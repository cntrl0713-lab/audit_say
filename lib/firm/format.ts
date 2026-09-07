/**
 * 표시용 포매터.
 *
 * DART 금액은 원 단위 정수로 들어온다. 조 단위까지 가는 수를 그대로 찍으면
 * 자릿수를 셀 수 없으므로 조/억/만으로 접는다.
 */

const TRILLION = 1_000_000_000_000;
const HUNDRED_MILLION = 100_000_000;
const TEN_THOUSAND = 10_000;

/**
 * 소수점 뒤 .0 을 지우고 정수부에 자릿수 구분을 넣는다.
 * 1.0조 → 1조, 9800억 → 9,800억
 */
function trim(value: number, digits: number): string {
    const fixed = value.toFixed(digits).replace(/\.0+$/, '');
    const [whole, fraction] = fixed.split('.');
    const grouped = Number(whole).toLocaleString('ko-KR');
    return fraction ? `${grouped}.${fraction}` : grouped;
}

/** 원 단위 금액 → "1.2조원" · "350억원" · "1,200만원" · "-" */
export function formatKrw(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';

    const sign = value < 0 ? '−' : '';
    const abs = Math.abs(value);

    if (abs >= TRILLION) return `${sign}${trim(abs / TRILLION, 1)}조원`;
    if (abs >= HUNDRED_MILLION) return `${sign}${trim(abs / HUNDRED_MILLION, 1)}억원`;
    if (abs >= TEN_THOUSAND) return `${sign}${Math.round(abs / TEN_THOUSAND).toLocaleString('ko-KR')}만원`;
    return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`;
}

/** 자릿수 구분만 넣는다. 결측은 0 이 아니라 "-" 다. */
export function formatNumber(value: number | null | undefined, unit = ''): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return `${Math.round(value).toLocaleString('ko-KR')}${unit}`;
}

/** 소수 한 자리까지 (평균 KAM 개수 등) */
export function formatDecimal(value: number | null | undefined, digits = 1, unit = ''): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return `${Number(value).toFixed(digits)}${unit}`;
}

/** 0~1 비율 → "60.0%" */
export function formatRatio(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return `${(Number(value) * 100).toFixed(1)}%`;
}

/** 분모가 0이면 null. 화면에서 나눗셈할 때 0으로 나누지 않도록. */
export function safeRatio(numerator: number | null, denominator: number | null): number | null {
    if (numerator === null || denominator === null || denominator === 0) return null;
    return numerator / denominator;
}
