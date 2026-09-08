import { getFirmPersonnelCost } from '../../../../lib/firm/queries';
import { buildCostConcepts, buildPersonnelCostSegments, buildTenureSegments, rowsForReceipt, splitCostSegments, splitTenureSegments, summarizeTurnover, TENURE_BANDS } from '../../../../lib/firm/personnel';
import type { FirmAnnualSummary, FirmCpaTenureRow, FirmPersonnelCostRow } from '../../../../lib/firm/types';
import { formatNumber, formatRatio, formatKrw } from '../../../../lib/firm/format';
import { Basis, Footnote, DataTable, EmptyState, StatTile } from '../../_components/ui';

export default async function PersonnelTab({ firmId, periods, year, tenure }: { firmId: number; periods: FirmAnnualSummary[]; year: number; tenure: FirmCpaTenureRow[] }) {
    const cost = await getFirmPersonnelCost(firmId);
    return (
        <>
            <h3 className="mb-2 text-lg font-medium">{year}년 시작 보고기간 · 인력 구성과 인건비</h3>
            <Basis>
                근속 분포는 <strong className="font-medium">공인회계사</strong>, 인건비 표의 인원은{' '}
                <strong className="font-medium">전 임직원</strong> 기준이라 두 인원은 서로 다릅니다. 같은 수로 비교하지
                마십시오. 부문 구분과 근속 구간은 공시 표기를 그대로 따르며, 값이 없으면 0 이 아니라 결측으로 둡니다.
            </Basis>
            {periods.length > 1 ? (
                <p className="mb-3 text-base">
                    같은 연도에 시작한 보고기간이 {periods.length}개입니다. 합산하지 않고 기간별로 표시합니다.
                </p>
            ) : null}
            {periods.length ? (
                <div className="space-y-8">
                    {periods.map((period) => (
                        <PersonnelPeriodCard
                            key={period.fy_end_date}
                            period={period}
                            tenure={rowsForReceipt(tenure, period.source_rcept_no)}
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

function PersonnelPeriodCard({
    period,
    tenure,
    cost,
}: {
    period: FirmAnnualSummary;
    tenure: FirmCpaTenureRow[];
    cost: FirmPersonnelCostRow[];
}) {
    const { shown: segments, omitted: emptySegments } = splitTenureSegments(buildTenureSegments(tenure));
    const turnover = summarizeTurnover(tenure);
    const { shown: costSegments, omitted: emptyCostSegments } = splitCostSegments(buildPersonnelCostSegments(cost));
    const concepts = buildCostConcepts(cost);
    const nothing = segments.length === 0 && turnover === null && costSegments.length === 0 && concepts.length === 0;

    return (
        <div className="space-y-8">
            <p className="text-[13px]">
                {period.fy_seq ? `제${period.fy_seq}기 · ` : ''}대상 기간 {period.fy_start_date} ~ {period.fy_end_date} ·
                접수일 {period.source_rcept_dt} ·{' '}
                <a
                    href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${period.source_rcept_no}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                >
                    DART 원문
                </a>
            </p>

            {nothing ? (
                <EmptyState
                    title="인력·인건비 수치 미확보"
                    description="이 보고기간의 근속 분포와 인건비 표가 확인되지 않았습니다."
                />
            ) : null}

            {turnover ? (
                <section>
                    <h4 className="mb-2 text-lg font-medium">공인회계사 입·퇴사</h4>
                    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                        <StatTile label="기초 인원" value={formatNumber(turnover.begin, '명')} />
                        <StatTile label="입사" value={formatNumber(turnover.hires, '명')} />
                        <StatTile label="퇴사" value={formatNumber(turnover.leavers, '명')} />
                        <StatTile label="기말 인원" value={formatNumber(turnover.end, '명')} />
                        <StatTile
                            label="순증"
                            value={
                                turnover.net === null
                                    ? '-'
                                    : `${turnover.net < 0 ? '−' : '+'}${formatNumber(Math.abs(turnover.net), '명')}`
                            }
                            hint="기말 − 기초"
                        />
                        <StatTile label="퇴사율" value={formatRatio(turnover.leaverRate)} hint="퇴사자 ÷ 기초 인원" />
                    </dl>
                    {turnover.reconciles === false ? (
                        <p className="mt-2 rounded border border-card-border p-3 text-base">
                            기초 + 입사 − 퇴사가 기말 인원과 맞지 않습니다. 원문 값을 고치지 않고 그대로 두었으니 비교할
                            때 공시의 집계 기준을 확인해 주세요.
                        </p>
                    ) : null}
                </section>
            ) : null}

            {segments.length ? (
                <section>
                    <h4 className="mb-2 text-lg font-medium">공인회계사 근속 분포</h4>
                    <DataTable columns={[{ key: 'segment', label: '부문' }, ...TENURE_BANDS.map(band => ({ key: band.key, label: band.label, align: 'right' as const, priority: 'wide' as const })), { key: 'total', label: '공시 합계', align: 'right' }]} rows={segments.map(segment => [segment.label, ...segment.bands.map(band => <span key={band.key}>{formatNumber(band.count)}<small className="block">{formatRatio(band.share)}</small></span>), <span key="total">{formatNumber(segment.total)}{segment.totalMismatch ? <small className="block">구간 합 {formatNumber(segment.observed)}</small> : null}</span>])} />
                    <Footnote>
                        비중은 구간 값이 확인된 인원만을 분모로 씁니다.
                        {segments.some((segment) => segment.totalMismatch)
                            ? ' 일부 부문은 구간 합과 공시 합계가 다릅니다. 두 값을 함께 두고 어느 쪽도 고치지 않았습니다.'
                            : ''}
                        {emptySegments.length
                            ? ` ${emptySegments.map((segment) => segment.label).join(' · ')} 부문은 이 보고기간에 근속 인원을 공시하지 않아 표에서 뺐습니다.`
                            : ''}
                    </Footnote>
                </section>
            ) : null}

            {costSegments.length ? (
                <section>
                    <h4 className="mb-2 text-lg font-medium">부문별 인건비</h4>
                    <DataTable columns={[{"key":"0","label":"부문","align":"left","priority":"always"},{"key":"1","label":"인건비","align":"right","priority":"always"},{"key":"2","label":"전 임직원 수","align":"right","priority":"wide"},{"key":"3","label":"1인당 인건비","align":"right","priority":"always"}]} rows={costSegments.map(segment => [<span key="0" className="block">
                                            {segment.label}
                                            {segment.note ? (
                                                <div className="text-[13px] text-foreground/50">{segment.note}</div>
                                            ) : null}
                                        </span>,
<span key="1" className="block">
                                            {formatKrw(segment.amount)}
                                        </span>,
<span key="2" className="block">
                                            {formatNumber(segment.headcount, '명')}
                                        </span>,
<span key="3" className="block">
                                            {formatKrw(segment.perHead)}
                                        </span>])} />
                    <Footnote>
                        1인당 인건비는 이사를 포함한 전체 임직원 인건비를 같은 표의 인원으로 나눈 값입니다. 위 근속
                        분포의 공인회계사 수로 나눈 값이 아닙니다.
                        {emptyCostSegments.length
                            ? ` ${emptyCostSegments.map((segment) => segment.label).join(' · ')} 부문은 금액도 인원도 공시되지 않아 표에서 뺐습니다.`
                            : ''}
                    </Footnote>
                </section>
            ) : null}

            {concepts.length ? (
                <section>
                    <h4 className="mb-2 text-lg font-medium">그 밖의 인력 관련 비용</h4>
                    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                        {concepts.map((concept) => (
                            <StatTile
                                key={concept.concept}
                                label={concept.label}
                                value={formatKrw(concept.amount)}
                                hint={concept.note ?? undefined}
                            />
                        ))}
                    </dl>
                    <Footnote>
                        전체 기준으로만 공시되어 부문별로 나누지 않습니다.
                    </Footnote>
                </section>
            ) : null}
        </div>
    );
}
