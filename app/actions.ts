'use server';

import { assertAdmin, assertSelf, assertAuthenticated } from '../lib/supabaseServer';

import { loadStructure, loadDb, gradeBatch, BatchItem, GradeResult } from '../lib/serverUtils';
import {
    getLeaderboardData,
    getAllUsers,
    getUserReviewNotes,
    AuditQuestion,
    UserProfile,
    ReviewNote
} from '../lib/db';
import {
    saveReviewNote,
    incrementProgress,
    updateUserRole,
    deleteReviewNote,
    updateQuestion,
    deleteQuestion,
} from '../lib/dbAdmin';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { hydrateModelAnswers } from '../lib/quizGrading';
import { StructureData } from '../lib/utils';

export async function getStructureData(): Promise<StructureData> {
    return loadStructure();
}

export async function getNormalizedQuestions(): Promise<AuditQuestion[]> {
    return loadDb(true);
}

export async function getAdminQuestions(): Promise<AuditQuestion[]> {
    await assertAdmin();
    return loadDb(false);
}

const gradeRateLimiter = new Map<string, { count: number, resetAt: number }>();

export async function gradeQuizBatch(items: BatchItem[]) {
    const session = await assertAuthenticated();
    const userId = session.user.id;
    const now = Date.now();
    const limit = gradeRateLimiter.get(userId);

    if (limit && now < limit.resetAt) {
        if (limit.count >= 10) {
            throw new Error('Rate limit exceeded: You can only grade 10 times per minute.');
        }
        limit.count++;
    } else {
        gradeRateLimiter.set(userId, { count: 1, resetAt: now + 60000 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable is not defined on the server.');
    }

    // Fetch questions without strip to access model answers internally.
    const adminSupabase = getSupabaseAdmin();
    const qids = items.map(i => i.qid);
    let allQuestionsV2: any[] = [];
    if (qids.length > 0) {
        // v2 조회
        try {
            const { data: dataV2, error: errorV2 } = await adminSupabase
                .from('cpa_questions_v2')
                .select('id, model_answer, rubric')
                .in('id', qids);
            if (dataV2) allQuestionsV2 = dataV2;
            if (errorV2) {
                console.warn('⚠️ [gradeQuizBatch] cpa_questions_v2 조회 오류:', errorV2.message);
            }
        } catch (e: any) {
            console.warn('⚠️ [gradeQuizBatch] cpa_questions_v2 조회 중 예외:', e.message || e);
        }
    }

    // Hydrate the real model answer into each batch item by question id (see lib/quizGrading).
    hydrateModelAnswers(items, allQuestionsV2);

    const validItems = items.filter(item => !item.invalid);
    const invalidItems = items.filter(item => item.invalid);

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
        const item = items.find(i => i.id.toString() === id);
        if (item) {
            res.model_answer = item.m;
        }
    }

    return results;
}

export async function saveQuizNoteAction(userId: string, questionId: number, userAnswer: string, score: number) {
    await assertSelf(userId);
    return saveReviewNote(userId, questionId, userAnswer, score);
}

export async function updateUserProgressAction(userId: string, addedExp: number) {
    await assertSelf(userId);
    return incrementProgress(userId, addedExp);
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
