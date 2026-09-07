import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatDecimal,
    formatKrw,
    formatNumber,
    formatRatio,
    safeRatio,
} from '../lib/firm/format.ts';
import {
    buildFilterQuery,
    buildQuery,
    readBool,
    readEnum,
    readInt,
    readString,
} from '../lib/firm/params.ts';

describe('formatKrw', () => {
    test('원 단위 금액을 조·억·만으로 접는다', () => {
        assert.equal(formatKrw(1_250_000_000_000), '1.3조원');
        assert.equal(formatKrw(980_000_000_000), '9,800억원');
        assert.equal(formatKrw(8_700_000_000), '87억원');
        assert.equal(formatKrw(95_000_000), '9,500만원');
        assert.equal(formatKrw(3_200), '3,200원');
    });

    test('.0 은 지우고 정수부에는 자릿수 구분을 넣는다', () => {
        assert.equal(formatKrw(1_000_000_000_000), '1조원');
        assert.equal(formatKrw(1_234_500_000_000), '1.2조원');
        assert.equal(formatKrw(1_234_000_000_000_0), '12.3조원');
    });

    test('음수는 하이픈이 아니라 마이너스 기호로 쓴다', () => {
        // 표에서 "-"(결측)와 음수가 같아 보이면 손실을 결측으로 읽는다
        assert.equal(formatKrw(-5_200_000_000), '−52억원');
        assert.equal(formatKrw(null), '-');
        assert.equal(formatKrw(undefined), '-');
        assert.equal(formatKrw(NaN), '-');
    });

    test('0 은 결측이 아니다', () => {
        assert.equal(formatKrw(0), '0원');
        assert.equal(formatNumber(0), '0');
    });
});

describe('숫자 포매터', () => {
    test('결측은 0 이 아니라 "-" 다', () => {
        assert.equal(formatNumber(null), '-');
        assert.equal(formatDecimal(null), '-');
        assert.equal(formatRatio(null), '-');
    });

    test('단위를 붙인다', () => {
        assert.equal(formatNumber(4100, '명'), '4,100명');
        assert.equal(formatDecimal(12.8125, 1, '배'), '12.8배');
        assert.equal(formatRatio(0.6), '60.0%');
        assert.equal(formatRatio(0.17513), '17.5%');
    });

    test('safeRatio 는 0 으로 나누지 않는다', () => {
        assert.equal(safeRatio(10, 0), null);
        assert.equal(safeRatio(10, null), null);
        assert.equal(safeRatio(null, 10), null);
        assert.equal(safeRatio(6, 10), 0.6);
    });
});

describe('searchParams 읽기', () => {
    test('빈 문자열은 값이 없는 것으로 본다', () => {
        assert.equal(readString({ q: '' }, 'q'), undefined);
        assert.equal(readString({ q: '  ' }, 'q'), undefined);
        assert.equal(readString({ q: ' 삼일 ' }, 'q'), '삼일');
    });

    test('readInt 는 잘못된 값을 기본값으로 떨어뜨린다', () => {
        assert.equal(readInt({ page: '3' }, 'page', 1), 3);
        assert.equal(readInt({ page: '0' }, 'page', 1), 1);
        assert.equal(readInt({ page: '-2' }, 'page', 1), 1);
        assert.equal(readInt({ page: 'abc' }, 'page', 1), 1);
        assert.equal(readInt({}, 'page', 1), 1);
    });

    test('readEnum 은 허용 목록 밖의 값을 버린다', () => {
        // 사용자가 URL 을 손으로 고쳐도 쿼리에 임의 값이 들어가면 안 된다
        const allowed = ['clients', 'kam'] as const;
        assert.equal(readEnum({ tab: 'kam' }, 'tab', allowed), 'kam');
        assert.equal(readEnum({ tab: 'drop table' }, 'tab', allowed), undefined);
        assert.equal(readEnum({}, 'tab', allowed), undefined);
    });

    test('readBool 은 true/false 만 받고 나머지는 전체로 본다', () => {
        assert.equal(readBool({ listed: 'true' }, 'listed'), true);
        assert.equal(readBool({ listed: 'false' }, 'listed'), false);
        assert.equal(readBool({ listed: '1' }, 'listed'), undefined);
        assert.equal(readBool({}, 'listed'), undefined);
    });

    test('배열로 들어온 파라미터는 첫 값만 쓴다', () => {
        assert.equal(readString({ q: ['가', '나'] }, 'q'), '가');
    });
});

describe('searchParams 쓰기', () => {
    test('기존 파라미터를 유지하면서 얹는다', () => {
        const query = buildQuery({ year: '2024', tab: 'clients' }, { page: 3 });
        const parsed = new URLSearchParams(query.slice(1));
        assert.equal(parsed.get('year'), '2024');
        assert.equal(parsed.get('tab'), 'clients');
        assert.equal(parsed.get('page'), '3');
    });

    test('null 은 키를 지운다 (필터 해제)', () => {
        const query = buildQuery({ year: '2024', market: 'Y' }, { market: null });
        assert.equal(new URLSearchParams(query.slice(1)).get('market'), null);
    });

    test('필터를 바꾸면 페이지를 1로 되돌린다', () => {
        // 3쪽에서 필터를 바꿔 빈 화면이 뜨면 버그처럼 보인다
        const query = buildFilterQuery({ page: '3', year: '2024' }, { market: 'K' });
        const parsed = new URLSearchParams(query.slice(1));
        assert.equal(parsed.get('page'), null);
        assert.equal(parsed.get('market'), 'K');
        assert.equal(parsed.get('year'), '2024');
    });

    test('빈 파라미터는 쿼리 문자열을 만들지 않는다', () => {
        assert.equal(buildQuery({}, {}), '');
        assert.equal(buildQuery({ q: '' }, {}), '');
    });
});
