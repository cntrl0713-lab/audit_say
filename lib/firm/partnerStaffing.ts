import { buildHeadcounts } from './personnel.ts';
import type { FirmAnnualPeriodRef, FirmHeadcountRow } from './types.ts';

export interface PartnerStaffingView {
    /** 사원과 수습을 포함하는 인원표 공인회계사 수. */
    cpa: number | null;
    /** 인원표 사원(출자자) 수. 이사 수나 보수 공시 인원으로 대체하지 않는다. */
    equityMembers: number | null;
    /** 공인회계사 수에서 출자사원을 뺀 인원. 수습과 비출자 파트너는 포함한다. */
    nonMemberCpa: number | null;
    /** 비출자 공인회계사 ÷ 출자사원. 백분율이 아닌 1인당 인원이다. */
    perEquityMember: number | null;
    note: string;
}

/** 같은 법인·접수번호·보고기간의 공개 집계로만 계산한다. */
export function buildPartnerStaffing(
    period: FirmAnnualPeriodRef,
    rawHeadcounts: readonly FirmHeadcountRow[],
): PartnerStaffingView {
    const rows = rawHeadcounts.filter(row => row.firm_id === period.firm_id
        && row.source_rcept_no === period.source_rcept_no
        && row.bsns_year === period.bsns_year
        && row.fy_start_year === period.fy_start_year
        && row.fy_start_date === period.fy_start_date
        && row.fy_end_date === period.fy_end_date);
    const counts = buildHeadcounts(rows);
    const cpaRow = counts.find(row => row.code === 'HR_CPA_ALL');
    const memberRow = counts.find(row => row.code === 'HR_E_ALL');
    const cpa = cpaRow?.count ?? null;
    const equityMembers = memberRow?.count ?? null;
    const unavailable = (note: string, nonMemberCpa: number | null = null): PartnerStaffingView => ({
        cpa, equityMembers, nonMemberCpa, perEquityMember: null, note,
    });
    const validationNotes = [cpaRow, memberRow].flatMap(row => row?.note ? [`${row.label}: ${row.note}`] : []);
    if (validationNotes.length > 0) return unavailable(`${validationNotes.join(' · ')}. 인원 확인이 필요해 비율을 표시하지 않습니다.`);
    if (cpa === null || equityMembers === null) {
        return unavailable('같은 보고기간의 공인회계사 수 또는 출자사원 수가 미확보되어 비율을 계산할 수 없습니다.');
    }
    if (equityMembers > cpa) {
        return unavailable('출자사원 수가 공인회계사 수보다 커서 비출자 인원과 비율을 계산할 수 없습니다.');
    }
    const nonMemberCpa = cpa - equityMembers;
    if (equityMembers === 0) return unavailable('출자사원이 0명이라 1인당 인원을 계산할 수 없습니다.', nonMemberCpa);
    return {
        cpa,
        equityMembers,
        nonMemberCpa,
        perEquityMember: nonMemberCpa / equityMembers,
        note: '같은 보고기간 말 인원표 기준',
    };
}
