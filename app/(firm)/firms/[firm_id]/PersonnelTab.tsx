import { StackedBarChart } from '../../_components/charts';
import { getFirmPersonnelCost, getFirmAuditInput } from '../../../../lib/firm/queries';
import {
    buildAuditInput,
    buildCostConcepts,
    buildPersonnelCostSegments,
    buildTenureSegments,
    rowsForReceipt,
    splitCostSegments,
    splitTenureSegments,
    summarizeTurnover,
} from '../../../../lib/firm/personnel';
import type {
    FirmAnnualSummary,
    FirmCpaTenureRow,
    FirmPersonnelCostRow,
    FirmAuditInputRow,
} from '../../../../lib/firm/types';
import { formatDecimal, formatNumber, formatRatio, formatKrw } from '../../../../lib/firm/format';
import { Basis, Footnote, DataTable, EmptyState, StatTile } from '../../_components/ui';

export default async function PersonnelTab({
    firmId,
    periods,
    year,
    tenure,
}: {
    firmId: number;
    periods: FirmAnnualSummary[];
    year: number;
    tenure: FirmCpaTenureRow[];
}) {
    const [cost, auditInput] = await Promise.all([getFirmPersonnelCost(firmId), getFirmAuditInput(firmId)]);
    return (
        <>
            <h3 className="mb-2 text-lg font-medium">{year}년 시작 보고기간 · 인력 구성과 인건비</h3>
            <Basis>
                근속 분포는 <strong className="font-medium">등록회계사 (공인회계사 중 근속표 모집단)</strong>, 인건비
                표의 인원은 <strong className="font-medium">전 임직원</strong> 기준이라 두 인원은 서로 다릅니다. 같은
                수로 비교하지 마십시오. 부문 구분과 근속 구간은 공시 표기를 그대로 따르며, 값이 없으면 0 이 아니라
                결측으로 둡니다.
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
                            key={period.source_rcept_no}
                            period={period}
                            tenure={rowsForReceipt(tenure, period.source_rcept_no)}
                            cost={rowsForReceipt(cost, period.source_rcept_no)}
                            auditInput={rowsForReceipt(auditInput, period.source_rcept_no)}
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
    auditInput,
}: {
    period: FirmAnnualSummary;
    tenure: FirmCpaTenureRow[];
    cost: FirmPersonnelCostRow[];
    auditInput: FirmAuditInputRow[];
}) {
    const { shown: segments, omitted: emptySegments } = splitTenureSegments(buildTenureSegments(tenure));
    const turnover = summarizeTurnover(tenure);
    const { shown: costSegments, omitted: emptyCostSegments } = splitCostSegments(buildPersonnelCostSegments(cost));
    const concepts = buildCostConcepts(cost);
    const input = buildAuditInput(auditInput);
    const nothing =
        input.length === 0 &&
        segments.length === 0 &&
        turnover === null &&
        costSegments.length === 0 &&
        concepts.length === 0;

    return (
        <div className="space-y-8">
            <p className="text-[13px]">
                {period.fy_seq ? `제${period.fy_seq}기 · ` : ''}대상 기간 {period.fy_start_date} ~ {period.fy_end_date}{' '}
                · 접수일 {period.source_rcept_dt} ·{' '}
                <a
                    href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${period.source_rcept_no}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                >
                    DART 원문
                </a>
            </p>

            {period.consistency_warnings.length ? (
                <Basis title={`공시 정합성 확인 사항 ${period.consistency_warnings.length}건`}>
                    원문 값을 보존했습니다. 표 간 수치 차이 또는 검증할 수 없는 항목이 있습니다.
                </Basis>
            ) : null}
            {period.consistency_warnings.some((warning) => warning.startsWith('auditInputExceedsCpa')) ? (
                <p className="rounded-lg border border-card-border p-3 text-[15px]">
                    감사 투입 인력이 공인회계사 수보다 큽니다. 원문 값을 보존했으므로 투입 인력 집계 기준을 확인해 주세요.
                </p>
            ) : null}
            {nothing ? (
                <EmptyState
                    title="인력·인건비 수치 미확보"
                    description="이 보고기간의 근속 분포와 인건비 표가 확인되지 않았습니다."
                />
            ) : null}

            {turnover ? (
                <section>
                    <h4 className="mb-2 text-lg font-medium">등록회계사 입·퇴사</h4>
                    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                        <StatTile label="기초 인원" value={formatNumber(turnover.begin, '명')} />
                        <StatTile size="lead" label="입사" value={formatNumber(turnover.hires, '명')} />
                        <StatTile size="lead" label="퇴사" value={formatNumber(turnover.leavers, '명')} />
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
                        <StatTile
                            size="lead"
                            label="퇴사율"
                            value={formatRatio(turnover.leaverRate)}
                            hint="퇴사자 ÷ 기초 인원"
                        />
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
                    <h4 className="mb-2 text-lg font-medium">등록회계사 근속 분포</h4>
                    <StackedBarChart title="등록회계사 근속 분포" rows={segments} />
                    <Footnote>
                        비중은 구간 값이 확인된 인원만을 분모로 씁니다.
                        {segments.some((segment) => segment.totalMismatch)
                            ? ' 일부 부문은 구간 합과 공시 합계가 다릅니다. 두 값을 함께 두고 어느 쪽도 고치지 않았습니다.'
                            : ''}
                    </Footnote>
                </section>
            ) : null}

            {emptySegments.length ? (
                <Footnote>
                    {emptySegments.map((segment) => segment.label).join(' · ')} 부문은 이 보고기간에 근속 인원을
                    공시하지 않아 그래프와 표에서 뺐습니다.
                </Footnote>
            ) : null}

            {costSegments.length ? (
                <section>
                    <h4 className="mb-2 text-lg font-medium">부문별 인건비</h4>
                    <DataTable
                        columns={[
                            { key: '0', label: '부문', align: 'left', priority: 'always' },
                            { key: '1', label: '인건비', align: 'right', priority: 'always' },
                            { key: '2', label: '전 임직원 수', align: 'right', priority: 'wide' },
                            { key: '3', label: '1인당 인건비', align: 'right', priority: 'always' },
                        ]}
                        rows={costSegments.map((segment) => [
                            <span key="0" className="block">
                                {segment.label}
                                {segment.note ? (
                                    <small className="block text-[13px] text-foreground/50">{segment.note}</small>
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
                            </span>,
                        ])}
                    />
                    <Footnote>
                        1인당 인건비는 이사를 포함한 전체 임직원 인건비를 같은 표의 인원으로 나눈 값입니다. 위 근속
                        분포의 등록회계사 수로 나눈 값이 아닙니다.
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
                    <Footnote>전체 기준으로만 공시되어 부문별로 나누지 않습니다.</Footnote>
                </section>
            ) : null}
            <section className="space-y-3">
                <h4 className="text-lg font-medium">감사 투입</h4>
                {input.length ? (
                    <DataTable
                        columns={[
                            { key: 'band', label: '경력 구간' },
                            { key: 'mid', label: '중간 (mid)', priority: 'wide' },
                            { key: 'end', label: '기말 (end)', priority: 'wide' },
                            { key: 'total', label: '합계 (tot)' },
                            { key: 'average', label: '1인당 연간 감사시간', align: 'right' },
                        ]}
                        rows={input.map((row) => [
                            row.label,
                            <span key="mid">
                                {formatNumber(row.mid_headcount, '명')}
                                <br />
                                {formatNumber(row.mid_hours, '시간')}
                            </span>,
                            <span key="end">
                                {formatNumber(row.end_headcount, '명')}
                                <br />
                                {formatNumber(row.end_hours, '시간')}
                            </span>,
                            <span key="total">
                                {formatNumber(row.tot_headcount, '명')}
                                <br />
                                {formatNumber(row.tot_hours, '시간')}
                            </span>,
                            formatDecimal(row.hoursPerHead, 1, '시간'),
                        ])}
                    />
                ) : (
                    <EmptyState title="감사 투입 수치 미확보" />
                )}
                <Footnote>
                    감사 부문 투입 한정이며 회계법인 전체 근로시간이 아닙니다. 중간(mid)·기말(end)·합계(tot)는 공시
                    원문의 구분입니다. 1인당 연간 감사시간은 해당 보고기간의 합계 감사시간 ÷ 같은 경력 구간의 합계 투입
                    인력(tot_headcount)이며, 보고기간 길이를 12개월로 환산하지 않습니다. 수습을 포함하는 경력 구간으로
                    위 근속연차 구간과 기준이 다릅니다.
                </Footnote>
            </section>
        </div>
    );
}
