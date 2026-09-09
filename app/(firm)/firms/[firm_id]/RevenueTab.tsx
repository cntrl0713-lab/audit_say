import { buildFirmOverview } from '../../../../lib/firm/overview';
import { buildAnnualTrend } from '../../../../lib/firm/trend';
import { formatKrw, formatRatio } from '../../../../lib/firm/format';
import type { FirmAnnualSummary } from '../../../../lib/firm/types';
import { TrendChart } from '../../_components/charts';
import { Basis, DataTable, EmptyState, Footnote, StatTile } from '../../_components/ui';
import { RevenuePieChart } from './OverviewCharts';

export default function RevenueTab({
    summaries,
    periods,
    year,
}: {
    summaries: FirmAnnualSummary[];
    periods: FirmAnnualSummary[];
    year: number;
}) {
    const trend = buildAnnualTrend(summaries);

    return (
        <div className="space-y-8">
            <section className="space-y-5">
                <h3 className="text-xl sm:text-2xl">{year}년 시작 보고기간 · 매출과 손익</h3>
                {periods.length > 1 ? (
                    <p className="text-sm leading-relaxed text-foreground/70">
                        같은 연도에 시작한 보고기간이 {periods.length}개입니다. 실적을 합산하지 않고 기간별로 표시합니다.
                    </p>
                ) : null}
                {periods.length ? (
                    <div className="space-y-8">
                        {periods.map((period) => (
                            <RevenuePeriod key={period.source_rcept_no} period={period} summaries={summaries} />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="보고기간 정보 미확보"
                        description="선택한 연도에 시작한 사업보고서가 아직 적재되지 않았거나 검토 보류 중입니다."
                    />
                )}
            </section>

            <section className="space-y-4 border-t border-card-border pt-6">
                <h3 className="text-xl sm:text-2xl">매출 추이</h3>
                {summaries.length ? (
                    <div className="grid gap-5 lg:grid-cols-2">
                        <TrendChart
                            title="총매출"
                            latestFirst
                            years={trend.years}
                            series={trend.series.filter((series) => series.key === 'revenue_total')}
                            multiPeriodYears={trend.multiPeriodYears}
                        />
                        <TrendChart
                            title="임직원 1인당 매출액"
                            latestFirst
                            years={trend.years}
                            series={trend.series.filter((series) => series.key === 'revenue_per_employee')}
                            multiPeriodYears={trend.multiPeriodYears}
                        />
                    </div>
                ) : (
                    <EmptyState title="매출 추이 미확보" description="비교할 보고기간의 매출 자료가 아직 없습니다." />
                )}
                <Footnote>
                    가로축은 보고기간 시작연도입니다. 금액은 각 보고기간의 회계법인 자체 실적이며, 기간 길이를
                    환산하거나 같은 연도의 여러 기수를 합산하지 않습니다. 1인당 매출액의 분모는 해당 보고기간 말
                    전 임직원입니다. 결측은 0으로 표시하지 않습니다.
                </Footnote>
            </section>
        </div>
    );
}

function RevenuePeriod({ period, summaries }: { period: FirmAnnualSummary; summaries: FirmAnnualSummary[] }) {
    const revenueMix = buildFirmOverview(period, summaries, [], []).revenueMix;
    const hasFinancialData = [
        period.revenue_total,
        period.revenue_per_employee,
        period.operating_income,
        period.net_income,
        period.audit_revenue_ratio,
        ...revenueMix.segments.map((segment) => segment.value),
    ].some((value) => value !== null);

    return (
        <section aria-label={`${period.fy_start_date}부터 ${period.fy_end_date}까지의 매출과 손익`} className="space-y-5">
            <p className="text-sm leading-relaxed text-foreground/70">
                {period.fy_seq ? `제${period.fy_seq}기 · ` : ''}{period.fy_start_date} ~ {period.fy_end_date}
            </p>
            {hasFinancialData ? (
                <>
                    <dl className="grid gap-3 sm:grid-cols-2 sm:gap-5">
                        <StatTile size="lead" label="총매출" value={formatKrw(period.revenue_total)} />
                        <StatTile
                            size="lead"
                            label="임직원 1인당 매출액"
                            value={formatKrw(period.revenue_per_employee)}
                            hint="총매출 ÷ 보고기간 말 전 임직원"
                        />
                    </dl>
                    <dl className="grid gap-3 sm:grid-cols-3">
                        <StatTile label="영업이익" value={formatKrw(period.operating_income)} />
                        <StatTile label="당기순이익" value={formatKrw(period.net_income)} />
                        <StatTile label="감사부문 매출 비중" value={formatRatio(period.audit_revenue_ratio)} />
                    </dl>
                    <div className="grid items-start gap-5 lg:grid-cols-2">
                        <section className="min-w-0 rounded-xl border border-card-border bg-card p-4 sm:p-6">
                            <h4 className="text-lg">매출의 업무 구성</h4>
                            <p className="mb-6 mt-1 text-sm leading-relaxed text-foreground/70">
                                감사·세무·경영자문 등 업무별 매출 비중
                            </p>
                            <RevenuePieChart {...revenueMix} />
                        </section>
                        <section className="min-w-0 space-y-3">
                            <h4 className="text-lg">부문별 매출액</h4>
                            <DataTable
                                columns={[
                                    { key: 'segment', label: '부문', priority: 'always' },
                                    { key: 'revenue', label: '매출액', align: 'right', priority: 'always' },
                                ]}
                                rows={revenueMix.segments.map((segment) => [segment.label, formatKrw(segment.value)])}
                            />
                        </section>
                    </div>
                </>
            ) : (
                <EmptyState title="매출·손익 수치 미확보" description="이 보고기간의 매출과 손익 수치가 확인되지 않았습니다." />
            )}
            {period.consistency_warnings.length ? (
                <p className="rounded-lg border border-card-border px-4 py-3 text-sm leading-relaxed text-foreground/70">
                    이 공시에는 표 간 수치 차이 또는 검증할 수 없는 항목이 {period.consistency_warnings.length}건
                    있습니다. 원문 값을 보존했으므로 비교할 때 공시의 기준을 확인해 주세요.
                </p>
            ) : null}
            <Basis title="집계 기준과 공시 원문">
                <div className="space-y-2 text-sm">
                    <p>
                        매출과 손익은 위 보고기간의 회계법인 자체 실적입니다. 감사대상회사 재무금액이나 사업연도와
                        구분하며, 보고기간 길이를 연간으로 환산하지 않습니다.
                    </p>
                    <p>
                        임직원 1인당 매출액은 총매출을 보고기간 말 전 임직원으로 나눈 값입니다. 공인회계사 수를
                        분모로 사용한 수치가 아닙니다. 감사부문 매출 비중은 감사매출 ÷ 총매출입니다.
                    </p>
                    <p>금액은 원 단위 공시 값을 조·억·만 단위로 표시합니다. ‘-’와 ‘미확보’는 결측으로 0과 다릅니다.</p>
                    <p>
                        접수일 {period.source_rcept_dt} ·{' '}
                        <a
                            href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${period.source_rcept_no}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-4"
                        >
                            DART 공시 원문 보기
                        </a>
                    </p>
                </div>
            </Basis>
        </section>
    );
}
