import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DartClient, filingWindows, type FirmFiling } from '../scripts/firm_collector/dartClient.ts';
import { decodeDartXml, indexDartXml, unitMultiplier } from '../scripts/firm_collector/dartXml.ts';
import { incomeLines, months, parseAnnualReport, PUBLIC_FORM_GROUPS } from '../scripts/firm_collector/annualReportParse.ts';
import { koreanToday, selectAnnualFilings } from '../scripts/firm_collector/annualReportSelection.ts';

const fixture = (name: string) => decodeDartXml(fs.readFileSync(new URL(`./fixtures/firm-annual/${name}.xml`, import.meta.url)));
test('조회 종료일은 한국 날짜를 기준으로 자정에 바뀐다', () => {
    assert.equal(koreanToday(new Date('2026-09-07T14:59:59Z')), '20260907');
    assert.equal(koreanToday(new Date('2026-09-07T15:00:00Z')), '20260908');
});
test('동일 날짜 재조회도 목록 캐시를 재사용하지 않고 새 공시를 발견한다', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f004-fresh-'));
    let calls = 0;
    try {
        const dart = new DartClient({ apiKey: 'fixture', cacheDir: dir, minIntervalMs: 0, fetchImpl: async () => {
            calls++;
            return Response.json({ status: '000', total_page: 1, list: [{ corp_code: '00260295', corp_name: '삼일회계법인', report_nm: '회계법인사업보고서 (2025.06)', rcept_no: `2026090800000${calls}`, rcept_dt: '20260908' }] });
        } });
        await dart.listFilings('20260901', '20260908');
        const latest = await dart.listFilings('20260901', '20260908');
        assert.equal(calls, 2);
        assert.equal(latest[0].rcept_no, '20260908000002');
        assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'filings-latest.json'), 'utf8'))[0].rcept_no, latest[0].rcept_no);
    } finally {
        // mkdtemp가 반환한 테스트 전용 경로만 제거한다.
        assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
test('DART 분기 창은 윤년/월말에도 중복·누락이 없고 역전일은 거부한다', () => {
    assert.deepEqual(filingWindows('20240229', '20240701'), [['20240229', '20240331'], ['20240401', '20240630'], ['20240701', '20240701']]);
    assert.throws(() => filingWindows('20240230', '20240701'));
    assert.throws(() => filingWindows('20250101', '20240101'));
});
test('F004 목록을 메타데이터 끝 페이지까지 읽고 접수번호로 중복을 없앤다', async () => {
    const pages: number[] = [];
    const dart = new DartClient({ apiKey: 'fixture', minIntervalMs: 0, fetchImpl: async input => {
        const page = Number(new URL(String(input)).searchParams.get('page_no')); pages.push(page);
        return Response.json({ status: '000', total_page: 2, list: [{ corp_code: '00260295', corp_name: '삼일회계법인', report_nm: '회계법인사업보고서 (2025.06)', rcept_no: `2025093000018${page}`, rcept_dt: '20250930' }] });
    } });
    assert.equal((await dart.listFilings('20250701', '20250930')).length, 2);
    assert.deepEqual(pages, [1, 2]);
});
test('늦게 접수된 과거 결산 정정은 해당 결산일에만 적용하고 복수 결산기는 보류한다', () => {
    const f = (report_nm: string, rcept_no: string): FirmFiling => ({ report_nm, rcept_no, rcept_dt: rcept_no.slice(0, 8), corp_code: '00260295', corp_name: '삼일회계법인' });
    const selected = selectAnnualFilings([f('회계법인사업보고서 (2024.06)', '20240930000001'), f('[기재정정]회계법인사업보고서 (2024.06)', '20260908000001'), f('회계법인사업보고서 (2025.06)', '20250930000001')], 2024);
    assert.equal(selected.selected.length, 1); assert.equal(selected.selected[0].rcept_no, '20260908000001');
    assert.equal(selectAnnualFilings([...selected.selected, f('회계법인사업보고서 (2024.12)', '20250331000001')], 2024).multiplePeriods.length, 1);
});
test('삼일 전 임직원 인건비·인원·감사투입을 실제 축약 원문에서 재현한다', () => {
    const doc = indexDartXml(fixture('samil'));
    const result = parseAnnualReport(doc, '20250930000188');
    assert.equal(doc.fyEndDate, '2025-06-30');
    assert.equal(result.profile.revenue_total, 1109366384939);
    assert.equal(result.workforce.salary_total, 795751178314);
    assert.equal(result.workforce.employee_total, 4263);
    assert.equal(result.workforce.employee_audit, 2454);
    assert.equal(result.tables.firm_audit_input_yearly.find(r => r.tenure_band === 'total')?.tot_hours, 2142905);
    assert.equal(result.workforce.salary_avg, 795751178314 / 4263);
    assert.equal(result.consistencyWarnings.includes('notVerifiable:revenue'), false);
});

test('사용자 지정 현대 제20기와 그 정정만 제외하고 제19기·제21기 및 타 법인은 유지한다', () => {
    const f = (corp_code: string, period: string, receipt: string): FirmFiling => ({ corp_code, corp_name: '회계법인', report_nm: `회계법인사업보고서 (${period})`, rcept_no: receipt, rcept_dt: receipt.slice(0, 8) });
    const filings = [f('00561352', '2024.03', '20240703000549'), f('00561352', '2024.06', '20240930000337'),
        f('00561352', '2024.06', '20260908000001'), f('00561352', '2025.06', '20250930000568'),
        f('00260295', '2024.06', '20240930000232')];
    const selected = selectAnnualFilings(filings, 2024);
    assert.deepEqual(selected.selected.map(x => x.rcept_no).sort(), ['20240703000549', '20240930000232']);
    assert.equal(selected.excluded.length, 2);
    assert.equal(selected.multiplePeriods.length, 0);
    assert.equal(selectAnnualFilings(filings, 2025).selected[0].rcept_no, '20250930000568');
});
test('표마다 단위를 읽으며 원/천원/백만원/미확인을 구분한다', () => {
    assert.equal(unitMultiplier('(단위 : 백만원, %)'), 1000000);
    assert.equal(unitMultiplier('(단위: 천원, 명)'), 1000);
    assert.equal(unitMultiplier('(단위: USD)'), null);
    assert.equal(unitMultiplier('(단위: 원) / (단위: 천원)'), null);
    const doc = indexDartXml(fixture('samjung'));
    assert.equal(doc.groups.get('TG_BSAL')?.unitMultiplier, 1000000);
    const changed = indexDartXml(fixture('samil').replaceAll('(단위 : 원, 명)', '(단위 : 미상)'));
    assert.equal(parseAnnualReport(changed, '20250930000188').workforce.salary_total, null);
});
test('매출 감소 법인의 제목 당기 문구를 열 헤더로 오인하지 않는다', () => {
    const doc = indexDartXml(fixture('declining-revenue'));
    const lines = incomeLines(doc.groups.get('KCIS:K'));
    assert.equal(lines.find(r => r.account_code === '12100000010000')?.amount, 16243572895);
});
test('당기 -는 전기 숫자로 대체하지 않고 부호·EUC-KR을 보존한다', () => {
    const xml = '<TABLE-GROUP ACLASS="KCIS:K"><TABLE><TR><TH>과목</TH><TH COLSPAN="2">제1(당)기</TH><TH>제0(전)기</TH></TR><TR><TE ACODE="12500000010000" ADELIM="0">영업이익</TE><TE></TE><TE>-</TE><TE>900</TE></TR><TR><TU>(단위: 원)</TU></TR></TABLE></TABLE-GROUP>';
    assert.equal(incomeLines(indexDartXml(xml).groups.get('KCIS:K'))[0].amount, null);
    assert.equal(incomeLines(indexDartXml(xml.replace('<TE>-</TE>', '<TE>(83)</TE>')).groups.get('KCIS:K'))[0].amount, -83);
    assert.equal(indexDartXml(fixture('legacy-euc-kr')).companyName, '삼일회계법인');
    assert.throws(() => parseAnnualReport(indexDartXml(fixture('legacy-euc-kr')), '20200929000485'), /버전/);
});
test('제1기 전기 결측과 원문 인원 불일치는 0으로 고치지 않는다', () => {
    const doc = indexDartXml(fixture('seonmin'));
    const parsed = parseAnnualReport(doc, '20250701000044');
    assert.equal(parsed.workforce.employee_total, 27);
    assert.ok(parsed.consistencyWarnings.includes('headcount:7!=27'));
    assert.equal(parsed.tables.firm_annual_form_cell.find(r => r.code === 'BSAL_PFY_S_SUM')?.numeric_value, null);
    assert.deepEqual(parsed.hardFailures, []);
});
test('1.8 실제 원문: 삼일 2024의 원 단위 인건비와 가립의 백만원 단위·손실을 보존한다', () => {
    const samilDoc = indexDartXml(fixture('samil-2024-v18'));
    assert.equal(samilDoc.formulaVersion, '1.8');
    const samil = parseAnnualReport(samilDoc, '20240930000232');
    assert.equal(samil.profile.revenue_total, 1023100915272);
    assert.equal(samil.workforce.salary_total, 745906432773);
    assert.equal(samil.workforce.employee_total, 4100);
    assert.equal(samil.fyEndDate, '2024-06-30');
    const garipDoc = indexDartXml(fixture('garip-2024-v18'));
    assert.equal(garipDoc.groups.get('TG_BSAL')?.unitMultiplier, 1000000);
    const garip = parseAnnualReport(garipDoc, '20240701000610');
    assert.equal(garip.workforce.salary_total, 2352000000);
    assert.equal(garip.profile.operating_income, -256225698);
    assert.equal(garip.profile.net_income, -217619654);
    assert.equal(garip.workforce.director_pay_total, null);
    assert.equal(garip.hardFailures.length, 0);
    assert.throws(() => parseAnnualReport({ ...samilDoc, formulaVersion: '1.9' }, '20240930000232'), /버전/);
});

test('원문 내부 매출 불일치를 적재 보류 사유로 반환한다', () => {
    const xml = fixture('samil').replace('1,109,366,384,939', '1,109,366,384,938');
    assert.ok(parseAnnualReport(indexDartXml(xml), '20250930000188').hardFailures.some(s => s.startsWith('revenue:')));
});

test('시작연도 기준에 필요한 시작일이 없거나 종료일보다 늦으면 추정하지 않는다', () => {
    const doc = indexDartXml(fixture('samil'));
    assert.throws(() => parseAnnualReport({ ...doc, fyStartDate: null }, '20250930000188'), /시작일/);
    assert.throws(() => parseAnnualReport({ ...doc, fyStartDate: '2026-01-01' }, '20250930000188'), /역전/);
});
test('개인 경력·보수 실명은 비공개 두 테이블에만 남는다', () => {
    const group = (name: string, prefix: string, extra: string) => `<TABLE-GROUP ACLASS="${name}"><TABLE><TR><TU>(단위: 원)</TU></TR><TR><TE ACODE="${prefix}_NM">테스트개인실명</TE>${extra}</TR></TABLE></TABLE-GROUP>`;
    const xml = fixture('samil').replace('</DOCUMENT>', group('TG_HR_ED', 'ED', '<TE ACODE="ED_WK_YM">36년 0개월</TE>') + group('TG_SAL', 'SAL', '<TE ACODE="SAL_TOT">900</TE>') + '</DOCUMENT>');
    const p = parseAnnualReport(indexDartXml(xml), '20250930000188');
    assert.equal(p.tables.firm_director[0].name, '테스트개인실명');
    assert.equal(p.tables.firm_director_pay[0].name, '테스트개인실명');
    assert.equal(JSON.stringify(Object.fromEntries(Object.entries(p.tables).filter(([k]) => !['firm_director', 'firm_director_pay'].includes(k)))).includes('테스트개인실명'), false);
    assert.equal(PUBLIC_FORM_GROUPS.includes('TG_SAL'), false);
    assert.equal(months('36년 0개월'), 432); assert.equal(months('-'), null);
    assert.equal(p.tables.firm_director_profile_yearly[0].tenure_months_avg, null);
});
