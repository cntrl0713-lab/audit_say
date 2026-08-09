import { supabase } from './supabase';

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
