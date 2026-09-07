import type { SupabaseClient } from '@supabase/supabase-js';
import { DartClient, DartError } from './dartClient.ts';
import {
    buildFirmIndex,
    countKamItems,
    matchFirm,
    normalizeAuditOpinion,
    parseDartAmount,
    parseDartDate,
    pickFinancials,
    type FnlttRow,
} from './normalize.ts';
import {
    loadRegisteredFirms,
    replaceServiceContracts,
    upsertAuditOpinion,
    upsertCompany,
    upsertEngagement,
    upsertFinancials,
    type ServiceContractInput,
} from './store.ts';

/**
 * 감사대상회사 파이프라인 (PRD §4.2-A, M1).
 *
 * 회사 하나·사업연도 하나마다
 *   감사의견 → 감사인 매칭 → 회사·engagement 적재 → 재무 3지표 → 감사/비감사 용역
 * 순으로 돈다. 실패한 회사가 있어도 배치 전체를 멈추지 않고 보고서에 남긴다 —
 * 수천 건짜리 배치에서 한 건 때문에 처음부터 다시 도는 건 낭비다.
 */

export interface EngagementReport {
    year: number;
    processed: number;
    /** 그 해 사업보고서(또는 감사의견 공시)가 없어 건너뛴 회사 */
    noReport: string[];
    /** 감사인명이 firm_registered 에 없어 적재하지 못한 건 */
    unmatchedAuditors: { corp_code: string; auditor: string }[];
    /** 감사의견 원문을 정규화하지 못한 건 (원문은 adt_opinion_raw 에 남는다) */
    unnormalizedOpinions: { corp_code: string; raw: string }[];
    financialsMissing: string[];
    errors: { corp_code: string; message: string }[];
}

export function emptyReport(year: number): EngagementReport {
    return {
        year,
        processed: 0,
        noReport: [],
        unmatchedAuditors: [],
        unnormalizedOpinions: [],
        financialsMissing: [],
        errors: [],
    };
}

export interface CollectEngagementsOptions {
    db: SupabaseClient;
    dart: DartClient;
    year: number;
    /** 대상 회사. corpCode.xml 에서 상장사만 추린 목록을 넘긴다. */
    companies: { corp_code: string; corp_name: string; stock_code: string | null }[];
    onProgress?: (done: number, total: number) => void;
}

export async function collectEngagements(
    options: CollectEngagementsOptions,
): Promise<EngagementReport> {
    const { db, dart, year, companies, onProgress } = options;
    const report = emptyReport(year);

    const firmIndex = buildFirmIndex(await loadRegisteredFirms(db));

    for (const [i, company] of companies.entries()) {
        try {
            const opinions = await dart.auditOpinion(company.corp_code, year);
            if (opinions.length === 0) {
                report.noReport.push(company.corp_code);
                continue;
            }

            // 한 회사·한 사업연도에 감사인이 둘 이상이면 공동감사다. 각각을 별개
            // engagement 로 적재한다 — rcept_no 는 같아도 natural key 가 다르다.
            for (const opinion of opinions) {
                const auditorRaw = opinion.adtor ?? '';
                const firmId = matchFirm(firmIndex, auditorRaw);
                if (firmId === null) {
                    report.unmatchedAuditors.push({
                        corp_code: company.corp_code,
                        auditor: auditorRaw,
                    });
                    continue;
                }

                await upsertCompany(db, {
                    corp_code: company.corp_code,
                    corp_name: opinion.corp_name?.trim() || company.corp_name,
                    corp_cls: opinion.corp_cls?.trim() || null,
                    stock_code: company.stock_code,
                    listed_yn: company.stock_code !== null,
                    induty: null,
                });

                const engagementId = await upsertEngagement(db, {
                    firm_id: firmId,
                    corp_code: company.corp_code,
                    bsns_year: year,
                    rcept_no: opinion.rcept_no?.trim() || null,
                });

                const rawOpinion = opinion.adt_opinion?.trim() || null;
                const normalized = normalizeAuditOpinion(rawOpinion);
                if (rawOpinion && normalized === null) {
                    report.unnormalizedOpinions.push({
                        corp_code: company.corp_code,
                        raw: rawOpinion,
                    });
                }

                const kamText = opinion.core_adt_matter?.trim() || null;
                await upsertAuditOpinion(db, {
                    engagement_id: engagementId,
                    adt_opinion: normalized,
                    adt_opinion_raw: rawOpinion,
                    emph_matter: opinion.emphs_matter?.trim() || null,
                    kam_text: kamText,
                    kam_count: countKamItems(kamText),
                });

                const accounts = (await dart.majorAccounts(company.corp_code, year)) as FnlttRow[];
                const financials = pickFinancials(accounts);
                if (financials.data_status === 'missing') {
                    report.financialsMissing.push(company.corp_code);
                }
                await upsertFinancials(db, {
                    engagement_id: engagementId,
                    ...financials,
                });

                await replaceServiceContracts(
                    db,
                    engagementId,
                    await collectContracts(dart, company.corp_code, year, engagementId),
                );

                report.processed += 1;
            }
        } catch (error) {
            // 인증키 문제는 다음 회사에서도 똑같이 터진다. 배치를 끌지 말고 즉시 멈춘다.
            if (error instanceof DartError && ['010', '011', '012', '901'].includes(error.status)) {
                throw error;
            }
            report.errors.push({
                corp_code: company.corp_code,
                message: error instanceof Error ? error.message : String(error),
            });
        } finally {
            onProgress?.(i + 1, companies.length);
        }
    }

    return report;
}

async function collectContracts(
    dart: DartClient,
    corpCode: string,
    year: number,
    engagementId: number,
): Promise<ServiceContractInput[]> {
    const contracts: ServiceContractInput[] = [];

    for (const row of await dart.auditServiceContracts(corpCode, year)) {
        contracts.push({
            engagement_id: engagementId,
            contract_type: 'audit',
            contract_date: null,
            // 감사용역은 계약일 대신 보수·시간이 온다. 내용 칸에 요약해 둔다.
            service_content: row.adt_cntrct_dtls_tot_tm
                ? `총소요시간 ${row.adt_cntrct_dtls_tot_tm}`
                : null,
            service_period: row.bsns_year?.trim() || String(year),
            service_fee: parseDartAmount(row.adt_cntrct_dtls_mtrpz),
        });
    }

    for (const row of await dart.nonAuditServiceContracts(corpCode, year)) {
        contracts.push({
            engagement_id: engagementId,
            contract_type: 'nonaudit',
            contract_date: parseDartDate(row.cntrct_cncls_de),
            service_content: row.servc_cn?.trim() || null,
            service_period: row.servc_exc_pd?.trim() || null,
            service_fee: parseDartAmount(row.servc_mnrt),
        });
    }

    return contracts;
}
