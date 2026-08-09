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
import { findAuthoringQuestionSetV3, loadPublicQuestionSetsV3 } from '../lib/questionV3Store';
import { gradeQuestionSetV3 } from '../lib/questionV3Grading';
import type { PublicQuestionSetV3 } from '../lib/questionV3';
import type { QuestionSetGradeResultV3 } from '../lib/questionV3Grading';

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
): Promise<QuestionSetGradeResultV3> {
    const session = await assertAuthenticated();

    if (typeof questionSetId !== 'string' || !/^pilot-\d{2}-\d{3}$/.test(questionSetId)) {
        throw new Error('유효하지 않은 v3 문제 세트 ID입니다.');
    }
    if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
        throw new Error('답안 데이터 형식이 올바르지 않습니다.');
    }
    const answerEntries = Object.entries(answers);
    if (
        answerEntries.length > 10
        || answerEntries.some(([id, answer]) => !/^pilot-\d{2}-\d{3}\.q\d+$/.test(id)
            || typeof answer !== 'string'
            || answer.length > 5000)
    ) {
        throw new Error('답안 데이터가 허용된 범위를 벗어났습니다.');
    }
    if (!await consumeGradeQuota(session.user.id)) {
        throw new Error('채점 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY environment variable is not defined on the server.');

    const questionSet = findAuthoringQuestionSetV3(questionSetId);
    const allowedAnswerIds = new Set(questionSet.subquestions.map((subquestion) => subquestion.id));
    if (answerEntries.some(([id]) => !allowedAnswerIds.has(id))) {
        throw new Error('문제 세트에 속하지 않는 답안이 포함되어 있습니다.');
    }
    const result = await gradeQuestionSetV3(questionSet, answers, apiKey);
    if (result.score > 0) await incrementProgress(session.user.id, result.score);
    return result;
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
