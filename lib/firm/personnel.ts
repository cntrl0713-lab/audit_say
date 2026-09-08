/**
 * 회계법인 인력 구성·인건비 표시 로직.
 *
 * 원문은 두 갈래로 들어온다.
 * - 공인회계사 근속표: 모집단이 공인회계사다.
 * - 부문별 인건비표: 모집단이 전 임직원이다.
 * 두 인원을 같은 수로 읽으면 안 되므로 여기서 섞지 않고 끝까지 나눠 둔다.
 *
 * 결측은 0 이 아니다. 합계가 내역과 맞지 않으면 고쳐 쓰지 않고 원문을 두고 알린다.
 */
import type {
    CostMatchMethod,
    FirmCpaTenureRow,
    FirmPersonnelCostRow,
    FirmSegment,
    PersonnelCostConcept,
} from './types.ts';

export const SEGMENT_ORDER: FirmSegment[] = ['total', 'audit', 'tax', 'advisory', 'other'];

export const SEGMENT_LABEL: Record<FirmSegment, string> = {
    total: '전체',
    audit: '감사',
    tax: '세무',
    advisory: '경영자문',
    other: '기타',
};

export const TENURE_BANDS = [
    { key: 'under_1y', label: '1년 미만' },
    { key: 'y1_3', label: '1~3년' },
    { key: 'y3_5', label: '3~5년' },
    { key: 'y5_10', label: '5~10년' },
    { key: 'y10_15', label: '10~15년' },
    { key: 'over_15y', label: '15년 이상' },
] as const;

export type TenureBandKey = (typeof TENURE_BANDS)[number]['key'];

export interface TenureBandView {
    key: TenureBandKey;
    label: string;
    count: number | null;
    /** 관측된 구간 합 대비 비중. 합이 없으면 null 이고 0 이 아니다. */
    share: number | null;
}

export interface TenureSegmentView {
    segment: FirmSegment;
    label: string;
    bands: TenureBandView[];
    /** 구간 값이 있는 것만 더한 수. 하나도 없으면 null. */
    observed: number | null;
    /** 공시가 적어 둔 합계. */
    total: number | null;
    /** 구간 합과 공시 합계가 어긋난 경우. 값을 고치지 않고 표시할 때 알린다. */
    totalMismatch: boolean;
}

function sumObserved(values: (number | null)[]): number | null {
    const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
    return present.length === 0 ? null : present.reduce((acc, value) => acc + value, 0);
}

function ratio(numerator: number | null, denominator: number | null): number | null {
    if (numerator === null || denominator === null || denominator === 0) return null;
    return numerator / denominator;
}

function segmentRank(segment: FirmSegment): number {
    const index = SEGMENT_ORDER.indexOf(segment);
    return index === -1 ? SEGMENT_ORDER.length : index;
}

/** 근속 구간을 부문별로 정리한다. 원문에 없는 부문은 만들어 내지 않는다. */
export function buildTenureSegments(rows: readonly FirmCpaTenureRow[]): TenureSegmentView[] {
    return rows
        .map((row) => {
            const counts = TENURE_BANDS.map((band) => row[band.key]);
            const observed = sumObserved(counts);
            const bands = TENURE_BANDS.map((band, index) => ({
                key: band.key,
                label: band.label,
                count: counts[index],
                share: ratio(counts[index], observed),
            }));
            return {
                segment: row.segment,
                label: SEGMENT_LABEL[row.segment] ?? row.segment,
                bands,
                observed,
                total: row.total,
                totalMismatch: observed !== null && row.total !== null && observed !== row.total,
            };
        })
        .sort((a, b) => segmentRank(a.segment) - segmentRank(b.segment));
}

/**
 * 값이 하나도 없는 부문은 표에서 빼고 이름만 따로 알린다.
 * 대시로만 찬 줄은 읽는 사람에게 아무것도 주지 못하지만,
 * "공시하지 않았다"는 사실 자체는 남겨야 한다.
 */
export function splitTenureSegments(views: readonly TenureSegmentView[]): {
    shown: TenureSegmentView[];
    omitted: TenureSegmentView[];
} {
    const shown: TenureSegmentView[] = [];
    const omitted: TenureSegmentView[] = [];
    for (const view of views) {
        (view.observed === null && view.total === null ? omitted : shown).push(view);
    }
    return { shown, omitted };
}

export interface TurnoverView {
    begin: number | null;
    hires: number | null;
    leavers: number | null;
    end: number | null;
    /** 기말 − 기초. 둘 다 있을 때만 계산한다. */
    net: number | null;
    /** 퇴사자 ÷ 기초 인원. 기초가 없거나 0 이면 null. */
    leaverRate: number | null;
    /** 기초 + 입사 − 퇴사 = 기말 이 맞는지. 넷 중 하나라도 없으면 null. */
    reconciles: boolean | null;
}

/** 입·퇴사는 total 세그먼트에만 공시된다. 부문별 행에서 끌어오지 않는다. */
export function summarizeTurnover(rows: readonly FirmCpaTenureRow[]): TurnoverView | null {
    const row = rows.find((candidate) => candidate.segment === 'total');
    if (!row) return null;
    const { begin_count: begin, hires, leavers, end_count: end } = row;
    if (begin === null && hires === null && leavers === null && end === null) return null;
    const complete = begin !== null && hires !== null && leavers !== null && end !== null;
    return {
        begin,
        hires,
        leavers,
        end,
        net: begin !== null && end !== null ? end - begin : null,
        leaverRate: ratio(leavers, begin),
        reconciles: complete ? begin + hires - leavers === end : null,
    };
}

export const COST_CONCEPT_LABEL: Record<PersonnelCostConcept, string> = {
    personnel_total: '인건비',
    quality_personnel: '품질관리 인력 인건비',
    training: '교육훈련비',
    travel: '여비교통비',
    welfare: '복리후생비',
    entertainment: '접대비',
};

/** 공시 표에서 그대로 읽은 값이 아니면 어디서 유도했는지 밝힌다. */
export const MATCH_METHOD_NOTE: Record<CostMatchMethod, string | null> = {
    form_table: null,
    account_code: '손익계산서 계정코드에서 유도한 값입니다.',
    account_label: '손익계산서 계정명에서 유도한 값이라 계정 분류가 법인마다 다를 수 있습니다.',
};

export interface CostSegmentView {
    segment: FirmSegment;
    label: string;
    amount: number | null;
    /** 전 임직원 기준 인원. 공인회계사 근속표의 인원과 모집단이 다르다. */
    headcount: number | null;
    /** 인건비 ÷ 인원. 인원이 없거나 0 이면 null. */
    perHead: number | null;
    note: string | null;
}

/** 부문별 인건비. 같은 부문이 여러 번 오면 공시 표에서 읽은 행을 우선한다. */
export function buildPersonnelCostSegments(rows: readonly FirmPersonnelCostRow[]): CostSegmentView[] {
    const bySegment = new Map<FirmSegment, FirmPersonnelCostRow>();
    for (const row of rows) {
        if (row.concept !== 'personnel_total') continue;
        const kept = bySegment.get(row.segment);
        if (!kept || (kept.match_method !== 'form_table' && row.match_method === 'form_table')) {
            bySegment.set(row.segment, row);
        }
    }
    return [...bySegment.values()]
        .map((row) => ({
            segment: row.segment,
            label: SEGMENT_LABEL[row.segment] ?? row.segment,
            amount: row.amount,
            headcount: row.headcount,
            perHead: ratio(row.amount, row.headcount),
            note: MATCH_METHOD_NOTE[row.match_method],
        }))
        .sort((a, b) => segmentRank(a.segment) - segmentRank(b.segment));
}

/** 근속 표와 같은 규칙. 금액도 인원도 없는 부문은 이름만 남긴다. */
export function splitCostSegments(views: readonly CostSegmentView[]): {
    shown: CostSegmentView[];
    omitted: CostSegmentView[];
} {
    const shown: CostSegmentView[] = [];
    const omitted: CostSegmentView[] = [];
    for (const view of views) {
        (view.amount === null && view.headcount === null ? omitted : shown).push(view);
    }
    return { shown, omitted };
}

export interface CostConceptView {
    concept: PersonnelCostConcept;
    label: string;
    amount: number | null;
    note: string | null;
}

const OTHER_CONCEPT_ORDER: PersonnelCostConcept[] = [
    'quality_personnel',
    'training',
    'welfare',
    'travel',
    'entertainment',
];

/** 인건비 밖의 비용은 전체 기준으로만 공시된다. 값이 없는 항목은 내보내지 않는다. */
export function buildCostConcepts(rows: readonly FirmPersonnelCostRow[]): CostConceptView[] {
    const byConcept = new Map<PersonnelCostConcept, FirmPersonnelCostRow>();
    for (const row of rows) {
        if (row.concept === 'personnel_total' || row.segment !== 'total') continue;
        if (row.amount === null) continue;
        if (!byConcept.has(row.concept)) byConcept.set(row.concept, row);
    }
    return OTHER_CONCEPT_ORDER.filter((concept) => byConcept.has(concept)).map((concept) => {
        const row = byConcept.get(concept)!;
        return {
            concept,
            label: COST_CONCEPT_LABEL[concept],
            amount: row.amount,
            note: MATCH_METHOD_NOTE[row.match_method],
        };
    });
}

/** 같은 해에 시작한 보고기간이 둘일 수 있어 연도가 아니라 접수번호로 고른다. */
export function rowsForReceipt<T extends { source_rcept_no: string }>(
    rows: readonly T[],
    sourceRceptNo: string,
): T[] {
    return rows.filter((row) => row.source_rcept_no === sourceRceptNo);
}
