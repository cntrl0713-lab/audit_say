import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
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
        const { data, error } = await supabase
            .from('cpa_questions')
            .select('*')
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
