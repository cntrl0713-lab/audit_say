/**
 * OpenDART 응답을 도메인 값으로 바꾸는 순수 함수들.
 *
 * 네트워크를 타지 않는 부분을 여기 모아 둔 것은 의도다 — 수집기에서 조용히 틀리기
 * 제일 쉬운 곳이 파싱과 법인명 매칭이라, 이 파일만 픽스처로 검증할 수 있게 했다.
 * 테스트: tests/firmCollector.test.ts
 */

export type AuditOpinion = '적정' | '한정' | '부적정' | '의견거절';

/**
 * DART 금액 문자열 → number.
 *
 * 공시 표기가 제각각이라 다음을 모두 받는다.
 *   "1,234,567" · "-1,234" · "(1,234)" 괄호 음수 · "△1,234" 삼각 음수 · "1 234"
 * 값이 없다는 뜻인 "" · "-" · "－" · null 은 0 이 아니라 null 이다.
 * 0 과 결측을 섞으면 평균 지표가 조용히 틀어진다.
 */
export function parseDartAmount(raw: string | null | undefined): number | null {
    if (raw === null || raw === undefined) return null;

    let text = String(raw).trim();
    if (text === '' || text === '-' || text === '－' || text === '–') return null;

    let negative = false;

    // 괄호 음수: (1,234)
    if (/^\(.*\)$/.test(text)) {
        negative = true;
        text = text.slice(1, -1);
    }

    // 삼각 음수: △1,234 / ▲1,234
    if (/^[△▲]/.test(text)) {
        negative = true;
        text = text.slice(1);
    }

    if (text.startsWith('-') || text.startsWith('−')) {
        negative = true;
        text = text.slice(1);
    }

    const digits = text.replace(/[,\s]/g, '');
    if (digits === '' || !/^\d+(\.\d+)?$/.test(digits)) return null;

    const value = Number(digits);
    if (!Number.isFinite(value)) return null;

    return negative ? -value : value;
}

/** DART 정수 문자열 → number. 음수는 인원수로 말이 안 되므로 null 로 본다. */
export function parseDartCount(raw: string | null | undefined): number | null {
    const value = parseDartAmount(raw);
    if (value === null) return null;
    if (!Number.isInteger(value) || value < 0) return null;
    return value;
}

/**
 * 감사의견 원문 → 정규화값.
 *
 * 검사 순서가 중요하다. "적정" 은 "부적정" 의 부분 문자열이라 적정을 먼저 보면
 * 부적정이 전부 적정으로 둔갑한다. 의견거절 → 부적정 → 한정 → 적정 순으로 본다.
 * 못 알아보면 null 을 주고, 호출부는 원문을 adt_opinion_raw 에 남긴다.
 */
export function normalizeAuditOpinion(raw: string | null | undefined): AuditOpinion | null {
    if (!raw) return null;
    const text = String(raw).replace(/\s/g, '');
    if (text === '') return null;

    if (text.includes('의견거절') || text.includes('거절')) return '의견거절';
    if (text.includes('부적정')) return '부적정';
    if (text.includes('한정')) return '한정';
    if (text.includes('적정')) return '적정';
    return null;
}

/**
 * 법인명 정규화 키.
 *
 * 같은 법인이 공시마다 "삼정회계법인" · "삼정" · "삼정KPMG회계법인" · "삼정 KPMG(감사)"
 * 처럼 다르게 적힌다. 괄호 주석과 공백·구분자를 걷어내고 소문자로 맞춘다.
 * "회계법인" 은 떼지 않는다 — 뗐다가 "삼일" 과 "삼일감정평가법인" 이 같은 키가 되는 쪽이
 * 더 위험하다. 대신 접미어 없는 표기는 alias 로 등록해 잡는다.
 */
export function normalizeFirmName(raw: string): string {
    return raw
        .replace(/\([^)]*\)/g, '')
        .replace(/（[^）]*）/g, '')
        .replace(/[\s·・,、]/g, '')
        .replace(/^주식회사/, '')
        .replace(/주식회사$/, '')
        .toLowerCase();
}

export interface FirmIndexEntry {
    firm_id: number;
    firm_name: string;
    alias: string[];
}

/**
 * 정규화 키 → firm_id 색인.
 *
 * 서로 다른 법인이 같은 키로 접히면 던진다. 조용히 덮어쓰면 A 법인의 감사 건이
 * B 법인 밑으로 들어가고, 적재가 끝난 뒤에는 원인을 되짚기 어렵다.
 */
export function buildFirmIndex(firms: FirmIndexEntry[]): Map<string, number> {
    const index = new Map<string, number>();
    const owner = new Map<string, string>();

    for (const firm of firms) {
        for (const label of [firm.firm_name, ...firm.alias]) {
            const key = normalizeFirmName(label);
            if (key === '') continue;

            const existing = index.get(key);
            if (existing !== undefined && existing !== firm.firm_id) {
                throw new Error(
                    `법인명 색인 충돌: "${key}" 가 ${owner.get(key)}(${existing}) 와 ` +
                    `${firm.firm_name}(${firm.firm_id}) 양쪽에 걸립니다. alias 를 고쳐 주세요.`,
                );
            }
            index.set(key, firm.firm_id);
            owner.set(key, firm.firm_name);
        }
    }

    return index;
}

/** 감사인 원문 → firm_id. 마스터에 없으면 null (호출부가 미매칭으로 보고한다). */
export function matchFirm(index: Map<string, number>, rawName: string | null | undefined): number | null {
    if (!rawName) return null;
    const key = normalizeFirmName(rawName);
    if (key === '') return null;
    return index.get(key) ?? null;
}

/**
 * DART 날짜 문자열 → ISO(YYYY-MM-DD).
 * "2024년 03월 15일" · "2024.03.15" · "2024-03-15" · "20240315" 를 받는다.
 */
export function parseDartDate(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const text = String(raw).trim();
    if (text === '' || text === '-') return null;

    // 구분자를 치환하는 대신 숫자 덩어리만 뽑는다. "2024년 03월 15일" 처럼 구분자가
    // 겹쳐 나오는 표기에서 치환 방식은 "2024--03--15" 를 만들어 매칭에 실패한다.
    const groups = text.match(/\d+/g);
    if (!groups) return null;

    let year: string;
    let month: number;
    let day: number;

    if (groups.length === 1 && groups[0].length === 8) {
        // 20240315 형태
        year = groups[0].slice(0, 4);
        month = Number(groups[0].slice(4, 6));
        day = Number(groups[0].slice(6, 8));
    } else if (groups.length >= 3 && groups[0].length === 4) {
        year = groups[0];
        month = Number(groups[1]);
        day = Number(groups[2]);
    } else {
        return null;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 핵심감사사항(KAM) 원문에서 항목 수를 센다.
 *
 * 이 필드는 자유 서술이라 정답이 없다. 줄머리 번호가 1부터 순서대로 붙어 있을 때만
 * 그 개수를 주고, 아니면 null 을 준다 — 틀린 숫자를 주는 것보다 모른다고 하는 편이 낫다.
 * 정밀 분류는 PRD §4.3 의 2차 수집 몫이다.
 */
export function countKamItems(raw: string | null | undefined): number | null {
    if (!raw) return null;

    const markers: number[] = [];
    const circled = '①②③④⑤⑥⑦⑧⑨⑩';

    for (const line of String(raw).split(/\r?\n/)) {
        const text = line.trim();
        if (text === '') continue;

        // "1." "1)" "(1)" 형태
        const arabic = text.match(/^\(?(\d{1,2})[.)]/);
        if (arabic) {
            markers.push(Number(arabic[1]));
            continue;
        }

        // 원문자 ①②③
        const circledIndex = circled.indexOf(text[0]);
        if (circledIndex >= 0) markers.push(circledIndex + 1);
    }

    if (markers.length === 0) return null;

    // 1,2,3... 으로 이어질 때만 신뢰한다
    const sequential = markers.every((value, i) => value === i + 1);
    return sequential ? markers.length : null;
}

/**
 * 재무 주요계정 응답에서 매출·영업이익·당기순이익을 고른다.
 *
 * PRD §4.4 대로 연결(CFS)을 먼저 쓰고, 연결이 없을 때만 별도(OFS)로 내려가며
 * fallback_yn 을 세운다. 금융회사는 "매출액" 대신 "영업수익" 을 쓰므로 둘 다 본다.
 */
const ACCOUNT_ALIASES = {
    revenue: ['매출액', '수익(매출액)', '영업수익', '매출'],
    operating_profit: ['영업이익', '영업이익(손실)', '영업손실'],
    net_income: ['당기순이익', '당기순이익(손실)', '당기순손실', '분기순이익', '반기순이익'],
} as const;

export interface FnlttRow {
    currency?: string;
    fs_div?: string;
    sj_div?: string;
    account_nm?: string;
    thstrm_amount?: string;
}

export interface PickedFinancials {
    revenue: number | null;
    operating_profit: number | null;
    net_income: number | null;
    fs_div: 'CFS' | 'OFS' | null;
    fallback_yn: boolean;
    data_status: 'ok' | 'missing' | 'parse_failed';
}

export function pickFinancials(rows: FnlttRow[]): PickedFinancials {
    const forDiv = (div: 'CFS' | 'OFS') =>
        rows.filter((row) => (row.fs_div ?? '').toUpperCase() === div);

    let chosen = forDiv('CFS');
    let fsDiv: 'CFS' | 'OFS' | null = 'CFS';
    let fallback = false;

    if (chosen.length === 0) {
        chosen = forDiv('OFS');
        fsDiv = chosen.length > 0 ? 'OFS' : null;
        fallback = chosen.length > 0;
    }

    // The comparison views format these amounts as KRW. Do not silently label USD/CNY/JPY as won.
    if (chosen.some((row) => row.currency && row.currency.trim().toUpperCase() !== 'KRW')) {
        return { revenue: null, operating_profit: null, net_income: null,
            fs_div: fsDiv, fallback_yn: fallback, data_status: 'parse_failed' };
    }

    const pick = (aliases: readonly string[]): number | null => {
        for (const alias of aliases) {
            const row = chosen.find((candidate) => (candidate.account_nm ?? '').trim() === alias);
            if (row) {
                const value = parseDartAmount(row.thstrm_amount);
                if (value !== null) return value;
            }
        }
        return null;
    };

    const revenue = pick(ACCOUNT_ALIASES.revenue);
    const operating_profit = pick(ACCOUNT_ALIASES.operating_profit);
    const net_income = pick(ACCOUNT_ALIASES.net_income);

    const anyFound = revenue !== null || operating_profit !== null || net_income !== null;

    return {
        revenue,
        operating_profit,
        net_income,
        fs_div: anyFound ? fsDiv : null,
        fallback_yn: anyFound ? fallback : false,
        data_status: anyFound ? 'ok' : 'missing',
    };
}

/**
 * 직원 현황(empSttus) 여러 행을 법인 단위로 합친다.
 *
 * 응답은 사업부문 × 성별로 쪼개져 온다. 합계 행("합계"/"계")이 섞여 있으면 두 번
 * 세게 되므로 합계 행이 있으면 그것만 쓰고, 없으면 세부 행을 더한다.
 * 1인 평균 급여는 부문마다 달라 단순 평균이 의미 없으니, 총액/인원으로 다시 구한다.
 */
export interface EmpRow {
    fo_bbm?: string;
    sm?: string;
    rgllbr_co?: string;
    cnttk_co?: string;
    fyer_salary_totamt?: string;
    jan_salary_am?: string;
}

export interface AggregatedWorkforce {
    employee_total: number | null;
    salary_total: number | null;
    salary_avg: number | null;
}

export function aggregateEmployees(rows: EmpRow[]): AggregatedWorkforce {
    const isTotalRow = (row: EmpRow) => /^(합계|계|총계)$/.test((row.fo_bbm ?? '').trim());
    const totalRows = rows.filter(isTotalRow);
    const target = totalRows.length > 0 ? totalRows : rows.filter((row) => !isTotalRow(row));

    let employeeTotal: number | null = null;
    let salaryTotal: number | null = null;

    for (const row of target) {
        // sm(합계)이 없으면 정규직+계약직으로 대신 센다
        const headcount =
            parseDartCount(row.sm) ??
            (() => {
                const regular = parseDartCount(row.rgllbr_co);
                const contract = parseDartCount(row.cnttk_co);
                if (regular === null && contract === null) return null;
                return (regular ?? 0) + (contract ?? 0);
            })();

        if (headcount !== null) employeeTotal = (employeeTotal ?? 0) + headcount;

        const salary = parseDartAmount(row.fyer_salary_totamt);
        if (salary !== null) salaryTotal = (salaryTotal ?? 0) + salary;
    }

    const salaryAvg =
        salaryTotal !== null && employeeTotal !== null && employeeTotal > 0
            ? salaryTotal / employeeTotal
            : null;

    return { employee_total: employeeTotal, salary_total: salaryTotal, salary_avg: salaryAvg };
}

/**
 * 임원 현황(exctvSttus)에서 등기임원 수를 센다.
 * PRD §4.2-B 의 "이사 수(등기임원 기준)" 다. 등기 여부 필드가 비어 있으면 세지 않는다.
 */
export interface ExctvRow {
    rgist_exctv_at?: string;
}

export function countRegisteredDirectors(rows: ExctvRow[]): number | null {
    let counted = 0;
    let sawField = false;

    for (const row of rows) {
        const value = (row.rgist_exctv_at ?? '').trim();
        if (value === '') continue;
        sawField = true;
        if (value.includes('등기') && !value.includes('미등기')) counted += 1;
    }

    return sawField ? counted : null;
}

export type FirmSegment = 'audit' | 'tax' | 'advisory' | 'other';

/**
 * 회계법인 사업보고서의 사업부문명 → 부문 코드.
 *
 * PRD §4.2-B 는 부문별 인원을 "파싱 필요, 1차 선택 수집" 으로 뒀지만, 직원 현황
 * 응답의 fo_bbm(사업부문)이 이미 부문명을 담고 있어 여기서 접을 수 있다.
 * 부문 표기는 법인마다 달라("회계감사본부" · "Audit" · "감사부문") 키워드로 본다.
 * 못 알아본 부문은 other 로 두고 합계에는 넣되 부문별 값에서는 뺀다 —
 * 모르는 것을 감사부문에 얹는 것보다 낫다.
 */
export function classifyFirmSegment(label: string | null | undefined): FirmSegment {
    if (!label) return 'other';
    const text = String(label).replace(/\s/g, '').toLowerCase();

    if (/감사|인증|assurance|audit/.test(text)) return 'audit';
    if (/세무|세정|tax/.test(text)) return 'tax';
    if (/자문|컨설팅|консал|advisory|consulting|deal|financial/.test(text)) return 'advisory';
    return 'other';
}

export interface SegmentedWorkforce extends AggregatedWorkforce {
    employee_audit: number | null;
    employee_tax: number | null;
    employee_advisory: number | null;
}

/**
 * 직원 현황을 부문별로 나눠 집계한다.
 *
 * 합계 행("합계"/"계")은 부문별 계산에서 제외한다 — 부문 행과 같이 세면 두 배가 된다.
 * 총원은 합계 행이 있으면 그것을, 없으면 부문 행의 합을 쓴다(aggregateEmployees 와 같은 규칙).
 */
export function aggregateEmployeesBySegment(rows: EmpRow[]): SegmentedWorkforce {
    const total = aggregateEmployees(rows);

    const isTotalRow = (row: EmpRow) => /^(합계|계|총계)$/.test((row.fo_bbm ?? '').trim());
    const detail = rows.filter((row) => !isTotalRow(row));

    const perSegment: Record<FirmSegment, number | null> = {
        audit: null,
        tax: null,
        advisory: null,
        other: null,
    };

    for (const row of detail) {
        const headcount =
            parseDartCount(row.sm) ??
            (() => {
                const regular = parseDartCount(row.rgllbr_co);
                const contract = parseDartCount(row.cnttk_co);
                if (regular === null && contract === null) return null;
                return (regular ?? 0) + (contract ?? 0);
            })();
        if (headcount === null) continue;

        const segment = classifyFirmSegment(row.fo_bbm);
        perSegment[segment] = (perSegment[segment] ?? 0) + headcount;
    }

    return {
        ...total,
        employee_audit: perSegment.audit,
        employee_tax: perSegment.tax,
        employee_advisory: perSegment.advisory,
    };
}
