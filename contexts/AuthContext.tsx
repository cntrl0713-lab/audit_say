'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCombinedProfile, createPublicProfile, checkUsernameExists, UserProfile } from '../lib/db';

interface AuthContextType {
    user: UserProfile | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (email: string, pass: string, username: string) => Promise<{ success: boolean; msg?: string; error?: string }>;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    loginAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (authUserId: string, email?: string) => {
        let profile = await getCombinedProfile(authUserId, email);

        // Error Recovery (Deadlock fix): Auth user exists, but DB profile is missing.
        if (!profile) {
            const fallbackUsername = email ? email.split('@')[0] : `user_${authUserId.substring(0, 8)}`;
            const recovered = await createPublicProfile(authUserId, fallbackUsername);
            if (recovered) {
                profile = await getCombinedProfile(authUserId, email);
            }
        }

        setUser(profile);
    };

    // 세션을 화면 표시용 사용자 상태로 변환.
    // 익명(게스트) 세션은 실제 Supabase 세션이지만 user_cpa에 영구 프로필을 만들지 않는다
    // (게스트는 학습 기록·오답노트가 보관되지 않는다는 기존 원칙 유지) — 화면 표시용
    // 고정 프로필만 세팅하고 DB 프로필 조회/생성 경로(fetchProfile)를 타지 않는다.
    const resolveSessionUser = async (session: { user: { id: string; email?: string; is_anonymous?: boolean } } | null) => {
        if (session?.user) {
            if (session.user.is_anonymous) {
                setUser({
                    id: session.user.id,
                    username: '비회원',
                    role: 'GUEST',
                    level: 1,
                    exp: 0,
                });
            } else {
                await fetchProfile(session.user.id, session.user.email);
            }
        } else {
            setUser(null);
        }
    };

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            resolveSessionUser(session).then(() => setLoading(false));
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            resolveSessionUser(session).then(() => setLoading(false));
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, pass: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: pass,
            });

            if (error) {
                return { success: false, error: error.message };
            }

            if (data.user) {
                await fetchProfile(data.user.id, data.user.email);
            }
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message || '로그인 중 오류가 발생했습니다.' };
        }
    };

    const signUp = async (email: string, pass: string, username: string) => {
        try {
            // 1. Check Username
            const exists = await checkUsernameExists(username);
            if (exists) {
                return { success: false, error: '이미 사용 중인 닉네임입니다.' };
            }

            // 2. Auth Sign Up
            const { data, error } = await supabase.auth.signUp({
                email,
                password: pass,
                options: {
                    data: { username },
                },
            });

            if (error) {
                return { success: false, error: error.message };
            }

            if (data.user) {
                // If there's no session, it means email confirmation is required.
                if (!data.session) {
                    return { success: true, msg: 'CHECK_EMAIL' };
                }

                const profileCreated = await createPublicProfile(data.user.id, username);
                if (profileCreated) {
                    await fetchProfile(data.user.id, data.user.email);
                    return { success: true, msg: 'SUCCESS' };
                } else {
                    return { success: false, error: '계정은 생성되었으나 프로필 설정에 실패했습니다.' };
                }
            }
            return { success: false, error: '가입을 처리하는 도중 사용자 정보가 반환되지 않았습니다.' };
        } catch (err: any) {
            return { success: false, error: err.message || '회원가입 중 오류가 발생했습니다.' };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    const refreshProfile = async () => {
        if (user?.id && user.role !== 'GUEST') {
            await fetchProfile(user.id, user.email);
        }
    };

    const loginAsGuest = async () => {
        try {
            // 실제 Supabase 익명 세션을 발급받아야 서버 측 assertAuthenticated()가
            // 통과한다 — 이전에는 sessionStorage 플래그만 세팅해 클라이언트만 게스트로
            // "보이고" 서버는 항상 Unauthorized를 던져 채점 자체가 동작하지 않았다.
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error || !data.user) {
                console.error('Guest login error:', error);
                return;
            }
            setUser({
                id: data.user.id,
                username: '비회원',
                role: 'GUEST',
                level: 1,
                exp: 0,
            });
        } catch (err) {
            console.error('Error in loginAsGuest:', err);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signUp, logout, refreshProfile, loginAsGuest }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
