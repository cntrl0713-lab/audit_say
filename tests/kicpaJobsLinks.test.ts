import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firmJobsHref, safeKicpaSourceUrl } from '../lib/kicpa/jobLinks.ts';

test('KICPA 공식 HTTPS 공고 주소와 게시글 쿼리를 보존한다', () => {
    for (const host of ['www.kicpa.or.kr', 'kicpa.or.kr']) {
        const source = `https://${host}/portal/default/kicpa/gnb/kr_pc/menu05/menu09/menu07.page?board=trainee_cpa&id=12345`;
        assert.equal(safeKicpaSourceUrl(source), source);
    }
    assert.equal(safeKicpaSourceUrl('https://www.kicpa.or.kr:443/path'), 'https://www.kicpa.or.kr/path');
});

test('외부 호스트·사칭 주소·실행 스킴·사용자정보·임의 포트를 원문 링크로 노출하지 않는다', () => {
    for (const source of [
        '', '/relative', '//www.kicpa.or.kr/path',
        'http://www.kicpa.or.kr/path', 'javascript:alert(1)', 'data:text/html,hello',
        'https://outside.example/path', 'https://www.kicpa.or.kr.outside.example/path',
        'https://fake-kicpa.or.kr/path', 'https://outside.example@www.kicpa.or.kr/path',
        'https://www.kicpa.or.kr@outside.example/path', 'https://www.kicpa.or.kr:8443/path',
        'https://user:password@www.kicpa.or.kr/path', 'https://subdomain.kicpa.or.kr/path',
    ]) assert.equal(safeKicpaSourceUrl(source), null, source);
});

test('검증된 법인 번호만 해당 법인의 채용공고로 연결하며 미매칭은 링크를 만들지 않는다', () => {
    assert.equal(firmJobsHref(17), '/firms/17?tab=jobs');
    for (const value of [null, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        assert.equal(firmJobsHref(value), null);
    }
});
