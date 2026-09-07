import type { SupabaseClient } from '@supabase/supabase-js';
import { DartClient, DartError } from './dartClient.ts';
import {
    buildFirmIndex,
    countKamItems,
    matchFirm,
    normalizeAuditOpinion,
    pickFinancials,
    type FnlttRow,
} from './normalize.ts';
import {
    loadRegisteredFirms,
    upsertAuditOpinion,
    upsertCompany,
    upsertEngagement,
    upsertFinancials,
} from './store.ts';
import { currentPeriod, hasAuditor, mergeCurrentOpinions, requireFields } from './responseMapping.ts';

/**
 * 감사대상회사 파이프라인 (PRD §4.2-A, M1).
 *
 * 회사 하나·사업연도 하나마다
 *   당기 감사의견 → 감사인 매칭 → 회사·engagement 적재 → 재무 3지표
 * 순으로 돈다. 실패한 회사가 있어도 배치 전체를 멈추지 않고 보고서에 남긴다 —
 * 수천 건짜리 배치에서 한 건 때문에 처음부터 다시 도는 건 낭비다.
 */

export interface EngagementReport {
    year: number;
    processed: number;
    /** 그 해 사업보고서(또는 감사의견 공시)가 없어 건너뛴 회사 */
    noReport: string[];
    noAuditor: string[];
    /** 감사인명이 firm_registered 에 없어 적재하지 못한 건 */
    unmatchedAuditors: { corp_code: string; auditor: string }[];
    /** 감사의견 원문을 정규화하지 못한 건 (원문은 adt_opinion_raw 에 남는다) */
    unnormalizedOpinions: { corp_code: string; raw: string }[];
    financialsMissing: string[];
    financialsUnsupportedCurrency: string[];
    errors: { corp_code: string; message: string }[];
    completedCorps: string[];
}

export function emptyReport(year: number): EngagementReport {
    return {
        year,
        processed: 0,
        noReport: [],
        noAuditor: [],
        unmatchedAuditors: [],
        unnormalizedOpinions: [],
        financialsMissing: [],
        financialsUnsupportedCurrency: [],
        errors: [],
        completedCorps: [],
    };
}

export interface CollectEngagementsOptions {
    db: SupabaseClient;
    dart: DartClient;
    year: number;
    /** 대상 회사. corpCode.xml 에서 상장사만 추린 목록을 넘긴다. */
    companies: { corp_code: string; corp_name: string; stock_code: string | null }[];
    onProgress?: (done: number, total: number) => void;
    onCheckpoint?: (report: EngagementReport) => void | Promise<void>;
    initialReport?: EngagementReport;
    concurrency?: number;
}

export async function collectEngagements(
    options: CollectEngagementsOptions,
): Promise<EngagementReport> {
    const { db, dart, year, companies, onProgress } = options;
    const report = options.initialReport ?? emptyReport(year);
    report.noAuditor ??= [];
    report.financialsUnsupportedCurrency ??= [];
    if (report.year !== year) throw new Error('재개 보고서의 사업연도가 다릅니다.');
    const retrying = new Set(companies.map((company) => company.corp_code));
    report.errors = report.errors.filter((entry) => !retrying.has(entry.corp_code));

    const firmIndex = buildFirmIndex(await loadRegisteredFirms(db));

    let next = 0;
    let done = 0;
    let fatal: unknown;
    const concurrency = Math.max(1, Math.min(8, options.concurrency ?? 1));
    const worker = async () => {
      while (next < companies.length && !fatal) {
        const company = companies[next++];
        try {
            const opinions = await dart.auditOpinion(company.corp_code, year);
            if (opinions.length === 0) {
                report.noReport.push(company.corp_code);
                report.completedCorps.push(company.corp_code);
                continue;
            }

            requireFields(opinions, ['adtor', 'bsns_year'], 'auditOpinion');
            if (!opinions.some(hasAuditor)) {
                report.noAuditor.push(company.corp_code);
                report.completedCorps.push(company.corp_code);
                continue;
            }
            const current = mergeCurrentOpinions(currentPeriod(opinions, year).rows);
            if (!current.length) {
                report.noAuditor.push(company.corp_code);
                report.completedCorps.push(company.corp_code);
                continue;
            }
            // Fetch once per company, including unmatched auditors, so alias repair can replay from cache.
            const accounts = (await dart.majorAccounts(company.corp_code, year)) as FnlttRow[];
            requireFields(accounts as Record<string, string>[], ['fs_div', 'account_nm', 'thstrm_amount'], 'majorAccounts');
            const financials = pickFinancials(accounts);

            // 한 회사·한 사업연도에 감사인이 둘 이상이면 공동감사다. 각각을 별개
            // engagement 로 적재한다 — rcept_no 는 같아도 natural key 가 다르다.
            for (const opinion of current) {
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
                    listed_yn: ['Y', 'K', 'N'].includes(opinion.corp_cls?.trim()),
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

                if (financials.data_status === 'missing') {
                    report.financialsMissing.push(company.corp_code);
                }
                if (financials.data_status === 'parse_failed') report.financialsUnsupportedCurrency.push(company.corp_code);
                await upsertFinancials(db, {
                    engagement_id: engagementId,
                    ...financials,
                });

                report.processed += 1;
            }
            report.completedCorps.push(company.corp_code);
        } catch (error) {
            // 인증키 문제는 다음 회사에서도 똑같이 터진다. 배치를 끌지 말고 즉시 멈춘다.
            if (error instanceof DartError && ['010', '011', '012', '020', '901'].includes(error.status)) {
                fatal = error;
                report.errors.push({ corp_code: company.corp_code, message: error.message });
                return;
            }
            report.errors.push({
                corp_code: company.corp_code,
                message: error instanceof Error ? error.message : String(error),
            });
        } finally {
            await options.onCheckpoint?.(report);
            onProgress?.(++done, companies.length);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    if (fatal) throw fatal;

    return report;
}
