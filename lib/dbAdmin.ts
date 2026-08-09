import { getSupabaseAdmin } from './supabaseAdmin';
import type { UserProfile } from './db';

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

export async function checkUsernameExists(username: string): Promise<boolean> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { data, error } = await adminSupabase
            .from('user_cpa')
            .select('username')
            .eq('username', username);

        if (error) {
            console.error('Error checking username:', error);
            return true;
        }
        return data.length > 0;
    } catch (err) {
        console.error('Error in checkUsernameExists:', err);
        return true;
    }
}

export async function getLeaderboardData(): Promise<Omit<UserProfile, 'email'>[]> {
    const adminSupabase = getSupabaseAdmin();
    const { data, error } = await adminSupabase
        .from('user_cpa')
        .select('id, username, role, level, exp')
        .order('exp', { ascending: false })
        .limit(10);

    if (error) throw new Error(`Failed to load leaderboard: ${error.message}`);
    return data || [];
}

export async function getAllUsers(): Promise<UserProfile[]> {
    const adminSupabase = getSupabaseAdmin();
    const { data, error } = await adminSupabase
        .from('user_cpa')
        .select('*')
        .order('username', { ascending: true });

    if (error) throw new Error(`Failed to load users: ${error.message}`);
    return data || [];
}
