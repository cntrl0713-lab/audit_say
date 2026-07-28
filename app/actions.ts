'use server';

import { assertAdmin, assertSelf, assertAuthenticated } from '../lib/supabaseServer';

import { loadStructure, loadDb, gradeBatch, GradeRequestItem, GradeResult } from '../lib/serverUtils';
import type { AuditQuestion, UserProfile, ReviewNote } from '../lib/db';
import {
    saveReviewNote,
    incrementProgress,
    updateUserRole,
    deleteReviewNote,
    updateQuestion,
    deleteQuestion,
    checkUsernameExists,
    getLeaderboardData,
    getAllUsers,
    getUserReviewNotes,
    getUserRole,
} from '../lib/dbAdmin';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { hydrateModelAnswers } from '../lib/quizGrading';
import { StructureData, sanitizeExpGain, validateGradeRequest } from '../lib/utils';
import { consumeGradeQuota, GRADE_RATE_LIMIT } from '../lib/rateLimit';

export async function getStructureData(): Promise<StructureData> {
    return loadStructure();
}

export async function getNormalizedQuestions(): Promise<AuditQuestion[]> {
    // 문제 본문은 로그인(비회원 익명 세션 포함)한 사용자에게만 준다. service role로 조회하게
    // 되면서 RLS가 더 이상 이 경로를 막아주지 않으므로 액션 자체에 관문을 둔다.
    await assertAuthenticated();
    return loadDb(true);
}

/** 가입 폼의 닉네임 중복 확인. 가입 전 호출이라 인증을 요구하지 않고 boolean만 돌려준다. */
export async function checkUsernameExistsAction(username: string): Promise<boolean> {
    const trimmed = (username || '').trim();
    if (!trimmed) return true; // 빈 닉네임은 사용 불가로 취급 (fail closed)
    return checkUsernameExists(trimmed);
}

export async function getAdminQuestions(): Promise<AuditQuestion[]> {
    await assertAdmin();
    return loadDb(false);
}

export interface GradeBatchResponse {
    results: { [id: number]: GradeResult };
    /** 이번 제출로 서버가 실제 적립한 경험치. 게스트이거나 적립할 점수가 없으면 0. */
    awardedExp: number;
}

export async function gradeQuizBatch(items: GradeRequestItem[]): Promise<GradeBatchResponse> {
    const session = await assertAuthenticated();
    const userId = session.user.id;
    const role = await getUserRole(userId);

    // 서버 액션은 누구나 POST할 수 있는 엔드포인트다. 화면의 등급별 문항 수 제한이나
    // textarea 길이는 방어선이 아니므로, 개수·길이·타입을 여기서 확인한 뒤에야
    // Gemini 호출로 넘어간다.
    const validationError = validateGradeRequest(items, role);
    if (validationError) {
        throw new Error(validationError);
    }

    if (!(await consumeGradeQuota(userId))) {
        throw new Error(`채점 요청이 너무 잦습니다. 분당 ${GRADE_RATE_LIMIT}회까지 채점할 수 있습니다.`);
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable is not defined on the server.');
    }

    // 프롬프트에 들어갈 값(질문 본문·모범 답안·루브릭)은 전부 여기서 조회한 DB 행으로
    // 확정한다 — 클라이언트가 보낸 값은 id·qid·답안뿐이다.
    const adminSupabase = getSupabaseAdmin();
    const qids = items.map(i => i.qid);
    let allQuestionsV2: any[] = [];
    try {
        const { data: dataV2, error: errorV2 } = await adminSupabase
            .from('cpa_questions_v2')
            .select('id, question_title, question_description, model_answer, rubric')
            .in('id', qids);
        if (dataV2) allQuestionsV2 = dataV2;
        if (errorV2) {
            console.warn('⚠️ [gradeQuizBatch] cpa_questions_v2 조회 오류:', errorV2.message);
        }
    } catch (e: any) {
        console.warn('⚠️ [gradeQuizBatch] cpa_questions_v2 조회 중 예외:', e.message || e);
    }

    // Hydrate the real question/model answer into each batch item by question id (see lib/quizGrading).
    const batchItems = hydrateModelAnswers(items, allQuestionsV2);

    const validItems = batchItems.filter(item => !item.invalid);
    const invalidItems = batchItems.filter(item => item.invalid);

    const results: { [id: number]: GradeResult } = {};
    for (const item of invalidItems) {
        results[item.id] = {
            score: -1,
            evaluation: `⚠️ 채점 불가: ${item.errorMsg || '루브릭 유효성 검증 실패'}`
        };
    }

    if (validItems.length > 0) {
        const validResults = await gradeBatch(validItems, apiKey);
        Object.assign(results, validResults);
    }

    // Inject the model answers back into the results payload to show on review page
    for (const [id, res] of Object.entries(results)) {
        const item = batchItems.find(i => i.id.toString() === id);
        if (item) {
            res.model_answer = item.m;
        }
    }

    // 경험치는 서버가 방금 매긴 점수로 직접 계산해 적립한다. 예전에는 클라이언트가 합계를
    // 보내는 별도 액션(updateUserProgressAction)이 있어서, 문제를 풀지 않고 그 액션만
    // 반복 호출하면 EXP와 레벨을 무제한으로 올릴 수 있었다.
    // 게스트(익명 세션)는 user_cpa에 행이 없으므로 적립 대상이 아니다.
    let awardedExp = 0;
    if (role !== 'GUEST') {
        // 채점 불가(-1)는 0점이 아니라 '점수 없음'이므로 합계에서 제외한다.
        const earned = Object.values(results).reduce((sum, r) => sum + Math.max(0, r.score), 0);
        const safeExp = sanitizeExpGain(earned);
        if (safeExp > 0 && await incrementProgress(userId, safeExp)) {
            awardedExp = safeExp;
        }
    }

    return { results, awardedExp };
}

export async function saveQuizNoteAction(userId: string, questionId: number, userAnswer: string, score: number) {
    await assertSelf(userId);
    return saveReviewNote(userId, questionId, userAnswer, score);
}

// updateUserProgressAction은 제거했다. 클라이언트가 계산한 경험치를 받아 적립하는 구조라,
// 문제를 풀지 않고 액션만 반복 호출해도 EXP·레벨이 무제한으로 올랐다. 경험치 적립은
// gradeQuizBatch가 서버에서 매긴 점수로만 이뤄진다.

export async function getLeaderboardAction(): Promise<Omit<UserProfile, 'email'>[]> {
    return getLeaderboardData();
}

export async function getAllUsersAction(): Promise<UserProfile[]> {
    await assertAdmin();
    return getAllUsers();
}

export async function updateUserRoleAction(userId: string, newRole: string): Promise<boolean> {
    await assertAdmin();

    const whitelist = ['MEMBER', 'ADMIN', 'PRO', 'GUEST'];
    if (!whitelist.includes(newRole)) {
        throw new Error('Invalid role');
    }

    return updateUserRole(userId, newRole);
}

export async function getUserReviewNotesAction(userId: string): Promise<ReviewNote[]> {
    await assertSelf(userId);
    return getUserReviewNotes(userId);
}

export async function deleteReviewNoteAction(noteId: number): Promise<boolean> {
    const session = await assertAuthenticated();
    return deleteReviewNote(noteId, session.user.id);
}

export async function updateQuestionAction(id: number, question: Partial<AuditQuestion> & { rubric?: string }): Promise<boolean> {
    await assertAdmin();
    return updateQuestion(id, question);
}

export async function deleteQuestionAction(id: number): Promise<boolean> {
    await assertAdmin();
    return deleteQuestion(id);
}
