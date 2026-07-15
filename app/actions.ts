'use server';

import { assertAdmin, assertSelf, assertAuthenticated } from '../lib/supabaseServer';

import { loadStructure, loadDb, gradeBatch, BatchItem } from '../lib/serverUtils';
import {
    saveReviewNote,
    incrementProgress,
    getLeaderboardData,
    getAllUsers,
    updateUserRole,
    getUserReviewNotes,
    deleteReviewNote,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    AuditQuestion,
    UserProfile,
    ReviewNote
} from '../lib/db';
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
    let allQuestions: any[] = [];
    if (qids.length > 0) {
        const { data } = await adminSupabase
            .from('cpa_questions')
            .select('id, model_answer')
            .in('id', qids);
        if (data) allQuestions = data;
    }

    // Hydrate the real model answer into each batch item by question id (see lib/quizGrading).
    hydrateModelAnswers(items, allQuestions);

    const results = await gradeBatch(items, apiKey);

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

export async function addQuestionAction(question: Omit<AuditQuestion, 'id'>): Promise<boolean> {
    await assertAdmin();
    return addQuestion(question);
}

export async function updateQuestionAction(id: number, question: Partial<AuditQuestion>): Promise<boolean> {
    await assertAdmin();
    return updateQuestion(id, question);
}

export async function deleteQuestionAction(id: number): Promise<boolean> {
    await assertAdmin();
    return deleteQuestion(id);
}
