import type { FirmFiling } from './dartClient.ts';
export { ANNUAL_COLLECTION_YEARS } from '../../lib/firm/annualYears.ts';

export function koreanToday(date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replaceAll('-', '');
}

export function filingPeriod(filing: FirmFiling): string | null {
    const m = filing.report_nm.match(/\((\d{4})\.(\d{2})\)/);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
    return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).toISOString().slice(0, 10);
}
// 2026-09-08 사용자 결정: 현대 제20기(결산월 변경에 따른 3개월)는 집계에서 제외.
// 접수번호가 바뀐 정정공시에도 동일하게 적용하며, 다른 단기 사업연도로 일반화하지 않는다.
export function annualFilingExclusion(filing: FirmFiling): string | null {
    return filing.corp_code === '00561352' && filingPeriod(filing) === '2024-06-30'
        ? 'userExcluded:현대회계법인 제20기(2024-04-01~2024-06-30)' : null;
}
/** 목록의 월은 후보 선정용. 원문 PERIODTO와 일치해야 최종 적재한다. */
export function selectAnnualFilings(filings: FirmFiling[], year: number) {
    const selected = new Map<string, FirmFiling>();
    const unclassified: FirmFiling[] = [];
    const excluded: { filing: FirmFiling; reason: string }[] = [];
    for (const filing of filings) {
        const period = filingPeriod(filing);
        if (!period) { unclassified.push(filing); continue; }
        if (Number(period.slice(0, 4)) !== year) continue;
        const reason = annualFilingExclusion(filing);
        if (reason) { excluded.push({ filing, reason }); continue; }
        const key = `${filing.corp_code}/${period}`;
        const previous = selected.get(key);
        if (!previous || `${filing.rcept_dt}${filing.rcept_no}` > `${previous.rcept_dt}${previous.rcept_no}`) selected.set(key, filing);
    }
    const byCorp = new Map<string, FirmFiling[]>();
    for (const f of selected.values()) byCorp.set(f.corp_code, [...(byCorp.get(f.corp_code) ?? []), f]);
    return { selected: [...selected.values()].sort((a, b) => a.corp_code.localeCompare(b.corp_code)), unclassified, excluded,
        multiplePeriods: [...byCorp.entries()].filter(([, rows]) => rows.length > 1).map(([corp_code, rows]) => ({ corp_code, filings: rows })) };
}
