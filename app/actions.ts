'use server';

import { assertAdmin, assertSelf, assertAuthenticated } from '../lib/supabaseServer';

import { loadStructure, loadDb, gradeBatch, GradeRequestItem } from '../lib/serverUtils';
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
import { runGradePipeline, type GradeBatchResponse } from '../lib/gradePipeline';
import { StructureData } from '../lib/utils';
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

export type { GradeBatchResponse } from '../lib/gradePipeline';

/**
 * 채점 요청의 관문 순서는 lib/gradePipeline의 runGradePipeline이 담당한다 (그 순서를
 * 테스트로 고정하기 위해 의존성 주입 형태로 분리해 뒀다). 여기서는 인증을 확인하고
 * 실제 구현을 연결하는 일만 한다.
 */
export async function gradeQuizBatch(items: GradeRequestItem[]): Promise<GradeBatchResponse> {
    const session = await assertAuthenticated();
    const userId = session.user.id;

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable is not defined on the server.');
    }

    return runGradePipeline(userId, items, GRADE_RATE_LIMIT, {
        getUserRole,
        consumeQuota: consumeGradeQuota,
        incrementProgress,
        gradeBatch: (batchItems) => gradeBatch(batchItems, apiKey),
        fetchQuestions: async (qids) => {
            const adminSupabase = getSupabaseAdmin();
            try {
                const { data, error } = await adminSupabase
                    .from('cpa_questions_v2')
                    .select('id, question_title, question_description, model_answer, rubric')
                    .in('id', qids);
                if (error) {
                    console.warn('⚠️ [gradeQuizBatch] cpa_questions_v2 조회 오류:', error.message);
                }
                return data || [];
            } catch (e: any) {
                console.warn('⚠️ [gradeQuizBatch] cpa_questions_v2 조회 중 예외:', e.message || e);
                return [];
            }
        },
    });
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
