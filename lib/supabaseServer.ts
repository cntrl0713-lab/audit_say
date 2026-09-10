import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireAuditMembership } from "./accountRepository";

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
    const { membership } = await assertAuthenticated();
    if (!membership?.is_service_admin) {
        throw new Error('Forbidden: Admins only');
    }

    return true;
}

export async function assertAuthenticated() {
    const supabase = await getSupabaseServerClient();

    // getSession()이 아니라 getUser()를 쓴다. 서버에서 getSession()은 요청 쿠키를 그대로
    // 디코딩할 뿐 JWT 서명을 검증하지 않으므로, 위조된 쿠키로 임의의 user.id를 주장할 수
    // 있다 — assertAdmin이 그 id로 역할을 조회하기 때문에 관리자 UUID를 넣으면 권한 상승이
    // 가능하다. getUser()는 Auth 서버에 토큰을 보내 검증한다.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || (!user.is_anonymous && !user.email_confirmed_at)) {
        throw new Error('Unauthorized');
    }
    const membership = user.is_anonymous ? null : await requireAuditMembership(user.id);
    return { user, membership };
}
