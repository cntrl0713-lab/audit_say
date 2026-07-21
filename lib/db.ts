import { supabase } from './supabase';
import { flattenRubricVariants } from './rubric';

// 이 파일은 클라이언트 컴포넌트(contexts/AuthContext.tsx 등)에서도 import되므로
// anon 클라이언트(supabase)만 쓰는 함수만 둔다. admin 클라이언트가 필요한 함수는
// lib/dbAdmin.ts로 분리되어 있다 — 'server-only'가 이 파일에 섞이면 클라이언트
// 번들링 시 500 에러가 발생한다.

export interface UserProfile {
    id: string;
    username: string;
    role: 'MEMBER' | 'ADMIN' | 'PRO' | 'GUEST';
    level: number;
    exp: number;
    email?: string;
    created_at?: string;
}

export interface AuditQuestion {
    id: number;
    part: string;
    chapter: string;
    standard: string;
    question_title: string;
    question_description: string;
    model_answer: string | string[];
    explanation: string;
    keywords?: string[];
    rubric?: any;
}

export interface ReviewNote {
    id: number;
    user_id: string;
    question_id: number | null;
    user_answer: string;
    score: number;
    created_at: string;

    // Joined from audit_questions
    part?: string;
    chapter?: string;
    standard_code?: string;
    question_title?: string;
    question_description?: string;
    model_answer?: string | string[];
    explanation?: string;
}

// --- Auth & User Profile Functions ---

export async function getCombinedProfile(authUserId: string, authEmail?: string): Promise<UserProfile | null> {
    try {
        const { data, error } = await supabase
            .from('user_cpa')
            .select('*')
            .eq('id', authUserId)
            .single();

        if (error) {
            console.error('Profile fetch error:', error);
            return null;
        }

        return {
            id: data.id,
            username: data.username,
            role: data.role || 'MEMBER',
            level: data.level || 1,
            exp: data.exp || 0,
            email: authEmail,
        };
    } catch (err) {
        console.error('Error in getCombinedProfile:', err);
        return null;
    }
}

export async function createPublicProfile(userId: string, username: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('user_cpa')
            .insert({
                id: userId,
                username,
                role: 'MEMBER',
                level: 1,
                exp: 0,
            });

        if (error) {
            console.error('Error creating profile:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Error in createPublicProfile:', err);
        return false;
    }
}

export async function checkUsernameExists(username: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
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
        return false;
    }
}

// --- Review Notes Functions ---

export async function getUserReviewNotes(userId: string): Promise<ReviewNote[]> {
    try {
        const { data: notesData, error: notesError } = await supabase
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
            const { data: qData, error: qError } = await supabase
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

// --- Leaderboard & User List ---

export async function getLeaderboardData(): Promise<Omit<UserProfile, 'email'>[]> {
    try {
        const { data, error } = await supabase
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
        const { data, error } = await supabase
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

// --- Question Administration ---

export async function fetchAllQuestions(stripAnswers: boolean = true): Promise<AuditQuestion[]> {
    try {
        const v2SelectCols = stripAnswers
            ? 'id, part, chapter, standard, question_title, question_description'
            : '*';
        const { data: v2Data, error: v2Error } = await supabase
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

