import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { currentPeriod, mergeCurrentOpinions, requireFields, firmCorpCandidates } from '../scripts/firm_collector/responseMapping.ts';
import { countKamItems, normalizeFirmName, pickFinancials } from '../scripts/firm_collector/normalize.ts';
import { DartClient } from '../scripts/firm_collector/dartClient.ts';

test('실제 삼성전자 2024 응답에서 과거 감사인과 중복 행을 제외한다', () => {
    const raw = JSON.parse(fs.readFileSync('tests/fixtures/dart-samsung-2024-opinions.json', 'utf8'));
    const current = currentPeriod(raw, 2024);
    assert.equal(current.term, 56);
    const rows = mergeCurrentOpinions(current.rows);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].adtor, '삼정회계법인');
    assert.equal(countKamItems(rows[0].core_adt_matter), 2);
    assert.equal(rows[0].bsns_year, '제56기\n(당기)');
});

test('순서에 의존하지 않고 당기를 선택하고 판별 불가 응답은 거절한다', () => {
    assert.deepEqual(currentPeriod([
        { bsns_year: '제55기 (전기)' }, { bsns_year: '제56기 (당기)' },
    ], 2024).rows, [{ bsns_year: '제56기 (당기)' }]);
    assert.deepEqual(currentPeriod([{ bsns_year: '2024' }, { bsns_year: '2023' }], 2024).rows,
        [{ bsns_year: '2024' }]);
    assert.deepEqual(currentPeriod([{ bsns_year: '2024년(제21기)' }, { bsns_year: '2023년(제20기)' }], 2024).rows,
        [{ bsns_year: '2024년(제21기)' }]);
    assert.throws(() => currentPeriod([{ bsns_year: '판별 불가' }], 2024), /당기/);
    assert.throws(() => requireFields([{ renamed_opinion: '적정' }], ['adt_opinion'], 'auditOpinion'), /필드 불일치/);
});

test('KAM 없는 정상 응답과 별도감사인 없음 행을 수집 오류로 취급하지 않는다', () => {
    const rows: Record<string, string>[] = [{ bsns_year: '제30기(당기)', adtor: '삼일회계법인', adt_opinion: '의견거절' },
        { bsns_year: '제30기(당기)', adtor: '-' }];
    requireFields(rows, ['adtor', 'bsns_year'], 'auditOpinion');
    assert.equal(mergeCurrentOpinions(currentPeriod(rows, 2024).rows).length, 1);
});

test('같은 당기 감사인의 의견이 서로 다르면 마지막 값으로 덮지 않는다', () => {
    assert.throws(() => mergeCurrentOpinions([
        { adtor: '삼정회계법인', adt_opinion: '적정' },
        { adtor: '삼정회계법인', adt_opinion: '한정' },
    ]), /수동 검토/);
    assert.equal(mergeCurrentOpinions([
        { adtor: '삼정회계법인', adt_opinion: '적정' },
        { adtor: '삼정회계법인' },
    ])[0].adt_opinion, '적정');
});

test('회계법인 고유번호를 같은 약칭의 일반 회사에서 가져오지 않는다', () => {
    assert.notEqual(normalizeFirmName('회계법인 정인'), normalizeFirmName('정인회계법인'));
    const firm = { firm_name: '삼일회계법인', alias: ['삼일'] };
    assert.deepEqual(firmCorpCandidates(firm, [
        { corp_code: '11111111', corp_name: '삼일' },
        { corp_code: '22222222', corp_name: '삼일회계법인' },
    ]), ['22222222']);
    assert.deepEqual(firmCorpCandidates(firm, [{ corp_code: '11111111', corp_name: '삼일' }]), []);
    assert.deepEqual(firmCorpCandidates({ firm_name: '정인회계법인', alias: [] }, [
        { corp_code: '00815466', corp_name: '회계법인정인' },
        { corp_code: '01281514', corp_name: '정인회계법인' },
    ]), ['00815466', '01281514']);
});

test('기수만 있는 공시는 결산연도와 연속 기수를 확인하고 최신 기수를 선택한다', () => {
    const rows = [52, 51, 50].map((term) => ({ bsns_year: `제${term}기`, stlm_dt: '2024-12-31' }));
    assert.equal(currentPeriod(rows, 2024).term, 52);
    assert.throws(() => currentPeriod(rows, 2025), /당기/);
    assert.equal(currentPeriod([{ bsns_year: "제52기 ('24.01.01~'24.12.31)" }], 2024).term, 52);
    assert.equal(currentPeriod([{ bsns_year: '2024연도(제13기)' }], 2024).term, 13);
    assert.equal(currentPeriod([{ bsns_year: '제22기(당분기말)' }], 2024).term, 22);
    assert.deepEqual(currentPeriod([{ bsns_year: '제7기 (2024)' }, { bsns_year: '제6기 (2023)' }], 2024).rows,
        [{ bsns_year: '제7기 (2024)' }]);
    assert.deepEqual(currentPeriod([{ bsns_year: '제30 (당)기' }, { bsns_year: '제29 (전)기' }], 2024).rows,
        [{ bsns_year: '제30 (당)기' }]);
    assert.throws(() => currentPeriod([62, 60].map((term) => ({ bsns_year: `제${term}기`, stlm_dt: '2024-12-31' })), 2024), /당기/);
    assert.equal(currentPeriod([{ bsns_year: '제9기 (2025기)' }, { bsns_year: '제8기 (2024년)' }], 2025).term, 9);
    assert.equal(currentPeriod(['제53기', '제52기(전기)', '제51기(전전기)'].map((bsns_year) => ({ bsns_year, stlm_dt: '2025-12-31' })), 2025).term, 53);
    assert.throws(() => currentPeriod(['제52기(전기)', '제51기(전전기)'].map((bsns_year) => ({ bsns_year, stlm_dt: '2025-12-31' })), 2025), /당기/);
});

test('외화 재무금액을 원화 비교 지표에 그대로 저장하지 않는다', () => {
    const result = pickFinancials([{ fs_div: 'CFS', account_nm: '매출액', thstrm_amount: '1,000', currency: 'USD' }]);
    assert.equal(result.revenue, null);
    assert.equal(result.data_status, 'parse_failed');
});

test('공개 응답 캐시는 재호출을 줄이고 인증키를 파일에 남기지 않는다', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'firm-cache-'));
    try {
        let calls = 0;
        const client = new DartClient({ apiKey: 'secret-test-key', cacheDir: directory, minIntervalMs: 0,
            fetchImpl: (async () => {
                calls += 1;
                return new Response(JSON.stringify({ status: '000', list: [{ adtor: '삼정' }] }));
            }) as typeof fetch,
        });
        await client.auditOpinion('00126380', 2024);
        assert.deepEqual(await client.auditOpinion('00126380', 2024), [{ adtor: '삼정' }]);
        assert.equal(calls, 1);
        for (const file of fs.readdirSync(directory)) {
            assert.doesNotMatch(file + fs.readFileSync(path.join(directory, file), 'utf8'), /secret-test-key/);
        }
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
