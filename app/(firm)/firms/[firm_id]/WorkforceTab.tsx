import { buildAnnualTrend } from '../../../../lib/firm/trend';
import { TrendChart } from '../../_components/charts';
import { averageDirectorPay, buildHeadcounts, rowsForReceipt, SEGMENT_LABEL } from '../../../../lib/firm/personnel';
import type { FirmAnnualSummary, FirmCpaTenureRow, FirmHeadcountRow } from '../../../../lib/firm/types';
import { formatDecimal, formatKrw, formatNumber, formatRatio } from '../../../../lib/firm/format';
import { Basis, DataTable, Footnote, EmptyState, StatTile } from '../../_components/ui';

export default function WorkforceTab({
    summaries,
    periods,
    year,
    tenure,
    headcounts,
}: {
    summaries: FirmAnnualSummary[];
    periods: FirmAnnualSummary[];
    year: number;
    tenure: FirmCpaTenureRow[];
    headcounts: FirmHeadcountRow[];
}) {
    const trend = buildAnnualTrend(summaries, headcounts, tenure);
    return (
        <>
            <section className="mb-8 space-y-3">
                <h3 className="text-lg font-medium">보고기간 시작연도별 추이</h3>
                <div className="grid gap-4 xl:grid-cols-3">
                    <TrendChart
                        title="자체 매출액"
                        years={trend.years}
                        series={trend.series.filter((s) => s.key === 'revenue_total')}
                        multiPeriodYears={trend.multiPeriodYears}
                    />
                    <TrendChart
                        title="인원 구성"
                        years={trend.years}
                        series={trend.series.filter((s) => ['employee_total', 'cpa', 'registered'].includes(s.key))}
                        multiPeriodYears={trend.multiPeriodYears}
                    />
                    <TrendChart
                        title="임직원 1인당 매출액"
                        years={trend.years}
                        series={trend.series.filter((s) => s.key === 'revenue_per_employee')}
                        multiPeriodYears={trend.multiPeriodYears}
                    />
                </div>
                <Footnote>
                    금액은 각 보고기간의 실적이며 기간 길이를 환산하지 않습니다. 인원은 보고기간 말 기준입니다. 결측은
                    0이 아니며 세 인원의 모집단은 서로 다릅니다.
                </Footnote>
            </section>
            <h3 className="mb-2 text-lg font-medium">{year}년 시작 실적 · 회계법인 자체 인력·재무</h3>
            <Basis>
                실적은 보고기간 시작연도로 구분합니다. 감사대상회사 사업연도와 실제 감사대상 기간이 같다는 뜻은
                아닙니다. 인원은 각 보고기간 말 기준이며, 1인당 인건비는 이사 등을 포함한 전체 임직원 인건비를 기말
                인원으로 나눈 값입니다.
            </Basis>
            {periods.length > 1 ? (
                <p className="mb-3 text-base">
                    같은 연도에 시작한 보고기간이 {periods.length}개입니다. 실적을 합산하지 않고 기간별로 표시합니다.
                </p>
            ) : null}
            {periods.length ? (
                <div className="space-y-8">
                    {periods.map((current) => (
                        <AnnualPeriodCard
                            key={current.source_rcept_no}
                            current={current}
                            tenure={rowsForReceipt(tenure, current.source_rcept_no)}
                            headcounts={rowsForReceipt(headcounts, current.source_rcept_no)}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState
                    title="보고기간 정보 미확보"
                    description="선택한 연도에 시작한 사업보고서가 아직 적재되지 않았거나 검토 보류 중입니다."
                />
            )}
        </>
    );
}

function AnnualPeriodCard({
    current,
    tenure,
    headcounts,
}: {
    current: FirmAnnualSummary;
    tenure: FirmCpaTenureRow[];
    headcounts: FirmHeadcountRow[];
}) {
    const counts = buildHeadcounts(headcounts);
    const cpa = counts.find((row) => row.code === 'HR_CPA_ALL')?.count ?? null;
    const registered = tenure.find((row) => row.segment === 'total')?.total ?? null;
    const averagePay = averageDirectorPay(current);
    const fields = [
        { label: '회계법인 이사 수', value: current?.director_count, format: (n: number) => formatNumber(n, '명') },
        { label: '회계법인 자체 영업이익', value: current?.operating_income, format: formatKrw },
        { label: '임직원 1인당 인건비', value: current?.salary_per_employee, format: formatKrw },
        { label: '당기순이익', value: current.net_income, format: formatKrw },
        {
            label: '이사 1인당 직원 수',
            value: current.employee_per_director,
            format: (n: number) => formatDecimal(n, 1, '명'),
        },
        { label: '이사 보수 총액', value: current.director_pay_total, format: formatKrw },
        ...(averagePay === null ? [] : [{ label: '이사 1인당 평균 보수', value: averagePay, format: formatKrw }]),
        { label: '감사부문 매출 비중', value: current?.audit_revenue_ratio, format: formatRatio },
    ];
    return (
        <>
            <p className="mb-3 text-[13px]">
                {current.fy_seq ? `제${current.fy_seq}기 · ` : ''}대상 기간 {current.fy_start_date} ~{' '}
                {current.fy_end_date} · 접수일 {current.source_rcept_dt} ·{' '}
                <a
                    href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${current.source_rcept_no}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                >
                    DART 원문
                </a>
            </p>
            {current?.consistency_warnings.length ? (
                <p className="mb-3 rounded border border-card-border p-3 text-base">
                    이 공시에는 표 간 수치 차이 또는 검증할 수 없는 항목이 {current.consistency_warnings.length}건
                    있습니다. 원문 값을 보존했으므로 비교할 때 공시의 기준을 확인해 주세요.
                </p>
            ) : null}
            <dl className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile size="lead" label="공인회계사" value={formatNumber(cpa, '명')} />
                <StatTile label="전 임직원" value={formatNumber(current.employee_total, '명')} />
                <StatTile label="등록회계사 (근속표)" value={formatNumber(registered, '명')} />
            </dl>
            <dl className="mb-3 grid gap-3 sm:grid-cols-2">
                <StatTile size="lead" label="회계법인 자체 매출액" value={formatKrw(current.revenue_total)} />
                <StatTile size="lead" label="임직원 1인당 매출액" value={formatKrw(current.revenue_per_employee)} />
            </dl>
            {!fields.some((field) => field.value != null) ? (
                <EmptyState title="수치 미확보" description="이 보고기간의 인력·재무 수치가 확인되지 않았습니다." />
            ) : (
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((field) => (
                        <StatTile
                            key={field.label}
                            label={field.label}
                            value={field.value == null ? '-' : field.format(field.value)}
                            hint={field.value == null ? '공시 값 미확보' : undefined}
                        />
                    ))}
                </dl>
            )}
            <Footnote>
                인원은 보고기간 말 기준입니다. 전 임직원·공인회계사·등록회계사는 서로 다른 모집단입니다. 1인당
                매출액·인건비의 분모는 전 임직원이며, 이사 1인당 직원 수는 전 임직원 ÷ 이사 수입니다.
            </Footnote>
            <Footnote>
                이사 평균 보수는 공시 보수 집계 인원으로 나눕니다. 집계 인원이 5명 미만이거나 미확보이면 평균을 표시하지
                않습니다.
            </Footnote>
            {counts.some((row) => row.note) ? (
                <Footnote>
                    {counts
                        .filter((row) => row.note)
                        .map((row) => row.label + ': ' + row.note)
                        .join(' · ')}
                </Footnote>
            ) : null}
            <section className="mt-8 space-y-3">
                <h4 className="text-lg font-medium">부문별 인력·매출</h4>
                <DataTable
                    columns={[
                        { key: 'segment', label: '부문' },
                        { key: 'people', label: '전 임직원', align: 'right' },
                        { key: 'revenue', label: '매출액', align: 'right' },
                    ]}
                    rows={(['audit', 'tax', 'advisory', 'other'] as const).map((segment) => [
                        SEGMENT_LABEL[segment],
                        formatNumber(current[`employee_${segment}`], '명'),
                        formatKrw(current[`revenue_${segment}`]),
                    ])}
                />
            </section>
        </>
    );
}
