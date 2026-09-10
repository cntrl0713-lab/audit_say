'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../lib/db';
import type { AccountSnapshot } from '../lib/accountPolicy';

interface AuthContextType {
    user: UserProfile | null;
    account: AccountSnapshot | null;
    loading: boolean;
    login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (email: string, password: string, nickname: string) => Promise<{ success: boolean; msg?: string; error?: string }>;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    loginAsGuest: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function accountRequest(operation: string, body: Record<string, unknown>) {
    const response = await fetch('/api/account/' + operation, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '계정 요청을 완료하지 못했습니다.');
    return result;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [account, setAccount] = useState<AccountSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const requestVersion = useRef(0);

    const refreshProfile = useCallback(async () => {
        const version = ++requestVersion.current;
        try {
            const response = await fetch('/api/account', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000) });
            if (response.ok) {
                const value: AccountSnapshot = await response.json();
                if (version !== requestVersion.current) return;
                setAccount(value);
                if (value.accountStatus === 'active' && value.membership?.status === 'active') {
                    setUser({ id: value.user.id, email: value.user.email, username: value.user.nickname,
                        role: value.membership.role, level: value.progress.level, exp: value.progress.exp });
                } else setUser(null);
                return;
            }
            if (response.status !== 401) throw new Error('계정 상태 확인 실패');
            const { data: { session } } = await supabase.auth.getSession();
            if (version !== requestVersion.current) return;
            setAccount(null);
            setUser(session?.user.is_anonymous ? { id: session.user.id, username: '비회원', role: 'GUEST', level: 1, exp: 0 } : null);
        } catch {
            if (version !== requestVersion.current) return;
            setAccount(null); setUser(null);
        } finally { if (version === requestVersion.current) setLoading(false); }
    }, []);

    useEffect(() => {
        queueMicrotask(() => { void refreshProfile(); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            // Do not await Auth calls inside its lock-owning callback.
            queueMicrotask(() => { void refreshProfile(); });
        });
        const onFocus = () => { void refreshProfile(); };
        window.addEventListener('focus', onFocus);
        return () => { requestVersion.current++; subscription.unsubscribe(); window.removeEventListener('focus', onFocus); };
    }, [refreshProfile]);

    async function login(identifier: string, password: string) {
        try { await accountRequest('login', { identifier, password }); await refreshProfile(); return { success: true }; }
        catch (error) { return { success: false, error: error instanceof Error ? error.message : '로그인에 실패했습니다.' }; }
    }
    async function signUp(email: string, password: string, nickname: string) {
        try {
            const result = await accountRequest('signup', { email, password, nickname });
            if (result.msg === 'SUCCESS') await refreshProfile();
            return { success: true, msg: result.msg };
        } catch (error) { return { success: false, error: error instanceof Error ? error.message : '회원가입에 실패했습니다.' }; }
    }
    async function logout() {
        await accountRequest('logout', {});
        await supabase.auth.signOut({ scope: 'local' });
        requestVersion.current++; setUser(null); setAccount(null);
    }
    async function loginAsGuest() {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw new Error('비회원 체험을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        await refreshProfile();
    }
    return <AuthContext.Provider value={{ user, account, loading, login, signUp, logout, refreshProfile, loginAsGuest }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
