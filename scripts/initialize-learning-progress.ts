import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const hostIndex = args.indexOf('--project-host');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!args.includes('--apply') || !url || !key || hostIndex < 0 || new URL(url).hostname !== args[hostIndex + 1]) {
    throw new Error('--apply --project-host <Supabase host> 및 서버 연결 설정이 필요합니다. 새 DB 앱 배포와 함께 전환하세요.');
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function main() {
    const { data, error } = await client.rpc('cpa_initialize_learning_progress');
    if (error) throw new Error(`경험치 전환 실패 (${error.code || 'unknown'})`);
    console.log(JSON.stringify({ initialized_profiles: data, legacy_direct_exp_updates_blocked: true }));
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : '경험치 전환 실패');
    process.exitCode = 1;
});
