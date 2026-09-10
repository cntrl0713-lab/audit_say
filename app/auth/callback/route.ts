import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { siteOrigin, recoveryKey } from '@/lib/accountServer';
import { issueRecoveryGrant, RECOVERY_COOKIE, RECOVERY_TTL_SECONDS } from '@/lib/accountRecovery';

export async function GET(request: Request) {
    const origin = siteOrigin(request);
    const code = new URL(request.url).searchParams.get('code');
    if (code && code.length < 4096) {
        const client = await getSupabaseServerClient();
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (!error && data.session && data.user) {
            const recovery = 'redirectType' in data && data.redirectType === 'recovery';
            const response = NextResponse.redirect(`${origin}${recovery ? '/auth/reset-password' : '/account'}`);
            response.headers.set('Cache-Control', 'private, no-store');
            if (recovery) response.cookies.set(RECOVERY_COOKIE, issueRecoveryGrant(data.user.id, data.session.access_token, recoveryKey()), {
                httpOnly: true, secure: new URL(origin).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: RECOVERY_TTL_SECONDS,
            });
            return response;
        }
    }
    return NextResponse.redirect(`${origin}/account/recovery?error=expired`);
}
