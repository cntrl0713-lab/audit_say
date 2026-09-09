import { getFirmPersonnelCost } from '../../../../lib/firm/queries';
import {
    averageDirectorPay,
    buildCostConcepts,
    buildPersonnelCostSegments,
    rowsForReceipt,
    splitCostSegments,
} from '../../../../lib/firm/personnel';
import type { FirmAnnualSummary, FirmPersonnelCostRow } from '../../../../lib/firm/types';
import { formatKrw, formatNumber } from '../../../../lib/firm/format';
import { Basis, DataTable, EmptyState, Footnote, StatTile } from '../../_components/ui';

export default async function CompensationTab({
    firmId,
    periods,
    year,
}: {
    firmId: number;
    periods: FirmAnnualSummary[];
    year: number;
}) {
    const cost = await getFirmPersonnelCost(firmId);

    return (
        <>
            <h3 className="mb-2 text-lg font-medium">{year}년 시작 보고기간 · 인건비·보수</h3>
            {periods.length > 1 ? (
                <p className="mb-3 text-base">
                    같은 연도에 시작한 보고기간이 {periods.length}개입니다. 합산하지 않고 기간별로 표시합니다.
                </p>
            ) : null}
            {periods.length ? (
                <div className="space-y-10">
                    {periods.map((period) => (
                        <CompensationPeriodCard
                            key={period.source_rcept_no}
                            period={period}
                            cost={rowsForReceipt(cost, period.source_rcept_no)}
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

function CompensationPeriodCard({
    period,
    cost,
}: {
    period: FirmAnnualSummary;
    cost: FirmPersonnelCostRow[];
}) {
    const { shown: costSegments, omitted: emptyCostSegments } = splitCostSegments(buildPersonnelCostSegments(cost));
    const concepts = buildCostConcepts(cost);
    const averagePay = averageDirectorPay(period);

    return (
        <div className="space-y-8">
            <section>
                <p className="mb-4 text-[13px] text-foreground/70">
                    {period.fy_seq ? `제${period.fy_seq}기 · ` : ''}대상 기간 {period.fy_start_date} ~ {period.fy_end_date}
                    {' · '}접수일 {period.source_rcept_dt} ·{' '}
                    <a
                        href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${period.source_rcept_no}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                    >
                        DART 원문
                    </a>
                </p>
                <dl className="grid gap-3 sm:grid-cols-2">
                    <StatTile
                        size="lead"
                        label="전 임직원 1인당 인건비"
                        value={formatKrw(period.salary_per_employee)}
                        hint={period.salary_per_employee === null ? '공시 값 미확보' : '전 임직원 인건비 ÷ 기말 전 임직원 수'}
                    />
                    <StatTile
                        label="전 임직원 인건비 총액"
                        value={formatKrw(period.salary_total)}
                        hint={period.salary_total === null ? '공시 값 미확보' : '대상 보고기간 기준'}
                    />
                </dl>
                <Basis title="인건비의 집계 기준">
                    인건비와 인원은 이사를 포함한 전 임직원 기준입니다. 1인당 인건비의 분모는 보고기간 말 전
                    임직원 수이며, 근속 분포의 등록회계사 수와는 모집단이 다릅니다. 금액은 각 보고기간의 실적이며
                    기간 길이를 환산하지 않습니다. 부문 구분은 공시 표기를 따르고, ‘-’는 결측이며 0과 구분합니다.
                </Basis>
                {period.consistency_warnings.length ? (
                    <Basis title={`공시 정합성 확인 사항 ${period.consistency_warnings.length}건`}>
                        원문 값을 보존했습니다. 표 간 수치 차이 또는 검증할 수 없는 항목이 있습니다.
                    </Basis>
                ) : null}
            </section>

            <section>
                <h4 className="mb-3 text-lg font-medium">이사 보수</h4>
                <dl className="grid gap-3 sm:grid-cols-2">
                    <StatTile
                        label="이사 보수 총액"
                        value={formatKrw(period.director_pay_total)}
                        hint={period.director_pay_total === null ? '공시 값 미확보' : '공시된 이사 보수 집계 기준'}
                    />
                    {averagePay !== null ? (
                        <StatTile
                            label="이사 1인당 평균 보수"
                            value={formatKrw(averagePay)}
                            hint={`공시 보수 집계 인원 ${formatNumber(period.director_pay_count, '명')} 기준`}
                        />
                    ) : null}
                </dl>
                <Footnote>
                    이사 평균 보수는 공시 보수 집계 인원으로 나눕니다. 집계 인원이 5명 미만이거나 미확보이면 평균을
                    표시하지 않습니다.
                </Footnote>
            </section>

            <section>
                <h4 className="mb-3 text-lg font-medium">부문별 인건비</h4>
                {costSegments.length ? (
                    <DataTable
                        columns={[
                            { key: 'segment', label: '부문', align: 'left', priority: 'always' },
                            { key: 'amount', label: '인건비', align: 'right', priority: 'always' },
                            { key: 'headcount', label: '전 임직원 수', align: 'right', priority: 'wide' },
                            { key: 'perHead', label: '1인당 인건비', align: 'right', priority: 'always' },
                        ]}
                        rows={costSegments.map((segment) => [
                            <span key="segment" className="block">
                                {segment.label}
                                {segment.note ? (
                                    <small className="block text-[13px] text-foreground/60">{segment.note}</small>
                                ) : null}
                            </span>,
                            formatKrw(segment.amount),
                            formatNumber(segment.headcount, '명'),
                            formatKrw(segment.perHead),
                        ])}
                    />
                ) : (
                    <EmptyState
                        title="부문별 인건비 수치 미확보"
                        description="이 보고기간의 부문별 인건비와 인원이 확인되지 않았습니다."
                    />
                )}
                <Footnote>
                    1인당 인건비는 이사를 포함한 전체 임직원 인건비를 같은 표의 인원으로 나눈 값입니다. 근속 분포의
                    등록회계사 수로 나눈 값이 아닙니다.
                    {emptyCostSegments.length
                        ? ` ${emptyCostSegments.map((segment) => segment.label).join(' · ')} 부문은 금액도 인원도 공시되지 않아 표에서 뺐습니다.`
                        : ''}
                </Footnote>
            </section>

            {concepts.length ? (
                <section>
                    <h4 className="mb-3 text-lg font-medium">그 밖의 인력 관련 비용</h4>
                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {concepts.map((concept) => (
                            <StatTile
                                key={concept.concept}
                                label={concept.label}
                                value={formatKrw(concept.amount)}
                                hint={concept.note ?? undefined}
                            />
                        ))}
                    </dl>
                    <Footnote>전체 기준으로만 공시되어 부문별로 나누지 않습니다.</Footnote>
                </section>
            ) : null}
        </div>
    );
}
