import { readZipEntries } from './zip.ts';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * OpenDART API 클라이언트.
 *
 * 2026-09-08 삼성전자 2024·2025 실응답 대조 완료. 사용 필드와 제외 범위는
 * README.md "첫 실행 전 확인"을 본다. fetchList는 응답 구조를 검사하고,
 * 파이프라인의 requireFields가 필수 필드 존재 여부를 검사한다.
 */

const BASE_URL = 'https://opendart.fss.or.kr/api';

/** 사업보고서. 반기·분기는 11012 / 11013 / 11014 다. */
export const REPRT_CODE_ANNUAL = '11011';

/**
 * OpenDART 응답 상태코드.
 * 013은 해당 API에서 조회 데이터가 없다는 뜻이며 공시 원문 부재를 증명하지 않는다.
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
    /** Credential-free raw responses, for replay after mapping/master corrections. */
    cacheDir?: string;
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
    private readonly cacheDir?: string;

    constructor(options: DartClientOptions) {
        if (!options.apiKey) throw new Error('DART_API_KEY 가 필요합니다.');
        this.apiKey = options.apiKey;
        this.minIntervalMs = options.minIntervalMs ?? 60;
        this.maxRetries = options.maxRetries ?? 4;
        this.retryBaseMs = options.retryBaseMs ?? 1000;
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.cacheDir = options.cacheDir;
    }

    private cachePath(endpoint: string, params: Record<string, string>): string | null {
        if (!this.cacheDir) return null;
        const key = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 20);
        return path.join(this.cacheDir, `${endpoint}-${key}.json`);
    }

    private async throttle(): Promise<void> {
        const now = Date.now();
        const scheduledAt = Math.max(now, this.lastCallAt + this.minIntervalMs);
        this.lastCallAt = scheduledAt;
        const wait = scheduledAt - now;
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    }

    private buildUrl(path: string, params: Record<string, string>): string {
        const url = new URL(`${BASE_URL}/${path}`);
        url.searchParams.set('crtfc_key', this.apiKey);
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
        return url.toString();
    }

    /** 공시 목록은 페이지 메타데이터까지 보존해야 누락 없이 순회할 수 있다. */
    private async fetchEnvelope(endpoint: string, params: Record<string, string>, useCache = true): Promise<Record<string, unknown>> {
        const cache = useCache ? this.cachePath(`envelope-${endpoint}`, params) : null;
        if (cache && fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
        for (let attempt = 0; ; attempt++) {
            await this.throttle();
            try {
                const response = await this.fetchImpl(this.buildUrl(endpoint, params), { signal: AbortSignal.timeout(30000) });
                if (!response.ok) throw new Error(`OpenDART ${endpoint}: HTTP ${response.status}`);
                const body = await response.json() as Record<string, unknown>;
                if (!['000', '013'].includes(String(body.status))) throw new DartError(String(body.status), STATUS_MESSAGES[String(body.status)] ?? 'API 오류');
                if (cache) {
                    fs.mkdirSync(path.dirname(cache), { recursive: true });
                    fs.writeFileSync(`${cache}.tmp`, JSON.stringify(body));
                    fs.renameSync(`${cache}.tmp`, cache);
                }
                return body;
            } catch (error) {
                if (attempt >= this.maxRetries || (error instanceof DartError && !RETRYABLE.has(error.status))) throw error;
                await new Promise(resolve => setTimeout(resolve, 2 ** attempt * this.retryBaseMs));
            }
        }
    }

    async company(corpCode: string): Promise<Record<string, string>> {
        if (!/^\d{8}$/.test(corpCode)) throw new Error('잘못된 corp_code');
        return await this.fetchEnvelope('company.json', { corp_code: corpCode }) as Record<string, string>;
    }

    async listFilings(startDate: string, endDate: string): Promise<FirmFiling[]> {
        const found = new Map<string, FirmFiling>();
        for (const [bgn_de, end_de] of filingWindows(startDate, endDate)) {
            let pages = 1;
            for (let page = 1; page <= pages; page++) {
                const body = await this.fetchEnvelope('list.json', {
                    bgn_de, end_de, pblntf_detail_ty: 'F004', last_reprt_at: 'N',
                    sort: 'date', sort_mth: 'asc', page_count: '100', page_no: String(page),
                }, false); // 목록은 매번 새로 조회: 오늘 추가된 공시를 캐시 때문에 놓치지 않는다.
                if (body.status === '013') break;
                if (!Array.isArray(body.list) || !Number.isInteger(Number(body.total_page)) || Number(body.total_page) < 1) throw new Error('F004 목록 메타데이터 오류');
                pages = Number(body.total_page);
                for (const item of body.list as FirmFiling[]) {
                    if (!/^\d{8}$/.test(item.corp_code) || !/^\d{14}$/.test(item.rcept_no) || !/^\d{8}$/.test(item.rcept_dt) || !item.report_nm || !item.corp_name) throw new Error('F004 목록 필수 필드 오류');
                    found.set(item.rcept_no, item);
                }
            }
        }
        const filings = [...found.values()];
        if (this.cacheDir) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            fs.writeFileSync(path.join(this.cacheDir, 'filings-latest.json'), JSON.stringify(filings));
            fs.writeFileSync(path.join(this.cacheDir, 'filings-latest.meta.json'), JSON.stringify({ startDate, endDate, fetchedAt: new Date().toISOString(), count: filings.length }));
        }
        return filings;
    }

    /** 원본은 gitignore 된 비공개 캐시만 허용. 호출자가 보관 방침을 명시한다. */
    async fetchDocument(rceptNo: string, cacheOriginal = false): Promise<Buffer> {
        if (!/^\d{14}$/.test(rceptNo)) throw new Error('잘못된 rcept_no');
        const cache = cacheOriginal && this.cacheDir ? path.join(this.cacheDir, 'documents', `${rceptNo}.zip`) : null;
        if (cache && fs.existsSync(cache)) return fs.readFileSync(cache);
        for (let attempt = 0; ; attempt++) {
            await this.throttle();
            try {
                const response = await this.fetchImpl(this.buildUrl('document.xml', { rcept_no: rceptNo }), { signal: AbortSignal.timeout(60000) });
                if (!response.ok) throw new Error(`document.xml HTTP ${response.status}`);
                const body = Buffer.from(await response.arrayBuffer());
                if (body.subarray(0, 2).toString() !== 'PK') {
                    const status = body.toString('utf8').match(/<status>(\d+)<\/status>/)?.[1] ?? '900';
                    throw new DartError(status, STATUS_MESSAGES[status] ?? '원문 응답 오류');
                }
                readZipEntries(body); // 손상된 ZIP은 캐시하지 않는다.
                if (cache) {
                    fs.mkdirSync(path.dirname(cache), { recursive: true });
                    fs.writeFileSync(`${cache}.tmp`, body, { mode: 0o600 });
                    fs.renameSync(`${cache}.tmp`, cache);
                }
                return body;
            } catch (error) {
                if (attempt >= this.maxRetries || (error instanceof DartError && !RETRYABLE.has(error.status))) throw error;
                await new Promise(resolve => setTimeout(resolve, 2 ** attempt * this.retryBaseMs));
            }
        }
    }

    /**
     * list 형태 응답을 가져온다. 데이터가 없으면(013) 빈 배열이다.
     * 재시도 가능한 상태코드는 지수 백오프로 다시 부른다.
     */
    async fetchList<T>(path: string, params: Record<string, string>): Promise<T[]> {
        const cache = this.cachePath(path, params);
        if (cache && fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8')) as T[];
        const url = this.buildUrl(path, params);

        for (let attempt = 0; ; attempt += 1) {
            await this.throttle();

            let envelope: DartEnvelope<T>;
            try {
                const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(30000) });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                envelope = (await response.json()) as DartEnvelope<T>;
            } catch (error) {
                if (attempt >= this.maxRetries) throw error;
                await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * this.retryBaseMs));
                continue;
            }

            if (envelope.status === '000' || envelope.status === '013') {
                if (envelope.status === '000' && !Array.isArray(envelope.list)) {
                    throw new Error(`OpenDART ${path}: 정상 응답의 list가 배열이 아닙니다.`);
                }
                const rows = envelope.list ?? [];
                if (cache) {
                    fs.mkdirSync(this.cacheDir!, { recursive: true });
                    fs.writeFileSync(`${cache}.tmp`, JSON.stringify(rows));
                    fs.renameSync(`${cache}.tmp`, cache);
                }
                return rows;
            }

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
        const cache = this.cachePath('corpCode', {});
        if (cache && fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8')) as CorpCodeEntry[];
        await this.throttle();

        const response = await this.fetchImpl(this.buildUrl('corpCode.xml', {}), { signal: AbortSignal.timeout(60000) });
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

        const rows = parseCorpCodeXml(entry.data.toString('utf8'));
        if (cache) {
            fs.mkdirSync(this.cacheDir!, { recursive: true });
            fs.writeFileSync(cache, JSON.stringify(rows));
        }
        return rows;
    }
}

export interface CorpCodeEntry {
    corp_code: string;
    corp_name: string;
    stock_code: string | null;
}

export interface FirmFiling {
    corp_code: string;
    corp_name: string;
    report_nm: string;
    rcept_no: string;
    rcept_dt: string;
}

/** 달력 분기 경계를 사용하면 월말/윤년에도 3개월 제한을 넘지 않는다. */
export function filingWindows(start: string, end: string): [string, string][] {
    const parse = (value: string) => {
        if (!/^\d{8}$/.test(value)) throw new Error('조회 날짜는 YYYYMMDD');
        const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10).replaceAll('-', '') !== value) throw new Error('유효하지 않은 조회 날짜');
        return date;
    };
    let cursor = parse(start);
    const finish = parse(end);
    if (cursor > finish) throw new Error('조회 시작일이 종료일보다 늦습니다.');
    const result: [string, string][] = [];
    const format = (date: Date) => date.toISOString().slice(0, 10).replaceAll('-', '');
    while (cursor <= finish) {
        const quarterEnd = new Date(Date.UTC(cursor.getUTCFullYear(), (Math.floor(cursor.getUTCMonth() / 3) + 1) * 3, 0));
        const last = quarterEnd < finish ? quarterEnd : finish;
        result.push([format(cursor), format(last)]);
        cursor = new Date(last.getTime() + 86400000);
    }
    return result;
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
