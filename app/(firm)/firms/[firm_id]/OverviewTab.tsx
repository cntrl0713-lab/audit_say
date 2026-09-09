import { buildFirmOverview } from '../../../../lib/firm/overview';
import { formatKrw, formatNumber, formatRatio } from '../../../../lib/firm/format';
import type { FirmAnnualSummary, FirmCpaTenureRow, FirmHeadcountRow } from '../../../../lib/firm/types';
import { Basis, EmptyState } from '../../_components/ui';
import { RevenuePieChart, TenureDistribution } from './OverviewCharts';

type Overview = ReturnType<typeof buildFirmOverview>;

export default function OverviewTab({ summaries, periods, tenure, headcounts }: {
    summaries: FirmAnnualSummary[];
    periods: FirmAnnualSummary[];
    tenure: FirmCpaTenureRow[];
    headcounts: FirmHeadcountRow[];
}) {
    if (!periods.length) {
        return <EmptyState title="주요정보 미확보" description="선택한 연도에 시작한 보고기간 자료가 아직 없습니다. 다른 연도를 선택해 주세요." />;
    }
    return <div className="space-y-8">
        {periods.length > 1 ? <p className="text-sm leading-relaxed text-foreground/70">같은 연도에 시작한 보고기간이 {periods.length}개입니다. 기간별로 표시하며 실적을 합산하지 않습니다.</p> : null}
        {periods.map(period => <OverviewPeriod key={period.source_rcept_no} period={period} showPeriod={periods.length > 1} overview={buildFirmOverview(period, summaries, headcounts, tenure)} />)}
    </div>;
}

function Growth({ growth }: { growth: Overview['revenueGrowth'] }) {
    if (growth.rate === null) return <p className="mt-3 text-[13px] leading-relaxed text-foreground/70">{growth.note}</p>;
    const rate = growth.rate;
    return <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
        <span className="text-foreground/70">전년 대비</span>
        <span className="font-medium tabular-nums">{rate > 0 ? '+' : rate < 0 ? '−' : ''}{formatRatio(Math.abs(rate))}</span>
    </p>;
}

function OverviewPeriod({ period, overview, showPeriod }: { period: FirmAnnualSummary; overview: Overview; showPeriod: boolean }) {
    const { cpa, revenueGrowth, cpaGrowth, revenueMix, tenure, turnover } = overview;
    return <section aria-label={`${period.fy_start_year}년 시작 보고기간 주요정보`} className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h3 className="text-xl sm:text-2xl">업무와 인력 한눈에 보기</h3>
            {showPeriod ? <p className="text-[13px] leading-relaxed text-foreground/70">
                {period.fy_seq ? `제${period.fy_seq}기 · ` : ''}{period.fy_start_date} ~ {period.fy_end_date}
            </p> : null}
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:gap-5">
            <div className="min-w-0 rounded-xl border border-card-border bg-card p-4 sm:p-6">
                <dt className="text-sm text-foreground/80">총매출</dt>
                <dd className="mt-2 break-words text-[28px] leading-tight tabular-nums sm:text-4xl">{formatKrw(period.revenue_total)}</dd>
                <Growth growth={revenueGrowth} />
                <p className="mt-2 text-[13px] text-foreground/70">회계법인 자체 실적</p>
            </div>
            <div className="min-w-0 rounded-xl border border-card-border bg-card p-4 sm:p-6">
                <dt className="text-sm text-foreground/80">공인회계사 수</dt>
                <dd className="mt-2 break-words text-[28px] leading-tight tabular-nums sm:text-4xl">{formatNumber(cpa, '명')}</dd>
                <Growth growth={cpaGrowth} />
                <p className="mt-2 text-[13px] text-foreground/70">보고기간 말 인원</p>
            </div>
        </dl>

        <div className="grid items-start gap-5 lg:grid-cols-2">
            <section className="min-w-0 rounded-xl border border-card-border bg-card p-4 sm:p-6">
                <h4 className="text-lg">매출의 업무 구성</h4>
                <p className="mb-6 mt-1 text-sm leading-relaxed text-foreground/70">감사·세무·경영자문 등 업무별 매출 비중</p>
                <RevenuePieChart {...revenueMix} />
            </section>
            <section className="min-w-0 rounded-xl border border-card-border bg-card p-4 sm:p-6">
                <h4 className="text-lg">근속연수별 분포</h4>
                <p className="mb-5 mt-1 text-sm leading-relaxed text-foreground/70">등록회계사의 근속 구간별 인원과 비중</p>
                <TenureDistribution tenure={tenure} />
                <div className="mt-6 border-t border-card-border pt-5">
                    <h4 className="text-base">입·퇴사 현황</h4>
                    <p className="mt-1 text-[13px] text-foreground/70">해당 보고기간 · 등록회계사 기준</p>
                    <dl className="mt-4 grid grid-cols-2 gap-4">
                        <div className="border-l-2 border-primary pl-3">
                            <dt className="text-sm text-foreground/80">입사</dt>
                            <dd className="mt-1 text-2xl tabular-nums">{formatNumber(turnover?.hires, '명')}</dd>
                        </div>
                        <div className="border-l-2 border-foreground/40 pl-3">
                            <dt className="text-sm text-foreground/80">퇴사</dt>
                            <dd className="mt-1 text-2xl tabular-nums">{formatNumber(turnover?.leavers, '명')}</dd>
                        </div>
                    </dl>
                    {turnover?.reconciles === false ? <p className="mt-3 text-[13px] leading-relaxed text-foreground/70">공시의 기초·입사·퇴사·기말 인원이 서로 맞지 않습니다. 원문 수치를 표시했습니다.</p> : null}
                    {turnover === null ? <p className="mt-3 text-[13px] text-foreground/70">입·퇴사 수치 미확보</p> : null}
                </div>
            </section>
        </div>

        <Basis title="집계 기준과 공시 원문">
            <div className="space-y-2">
                <p>매출은 위 보고기간의 회계법인 자체 실적이며, 감사대상회사 매출이 아닙니다. 인원은 보고기간 말 기준입니다. ‘-’와 ‘미확보’는 결측으로 0과 다릅니다.</p>
                <p>공인회계사 수는 인원표, 근속 분포와 입·퇴사는 등록회계사 근속표를 사용합니다. 서로 다른 모집단을 같은 인원으로 환산하지 않습니다.</p>
                <p>성장률은 (당기 − 전기) ÷ 전기입니다. 바로 전년의 비교 가능한 보고기간과 동일한 인원 기준을 사용하며, 비교 자료가 없거나 전기 값이 0이면 계산하지 않습니다.</p>
                <p>매출 비교: {revenueGrowth.note} · 인원 비교: {cpaGrowth.note}</p>
                {period.consistency_warnings.length ? <p>공시 표 간 수치 차이 또는 검증할 수 없는 항목이 {period.consistency_warnings.length}건 있습니다. 원문 값을 보존했습니다.</p> : null}
                <p>접수일 {period.source_rcept_dt} · <a href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${period.source_rcept_no}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">DART 공시 원문 보기</a></p>
            </div>
        </Basis>
    </section>;
}
