import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { assertAdmin } from '../../../lib/supabaseServer';

export async function GET() {
    if (process.env.NODE_ENV === 'production') {
        try {
            await assertAdmin();
        } catch {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
    }
    // 1. Check environment variables
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'missing';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'exists (masked)' : 'missing';
    const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'exists (masked)' : 'missing';

    // 2. Test Supabase connection
    let dbStatus = 'untested';
    let dbError = null;
    let dataCount = 0;

    try {
        // 앱이 실제로 쓰는 경로(service role)로 연결을 확인해야 진단값이 의미가 있다.
        // 행 내용은 응답에 담지 않고 개수만 센다.
        const { data, error } = await getSupabaseAdmin()
            .from('cpa_questions_v2')
            .select('id')
            .limit(1);

        if (error) {
            dbStatus = 'error';
            dbError = error;
        } else {
            dbStatus = 'success';
            dataCount = data.length;
        }
    } catch (e: any) {
        dbStatus = 'exception';
        dbError = e.message;
    }

    return NextResponse.json({
        env: {
            NEXT_PUBLIC_SUPABASE_URL: url,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
            SUPABASE_SERVICE_ROLE_KEY: roleKey
        },
        database_test: {
            status: dbStatus,
            dataCount: dataCount,
            error: dbError
        }
    });
}
