import { getSupabaseAdmin } from './supabaseAdmin';
import type { AuditQuestion, UserProfile, ReviewNote } from './db';
import { validateRubric } from './rubric';

// 서버 전용(admin 클라이언트 사용) 함수 모음.
// lib/db.ts와 분리된 이유: db.ts는 클라이언트 컴포넌트(예: contexts/AuthContext.tsx)에서도
// import되는데, ES 모듈은 파일 단위로 번들링되므로 admin 클라이언트를 쓰는 함수가 같은 파일에
// 있으면 그 함수를 호출하지 않아도 'server-only' 임포트가 클라이언트 번들에 딸려 들어가 500
// 에러를 일으킨다. 이 파일은 반드시 'use server' 컨텍스트(app/actions.ts 등)에서만 import한다.
//
// 조회 함수들이 service role을 쓰는 이유: 이전에는 브라우저용 anon 클라이언트로 서버에서
// 조회했기 때문에 cpa_questions_v2·cpa_review_notes·user_cpa가 모두 anon에게 열려 있어야
// 동작했다. 그러면 공개된 anon 키만으로 Supabase에 직접 붙어 모범답안·루브릭·타인의
// 오답노트를 그대로 받아갈 수 있다. 호출자(app/actions.ts)가 이미 assertAdmin/assertSelf로
// 권한을 확인하므로, 여기서는 RLS를 우회하는 service role로 조회해 테이블을 전부 잠글 수 있게 한다.

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

        // exp는 정수 단위로만 누적한다. 루브릭 채점은 0.5점 단위 점수를 내므로 그대로 더하면
        // 소수 exp가 저장되고, exp 컬럼이 정수형이면 update 자체가 거부되어 경험치가 조용히
        // 오르지 않는다. 저장 직전 서버에서 반올림해 두 경우 모두를 막는다.
        const newExp = Math.round((data.exp || 0) + addedExp);
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
        // (user_id, question_id)에 유니크 제약이 있으므로 insert가 아니라 upsert를 쓴다.
        // 같은 문항을 다시 풀고 저장하면 최신 답안·점수로 갱신된다 — insert로 두면
        // 중복 저장 시 제약 위반이 나서 사용자에게는 "저장 실패"로만 보인다.
        // question_id가 NULL인 고아 노트는 NULL이 서로 distinct해 제약에 걸리지 않고
        // 항상 새 행으로 쌓인다(의도된 동작).
        const { error } = await adminSupabase
            .from('cpa_review_notes')
            .upsert({
                user_id: userId,
                question_id: questionId,
                user_answer: userAnswer,
                score,
                created_at: new Date().toISOString()
            }, { onConflict: 'user_id,question_id' });

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

// --- 조회 (호출자가 권한을 검증한 뒤 service role로 수행) ---

export async function checkUsernameExists(username: string): Promise<boolean> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { data, error } = await adminSupabase
            .from('user_cpa')
            .select('username')
            .eq('username', username);

        if (error) {
            console.error('Error checking username:', error);
            return true; // Fail closed: assume exists to prevent overlaps
        }
        return data.length > 0;
    } catch (err) {
        console.error('Error in checkUsernameExists:', err);
        return true; // 위 error 분기와 동일하게 fail closed — 예외 시 중복을 통과시키지 않는다.
    }
}

export interface UserRoleLookup {
    role: UserProfile['role'];
    /**
     * 조회가 실제로 성공했는지. false면 role은 fail-closed 기본값(GUEST)일 뿐
     * "이 사용자가 게스트임을 확인했다"는 뜻이 아니다.
     */
    known: boolean;
}

/**
 * 사용자의 등급을 조회한다. 채점 요청의 문항 수 상한과 경험치 적립 여부를 서버에서
 * 판단하는 데 쓴다.
 *
 * 익명(게스트) 세션은 user_cpa에 행이 없다 — 행이 없는 것은 오류가 아니라 확정된
 * 'GUEST'다(known: true). 반면 조회 자체가 실패한 경우는 등급을 모르는 것이므로
 * known: false로 구분해서 돌려준다. 둘을 뭉뚱그리면, 일시적인 DB 오류가 정상 사용자의
 * 경험치를 오류 표시 하나 없이 조용히 0으로 만든다.
 */
export async function getUserRole(userId: string): Promise<UserRoleLookup> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { data, error } = await adminSupabase
            .from('user_cpa')
            .select('role')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error getting user role:', error);
            return { role: 'GUEST', known: false };
        }
        // 행이 없으면(익명 세션) 확정된 게스트다.
        return { role: (data?.role as UserProfile['role']) || 'GUEST', known: true };
    } catch (err) {
        console.error('Error in getUserRole:', err);
        return { role: 'GUEST', known: false };
    }
}

export async function getUserReviewNotes(userId: string): Promise<ReviewNote[]> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { data: notesData, error: notesError } = await adminSupabase
            .from('cpa_review_notes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (notesError) {
            console.error('Error getting review notes:', notesError);
            throw new Error(`Failed to load review notes: ${notesError.message}`);
        }

        const notes = notesData || [];
        const questionIds = Array.from(
            new Set(notes.map((n: any) => n.question_id).filter((id: any) => id !== null))
        );

        const questionMap = new Map<number, any>();
        if (questionIds.length > 0) {
            const { data: qData, error: qError } = await adminSupabase
                .from('cpa_questions_v2')
                .select('*')
                .in('id', questionIds);

            if (qError) {
                console.error('Error getting v2 questions for review notes:', qError);
            } else if (qData) {
                qData.forEach((q: any) => {
                    questionMap.set(Number(q.id), q);
                });
            }
        }

        return notes.map((item: any) => {
            const q = item.question_id !== null ? questionMap.get(Number(item.question_id)) : undefined;
            return {
                id: item.id,
                user_id: item.user_id,
                question_id: item.question_id,
                user_answer: item.user_answer,
                score: item.score,
                created_at: item.created_at,
                part: q ? String(q.part) : 'Unknown/Deleted',
                chapter: q ? String(q.chapter) : 'Unknown',
                standard_code: q ? q.standard : 'Unknown',
                question_title: q ? q.question_title : 'Unknown Title',
                question_description: q ? q.question_description : '(문제 내용 없음)',
                model_answer: q ? (q.model_answer || []) : [],
                explanation: q ? (q.explanation || '') : '해설 없음',
            };
        });
    } catch (err) {
        console.error('Error in getUserReviewNotes:', err);
        throw err;
    }
}

export async function getLeaderboardData(): Promise<Omit<UserProfile, 'email'>[]> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { data, error } = await adminSupabase
            .from('user_cpa')
            .select('id, username, role, level, exp')
            .order('exp', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error getting leaderboard:', error);
            throw new Error(`Failed to load leaderboard: ${error.message}`);
        }
        return data || [];
    } catch (err) {
        console.error('Error in getLeaderboardData:', err);
        throw err;
    }
}

export async function getAllUsers(): Promise<UserProfile[]> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { data, error } = await adminSupabase
            .from('user_cpa')
            .select('*')
            .order('username', { ascending: true });

        if (error) {
            console.error('Error getting all users:', error);
            throw new Error(`Failed to load users: ${error.message}`);
        }
        return data || [];
    } catch (err) {
        console.error('Error in getAllUsers:', err);
        throw err;
    }
}

export async function fetchAllQuestions(stripAnswers: boolean = true): Promise<AuditQuestion[]> {
    try {
        const adminSupabase = getSupabaseAdmin();
        // stripAnswers일 때 컬럼 자체를 선택하지 않는다 — service role은 RLS를 우회하므로
        // 응답에서 답을 지우는 게 아니라 애초에 가져오지 않는 것이 유일한 방어선이다.
        const v2SelectCols = stripAnswers
            ? 'id, part, chapter, standard, question_title, question_description'
            : '*';
        const { data: v2Data, error: v2Error } = await adminSupabase
            .from('cpa_questions_v2')
            .select(v2SelectCols)
            .order('id', { ascending: true });

        if (v2Error) {
            console.error('Error loading v2 questions:', v2Error);
            return [];
        }

        const questions: AuditQuestion[] = (v2Data || []).map((q: any) => ({
            id: q.id,
            part: String(q.part),
            chapter: String(q.chapter),
            standard: q.standard,
            question_title: q.question_title,
            question_description: q.question_description,
            model_answer: q.model_answer || [],
            explanation: q.explanation || '',
            // v2 rubric의 variants·배점 등 채점 근거는 클라이언트에 노출하지 않는다 (기존 leak 방지 원칙 유지).
            keywords: [],
            rubric: stripAnswers ? undefined : q.rubric,
        }));

        questions.sort((a, b) => Number(a.id) - Number(b.id));

        return questions;
    } catch (err) {
        console.error('Error in fetchAllQuestions:', err);
        return [];
    }
}
