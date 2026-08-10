'use server';

import { assertAdmin, assertAuthenticated } from '../lib/supabaseServer';
import type { UserProfile } from '../lib/db';
import {
    checkUsernameExists,
    getAllUsers,
    getLeaderboardData,
    incrementProgress,
    updateUserRole,
} from '../lib/dbAdmin';
import { consumeGradeQuota } from '../lib/rateLimit';
import {
    classifyQuestionBankV3LoadError,
    findAuthoringQuestionSetV3,
    loadPublicQuestionSetsV3,
} from '../lib/questionV3Store';
import type { QuestionBankV3LoadErrorCode } from '../lib/questionV3Store';
import { gradeQuestionSetV3 } from '../lib/questionV3Grading';
import { isQuestionSetAnswerPayloadV3, type PublicQuestionSetV3 } from '../lib/questionV3';
import type { QuestionSetGradeResultV3 } from '../lib/questionV3Grading';

type GradeQuestionSetV3FailureCode =
    | 'rate_limited'
    | 'grading_key_missing'
    | `question_bank_${QuestionBankV3LoadErrorCode}`
    | 'grading_service_unavailable';

export type GradeQuestionSetV3ActionResult =
    | { ok: true; result: QuestionSetGradeResultV3 }
    | { ok: false; code: GradeQuestionSetV3FailureCode; message: string };

function questionBankFailureMessage(code: QuestionBankV3LoadErrorCode): string {
    if (code === 'file_missing') return '채점 문제은행 배포 파일을 찾을 수 없습니다.';
    if (code === 'key_missing') return '채점 문제은행 암호화 키가 운영 환경에 설정되지 않았습니다.';
    if (code === 'decryption_failed') return '채점 문제은행 복호화에 실패했습니다. 운영 암호화 키를 확인해 주세요.';
    return '채점 문제은행 데이터 검증에 실패했습니다.';
}

export async function getQuestionSetsV3(): Promise<PublicQuestionSetV3[]> {
    await assertAdmin();
    return loadPublicQuestionSetsV3();
}

export async function checkUsernameExistsAction(username: string): Promise<boolean> {
    const trimmed = (username || '').trim();
    if (!trimmed) return true;
    return checkUsernameExists(trimmed);
}

export async function gradeQuestionSetV3Action(
    questionSetId: string,
    answers: Record<string, string>,
): Promise<GradeQuestionSetV3ActionResult> {
    const session = await assertAuthenticated();

    if (typeof questionSetId !== 'string' || !/^pilot-\d{2}-\d{3}$/.test(questionSetId)) {
        throw new Error('유효하지 않은 v3 문제 세트 ID입니다.');
    }
    if (!isQuestionSetAnswerPayloadV3(answers)) {
        throw new Error('답안 데이터가 허용된 범위를 벗어났습니다.');
    }
    const answerEntries = Object.entries(answers);
    if (!await consumeGradeQuota(session.user.id)) {
        return { ok: false, code: 'rate_limited', message: '채점 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' };
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return { ok: false, code: 'grading_key_missing', message: 'AI 채점 서비스 설정이 누락되었습니다.' };
    }

    let questionSet;
    try {
        questionSet = findAuthoringQuestionSetV3(questionSetId);
    } catch (error) {
        const code = classifyQuestionBankV3LoadError(error);
        console.error(`[questionV3] authoring load failed (${code}):`, error);
        return {
            ok: false,
            code: `question_bank_${code}`,
            message: questionBankFailureMessage(code),
        };
    }
    const allowedAnswerIds = new Set(questionSet.subquestions.map((subquestion) => subquestion.id));
    if (answerEntries.some(([id]) => !allowedAnswerIds.has(id))) {
        throw new Error('문제 세트에 속하지 않는 답안이 포함되어 있습니다.');
    }
    let result: QuestionSetGradeResultV3;
    try {
        result = await gradeQuestionSetV3(questionSet, answers, apiKey);
    } catch (error) {
        console.error('[questionV3] grading service failed:', error);
        return { ok: false, code: 'grading_service_unavailable', message: 'AI 채점 서비스 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
    }
    if (result.score > 0) await incrementProgress(session.user.id, result.score);
    return { ok: true, result };
}

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
