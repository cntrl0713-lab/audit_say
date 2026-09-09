import { getFirmAuditInput } from '../../../../lib/firm/queries';
import {
    buildAuditInput,
    buildHeadcounts,
    buildTenureSegments,
    rowsForReceipt,
    SEGMENT_LABEL,
    splitTenureSegments,
    summarizeTurnover,
} from '../../../../lib/firm/personnel';
import { buildAnnualTrend } from '../../../../lib/firm/trend';
import { buildPartnerStaffing } from '../../../../lib/firm/partnerStaffing';
import type { FirmAnnualSummary, FirmAuditInputRow, FirmCpaTenureRow, FirmHeadcountRow } from '../../../../lib/firm/types';
import { formatDecimal, formatNumber, formatRatio } from '../../../../lib/firm/format';
import { StackedBarChart, TrendChart } from '../../_components/charts';
import { Basis, DataTable, EmptyState, Footnote, StatTile } from '../../_components/ui';
import { TenureDistribution } from './OverviewCharts';

export default async function PeopleTab({
    firmId,
    summaries,
    periods,
    year,
    headcounts,
    tenure,
}: {
    firmId: number;
    summaries: FirmAnnualSummary[];
    periods: FirmAnnualSummary[];
    year: number;
    headcounts: FirmHeadcountRow[];
    tenure: FirmCpaTenureRow[];
}) {
    const auditInput = periods.length > 0 ? await getFirmAuditInput(firmId) : [];
    const trend = buildAnnualTrend(summaries, headcounts, tenure);
    return (
        <div className="space-y-8">
            {periods.length > 1 ? (
                <p className="text-sm leading-relaxed text-foreground/70">
                    {year}년에 시작한 보고기간이 {periods.length}개입니다. 인원을 합산하지 않고 기간별로 표시합니다.
                </p>
            ) : null}
            {periods.length > 0 ? periods.map(period => (
                <PeoplePeriod
                    key={period.source_rcept_no}
                    period={period}
                    showPeriod={periods.length > 1}
                    headcounts={rowsForReceipt(headcounts, period.source_rcept_no)}
                    tenure={rowsForReceipt(tenure, period.source_rcept_no)}
                    auditInput={rowsForReceipt(auditInput, period.source_rcept_no)}
                />
            )) : (
                <EmptyState title="보고기간 정보 미확보" description="선택한 연도에 시작한 사업보고서가 아직 적재되지 않았거나 검토 보류 중입니다." />
            )}
            <section className="space-y-3 border-t border-card-border pt-7">
                <h3 className="text-xl">인력 규모의 변화</h3>
                <TrendChart
                    title="보고기간 시작연도별 인원"
                    years={trend.years}
                    series={trend.series.filter(series => ['employee_total', 'cpa', 'registered'].includes(series.key))}
                    multiPeriodYears={trend.multiPeriodYears}
                />
                <Footnote>
                    각 보고기간 말 인원입니다. 등록회계사 추이는 근속표 합계를 사용합니다. 전 임직원·공인회계사·등록회계사는
                    집계 범위가 다르며, 값이 없으면 0으로 표시하지 않습니다.
                </Footnote>
            </section>
        </div>
    );
}

function PeoplePeriod({
    period,
    showPeriod,
    headcounts,
    tenure,
    auditInput,
}: {
    period: FirmAnnualSummary;
    showPeriod: boolean;
    headcounts: FirmHeadcountRow[];
    tenure: FirmCpaTenureRow[];
    auditInput: FirmAuditInputRow[];
}) {
    const counts = buildHeadcounts(headcounts);
    const count = (code: string) => counts.find(row => row.code === code)?.count ?? null;
    const totalTenureRows = tenure.filter(row => row.segment === 'total');
    const singleTotal = totalTenureRows.length === 1 ? totalTenureRows : [];
    const totalTenure = buildTenureSegments(singleTotal)[0] ?? null;
    const turnover = summarizeTurnover(singleTotal);
    const { shown: segmentTenure, omitted: missingSegmentTenure } = splitTenureSegments(
        buildTenureSegments(tenure.filter(row => row.segment !== 'total')),
    );
    const input = buildAuditInput(auditInput);
    const net = turnover?.net ?? null;
    const partnerStaffing = buildPartnerStaffing(period, headcounts);

    return (
        <section aria-label={`${period.fy_start_year}년 시작 보고기간 인력 구조`} className="space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <h3 className="text-xl sm:text-2xl">인력 규모와 구성</h3>
                {showPeriod ? (
                    <p className="text-[13px] text-foreground/70">
                        {period.fy_seq ? `제${period.fy_seq}기 · ` : ''}{period.fy_start_date} ~ {period.fy_end_date}
                    </p>
                ) : null}
            </div>
            <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-3 sm:gap-5">
                    <StatTile size="lead" label="공인회계사 수" value={formatNumber(count('HR_CPA_ALL'), '명')} hint="인원표 기준 · 사원·수습 포함" />
                    <StatTile size="lead" label="전 임직원 수" value={formatNumber(period.employee_total, '명')} hint="기타직원 등을 포함한 전체 인원" />
                </dl>
                <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatTile label="소속 등록회계사 수" value={formatNumber(count('HR_R_ALL'), '명')} hint="인원표 기준 · 사원 제외" />
                    <StatTile label="수습회계사 수" value={formatNumber(count('HR_P_ALL'), '명')} hint="인원표 기준" />
                    <StatTile label="사원(출자자) 수" value={formatNumber(count('HR_E_ALL'), '명')} hint="인원표의 사원 집계" />
                    <StatTile label="이사 수" value={formatNumber(period.director_count, '명')} hint="인원표의 이사 집계" />
                </dl>
                <p className="text-[13px] leading-relaxed text-foreground/70">보고기간 말 인원이며, 서로 겹치는 집계가 있어 위 숫자를 합산하지 않습니다.</p>
            </div>

            <section className="rounded-xl border border-primary/25 bg-card p-4 sm:p-6">
                <h4 className="text-lg">출자사원 1인당 비출자 공인회계사 수</h4>
                <p className="mt-3 text-4xl tabular-nums">
                    {formatDecimal(partnerStaffing.perEquityMember, 1, '명')}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                    {partnerStaffing.note}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-card-border pt-4 sm:grid-cols-3">
                    <div>
                        <dt className="text-[13px] text-foreground/70">전체 공인회계사</dt>
                        <dd className="mt-1 text-lg tabular-nums">{formatNumber(partnerStaffing.cpa, '명')}</dd>
                    </div>
                    <div>
                        <dt className="text-[13px] text-foreground/70">출자사원</dt>
                        <dd className="mt-1 text-lg tabular-nums">{formatNumber(partnerStaffing.equityMembers, '명')}</dd>
                    </div>
                    <div>
                        <dt className="text-[13px] text-foreground/70">비출자 공인회계사</dt>
                        <dd className="mt-1 text-lg tabular-nums">{formatNumber(partnerStaffing.nonMemberCpa, '명')}</dd>
                    </div>
                </dl>
                <p className="mt-4 text-[13px] leading-relaxed text-foreground/70">
                    계산식: (전체 공인회계사 − 출자사원) ÷ 출자사원. 같은 공시의 보고기간 말 인원으로 계산합니다.
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground/70">
                    출자사원은 공시상 사원(출자자)입니다. 비출자 공인회계사에는 수습회계사와 비출자 파트너가 포함되며,
                    비출자 파트너 인원은 별도로 구분할 수 없어 제외하지 않았습니다.
                </p>
            </section>

            <div className="grid items-start gap-5 lg:grid-cols-2">
                <section className="min-w-0 rounded-xl border border-card-border bg-card p-4 sm:p-6">
                    <h4 className="text-lg">근속연수별 분포</h4>
                    <p className="mb-5 mt-1 text-sm text-foreground/70">등록회계사 근속표 기준</p>
                    <TenureDistribution tenure={totalTenure} />
                </section>
                <section className="min-w-0 rounded-xl border border-card-border bg-card p-4 sm:p-6">
                    <h4 className="text-lg">입·퇴사 현황</h4>
                    <p className="mb-4 mt-1 text-sm text-foreground/70">해당 보고기간 · 등록회계사 기준</p>
                    {turnover ? (
                        <>
                            <dl className="grid grid-cols-2 gap-3">
                                <StatTile size="lead" label="입사" value={formatNumber(turnover.hires, '명')} />
                                <StatTile size="lead" label="퇴사" value={formatNumber(turnover.leavers, '명')} />
                                <StatTile label="기초 인원" value={formatNumber(turnover.begin, '명')} />
                                <StatTile label="기말 인원" value={formatNumber(turnover.end, '명')} />
                                <StatTile
                                    label="순증"
                                    value={net === null ? '-' : `${net > 0 ? '+' : net < 0 ? '−' : ''}${formatNumber(Math.abs(net), '명')}`}
                                    hint="기말 − 기초"
                                />
                                <StatTile label="퇴사율" value={formatRatio(turnover.leaverRate)} hint="퇴사자 ÷ 기초 인원" />
                            </dl>
                            {turnover.reconciles === false ? (
                                <Footnote>기초 + 입사 − 퇴사가 기말 인원과 맞지 않습니다. 공시 원문 수치를 표시했습니다.</Footnote>
                            ) : null}
                        </>
                    ) : <EmptyState title="입·퇴사 수치 미확보" />}
                    {totalTenureRows.length > 1 ? <Footnote>전체 근속표 행이 여러 개여서 근속 분포와 입·퇴사 값을 선택하지 않았습니다.</Footnote> : null}
                </section>
            </div>

            <section className="space-y-3">
                <h4 className="text-lg">부문별 인원</h4>
                <DataTable
                    columns={[
                        { key: 'segment', label: '업무 부문' },
                        { key: 'people', label: '전 임직원 수', align: 'right' },
                    ]}
                    rows={(['audit', 'tax', 'advisory', 'other'] as const).map(segment => [
                        SEGMENT_LABEL[segment], formatNumber(period[`employee_${segment}`], '명'),
                    ])}
                />
                <Footnote>부문별 인원은 전 임직원 기준입니다. 위 등록회계사 근속표와 집계 범위가 다릅니다.</Footnote>
            </section>

            {segmentTenure.length > 0 || missingSegmentTenure.length > 0 ? (
                <details className="rounded-xl border border-card-border bg-card p-4 sm:p-5">
                    <summary className="cursor-pointer text-base">부문별 근속 분포 더 보기</summary>
                    <div className="mt-5 space-y-3">
                        {segmentTenure.length > 0 ? <StackedBarChart title="부문별 등록회계사 근속 분포" rows={segmentTenure} /> : null}
                        <Footnote>
                            비중은 각 부문에서 확인된 근속 구간 인원 합을 기준으로 계산합니다.
                            {segmentTenure.some(segment => segment.totalMismatch) ? ' 일부 부문은 구간 합과 공시 합계가 다르며 원문 값을 그대로 표시했습니다.' : ''}
                            {missingSegmentTenure.length > 0 ? ` ${missingSegmentTenure.map(segment => segment.label).join(' · ')} 부문은 근속 인원이 미확보되었습니다.` : ''}
                        </Footnote>
                    </div>
                </details>
            ) : null}

            <details className="rounded-xl border border-card-border bg-card p-4 sm:p-5">
                <summary className="cursor-pointer text-base">감사 투입 인원·시간 더 보기</summary>
                <div className="mt-5 space-y-3">
                    {period.consistency_warnings.some(warning => warning.startsWith('auditInputExceedsCpa')) ? (
                        <Footnote>공시의 감사 투입 인력이 공인회계사 수보다 큽니다. 원문 값을 보존했으며 투입 인력 집계 기준 확인이 필요합니다.</Footnote>
                    ) : null}
                    {input.length > 0 ? (
                        <DataTable
                            columns={[
                                { key: 'band', label: '경력 구간' },
                                { key: 'mid', label: '중간 (mid)', priority: 'wide' },
                                { key: 'end', label: '기말 (end)', priority: 'wide' },
                                { key: 'total', label: '합계 (tot)' },
                                { key: 'average', label: '1인당 감사시간', align: 'right' },
                            ]}
                            rows={input.map(row => [
                                row.label,
                                <span key="mid">{formatNumber(row.mid_headcount, '명')}<br />{formatNumber(row.mid_hours, '시간')}</span>,
                                <span key="end">{formatNumber(row.end_headcount, '명')}<br />{formatNumber(row.end_hours, '시간')}</span>,
                                <span key="total">{formatNumber(row.tot_headcount, '명')}<br />{formatNumber(row.tot_hours, '시간')}</span>,
                                formatDecimal(row.hoursPerHead, 1, '시간'),
                            ])}
                        />
                    ) : <EmptyState title="감사 투입 수치 미확보" />}
                    <Footnote>
                        감사 부문 투입 한정이며 회계법인 전체 근로시간이 아닙니다. 중간(mid)·기말(end)·합계(tot)는 공시 원문의 구분입니다.
                        1인당 감사시간은 해당 보고기간의 합계 감사시간 ÷ 같은 경력 구간의 합계 투입 인원이며, 12개월로 환산하지 않습니다.
                        수습을 포함하는 경력 구간으로 위 근속연수 구간과 기준이 다릅니다.
                    </Footnote>
                </div>
            </details>

            <Basis title="인원 집계 기준과 공시 원문">
                <div className="space-y-2">
                    <p>공인회계사·소속 등록회계사·수습회계사·사원(출자자)·이사는 공시 인원표의 구분을 따릅니다. 근속 분포와 입·퇴사는 등록회계사 근속표를 사용하며, 사원을 제외한 소속 등록회계사 수와 집계 범위가 다릅니다.</p>
                    <p>‘-’와 ‘미확보’는 결측으로, 0명과 다릅니다. 인원에 단위 배수를 곱하거나 여러 보고기간의 인원을 합산하지 않습니다.</p>
                    {counts.some(row => row.note) ? <p>{counts.filter(row => row.note).map(row => `${row.label}: ${row.note}`).join(' · ')}</p> : null}
                    {period.consistency_warnings.length > 0 ? <p>공시 표 간 수치 차이 또는 검증할 수 없는 항목이 {period.consistency_warnings.length}건 있으며 원문 값을 보존했습니다.</p> : null}
                    <p>
                        {period.fy_start_date} ~ {period.fy_end_date} · 접수일 {period.source_rcept_dt} ·{' '}
                        <a href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${period.source_rcept_no}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">DART 공시 원문 보기</a>
                    </p>
                </div>
            </Basis>
        </section>
    );
}
