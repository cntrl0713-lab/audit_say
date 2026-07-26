import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "./supabaseAdmin";

export async function getSupabaseServerClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}

export async function assertAdmin() {
    const { user } = await assertAuthenticated();

    // Now check role using admin client
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
        .from('user_cpa')
        .select('role')
        .eq('id', user.id)
        .single();

    if (error || !data || data.role !== 'ADMIN') {
        throw new Error('Forbidden: Admins only');
    }

    return true;
}

export async function assertAuthenticated() {
    if (process.env.DANGEROUSLY_BYPASS_AUTH_FOR_TESTS === 'true' && process.env.NODE_ENV !== 'production') {
        return { user: { id: 'test-user-id' } } as any;
    }
    const supabase = await getSupabaseServerClient();

    // getSession()이 아니라 getUser()를 쓴다. 서버에서 getSession()은 요청 쿠키를 그대로
    // 디코딩할 뿐 JWT 서명을 검증하지 않으므로, 위조된 쿠키로 임의의 user.id를 주장할 수
    // 있다 — assertAdmin이 그 id로 역할을 조회하기 때문에 관리자 UUID를 넣으면 권한 상승이
    // 가능하다. getUser()는 Auth 서버에 토큰을 보내 검증한다.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        throw new Error('Unauthorized');
    }
    return { user };
}

export async function assertSelf(userId: string) {
    const session = await assertAuthenticated();
    if (session.user.id !== userId) {
        throw new Error('Forbidden: User ID mismatch');
    }
    return session;
}

export type AuthenticatedSession = Awaited<ReturnType<typeof assertAuthenticated>>;
