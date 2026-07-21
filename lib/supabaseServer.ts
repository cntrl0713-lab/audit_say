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
    const supabase = await getSupabaseServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session || !session.user) {
        throw new Error('Unauthorized');
    }

    // Now check role using admin client
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
        .from('user_cpa')
        .select('role')
        .eq('id', session.user.id)
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
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session || !session.user) {
        throw new Error('Unauthorized');
    }
    return session;
}

export async function assertSelf(userId: string) {
    const session = await assertAuthenticated();
    if (session.user.id !== userId) {
        throw new Error('Forbidden: User ID mismatch');
    }
    return session;
}
