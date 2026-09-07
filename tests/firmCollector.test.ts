import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import {
    aggregateEmployees,
    aggregateEmployeesBySegment,
    buildFirmIndex,
    classifyFirmSegment,
    countKamItems,
    countRegisteredDirectors,
    matchFirm,
    normalizeAuditOpinion,
    normalizeFirmName,
    parseDartAmount,
    parseDartCount,
    parseDartDate,
    pickFinancials,
} from '../scripts/firm_collector/normalize.ts';
import { readZipEntries } from '../scripts/firm_collector/zip.ts';
import { DartClient, DartError, parseCorpCodeXml } from '../scripts/firm_collector/dartClient.ts';

describe('parseDartAmount', () => {
    test('공시 표기의 음수 형태를 모두 읽는다', () => {
        assert.equal(parseDartAmount('1,234,567'), 1234567);
        assert.equal(parseDartAmount('-1,234'), -1234);
        assert.equal(parseDartAmount('(1,234)'), -1234);
        assert.equal(parseDartAmount('△1,234'), -1234);
        assert.equal(parseDartAmount('▲1,234'), -1234);
        assert.equal(parseDartAmount('1 234'), 1234);
    });

    test('결측을 0 이 아니라 null 로 준다', () => {
        // 0 으로 접으면 v_firm_summary 의 평균이 조용히 낮아진다
        assert.equal(parseDartAmount(''), null);
        assert.equal(parseDartAmount('-'), null);
        assert.equal(parseDartAmount('－'), null);
        assert.equal(parseDartAmount(null), null);
        assert.equal(parseDartAmount(undefined), null);
        assert.equal(parseDartAmount('해당사항없음'), null);
        assert.equal(parseDartAmount('0'), 0);
    });

    test('parseDartCount 는 음수와 소수를 거른다', () => {
        assert.equal(parseDartCount('1,200'), 1200);
        assert.equal(parseDartCount('(5)'), null);
        assert.equal(parseDartCount('3.5'), null);
        assert.equal(parseDartCount('0'), 0);
    });
});

describe('normalizeAuditOpinion', () => {
    test('부적정을 적정으로 읽지 않는다', () => {
        // "적정" 이 "부적정" 의 부분 문자열이라 검사 순서가 틀리면 의견변형이 사라진다
        assert.equal(normalizeAuditOpinion('부적정'), '부적정');
        assert.equal(normalizeAuditOpinion('부적정의견'), '부적정');
        assert.equal(normalizeAuditOpinion('적정'), '적정');
    });

    test('꾸밈말이 붙은 원문도 접는다', () => {
        assert.equal(normalizeAuditOpinion('적정의견'), '적정');
        assert.equal(
            normalizeAuditOpinion('적정 (계속기업 관련 중요한 불확실성)'),
            '적정',
        );
        assert.equal(normalizeAuditOpinion('한정의견'), '한정');
        assert.equal(normalizeAuditOpinion('의견 거절'), '의견거절');
    });

    test('못 알아보면 null 이다', () => {
        assert.equal(normalizeAuditOpinion(''), null);
        assert.equal(normalizeAuditOpinion(null), null);
        assert.equal(normalizeAuditOpinion('감사받지아니한재무제표'), null);
    });
});

describe('법인명 매칭', () => {
    const firms = [
        { firm_id: 1, firm_name: '삼일회계법인', alias: ['삼일', 'PwC', 'Samil PwC'] },
        { firm_id: 2, firm_name: '삼정회계법인', alias: ['삼정', 'KPMG'] },
    ];

    test('표기 변형을 같은 법인으로 접는다', () => {
        const index = buildFirmIndex(firms);
        assert.equal(matchFirm(index, '삼일회계법인'), 1);
        assert.equal(matchFirm(index, '삼일'), 1);
        assert.equal(matchFirm(index, '  삼일 회계법인  '), 1);
        assert.equal(matchFirm(index, '삼정회계법인(KPMG)'), 2);
        assert.equal(matchFirm(index, 'samil pwc'), 1);
    });

    test('마스터에 없는 감사인은 null 이다', () => {
        const index = buildFirmIndex(firms);
        assert.equal(matchFirm(index, '없는회계법인'), null);
        assert.equal(matchFirm(index, ''), null);
        assert.equal(matchFirm(index, null), null);
    });

    test('두 법인이 같은 키를 물면 던진다', () => {
        // 조용히 덮어쓰면 A 법인 감사 건이 B 법인 밑으로 들어간다
        assert.throws(
            () =>
                buildFirmIndex([
                    { firm_id: 1, firm_name: '가나회계법인', alias: ['공통'] },
                    { firm_id: 2, firm_name: '다라회계법인', alias: ['공통'] },
                ]),
            /색인 충돌/,
        );
    });

    test('회계법인 접미어를 떼지 않아 다른 업종 법인과 섞이지 않는다', () => {
        assert.notEqual(normalizeFirmName('삼일회계법인'), normalizeFirmName('삼일감정평가법인'));
    });
});

describe('parseDartDate', () => {
    test('공시 날짜 표기를 ISO 로 바꾼다', () => {
        assert.equal(parseDartDate('2024년 03월 15일'), '2024-03-15');
        assert.equal(parseDartDate('2024.03.15'), '2024-03-15');
        assert.equal(parseDartDate('2024-3-5'), '2024-03-05');
        assert.equal(parseDartDate('20240315'), '2024-03-15');
        assert.equal(parseDartDate('-'), null);
        assert.equal(parseDartDate('2024년 13월 01일'), null);
    });
});

describe('countKamItems', () => {
    test('1부터 이어지는 번호만 센다', () => {
        assert.equal(countKamItems('1. 매출인식\n2. 재고자산 평가\n3. 영업권 손상'), 3);
        assert.equal(countKamItems('(1) 매출인식\n(2) 리스'), 2);
        assert.equal(countKamItems('① 매출인식\n② 리스\n③ 충당부채'), 3);
    });

    test('셀 수 없으면 틀린 숫자 대신 null 을 준다', () => {
        assert.equal(countKamItems('핵심감사사항은 다음과 같습니다.'), null);
        assert.equal(countKamItems('2. 매출인식\n5. 리스'), null);
        assert.equal(countKamItems(''), null);
        assert.equal(countKamItems(null), null);
    });
});

describe('pickFinancials', () => {
    test('연결이 있으면 연결을 쓴다', () => {
        const picked = pickFinancials([
            { fs_div: 'CFS', account_nm: '매출액', thstrm_amount: '1,000' },
            { fs_div: 'CFS', account_nm: '영업이익', thstrm_amount: '100' },
            { fs_div: 'CFS', account_nm: '당기순이익', thstrm_amount: '50' },
            { fs_div: 'OFS', account_nm: '매출액', thstrm_amount: '900' },
        ]);
        assert.equal(picked.revenue, 1000);
        assert.equal(picked.fs_div, 'CFS');
        assert.equal(picked.fallback_yn, false);
        assert.equal(picked.data_status, 'ok');
    });

    test('연결이 없으면 별도로 내려가며 fallback 을 세운다', () => {
        // PRD §4.4. fallback_yn 이 안 서면 나중에 연결/별도를 섞어 비교하게 된다
        const picked = pickFinancials([
            { fs_div: 'OFS', account_nm: '매출액', thstrm_amount: '900' },
            { fs_div: 'OFS', account_nm: '영업이익', thstrm_amount: '-90' },
        ]);
        assert.equal(picked.revenue, 900);
        assert.equal(picked.operating_profit, -90);
        assert.equal(picked.net_income, null);
        assert.equal(picked.fs_div, 'OFS');
        assert.equal(picked.fallback_yn, true);
    });

    test('금융회사의 영업수익도 매출로 읽는다', () => {
        const picked = pickFinancials([
            { fs_div: 'CFS', account_nm: '영업수익', thstrm_amount: '5,000' },
        ]);
        assert.equal(picked.revenue, 5000);
    });

    test('아무 계정도 못 찾으면 missing 이다', () => {
        const picked = pickFinancials([
            { fs_div: 'CFS', account_nm: '자산총계', thstrm_amount: '10,000' },
        ]);
        assert.equal(picked.data_status, 'missing');
        assert.equal(picked.fs_div, null);
        assert.equal(picked.fallback_yn, false);
    });
});

describe('직원·임원 집계', () => {
    test('합계 행이 있으면 부문 행과 겹쳐 세지 않는다', () => {
        const aggregated = aggregateEmployees([
            { fo_bbm: '회계감사', sm: '600', fyer_salary_totamt: '60,000' },
            { fo_bbm: '세무', sm: '300', fyer_salary_totamt: '30,000' },
            { fo_bbm: '합계', sm: '900', fyer_salary_totamt: '90,000' },
        ]);
        assert.equal(aggregated.employee_total, 900);
        assert.equal(aggregated.salary_total, 90000);
        assert.equal(aggregated.salary_avg, 100);
    });

    test('합계 행이 없으면 부문 행을 더한다', () => {
        const aggregated = aggregateEmployees([
            { fo_bbm: '회계감사', rgllbr_co: '500', cnttk_co: '100' },
            { fo_bbm: '세무', rgllbr_co: '300', cnttk_co: '0' },
        ]);
        assert.equal(aggregated.employee_total, 900);
        assert.equal(aggregated.salary_total, null);
        assert.equal(aggregated.salary_avg, null);
    });

    test('부문명을 감사/세무/자문으로 나눈다', () => {
        assert.equal(classifyFirmSegment('회계감사본부'), 'audit');
        assert.equal(classifyFirmSegment('Assurance'), 'audit');
        assert.equal(classifyFirmSegment('세무자문본부'), 'tax');
        assert.equal(classifyFirmSegment('경영자문'), 'advisory');
        assert.equal(classifyFirmSegment('Deal Advisory'), 'advisory');
        assert.equal(classifyFirmSegment('경영지원'), 'other');
        assert.equal(classifyFirmSegment(null), 'other');
    });

    test('부문별 인원은 합계 행을 빼고 센다', () => {
        const segmented = aggregateEmployeesBySegment([
            { fo_bbm: '회계감사', sm: '600' },
            { fo_bbm: '세무', sm: '200' },
            { fo_bbm: '경영자문', sm: '100' },
            { fo_bbm: '경영지원', sm: '50' },
            { fo_bbm: '합계', sm: '950' },
        ]);
        assert.equal(segmented.employee_total, 950);
        assert.equal(segmented.employee_audit, 600);
        assert.equal(segmented.employee_tax, 200);
        assert.equal(segmented.employee_advisory, 100);
    });

    test('등기임원만 이사 수로 센다', () => {
        assert.equal(
            countRegisteredDirectors([
                { rgist_exctv_at: '등기임원' },
                { rgist_exctv_at: '미등기임원' },
                { rgist_exctv_at: '등기임원' },
            ]),
            2,
        );
        // 등기 여부 필드가 아예 안 오면 0 이 아니라 null 이다
        assert.equal(countRegisteredDirectors([{ rgist_exctv_at: '' }, {}]), null);
    });
});

describe('corpCode.xml', () => {
    test('상장사는 stock_code 가 있고 비상장사는 null 이다', () => {
        const entries = parseCorpCodeXml(`<?xml version="1.0" encoding="UTF-8"?>
<result>
  <list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code><modify_date>20240101</modify_date></list>
  <list><corp_code>00434003</corp_code><corp_name>삼일회계법인</corp_name><stock_code> </stock_code><modify_date>20240101</modify_date></list>
  <list><corp_code>bad</corp_code><corp_name>깨진행</corp_name><stock_code></stock_code></list>
</result>`);

        assert.equal(entries.length, 2);
        assert.deepEqual(entries[0], {
            corp_code: '00126380',
            corp_name: '삼성전자',
            stock_code: '005930',
        });
        assert.equal(entries[1].stock_code, null);
    });
});

describe('ZIP 리더', () => {
    /** deflate 로 압축한 단일 항목 ZIP 을 손으로 만든다. */
    function buildZip(fileName: string, content: Buffer): Buffer {
        const name = Buffer.from(fileName, 'utf8');
        const compressed = deflateRawSync(content);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(8, 8); // deflate
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(content.length, 22);
        local.writeUInt16LE(name.length, 26);

        const localBlock = Buffer.concat([local, name, compressed]);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(content.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(0, 42); // 로컬 헤더 위치

        const centralBlock = Buffer.concat([central, name]);

        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(1, 8);
        eocd.writeUInt16LE(1, 10);
        eocd.writeUInt32LE(centralBlock.length, 12);
        eocd.writeUInt32LE(localBlock.length, 16);

        return Buffer.concat([localBlock, centralBlock, eocd]);
    }

    test('deflate 항목을 풀어낸다', () => {
        const payload = Buffer.from('<result><list><corp_code>00126380</corp_code></list></result>', 'utf8');
        const entries = readZipEntries(buildZip('CORPCODE.xml', payload));

        assert.equal(entries.length, 1);
        assert.equal(entries[0].fileName, 'CORPCODE.xml');
        assert.equal(entries[0].data.toString('utf8'), payload.toString('utf8'));
    });

    test('ZIP 이 아니면 던진다', () => {
        assert.throws(() => readZipEntries(Buffer.from('not a zip')), /ZIP 형식이 아닙니다/);
    });
});

describe('DartClient', () => {
    function clientWith(responses: unknown[]): { client: DartClient; calls: string[] } {
        const calls: string[] = [];
        let i = 0;
        const fetchImpl = (async (input: string | URL) => {
            calls.push(String(input));
            const body = responses[Math.min(i, responses.length - 1)];
            i += 1;
            return { ok: true, json: async () => body } as Response;
        }) as unknown as typeof fetch;

        return {
            client: new DartClient({ apiKey: 'test-key', minIntervalMs: 0, maxRetries: 1, fetchImpl }),
            calls,
        };
    }

    test('정상 응답의 list 를 준다', async () => {
        const { client, calls } = clientWith([{ status: '000', message: '정상', list: [{ adtor: '삼일회계법인' }] }]);
        const rows = await client.auditOpinion('00126380', 2025);

        assert.deepEqual(rows, [{ adtor: '삼일회계법인' }]);
        assert.match(calls[0], /accnutAdtorNmNdAdtOpinion\.json/);
        assert.match(calls[0], /corp_code=00126380/);
        assert.match(calls[0], /bsns_year=2025/);
        assert.match(calls[0], /reprt_code=11011/);
    });

    test('013(데이터 없음)은 오류가 아니라 빈 배열이다', async () => {
        // 그 해 공시가 없는 회사가 배치를 세우면 안 된다
        const { client } = clientWith([{ status: '013', message: '조회된 데이터가 없습니다.' }]);
        assert.deepEqual(await client.auditOpinion('00126380', 2025), []);
    });

    test('인증키 오류는 상태코드를 달고 던진다', async () => {
        const { client } = clientWith([{ status: '011', message: '사용할 수 없는 키' }]);
        await assert.rejects(client.auditOpinion('00126380', 2025), (error: unknown) => {
            assert.ok(error instanceof DartError);
            assert.equal(error.status, '011');
            return true;
        });
    });

    test('요청 제한(020)은 다시 부른다', async () => {
        const { client, calls } = clientWith([
            { status: '020', message: '요청 제한 초과' },
            { status: '000', message: '정상', list: [{ adtor: '삼정회계법인' }] },
        ]);
        const rows = await client.auditOpinion('00126380', 2025);

        assert.equal(calls.length, 2);
        assert.deepEqual(rows, [{ adtor: '삼정회계법인' }]);
    });

    test('키가 없으면 만들 때 바로 막는다', () => {
        assert.throws(() => new DartClient({ apiKey: '' }), /DART_API_KEY/);
    });
});

describe('collectEngagements 배선', () => {
    /**
     * 가짜 Supabase 클라이언트. 어떤 테이블에 무엇을 썼는지만 기록한다.
     *
     * 이 테스트가 확인하는 것은 "DART 응답의 어느 필드가 어느 컬럼으로 가는가" 라는
     * 배선이다. 필드명 자체가 실제 API 와 맞는지는 키가 있어야 확인할 수 있고,
     * 그 절차는 scripts/firm_collector/README.md "첫 실행 전 확인" 에 있다.
     */
    interface Written {
        table: string;
        op: string;
        payload: unknown;
    }

    function fakeDb(firms: unknown[]) {
        const written: Written[] = [];
        let engagementSeq = 100;

        const makeQuery = (table: string, op: string, payload: unknown) => {
            if (op !== 'select') written.push({ table, op, payload });

            let result: unknown = { data: null, error: null };
            if (table === 'firm_registered' && op === 'select') {
                result = { data: firms, error: null };
            }
            if (table === 'firm_engagement' && op === 'upsert') {
                engagementSeq += 1;
                result = { data: { engagement_id: engagementSeq }, error: null };
            }

            const query: Record<string, unknown> = {
                then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
                    Promise.resolve(result).then(resolve, reject),
            };
            for (const method of ['select', 'eq', 'is', 'single', 'order', 'limit']) {
                query[method] = () => query;
            }
            return query;
        };

        const db = {
            from: (table: string) => ({
                select: (columns: string) => makeQuery(table, 'select', columns),
                upsert: (payload: unknown) => makeQuery(table, 'upsert', payload),
                insert: (payload: unknown) => makeQuery(table, 'insert', payload),
                update: (payload: unknown) => makeQuery(table, 'update', payload),
                delete: () => makeQuery(table, 'delete', null),
            }),
        };

        return { db, written };
    }

    const FIXTURES: Record<string, unknown> = {
        'accnutAdtorNmNdAdtOpinion.json': {
            status: '000',
            message: '정상',
            list: [
                {
                    rcept_no: '20250315000001',
                    corp_cls: 'Y',
                    corp_name: '주식회사 테스트전자',
                    adtor: '삼일회계법인',
                    adt_opinion: '적정',
                    emphs_matter: '계속기업 관련 중요한 불확실성',
                    core_adt_matter: '1. 매출인식\n2. 재고자산 평가',
                },
            ],
        },
        'fnlttSinglAcnt.json': {
            status: '000',
            message: '정상',
            list: [
                { fs_div: 'CFS', account_nm: '매출액', thstrm_amount: '1,000,000' },
                { fs_div: 'CFS', account_nm: '영업이익', thstrm_amount: '(50,000)' },
                { fs_div: 'CFS', account_nm: '당기순이익', thstrm_amount: '30,000' },
                { fs_div: 'OFS', account_nm: '매출액', thstrm_amount: '900,000' },
            ],
        },
        'adtServcCnclsSttus.json': {
            status: '000',
            message: '정상',
            list: [{ bsns_year: '제 30 기', adt_cntrct_dtls_mtrpz: '450,000,000', adt_cntrct_dtls_tot_tm: '3,200' }],
        },
        'accnutAdtorNonAdtServcCnclsSttus.json': {
            status: '000',
            message: '정상',
            list: [
                {
                    cntrct_cncls_de: '2024년 07월 01일',
                    servc_cn: '세무자문',
                    servc_exc_pd: '2024.07~2024.12',
                    servc_mnrt: '80,000,000',
                },
            ],
        },
    };

    function fixtureFetch(): typeof fetch {
        return (async (input: string | URL) => {
            const url = String(input);
            const key = Object.keys(FIXTURES).find((endpoint) => url.includes(endpoint));
            if (!key) throw new Error(`픽스처가 없는 호출: ${url}`);
            return { ok: true, json: async () => FIXTURES[key] } as Response;
        }) as unknown as typeof fetch;
    }

    test('DART 응답이 각 테이블의 제 컬럼으로 들어간다', async () => {
        const { db, written } = fakeDb([
            { firm_id: 7, firm_name: '삼일회계법인', alias: ['삼일'] },
        ]);
        const dart = new DartClient({ apiKey: 'k', minIntervalMs: 0, fetchImpl: fixtureFetch() });

        const { collectEngagements } = await import('../scripts/firm_collector/collectEngagements.ts');
        const report = await collectEngagements({
            db: db as never,
            dart,
            year: 2024,
            companies: [{ corp_code: '00126380', corp_name: '테스트전자', stock_code: '005930' }],
        });

        assert.equal(report.processed, 1);
        assert.deepEqual(report.unmatchedAuditors, []);
        assert.deepEqual(report.errors, []);
        assert.deepEqual(report.financialsMissing, []);

        const find = (table: string, op: string) =>
            written.find((row) => row.table === table && row.op === op)?.payload as Record<string, unknown>;

        assert.deepEqual(find('firm_engagement', 'upsert'), {
            firm_id: 7,
            corp_code: '00126380',
            bsns_year: 2024,
            rcept_no: '20250315000001',
        });

        const company = find('firm_company', 'upsert');
        assert.equal(company.corp_name, '주식회사 테스트전자');
        assert.equal(company.corp_cls, 'Y');
        assert.equal(company.listed_yn, true);

        const opinion = find('firm_audit_opinion', 'upsert');
        assert.equal(opinion.adt_opinion, '적정');
        assert.equal(opinion.adt_opinion_raw, '적정');
        assert.equal(opinion.kam_count, 2);
        assert.equal(opinion.emph_matter, '계속기업 관련 중요한 불확실성');

        // 연결이 있으므로 별도(900,000)가 아니라 연결(1,000,000)을 써야 한다
        const financials = find('firm_financials', 'upsert');
        assert.equal(financials.revenue, 1000000);
        assert.equal(financials.operating_profit, -50000); // 괄호 음수
        assert.equal(financials.fs_div, 'CFS');
        assert.equal(financials.fallback_yn, false);
        assert.equal(financials.data_status, 'ok');

        const contracts = find('firm_service_contract', 'insert') as unknown as Record<string, unknown>[];
        assert.equal(contracts.length, 2);
        assert.equal(contracts[0].contract_type, 'audit');
        assert.equal(contracts[0].service_fee, 450000000);
        assert.equal(contracts[1].contract_type, 'nonaudit');
        assert.equal(contracts[1].service_fee, 80000000);
        assert.equal(contracts[1].contract_date, '2024-07-01');
        assert.equal(contracts[1].service_content, '세무자문');
    });

    test('마스터에 없는 감사인은 적재하지 않고 보고서에 남긴다', async () => {
        // 미매칭을 조용히 넘기면 그 법인의 고객사 수가 실제보다 적게 나온다
        const { db, written } = fakeDb([
            { firm_id: 7, firm_name: '삼일회계법인', alias: ['삼일'] },
        ]);
        const dart = new DartClient({ apiKey: 'k', minIntervalMs: 0, fetchImpl: fixtureFetch() });

        const { collectEngagements } = await import('../scripts/firm_collector/collectEngagements.ts');
        const report = await collectEngagements({
            db: db as never,
            dart,
            year: 2024,
            companies: [{ corp_code: '00126380', corp_name: '테스트전자', stock_code: '005930' }],
        });

        // 픽스처의 감사인은 삼일인데 마스터에 있으므로 정상 처리된다.
        // 마스터를 비우면 미매칭으로 떨어져야 한다.
        assert.equal(report.processed, 1);

        const empty = fakeDb([]);
        const report2 = await collectEngagements({
            db: empty.db as never,
            dart: new DartClient({ apiKey: 'k', minIntervalMs: 0, fetchImpl: fixtureFetch() }),
            year: 2024,
            companies: [{ corp_code: '00126380', corp_name: '테스트전자', stock_code: '005930' }],
        });

        assert.equal(report2.processed, 0);
        assert.deepEqual(report2.unmatchedAuditors, [
            { corp_code: '00126380', auditor: '삼일회계법인' },
        ]);
        assert.equal(
            empty.written.filter((row) => row.table === 'firm_engagement').length,
            0,
        );
        assert.ok(written.length > 0);
    });
});
