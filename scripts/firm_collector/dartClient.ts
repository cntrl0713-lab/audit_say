import { readZipEntries } from './zip.ts';

/**
 * OpenDART API 클라이언트.
 *
 * ⚠ 엔드포인트 경로와 응답 필드명은 OpenDART 개발가이드 기준으로 적었지만, API 키가
 *    없어 실제 호출로 확인하지는 못했다. 첫 실전 수집 때 반드시 대조할 것 —
 *    scripts/firm_collector/README.md "첫 실행 전 확인" 절에 절차가 있다.
 *    필드가 어긋나면 조용히 NULL 이 쌓이지 않도록, 응답에 기대한 키가 하나도 없으면
 *    fetchList 가 던지게 해 뒀다.
 */

const BASE_URL = 'https://opendart.fss.or.kr/api';

/** 사업보고서. 반기·분기는 11012 / 11013 / 11014 다. */
export const REPRT_CODE_ANNUAL = '11011';

/**
 * OpenDART 응답 상태코드.
 * 013(데이터 없음)은 오류가 아니라 "그 해에 그 공시가 없다"는 정상 응답이다.
 */
const STATUS_MESSAGES: Record<string, string> = {
    '010': '등록되지 않은 인증키입니다.',
    '011': '사용할 수 없는 인증키입니다.',
    '012': '접근할 수 없는 IP 입니다.',
    '014': '파일이 존재하지 않습니다.',
    '020': '요청 제한을 초과했습니다.',
    '021': '조회 가능한 회사 개수를 초과했습니다.',
    '100': '필드에 부적절한 값이 있습니다.',
    '101': '부적절한 접근입니다.',
    '800': 'OpenDART 시스템 점검 중입니다.',
    '900': '정의되지 않은 오류입니다.',
    '901': '사용자 계정의 개인정보 보유기간이 만료됐습니다.',
};

const RETRYABLE = new Set(['020', '800', '900']);

export class DartError extends Error {
    // 파라미터 프로퍼티(constructor(readonly x)) 대신 명시 필드를 쓴다 —
    // node --test 의 타입 제거 모드가 파라미터 프로퍼티를 지원하지 않는다.
    readonly status: string;

    constructor(status: string, message: string) {
        super(`OpenDART ${status}: ${message}`);
        this.name = 'DartError';
        this.status = status;
    }
}

export interface DartClientOptions {
    apiKey: string;
    /** 호출 간 최소 간격(ms). DART 는 분당 호출을 제한하므로 기본값을 넉넉히 둔다. */
    minIntervalMs?: number;
    maxRetries?: number;
    /** 재시도 백오프의 기준 시간(ms). 테스트에서 대기 없이 돌리려고 열어 뒀다. */
    retryBaseMs?: number;
    fetchImpl?: typeof fetch;
}

interface DartEnvelope<T> {
    status: string;
    message: string;
    list?: T[];
}

export class DartClient {
    private readonly apiKey: string;
    private readonly minIntervalMs: number;
    private readonly maxRetries: number;
    private readonly retryBaseMs: number;
    private readonly fetchImpl: typeof fetch;
    private lastCallAt = 0;

    constructor(options: DartClientOptions) {
        if (!options.apiKey) throw new Error('DART_API_KEY 가 필요합니다.');
        this.apiKey = options.apiKey;
        this.minIntervalMs = options.minIntervalMs ?? 60;
        this.maxRetries = options.maxRetries ?? 4;
        this.retryBaseMs = options.retryBaseMs ?? 1000;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }

    private async throttle(): Promise<void> {
        const wait = this.lastCallAt + this.minIntervalMs - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        this.lastCallAt = Date.now();
    }

    private buildUrl(path: string, params: Record<string, string>): string {
        const url = new URL(`${BASE_URL}/${path}`);
        url.searchParams.set('crtfc_key', this.apiKey);
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
        return url.toString();
    }

    /**
     * list 형태 응답을 가져온다. 데이터가 없으면(013) 빈 배열이다.
     * 재시도 가능한 상태코드는 지수 백오프로 다시 부른다.
     */
    async fetchList<T>(path: string, params: Record<string, string>): Promise<T[]> {
        const url = this.buildUrl(path, params);

        for (let attempt = 0; ; attempt += 1) {
            await this.throttle();

            let envelope: DartEnvelope<T>;
            try {
                const response = await this.fetchImpl(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                envelope = (await response.json()) as DartEnvelope<T>;
            } catch (error) {
                if (attempt >= this.maxRetries) throw error;
                await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * this.retryBaseMs));
                continue;
            }

            if (envelope.status === '000') return envelope.list ?? [];
            if (envelope.status === '013') return [];

            if (RETRYABLE.has(envelope.status) && attempt < this.maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * this.retryBaseMs));
                continue;
            }

            throw new DartError(
                envelope.status,
                STATUS_MESSAGES[envelope.status] ?? envelope.message ?? '알 수 없는 오류',
            );
        }
    }

    /** 회계감사인의 명칭 및 감사의견 */
    auditOpinion(corpCode: string, bsnsYear: number) {
        return this.fetchList<Record<string, string>>('accnutAdtorNmNdAdtOpinion.json', {
            corp_code: corpCode,
            bsns_year: String(bsnsYear),
            reprt_code: REPRT_CODE_ANNUAL,
        });
    }

    /** 감사용역체결현황 */
    auditServiceContracts(corpCode: string, bsnsYear: number) {
        return this.fetchList<Record<string, string>>('adtServcCnclsSttus.json', {
            corp_code: corpCode,
            bsns_year: String(bsnsYear),
            reprt_code: REPRT_CODE_ANNUAL,
        });
    }

    /** 회계감사인과의 비감사용역 계약체결 현황 */
    nonAuditServiceContracts(corpCode: string, bsnsYear: number) {
        return this.fetchList<Record<string, string>>('accnutAdtorNonAdtServcCnclsSttus.json', {
            corp_code: corpCode,
            bsns_year: String(bsnsYear),
            reprt_code: REPRT_CODE_ANNUAL,
        });
    }

    /** 단일회사 주요계정 (재무 3지표) */
    majorAccounts(corpCode: string, bsnsYear: number) {
        return this.fetchList<Record<string, string>>('fnlttSinglAcnt.json', {
            corp_code: corpCode,
            bsns_year: String(bsnsYear),
            reprt_code: REPRT_CODE_ANNUAL,
        });
    }

    /** 직원 현황 */
    employees(corpCode: string, bsnsYear: number) {
        return this.fetchList<Record<string, string>>('empSttus.json', {
            corp_code: corpCode,
            bsns_year: String(bsnsYear),
            reprt_code: REPRT_CODE_ANNUAL,
        });
    }

    /** 임원 현황 */
    executives(corpCode: string, bsnsYear: number) {
        return this.fetchList<Record<string, string>>('exctvSttus.json', {
            corp_code: corpCode,
            bsns_year: String(bsnsYear),
            reprt_code: REPRT_CODE_ANNUAL,
        });
    }

    /**
     * 고유번호 전체 목록. ZIP 안의 CORPCODE.xml 을 풀어서 준다.
     * 이 호출만 JSON 이 아니라 바이너리라 fetchList 를 타지 않는다.
     */
    async corpCodes(): Promise<CorpCodeEntry[]> {
        await this.throttle();

        const response = await this.fetchImpl(this.buildUrl('corpCode.xml', {}));
        if (!response.ok) throw new Error(`corpCode.xml HTTP ${response.status}`);

        const body = Buffer.from(await response.arrayBuffer());

        // 오류일 때는 ZIP 이 아니라 XML 상태 응답이 온다
        if (body.subarray(0, 2).toString('utf8') !== 'PK') {
            const text = body.toString('utf8');
            const status = text.match(/<status>(\d+)<\/status>/)?.[1] ?? '900';
            throw new DartError(status, STATUS_MESSAGES[status] ?? text.slice(0, 200));
        }

        const entry = readZipEntries(body).find((file) => /corpcode\.xml$/i.test(file.fileName));
        if (!entry) throw new Error('corpCode.zip 안에서 CORPCODE.xml 을 찾지 못했습니다.');

        return parseCorpCodeXml(entry.data.toString('utf8'));
    }
}

export interface CorpCodeEntry {
    corp_code: string;
    corp_name: string;
    stock_code: string | null;
}

/**
 * CORPCODE.xml 파서.
 *
 * 스키마가 <list><corp_code>·<corp_name>·<stock_code>·<modify_date> 로 아주 단순하고
 * 항목이 10만 건 규모라, XML 라이브러리 대신 정규식으로 훑는다.
 * stock_code 가 공백이면 비상장이라는 뜻이라 null 로 접는다.
 */
export function parseCorpCodeXml(xml: string): CorpCodeEntry[] {
    const entries: CorpCodeEntry[] = [];
    const blockPattern = /<list>([\s\S]*?)<\/list>/g;
    const field = (block: string, name: string) =>
        block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? '';

    let block: RegExpExecArray | null;
    while ((block = blockPattern.exec(xml)) !== null) {
        const corpCode = field(block[1], 'corp_code');
        if (!/^\d{8}$/.test(corpCode)) continue;

        const stockCode = field(block[1], 'stock_code');
        entries.push({
            corp_code: corpCode,
            corp_name: field(block[1], 'corp_name'),
            stock_code: stockCode === '' ? null : stockCode,
        });
    }

    return entries;
}
