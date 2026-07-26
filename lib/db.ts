import { supabase } from './supabase';

// 이 파일은 클라이언트 컴포넌트(contexts/AuthContext.tsx 등)에서도 import되므로
// anon 클라이언트(supabase)만 쓰는 함수만 둔다. admin 클라이언트가 필요한 함수는
// lib/dbAdmin.ts로 분리되어 있다 — 'server-only'가 이 파일에 섞이면 클라이언트
// 번들링 시 500 에러가 발생한다.
//
// 여기 남은 두 함수는 실제로 브라우저에서 실행되며(로그인 직후 자기 프로필 조회·생성),
// 사용자 세션으로 동작하므로 user_cpa의 "본인 행" RLS 정책이 적용된다.
// 나머지 조회(문제, 오답노트, 리더보드, 회원 목록)는 모두 서버에서 service role로
// 수행하므로 어떤 테이블도 anon에게 열어둘 필요가 없다. 필요한 정책은 supabase-rls.md 참고.

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

// --- Auth & User Profile Functions (브라우저에서 사용자 세션으로 실행) ---

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
