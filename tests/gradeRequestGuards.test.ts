import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateGradeRequest,
    maxQuestionsForRole,
    MAX_ANSWER_LENGTH,
} from '../lib/utils.ts';
import { consumeInMemory } from '../lib/rateLimit.ts';

const req = (id: number, qid: number, a = '유효한 답안') => ({ id, qid, a });

// ─── validateGradeRequest ─────────────────────────────────────────

describe('validateGradeRequest', () => {
    test('정상 요청은 통과한다', () => {
        assert.equal(validateGradeRequest([req(0, 1), req(1, 2)], 'MEMBER'), null);
        assert.equal(validateGradeRequest([req(0, 1)], 'GUEST'), null);
    });

    test('배열이 아니거나 비어 있으면 거절한다', () => {
        assert.ok(validateGradeRequest(null, 'ADMIN'));
        assert.ok(validateGradeRequest('items', 'ADMIN'));
        assert.ok(validateGradeRequest({ 0: req(0, 1) }, 'ADMIN'));
        assert.ok(validateGradeRequest([], 'ADMIN'));
    });

    test('등급별 문항 수 상한을 서버에서 강제한다', () => {
        const four = [req(0, 1), req(1, 2), req(2, 3), req(3, 4)];
        // 화면에서 3문제로 제한되는 등급은 서버에서도 4개를 거절해야 한다.
        assert.ok(validateGradeRequest(four, 'GUEST'));
        assert.ok(validateGradeRequest(four, 'MEMBER'));
        assert.equal(validateGradeRequest(four, 'PRO'), null);
        assert.equal(validateGradeRequest(four, 'ADMIN'), null);
    });

    test('가장 높은 등급도 상한을 넘으면 거절한다', () => {
        const many = Array.from({ length: 100 }, (_, i) => req(i, i + 1));
        assert.ok(validateGradeRequest(many, 'ADMIN'));
    });

    test('알 수 없는 등급은 가장 낮은 상한을 적용한다', () => {
        assert.equal(maxQuestionsForRole('SUPERUSER'), maxQuestionsForRole('GUEST'));
        assert.ok(validateGradeRequest([req(0, 1), req(1, 2), req(2, 3), req(3, 4)], 'SUPERUSER'));
    });

    test('답안 길이 상한을 넘으면 거절한다', () => {
        const ok = [req(0, 1, 'ㄱ'.repeat(MAX_ANSWER_LENGTH))];
        assert.equal(validateGradeRequest(ok, 'ADMIN'), null);

        const tooLong = [req(0, 1, 'ㄱ'.repeat(MAX_ANSWER_LENGTH + 1))];
        assert.ok(validateGradeRequest(tooLong, 'ADMIN'));
    });

    test('빈 답안과 공백만 있는 답안은 거절한다', () => {
        assert.ok(validateGradeRequest([req(0, 1, '')], 'ADMIN'));
        assert.ok(validateGradeRequest([req(0, 1, '   \n\t ')], 'ADMIN'));
    });

    test('id/qid 타입이 정수가 아니면 거절한다', () => {
        assert.ok(validateGradeRequest([{ id: '0', qid: 1, a: 'x' }], 'ADMIN'));
        assert.ok(validateGradeRequest([{ id: 0.5, qid: 1, a: 'x' }], 'ADMIN'));
        assert.ok(validateGradeRequest([{ id: 0, qid: '1', a: 'x' }], 'ADMIN'));
        assert.ok(validateGradeRequest([{ id: 0, qid: null, a: 'x' }], 'ADMIN'));
        assert.ok(validateGradeRequest([{ id: 0, qid: 1, a: 42 }], 'ADMIN'));
        assert.ok(validateGradeRequest([null], 'ADMIN'));
    });

    test('id가 중복되면 거절한다 (결과 맵에서 서로 덮어쓴다)', () => {
        assert.ok(validateGradeRequest([req(0, 1), req(0, 2)], 'ADMIN'));
    });
});

// ─── consumeInMemory (레이트 리밋 폴백) ─────────────────────────────

describe('consumeInMemory', () => {
    test('한도까지 허용하고 그 다음부터 거절한다', () => {
        const buckets = new Map();
        for (let i = 0; i < 10; i++) {
            assert.equal(consumeInMemory(buckets, 'u1', 10, 60_000, 1_000), true, `${i + 1}번째 호출`);
        }
        assert.equal(consumeInMemory(buckets, 'u1', 10, 60_000, 1_000), false);
    });

    test('창이 지나면 카운터가 초기화된다', () => {
        const buckets = new Map();
        for (let i = 0; i < 10; i++) consumeInMemory(buckets, 'u1', 10, 60_000, 1_000);
        assert.equal(consumeInMemory(buckets, 'u1', 10, 60_000, 1_000), false);
        assert.equal(consumeInMemory(buckets, 'u1', 10, 60_000, 61_001), true);
    });

    test('사용자별로 카운터가 분리된다', () => {
        const buckets = new Map();
        for (let i = 0; i < 10; i++) consumeInMemory(buckets, 'u1', 10, 60_000, 1_000);
        assert.equal(consumeInMemory(buckets, 'u1', 10, 60_000, 1_000), false);
        assert.equal(consumeInMemory(buckets, 'u2', 10, 60_000, 1_000), true);
    });

    test('만료된 엔트리를 정리해 Map이 무한히 커지지 않는다', () => {
        const buckets = new Map();
        consumeInMemory(buckets, 'old-1', 10, 60_000, 1_000);
        consumeInMemory(buckets, 'old-2', 10, 60_000, 1_000);
        assert.equal(buckets.size, 2);

        consumeInMemory(buckets, 'new', 10, 60_000, 61_001);
        assert.equal(buckets.size, 1);
        assert.ok(buckets.has('new'));
    });
});
