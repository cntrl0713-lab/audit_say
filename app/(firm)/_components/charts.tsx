import { buildLineSeries, buildStackedBars } from '../../../lib/firm/chart';
import { formatKrw, formatNumber, formatRatio } from '../../../lib/firm/format';
import type { TenureSegmentView } from '../../../lib/firm/personnel';
import type { TrendSeries } from '../../../lib/firm/trend';
import { DataTable, Footnote, StatTile } from './ui';

const COLORS = [
    'var(--primary)',
    'var(--foreground)',
    'color-mix(in srgb, var(--foreground) 65%, transparent)',
    'color-mix(in srgb, var(--foreground) 45%, transparent)',
    'color-mix(in srgb, var(--foreground) 30%, transparent)',
    'color-mix(in srgb, var(--foreground) 18%, transparent)',
];

function formatValue(value: number | null, unit: TrendSeries['unit']) {
    return unit === 'krw' ? formatKrw(value) : unit === 'people' ? formatNumber(value, '명') : formatRatio(value);
}

/** 서버 렌더링 SVG와 복사·접근성·인쇄를 위한 원표를 함께 제공한다. */
export function TrendChart({
    title,
    years,
    series,
    multiPeriodYears = [],
    latestFirst = false,
}: {
    title: string;
    years: readonly number[];
    series: readonly TrendSeries[];
    multiPeriodYears?: readonly number[];
    /** 수치 카드는 최신 확보 기간부터 세로로, 원표의 미확보 값은 마지막에 표시한다. */
    latestFirst?: boolean;
}) {
    const displaySeries = latestFirst ? series.map((s) => ({
        ...s,
        points: [...s.points].sort((a, b) =>
            Number(a.value === null) - Number(b.value === null) || b.x - a.x),
    })) : series;
    const values = series.flatMap((s) => s.points.flatMap((p) => (p.value === null ? [] : [p.value])));
    const domain: [number, number] = [Math.min(0, ...values), Math.max(0, ...values)];
    const plots = series.map((s) =>
        buildLineSeries(s.points, { xDomain: [years[0] - 0.3, years[years.length - 1] + 0.3], yDomain: domain }),
    );
    const plot = plots[0];
    // 1~2개 보고기간은 추세를 주장하지 않고 확인된 수치 카드로 표시한다.
    const hasTrend = series.some((s) => s.points.filter((p) => p.value !== null).length >= 3);
    if (!plot) return null;
    return (
        <section className="min-w-0 space-y-3 rounded-lg border border-card-border bg-card p-4">
            <h4 className="text-lg font-medium">{title}</h4>
            {hasTrend ? (
                <>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                        {series.map((s, index) => (
                            <li key={s.key} className="flex items-center gap-2">
                                <span
                                    aria-hidden="true"
                                    className="h-2 w-4"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                {s.label}
                            </li>
                        ))}
                    </ul>
                    <svg
                        role="img"
                        aria-label={`${title} · 보고기간 시작연도별 추이`}
                        viewBox={`0 0 ${plot.width} ${plot.height}`}
                        className="block h-auto w-full text-foreground"
                    >
                        <title>{title}</title>
                        <desc>
                            가로축은 보고기간 시작연도입니다. 결측은 점을 찍지 않고 선을 끊습니다. 복수 기수는 연도 안의
                            별도 점이며 합산하지 않습니다. 상세 수치는 아래 수치 보기에서 확인할 수 있습니다.
                        </desc>
                        {plot.ticks.map((tick) => (
                            <g key={tick.value}>
                                <line
                                    x1={plot.left}
                                    x2={plot.right}
                                    y1={tick.position}
                                    y2={tick.position}
                                    stroke="currentColor"
                                    strokeOpacity="0.12"
                                />
                                <text
                                    x={plot.left - 8}
                                    y={tick.position + 4}
                                    textAnchor="end"
                                    fill="currentColor"
                                    fontSize="18"
                                >
                                    {formatValue(tick.value, series[0].unit)}
                                </text>
                            </g>
                        ))}
                        {series.map((s, index) => (
                            <g key={s.key} style={{ color: COLORS[index % COLORS.length] }}>
                                {plots[index].segments.map((path, segment) => (
                                    <path
                                        key={segment}
                                        d={path}
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        fill="none"
                                        strokeDasharray={index === 2 ? '5 3' : undefined}
                                    />
                                ))}
                                {plots[index].dots.map((dot, point) => (
                                    <circle
                                        key={point}
                                        cx={dot.cx}
                                        cy={dot.cy}
                                        r={index === 1 ? 4 : 3}
                                        fill="currentColor"
                                    >
                                        <title>{`${s.label} · ${dot.label}: ${formatValue(dot.value, s.unit)}`}</title>
                                    </circle>
                                ))}
                            </g>
                        ))}
                        {years.map((year) => {
                            const present = series.map((s) =>
                                s.points.some((p) => Math.round(p.x) === year && p.value !== null),
                            );
                            const missing = present.every(Boolean)
                                ? ''
                                : present.some(Boolean)
                                  ? '일부 미확보'
                                  : '미확보';
                            return (
                                <g key={year}>
                                    <text
                                        x={plot.xAt(year)}
                                        y={plot.bottom + 23}
                                        textAnchor="middle"
                                        fill="currentColor"
                                        fontSize="18"
                                    >
                                        {year}
                                        {multiPeriodYears.includes(year) ? '*' : ''}
                                    </text>
                                    <text
                                        x={plot.xAt(year)}
                                        y={plot.bottom + 44}
                                        textAnchor="middle"
                                        fill="currentColor"
                                        fontSize="15"
                                    >
                                        {missing}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </>
            ) : (
                <>
                    <p className="text-[13px] text-foreground/70">
                        추이 비교에 필요한 보고기간이 부족하여 확인된 수치를 표시합니다.
                    </p>
                    <dl className={`grid gap-2 ${latestFirst ? '' : 'sm:grid-cols-2'}`}>
                        {displaySeries.flatMap((s) => {
                            const present = s.points.filter((p) => p.value !== null);
                            return present.length
                                ? present.map((p, index) => (
                                      <StatTile
                                          key={`${s.key}-${index}`}
                                          label={s.label}
                                          value={formatValue(p.value, s.unit)}
                                          hint={p.label}
                                      />
                                  ))
                                : [<StatTile key={s.key} label={s.label} value="-" hint="공시 값 미확보" />];
                        })}
                    </dl>
                </>
            )}
            {multiPeriodYears.length ? (
                <Footnote>
                    * {multiPeriodYears.join(' · ')}년은 복수 기수입니다. 같은 연도 안의 {hasTrend ? '점' : '수치'}는 서로 다른 보고기간이며
                    합산하지 않습니다.
                </Footnote>
            ) : null}
            <details className="firm-chart-data text-[13px]">
                <summary className="cursor-pointer py-2">수치 보기</summary>
                <div className="print:block">
                    <DataTable
                        caption={`${title} · 보고기간별 원표`}
                        columns={[
                            { key: 'period', label: '보고기간' },
                            { key: 'series', label: '지표' },
                            { key: 'value', label: '값', align: 'right' },
                        ]}
                        rows={displaySeries.flatMap((s) =>
                            s.points.map((p) => [p.label, s.label, formatValue(p.value, s.unit)]),
                        )}
                    />
                </div>
            </details>
        </section>
    );
}

export function StackedBarChart({ rows, title }: { rows: readonly TenureSegmentView[]; title: string }) {
    const chart = buildStackedBars(rows);
    return (
        <div className="space-y-3">
            <ul className="flex flex-wrap gap-3 text-[13px]">
                {chart.legend.map((item) => (
                    <li key={item.key} className="flex items-center gap-1">
                        <span aria-hidden="true" className="h-3 w-3" style={{ backgroundColor: COLORS[item.index] }} />
                        {item.label}
                    </li>
                ))}
            </ul>
            <svg
                role="img"
                aria-label={title}
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                className="block h-auto w-full text-foreground"
            >
                <title>{title}</title>
                <desc>
                    부문별 근속 구간 비중입니다. 확인된 구간 인원만 분모로 사용하고 결측을 0으로 바꾸지 않습니다. 공시
                    합계와 구간 합은 아래 원표에 각각 표시합니다.
                </desc>
                {rows.map((row, index) => (
                    <g key={row.segment}>
                        <text
                            x={chart.left - 10}
                            y={30 + index * 52}
                            textAnchor="end"
                            fill="currentColor"
                            fontSize="18"
                        >
                            {row.label}
                        </text>
                        {row.observed === null ? (
                            <text x={chart.left} y={30 + index * 52} fill="currentColor" fontSize="18">
                                구간 값 미확보
                            </text>
                        ) : row.observed === 0 ? (
                            <text x={chart.left} y={30 + index * 52} fill="currentColor" fontSize="18">
                                구간 합 0명
                            </text>
                        ) : null}
                    </g>
                ))}
                {chart.bars.map((bar) => (
                    <rect
                        key={`${bar.segment}-${bar.key}`}
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        fill={COLORS[bar.index]}
                    >
                        <title>{`${bar.segmentLabel} · ${bar.label}: ${formatNumber(bar.count, '명')} (${formatRatio(bar.share)})`}</title>
                    </rect>
                ))}
            </svg>
            <details className="firm-chart-data text-[13px]">
                <summary className="cursor-pointer py-2">수치 보기</summary>
                <div className="print:block">
                    <DataTable
                        caption={title}
                        columns={[
                            { key: 'segment', label: '부문' },
                            { key: 'band', label: '구간' },
                            { key: 'count', label: '인원', align: 'right' },
                            { key: 'share', label: '비중', align: 'right' },
                        ]}
                        rows={rows.flatMap((row) => [
                            ...row.bands.map((band) => [
                                row.label,
                                band.label,
                                formatNumber(band.count, '명'),
                                formatRatio(band.share),
                            ]),
                            [row.label, '구간 합', formatNumber(row.observed, '명'), ''],
                            [
                                row.label,
                                '공시 합계',
                                formatNumber(row.total, '명'),
                                row.totalMismatch ? '구간 합과 다름' : '',
                            ],
                        ])}
                    />
                </div>
            </details>
        </div>
    );
}
