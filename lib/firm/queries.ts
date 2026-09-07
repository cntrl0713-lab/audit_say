import 'server-only';
import { getSupabaseServerClient } from '../supabaseServer';
import type { FirmCompany, RegisteredFirm } from './types';

// 공시 도메인은 anon SELECT 가 열려 있으므로(PRD §8) 관리자 클라이언트를 쓰지 않는다.
// 로그인 여부와 무관하게 같은 결과가 나와야 하는 공개 데이터다.

export async function listRegisteredFirms(): Promise<RegisteredFirm[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('firm_registered')
        .select('firm_id, firm_name, registration_no, tier, alias, status, dart_corp_code')
        .eq('status', 'active')
        .order('firm_name');

    if (error) throw new Error(`등록회계법인 목록 조회 실패: ${error.message}`);
    return data ?? [];
}

export async function getRegisteredFirm(firmId: number): Promise<RegisteredFirm | null> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('firm_registered')
        .select('firm_id, firm_name, registration_no, tier, alias, status, dart_corp_code')
        .eq('firm_id', firmId)
        .maybeSingle();

    if (error) throw new Error(`회계법인 조회 실패: ${error.message}`);
    return data;
}

export async function listCompanies(limit = 100): Promise<FirmCompany[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('firm_company')
        .select('corp_code, corp_name, corp_cls, stock_code, listed_yn, induty')
        .order('corp_name')
        .limit(limit);

    if (error) throw new Error(`회사 목록 조회 실패: ${error.message}`);
    return data ?? [];
}

export async function getCompany(corpCode: string): Promise<FirmCompany | null> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('firm_company')
        .select('corp_code, corp_name, corp_cls, stock_code, listed_yn, induty')
        .eq('corp_code', corpCode)
        .maybeSingle();

    if (error) throw new Error(`회사 조회 실패: ${error.message}`);
    return data;
}
