import type { TenureSegmentView } from './personnel.ts';

export interface Point {
    x: number;
    label: string;
    value: number | null;
}
export interface Tick {
    value: number;
    position: number;
}
export interface LineOptions {
    width?: number;
    height?: number;
    xDomain?: [number, number];
    yDomain?: [number, number];
}

/** 읽기 쉬운 눈금. 상수·음수 범위도 최소 두 눈금을 갖는다. */
export function niceTicks(min: number, max: number, count = 4): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min > max) [min, max] = [max, min];
    if (min === max) {
        const padding = Math.abs(min) * 0.1 || 1;
        min -= padding;
        max += padding;
    }
    const raw = (max - min) / Math.max(1, count - 1);
    const power = 10 ** Math.floor(Math.log10(raw));
    const step = ([1, 2, 5, 10].find((n) => n * power >= raw) ?? 10) * power;
    const start = Math.floor(min / step);
    const end = Math.ceil(max / step);
    return Array.from({ length: end - start + 1 }, (_, i) => Number(((start + i) * step).toPrecision(12)));
}

/** null은 경로를 끊는다. 단일 점은 dots로 남고 모든 결측은 빈 경로다. */
export function buildLineSeries(points: readonly Point[], opts: LineOptions = {}) {
    const width = opts.width ?? 420,
        height = opts.height ?? 280;
    const left = 88,
        right = width - 30,
        top = 20,
        bottom = height - 65;
    const xs = points.map((p) => p.x);
    const values = points.flatMap((p) => (p.value !== null && Number.isFinite(p.value) ? [p.value] : []));
    const [xMin, xMax] = opts.xDomain ?? (xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1]);
    const ticks = niceTicks(...(opts.yDomain ?? [Math.min(0, ...values), Math.max(0, ...values)]));
    const yMin = ticks[0],
        yMax = ticks[ticks.length - 1];
    const xAt = (x: number) =>
        xMin === xMax ? (left + right) / 2 : left + ((x - xMin) / (xMax - xMin)) * (right - left);
    const yAt = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top);
    const segments: string[] = [];
    const dots: (Point & { cx: number; cy: number })[] = [];
    let segment: string[] = [];
    const flush = () => {
        if (segment.length) segments.push(segment.join(' '));
        segment = [];
    };
    for (const point of points) {
        if (point.value === null || !Number.isFinite(point.value)) {
            flush();
            continue;
        }
        const cx = xAt(point.x),
            cy = yAt(point.value);
        segment.push(`${segment.length ? 'L' : 'M'}${cx},${cy}`);
        dots.push({ ...point, cx, cy });
    }
    flush();
    return {
        segments,
        dots,
        ticks: ticks.map((value) => ({ value, position: yAt(value) }) satisfies Tick),
        xAt,
        left,
        right,
        top,
        bottom,
        width,
        height,
    };
}

/** 인원·비중 계산은 personnel.ts의 결과를 소비한다. 결측은 막대로 만들지 않는다. */
export function buildStackedBars(rows: readonly TenureSegmentView[], opts: { width?: number } = {}) {
    const width = opts.width ?? 420;
    const left = 95,
        plotWidth = width - left - 24;
    const legend = rows[0]?.bands.map((band, index) => ({ key: band.key, label: band.label, index })) ?? [];
    const bars = rows.flatMap((row, rowIndex) => {
        let offset = 0;
        return row.bands.flatMap((band, index) => {
            if (band.share === null || band.count === null) return [];
            const bar = {
                ...band,
                segment: row.segment,
                segmentLabel: row.label,
                index,
                x: left + offset * plotWidth,
                y: 12 + rowIndex * 52,
                width: band.share * plotWidth,
                height: 26,
            };
            offset += band.share;
            return [bar];
        });
    });
    return { bars, legend, width, height: Math.max(64, rows.length * 52 + 12), left };
}
