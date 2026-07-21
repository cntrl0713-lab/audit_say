import { getSupabaseAdmin } from './supabaseAdmin';
import type { AuditQuestion } from './db';
import { validateRubric } from './rubric';

// 서버 전용(admin 클라이언트 사용) 함수 모음.
// lib/db.ts와 분리된 이유: db.ts는 클라이언트 컴포넌트(예: contexts/AuthContext.tsx)에서도
// import되는데, ES 모듈은 파일 단위로 번들링되므로 admin 클라이언트를 쓰는 함수가 같은 파일에
// 있으면 그 함수를 호출하지 않아도 'server-only' 임포트가 클라이언트 번들에 딸려 들어가 500
// 에러를 일으킨다. 이 파일은 반드시 'use server' 컨텍스트(app/actions.ts 등)에서만 import한다.

export async function incrementProgress(id: string, addedExp: number): Promise<boolean> {
    try {
        const adminSupabase = getSupabaseAdmin();

        // Transactional increment approach since Supabase SDK doesn't have a direct increment method
        // (If there are concurrency issues, RPC is better, but this solves the lost update over client state)
        const { data, error: selectError } = await adminSupabase
            .from('user_cpa')
            .select('exp')
            .eq('id', id)
            .single();

        if (selectError || !data) return false;

        const newExp = (data.exp || 0) + addedExp;
        const newLevel = 1 + Math.floor(newExp / 100);

        const { error } = await adminSupabase
            .from('user_cpa')
            .update({ level: newLevel, exp: newExp })
            .eq('id', id);

        if (error) {
            console.error('Error updating progress:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Error in incrementProgress:', err);
        return false;
    }
}

export async function saveReviewNote(
    userId: string,
    questionId: number,
    userAnswer: string,
    score: number
): Promise<boolean> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { error } = await adminSupabase
            .from('cpa_review_notes')
            .insert({
                user_id: userId,
                question_id: questionId,
                user_answer: userAnswer,
                score,
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error saving review note:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Error in saveReviewNote:', err);
        return false;
    }
}

export async function deleteReviewNote(noteId: number, userId: string): Promise<boolean> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { error } = await adminSupabase
            .from('cpa_review_notes')
            .delete()
            .eq('id', noteId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error deleting review note:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Error in deleteReviewNote:', err);
        return false;
    }
}

export async function updateUserRole(userId: string, newRole: string): Promise<boolean> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { error } = await adminSupabase
            .from('user_cpa')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            console.error('Error updating user role:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Error in updateUserRole:', err);
        return false;
    }
}

export async function updateQuestion(id: number, question: Partial<AuditQuestion> & { rubric?: string }): Promise<boolean> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const cleanData: any = {};

        if (question.part !== undefined) {
            const partVal = Number(question.part);
            if (!Number.isInteger(partVal)) {
                throw new Error('PART는 정수 형태여야 합니다.');
            }
            cleanData.part = partVal;
        }

        if (question.chapter !== undefined) {
            const chapterVal = Number(question.chapter);
            if (!Number.isInteger(chapterVal)) {
                throw new Error('CHAPTER는 정수 형태여야 합니다.');
            }
            cleanData.chapter = chapterVal;
        }

        if (question.standard !== undefined) cleanData.standard = question.standard;
        if (question.question_title !== undefined) cleanData.question_title = question.question_title;
        if (question.question_description !== undefined) cleanData.question_description = question.question_description;
        if (question.model_answer !== undefined) cleanData.model_answer = question.model_answer;
        if (question.explanation !== undefined) cleanData.explanation = question.explanation;

        // rubric 수정이 포함된 경우
        if (question.rubric !== undefined) {
            let parsedRubric: any;
            try {
                parsedRubric = JSON.parse(question.rubric);
            } catch (e: any) {
                throw new Error(`루브릭 JSON 파싱 실패: ${e.message}`);
            }

            const errors = validateRubric(parsedRubric);
            if (errors.length > 0) {
                throw new Error(`루브릭 검증 실패:\n${errors.join('\n')}`);
            }
            cleanData.rubric = parsedRubric;
        }

        const { error } = await adminSupabase
            .from('cpa_questions_v2')
            .update(cleanData)
            .eq('id', id);

        if (error) {
            console.error('Error updating question:', error);
            throw new Error(`DB 에러: ${error.message}`);
        }
        return true;
    } catch (err: any) {
        console.error('Error in updateQuestion:', err);
        throw err;
    }
}

export async function deleteQuestion(id: number): Promise<boolean> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { error } = await adminSupabase
            .from('cpa_questions_v2')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting question:', error);
            throw new Error(`DB 에러: ${error.message}`);
        }
        return true;
    } catch (err: any) {
        console.error('Error in deleteQuestion:', err);
        throw err;
    }
}
