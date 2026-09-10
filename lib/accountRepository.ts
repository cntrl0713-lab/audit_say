import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import { AccountError, activeAuditMembership, type AuditMembership, type CommonProfile } from './accountPolicy';

export async function readAccountProfile(userId: string): Promise<CommonProfile | null> {
    const { data, error } = await getSupabaseAdmin().from('common_profiles').select('id,nickname,account_status').eq('id', userId).maybeSingle();
    if (error) throw new AccountError('통합 계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
    return data as CommonProfile | null;
}
export async function readAuditMembership(userId: string): Promise<AuditMembership | null> {
    const { data, error } = await getSupabaseAdmin().from('cpa_users')
        .select('id,membership_status,membership_version,is_service_admin,role,level,exp').eq('id', userId).maybeSingle();
    if (error) throw new AccountError('감사 서비스 가입 정보를 불러오지 못했습니다.', 503);
    return data as AuditMembership | null;
}
export async function requireAuditMembership(userId: string): Promise<AuditMembership> {
    const [profile, member] = await Promise.all([readAccountProfile(userId), readAuditMembership(userId)]);
    return activeAuditMembership(profile, member);
}
export async function accountRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await getSupabaseAdmin().rpc(name, args);
    if (error) {
        if (error.code === '23505') throw new AccountError('이미 사용 중인 닉네임입니다.');
        console.error(`[account] ${name} failed (${error.code ?? 'unknown'})`);
        throw new AccountError('요청을 완료하지 못했습니다. 계정과 서비스 상태를 새로고침한 뒤 다시 시도해 주세요.', 409);
    }
    return data as T;
}
