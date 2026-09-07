import type { Cell, ParsedDocument, TableGroup } from './dartXml.ts';
import { classifyFirmSegment, normalizeAuditOpinion, parseDartAmount, parseDartCount, parseDartDate } from './normalize.ts';

export type AnnualRow = Record<string, string | number | boolean | null>;
export interface AnnualResult {
    corpCode: string; fyEndDate: string; year: number; source: string;
    profile: AnnualRow; workforce: AnnualRow; tables: Record<string, AnnualRow[]>;
    hardFailures: string[]; consistencyWarnings: string[];
}
export const PRIVATE_ANNUAL_TABLES = ['firm_director', 'firm_director_pay'] as const;
// 1.8 원문 231건의 수집 대상 그룹/필드키·단위를 6.0과 대조했다.
export const SUPPORTED_ANNUAL_FORM_VERSIONS = ['1.8', '6.0'] as const;
export const PUBLIC_FORM_GROUPS = ['TG_RVN_DTL', 'TG_HR_TOT', 'TG_HR_CHG', 'TG_HR_CR', 'TG_BSAL', 'TG_COST', 'TG_ARCD_TOT', 'TG_ARCD_SA', 'TG_ARCD_SRA', 'TG_ARCD_SADO', 'TG_PUT'];
export const ANNUAL_TABLES = ['firm_personnel_cost_yearly', 'firm_income_statement_line', 'firm_audit_record_yearly', 'firm_audit_client', 'firm_cpa_tenure_yearly', 'firm_audit_input_yearly', 'firm_quality_staff', 'firm_inspection_result', 'firm_director_discipline', 'firm_certification_yearly', 'firm_director_profile_yearly', 'firm_director', 'firm_director_pay', 'firm_annual_form_cell'] as const;
const segments = { A: 'audit', T: 'tax', B: 'advisory', E: 'other', SUM: 'total' };
const markets = { SM: 'kospi', KSD: 'kosdaq', KNE: 'konex', LC: 'other_reporting', ETC: 'other' };
const nullable = (s: string | undefined): string | null => !s || /^(?:[-－–]|해당\s*사항\s*없음|해당없음)$/.test(s.trim()) ? null : s.trim();
const rowValue = (r: Cell[], code: string) => nullable(r.find(c => c.code === code)?.text);
const completeSum = (values: (number | null)[]) => values.every(v => v !== null) ? values.reduce<number>((s, v) => s + v!, 0) : null;
export function months(raw: string | null): number | null {
    const m = raw?.replace(/\s/g, '').match(/^(?:(\d+)년)?(?:(\d+)개월)?$/);
    if (!m || (!m[1] && !m[2]) || Number(m[2] ?? 0) > 11) return null;
    return Number(m[1] ?? 0) * 12 + Number(m[2] ?? 0);
}

/** 당기 열 경계 안에서만 빈 들여쓰기 칸을 건너뛴다. '-' 다음 전기 값으로 넘어가지 않는다. */
export function incomeLines(group: TableGroup | undefined): AnnualRow[] {
    if (!group) return [];
    const header = group.rows.find(row => row[0]?.text.replace(/\s/g, '') === '과목');
    const current = header?.find(c => c.column > 0 && /^제\s*\d+/.test(c.text));
    const rows: AnnualRow[] = [];
    for (const row of group.rows) {
        const label = row.find(c => c.attrs.ADELIM === '0' && /^\d{14}$/.test(c.code ?? ''));
        if (!label) continue;
        // DART KCIS v6 당기 colspan. 개별 양식에서 헤더가 바뀌면 추측하지 않는다.
        const candidates = current ? row.filter(c => c.column >= current.column && c.column < current.column + current.colspan) : [];
        const value = candidates.find(c => c.text.trim() !== '');
        const amount = parseDartAmount(value?.text);
        rows.push({ ord: rows.length + 1, account_code: label.code!, is_standard: label.code !== '99999999999999', account_label: label.text,
            amount: group.unitMultiplier !== null && amount !== null ? amount * group.unitMultiplier : null });
    }
    return rows;
}

export function parseAnnualReport(doc: ParsedDocument, source: string): AnnualResult {
    if (!(SUPPORTED_ANNUAL_FORM_VERSIONS as readonly string[]).includes(doc.formulaVersion)) throw new Error(`지원하지 않는 서식 버전: ${doc.formulaVersion}`);
    if (!doc.fyEndDate || !/^\d{8}$/.test(doc.corpCode)) throw new Error('표지 결산일/법인코드 미확인');
    if (!doc.fyStartDate || doc.fyStartDate > doc.fyEndDate) throw new Error('표지 보고기간 시작일 미확인/역전');
    const hardFailures: string[] = [], warnings: string[] = [];
    const tables = Object.fromEntries(ANNUAL_TABLES.map(t => [t, []])) as Record<string, AnnualRow[]>;
    const group = (name: string) => doc.groups.get(name);
    const raw = (name: string, code: string) => {
        const cells = group(name)?.byCode.get(code);
        if (!cells?.length) { warnings.push(`missingCode:${name}.${code}`); return null; }
        if (cells.length !== 1) { warnings.push(`duplicateCode:${name}.${code}`); return null; }
        return nullable(cells[0].text);
    };
    const count = (name: string, code: string) => parseDartCount(raw(name, code));
    const number = (name: string, code: string) => parseDartAmount(raw(name, code));
    const money = (name: string, code: string) => {
        const amount = number(name, code), multiplier = group(name)?.unitMultiplier;
        if (multiplier == null) { warnings.push(`unknownUnit:${name}`); return null; }
        return amount === null ? null : amount * multiplier;
    };
    const detail = (name: string, key: string) => (group(name)?.rows ?? []).filter(r => rowValue(r, key) !== null);
    const moneyRow = (name: string, row: Cell[], code: string) => {
        const v = parseDartAmount(rowValue(row, code)), u = group(name)?.unitMultiplier;
        if (u == null) { warnings.push(`unknownUnit:${name}`); return null; }
        return v === null ? null : v * u;
    };
    const lines = incomeLines(group('KCIS:K'));
    const incomeHeader = group('KCIS:K')?.rows.find(row => row[0]?.text.replace(/\s/g, '') === '과목')?.find(c => c.column > 0);
    if (incomeHeader && !/\(당\)/.test(incomeHeader.text)) warnings.push('incomeCurrentColumnLabel:KCIS:K (서식의 첫 금액 열 사용, 원문 당기 표기 확인 필요)');
    if (group('KCIS:K')?.unitMultiplier == null) warnings.push('unknownUnit:KCIS:K');
    tables.firm_income_statement_line = lines;
    const account = (code: string) => {
        const found = lines.filter(r => r.account_code === code);
        if (found.length !== 1) { warnings.push(`accountCount:${code}:${found.length}`); return null; }
        return found[0].amount as number | null;
    };
    const profile: AnnualRow = {
        fy_end_date: doc.fyEndDate, fy_start_date: doc.fyStartDate, fy_seq: doc.fySeq,
        revenue_total: money('TG_RVN_DTL', 'RVN_FY_SUM'), revenue_audit: money('TG_RVN_DTL', 'RVN_FY_TOT1'),
        revenue_tax: money('TG_RVN_DTL', 'RVN_FY_TOT2'), revenue_advisory: money('TG_RVN_DTL', 'RVN_FY_TOT3'), revenue_other: money('TG_RVN_DTL', 'RVN_FY_TOT4'),
        operating_income: account('12500000010000'), net_income: account('12900000010000'),
    };
    const workforce: AnnualRow = {
        fy_end_date: doc.fyEndDate, fy_start_date: doc.fyStartDate, fy_seq: doc.fySeq,
        employee_total: count('TG_HR_TOT', 'HR_TOT_ALL'), director_count: count('TG_HR_TOT', 'HR_D_ALL'),
        employee_audit: count('TG_BSAL', 'BSAL_CFY_P_A'), employee_tax: count('TG_BSAL', 'BSAL_CFY_P_T'), employee_advisory: count('TG_BSAL', 'BSAL_CFY_P_B'), employee_other: count('TG_BSAL', 'BSAL_CFY_P_E'),
        salary_total: money('TG_BSAL', 'BSAL_CFY_S_SUM'), salary_avg: null, director_pay_total: null, director_pay_count: null,
    };
    // 원문 부문표 평균과 뷰의 기말 전 임직원 기준 1인당 인건비를 구분한다.
    const salaryHeadcount = count('TG_BSAL', 'BSAL_CFY_P_SUM');
    if (typeof workforce.salary_total === 'number' && salaryHeadcount !== null && salaryHeadcount > 0) workforce.salary_avg = workforce.salary_total / salaryHeadcount;
    for (const [suffix, segment] of Object.entries(segments)) {
        tables.firm_personnel_cost_yearly.push({ concept: 'personnel_total', segment, amount: money('TG_BSAL', `BSAL_CFY_S_${suffix}`), headcount: count('TG_BSAL', `BSAL_CFY_P_${suffix}`), source_table: 'TG_BSAL', match_method: 'form_table' });
        const tenure: AnnualRow = { segment };
        for (const [field, key] of Object.entries({ under_1y: 'L1Y', y1_3: 'O1Y', y3_5: 'O3Y', y5_10: 'O5Y', y10_15: 'O10Y', over_15y: 'O15Y', total: 'TOT' })) tenure[field] = count('TG_HR_CR', `CR_${key}_${suffix}`);
        for (const [field, key] of Object.entries({ hires: 'INC', leavers: 'DES', begin_count: 'BGN', end_count: 'END' })) tenure[field] = segment === 'total' ? count('TG_HR_CHG', `HR_${key}_SUM`) : null;
        tables.firm_cpa_tenure_yearly.push(tenure);
    }
    tables.firm_personnel_cost_yearly.push({ concept: 'quality_personnel', segment: 'total', amount: money('TG_COST', 'COST_QLT'), headcount: null, source_table: 'TG_COST', match_method: 'form_table' });
    for (const [concept, code] of Object.entries({ welfare: '12417000010000', travel: '12421100010000', training: '12422300010000', entertainment: '12431100060000' })) {
        let found = lines.filter(r => r.account_code === code), method = 'account_code';
        if (concept === 'entertainment' && found.length === 0) {
            found = lines.filter(r => /^업무추진비(?:\s*\(주석[^)]*\))?$/.test(String(r.account_label)));
            method = 'account_label';
        }
        if (found.length > 1) warnings.push(`ambiguousAccount:${concept}`);
        tables.firm_personnel_cost_yearly.push({ concept, segment: 'total', amount: found.length === 1 ? found[0].amount : null, headcount: null, source_table: 'KCIS', match_method: method });
    }
    const payTotals: (number | null)[] = [];
    for (const [g, p] of [['TG_SAL', 'SAL'], ['NTG_SAL', 'NSAL']]) {
        const rows = detail(g, `${p}_NM`);
        if (rows.length) payTotals.push(money(g, `${p}_TOTT`));
        for (const row of rows) tables.firm_director_pay.push({ source_table: g, seq_no: tables.firm_director_pay.length + 1, name: rowValue(row, `${p}_NM`), position: rowValue(row, `${p}_PST`), employer: rowValue(row, `${p}_ONM`), pay_kind: rowValue(row, `${p}_KND`), amount: moneyRow(g, row, `${p}_TOT`), masked: g === 'NTG_SAL' });
    }
    if (tables.firm_director_pay.length) {
        workforce.director_pay_count = tables.firm_director_pay.length;
        workforce.director_pay_total = completeSum(payTotals);
    }
    for (const row of detail('TG_HR_ED', 'ED_NM')) {
        const duty = rowValue(row, 'ED_BSN');
        tables.firm_director.push({ seq_no: tables.firm_director.length + 1, name: rowValue(row, 'ED_NM'), position: rowValue(row, 'ED_PST'), duty, segment: duty ? classifyFirmSegment(duty) : 'unclassified', tenure_months: months(rowValue(row, 'ED_WK_YM')), practice_months: months(rowValue(row, 'ED_OP_YM')), invest_rate: parseDartAmount(rowValue(row, 'ED_IVST_RT')) });
    }
    const avg = (rows: AnnualRow[], key: string) => { const vs = rows.map(r => r[key]).filter((v): v is number => typeof v === 'number'); return vs.length ? vs.reduce((a, b) => a + b) / vs.length : null; };
    for (const segment of [...Object.values(segments).filter(s => s !== 'total'), 'unclassified', 'total']) {
        const rows = tables.firm_director.filter(r => segment === 'total' || r.segment === segment);
        if (!rows.length) continue;
        const vs = rows.map(r => r.tenure_months).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
        // 소규모 집계의 개인 추정을 막기 위해 5명 미만은 인원수 외 전부 NULL.
        tables.firm_director_profile_yearly.push({ segment, director_count: rows.length, tenure_months_avg: rows.length >= 5 ? avg(rows, 'tenure_months') : null, tenure_months_median: rows.length >= 5 && vs.length ? (vs[Math.floor((vs.length - 1) / 2)] + vs[Math.floor(vs.length / 2)]) / 2 : null, practice_months_avg: rows.length >= 5 ? avg(rows, 'practice_months') : null, invest_rate_max: null, invest_rate_top3: null });
    }
    for (const row of detail('TG_DCP', 'DCP_DTL')) tables.firm_director_discipline.push({ seq_no: tables.firm_director_discipline.length + 1, position: rowValue(row, 'DCP_PST'), discipline_date: parseDartDate(rowValue(row, 'DCP_DAY')), detail: rowValue(row, 'DCP_DTL'), note: rowValue(row, 'DCP_NT') });
    for (const [key, scope] of [['D', 'domestic'], ['I', 'foreign']]) for (const row of detail('TG_HR_CTF', `CTF_${key}_NM`)) tables.firm_certification_yearly.push({ scope, cert_name: rowValue(row, `CTF_${key}_NM`), headcount: parseDartCount(rowValue(row, `CTF_${key}_CNT`)) });
    for (const [key, market] of Object.entries(markets)) for (const [fs, fs_div] of [['S', 'separate'], ['C', 'consolidated']]) {
        const record: AnnualRow = { market, fs_div, client_count: count('TG_ARCD_TOT', `ARCD_${fs}_${key}_FY`) };
        for (const [field, suffix] of Object.entries({ opinion_unqualified: 'UO', opinion_qualified: 'QO', opinion_adverse: 'AO', opinion_disclaimer: 'DO' })) record[field] = fs === 'S' ? count('TG_ARCD_SADO', `SADO_${key}_${suffix}`) : null;
        tables.firm_audit_record_yearly.push(record);
    }
    for (const row of detail('TG_ARCD_C', 'ARCD_C_NM')) tables.firm_audit_client.push({ seq_no: tables.firm_audit_client.length + 1, client_name: rowValue(row, 'ARCD_C_NM'), subsidiary_count: parseDartCount(rowValue(row, 'ARCD_S_CNT')), adt_opinion_raw: rowValue(row, 'ARCD_C_ADO'), adt_opinion: normalizeAuditOpinion(rowValue(row, 'ARCD_C_ADO')) });
    for (const [suffix, tenure_band] of Object.entries({ P: 'trainee', L1: 'under_1y', O1: 'y1_3', O3: 'y3_5', O5: 'y5_10', O10: 'y10_15', O15: 'over_15y', SUM: 'total' })) {
        const row: AnnualRow = { tenure_band };
        for (const part of ['mid', 'end', 'tot']) { row[`${part}_headcount`] = count('TG_PUT', `PUT_${part.toUpperCase()}_P_${suffix}`); row[`${part}_hours`] = number('TG_PUT', `PUT_${part.toUpperCase()}_H_${suffix}`); }
        tables.firm_audit_input_yearly.push(row);
    }
    for (const row of detail('TG_QLT', 'QLT_WK')) tables.firm_quality_staff.push({ seq_no: tables.firm_quality_staff.length + 1, dept_name: rowValue(row, 'QLT_NM'), duty: rowValue(row, 'QLT_WK'), headcount: parseDartCount(rowValue(row, 'QLT_CNT')), career_band: rowValue(row, 'QLT_ABLT_TIEM'), staff_kind: rowValue(row, 'QLT_ABLT_DIV'), residency: rowValue(row, 'QLT_ABLT_FULL'), dedication: rowValue(row, 'QLT_ABLT_EXC') });
    for (const row of detail('TG_ADRV', 'ADRV_PO')) tables.firm_inspection_result.push({ kind: 'audit_report', seq_no: tables.firm_inspection_result.length + 1, action_date: parseDartDate(rowValue(row, 'ADRV_DT')), authority: rowValue(row, 'ADRV_NM'), target_company: rowValue(row, 'ADRV_CP_NM'), target_fy: rowValue(row, 'ADRV_FY'), qc_element: null, finding_text: rowValue(row, 'ADRV_PO'), action_text: rowValue(row, 'ADRV_ACP_STEP'), cpa_action_text: rowValue(row, 'ADRV_CPA_STEP') });
    for (const [key, qc_element] of Object.entries({ LR: '리더십', ER: '윤리', AM: '수용유지', PR: '인적자원', BP: '업무수행', MT: '모니터링' })) for (const row of detail('TG_ADQLT', `ADQLT_ADV_${key}`)) tables.firm_inspection_result.push({ kind: 'auditor_quality', seq_no: tables.firm_inspection_result.length + 1, action_date: parseDartDate(rowValue(row, `ADQLT_DT_${key}`)), authority: null, target_company: null, target_fy: null, qc_element, finding_text: rowValue(row, `ADQLT_ADV_${key}`), action_text: rowValue(row, `ADQLT_PFM_${key}`), cpa_action_text: null });
    // 기존 모델에 칸이 없는 사무소/상시구분, 자산·연차별 실적, 전기·전전기는 서식키로 보존.
    for (const name of PUBLIC_FORM_GROUPS) for (const [code, cells] of group(name)?.byCode ?? []) cells.forEach((cell, i) => tables.firm_annual_form_cell.push({ source_table: name, code, occurrence: i + 1, raw_text: cell.text, numeric_value: parseDartAmount(cell.text), unit_raw: group(name)?.unitRaw ?? null, unit_multiplier: group(name)?.unitMultiplier ?? null }));
    const equal = (name: string, a: unknown, b: unknown, hard: boolean, tolerance = 0) => {
        if (typeof a !== 'number' || typeof b !== 'number') { warnings.push(`notVerifiable:${name}`); return; }
        if (Math.abs(a - b) > tolerance) (hard ? hardFailures : warnings).push(`${name}:${a}!=${b}`);
    };
    equal('revenue', profile.revenue_total, account('12100000010000'), true);
    equal('consolidatedClients', count('TG_ARCD_TOT', 'ARCD_C_FY_SUM'), tables.firm_audit_client.length, true);
    equal('marketSeparateTotal', completeSum(Object.keys(markets).map(k => count('TG_ARCD_SADO', `SADO_${k}_SUM`))), count('TG_ARCD_TOT', 'ARCD_S_FY_SUM'), true);
    equal('headcount', count('TG_BSAL', 'BSAL_CFY_P_SUM'), workforce.employee_total, false);
    equal('salary', workforce.salary_total, money('TG_COST', 'COST_ALL'), false, Math.max(group('TG_BSAL')?.unitMultiplier ?? 1, group('TG_COST')?.unitMultiplier ?? 1));
    equal('cpaEnd', count('TG_HR_CR', 'CR_TOT_SUM'), count('TG_HR_CHG', 'HR_END_SUM'), false);
    const input = count('TG_PUT', 'PUT_TOT_P_SUM'), cpa = count('TG_HR_TOT', 'HR_CPA_ALL');
    if (input !== null && cpa !== null && input > cpa) warnings.push(`auditInputExceedsCpa:${input}>${cpa}`);
    for (const rows of Object.values(tables)) for (const row of rows) row.source_rcept_no = source;
    return { corpCode: doc.corpCode, fyEndDate: doc.fyEndDate, year: Number(doc.fyEndDate.slice(0, 4)), source, profile, workforce, tables, hardFailures, consistencyWarnings: [...new Set(warnings)] };
}
