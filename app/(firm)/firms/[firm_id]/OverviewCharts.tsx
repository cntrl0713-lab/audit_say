import { formatKrw, formatNumber, formatRatio } from '../../../../lib/firm/format';
import type { TenureSegmentView } from '../../../../lib/firm/personnel';

const REVENUE_COLORS = ['#f54e00', '#26251e', '#82765f', '#d6c3a4'];

type RevenueSegment = {
    key: string;
    label: string;
    value: number | null;
    share: number | null;
};

function pieSector(start: number, share: number): string {
    const startAngle = start * Math.PI * 2 - Math.PI / 2;
    const endAngle = (start + share) * Math.PI * 2 - Math.PI / 2;
    const radius = 96;
    const startX = 100 + radius * Math.cos(startAngle);
    const startY = 100 + radius * Math.sin(startAngle);
    const endX = 100 + radius * Math.cos(endAngle);
    const endY = 100 + radius * Math.sin(endAngle);
    return `M 100 100 L ${startX} ${startY} A ${radius} ${radius} 0 ${share > 0.5 ? 1 : 0} 1 ${endX} ${endY} Z`;
}

/** 수치는 범례에 항상 노출하며, 값이 불완전하면 원을 채워 비중을 추정하지 않는다. */
export function RevenuePieChart({
    segments,
    canChart,
    note,
}: {
    segments: readonly RevenueSegment[];
    canChart: boolean;
    note: string;
}) {
    const shareTotal = segments.reduce((sum, segment) => sum + (segment.share ?? 0), 0);
    const validMix =
        canChart &&
        segments.length > 0 &&
        segments.every(
            (segment) => (segment.value === null && segment.share === null) || (
                segment.value !== null &&
                Number.isFinite(segment.value) &&
                segment.value >= 0 &&
                segment.share !== null &&
                Number.isFinite(segment.share) &&
                segment.share >= 0),
        ) &&
        segments.some((segment) => segment.value !== null && segment.value > 0) &&
        Math.abs(shareTotal - 1) < 0.000001;
    let start = 0;
    const sectors = validMix
        ? segments.flatMap((segment, index) => {
              const share = segment.share ?? 0;
              const sector = {
                  key: segment.key,
                  color: REVENUE_COLORS[index % REVENUE_COLORS.length],
                  path: pieSector(start, share),
              };
              start += share;
              return share > 0 ? [sector] : [];
          })
        : [];

    return (
        <div className="@container space-y-4">
            <div
                className={`grid items-center gap-5 ${validMix ? '@min-[440px]:grid-cols-[180px_minmax(0,1fr)]' : ''}`}
            >
                {validMix ? (
                    <svg
                        role="img"
                        aria-label="매출 업무 구성 원그래프. 업무별 매출액과 비중은 범례에 표시되어 있습니다."
                        viewBox="0 0 200 200"
                        className="mx-auto block h-auto w-[180px] max-w-full"
                    >
                        {sectors.length === 1 ? (
                            <circle cx="100" cy="100" r="96" fill={sectors[0].color} />
                        ) : (
                            sectors.map((sector) => (
                                <path
                                    key={sector.key}
                                    d={sector.path}
                                    fill={sector.color}
                                    stroke="var(--card)"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                />
                            ))
                        )}
                    </svg>
                ) : null}
                <dl className="min-w-0 divide-y divide-card-border">
                    {segments.map((segment, index) => (
                        <div key={segment.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-3 first:pt-0 last:pb-0">
                            <dt className="flex min-w-0 items-center gap-2 text-sm font-medium">
                                <span
                                    aria-hidden="true"
                                    className="size-2.5 shrink-0 rounded-[2px]"
                                    style={{ backgroundColor: REVENUE_COLORS[index % REVENUE_COLORS.length] }}
                                />
                                {segment.label}
                            </dt>
                            <dd className="text-right text-sm tabular-nums">
                                <span className="font-medium">
                                    {segment.share === null ? '비중 미확보' : formatRatio(segment.share)}
                                </span>
                                <span className="mt-0.5 block text-[13px] text-foreground/65">
                                    {segment.value === null ? '매출 미확보' : formatKrw(segment.value)}
                                </span>
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
            {note || !validMix ? (
                <p className="text-[13px] leading-relaxed text-foreground/65">
                    {note || '매출 구성의 비중을 확인할 수 없어 원그래프를 표시하지 않습니다.'}
                </p>
            ) : null}
        </div>
    );
}

/** 공시 근속표의 전체 행만 표시한다. 비중의 분모는 확인된 구간 인원 합이다. */
export function TenureDistribution({ tenure }: { tenure: TenureSegmentView | null }) {
    const hasObservedBands = tenure !== null && tenure.bands.some((band) => band.count !== null);
    const partial = hasObservedBands && tenure!.bands.some((band) => band.count === null);
    const colors = ['#f54e00', '#26251e', '#70634f', '#9b8463', '#c4ad88', '#e2d3bb'];
    const hasShares = tenure !== null && tenure.bands.some((band) => band.share !== null && band.share > 0);

    return (
        <div className="@container space-y-4">
            {tenure && hasObservedBands ? (
                <div className="space-y-4">
                    {hasShares ? (
                        <div
                            role="img"
                            aria-label="등록회계사 근속 분포 누적 막대그래프. 왼쪽부터 근속연수 순이며 구간별 인원과 비중은 아래 범례에 표시되어 있습니다."
                            className="flex h-9 w-full overflow-hidden rounded-md"
                        >
                            {tenure.bands.map((band, index) =>
                                band.share !== null && Number.isFinite(band.share) && band.share > 0 ? (
                                    <div
                                        key={band.key}
                                        className="h-full shrink-0"
                                        style={{
                                            width: `${Math.min(band.share, 1) * 100}%`,
                                            backgroundColor: colors[index % colors.length],
                                        }}
                                    />
                                ) : null,
                            )}
                        </div>
                    ) : (
                        <p className="text-sm leading-relaxed text-foreground/65">확인된 근속 인원은 0명으로 비중을 계산하지 않았습니다.</p>
                    )}
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 @min-[440px]:grid-cols-3">
                        {tenure.bands.map((band, index) => (
                            <div key={band.key} className="min-w-0">
                                <dt className="flex items-center gap-2 text-sm">
                                    <span
                                        aria-hidden="true"
                                        className="size-2.5 shrink-0 rounded-[2px]"
                                        style={{ backgroundColor: colors[index % colors.length] }}
                                    />
                                    {band.label}
                                </dt>
                                <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-[18px] text-sm tabular-nums">
                                    <span className="font-medium">
                                        {band.count === null ? '미확보' : formatNumber(band.count, '명')}
                                    </span>
                                    <span className="text-[13px] text-foreground/65">
                                        {band.share === null ? '—' : formatRatio(band.share)}
                                    </span>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            ) : (
                <p className="rounded-lg bg-background px-4 py-5 text-sm leading-relaxed text-foreground/65">
                    근속 구간별 인원을 아직 확보하지 못했습니다.
                    {tenure?.total !== null && tenure?.total !== undefined
                        ? ` 근속표에 공시된 합계는 ${formatNumber(tenure.total, '명')}입니다.`
                        : ''}
                </p>
            )}
            <div className="space-y-1.5 text-[13px] leading-relaxed text-foreground/65">
                <p>등록회계사 기준으로, 전체 공인회계사 수와 집계 범위가 다릅니다.</p>
                {hasObservedBands ? <p>비중은 확인된 근속 구간의 인원 합을 기준으로 계산합니다.</p> : null}
                {partial ? <p>일부 구간은 미확보 상태이며, 0명으로 처리하지 않았습니다.</p> : null}
                {tenure?.totalMismatch ? (
                    <p className="font-medium text-foreground/80">
                        구간 합 {formatNumber(tenure.observed, '명')}과 공시 합계 {formatNumber(tenure.total, '명')}이 다릅니다.
                    </p>
                ) : null}
            </div>
        </div>
    );
}
