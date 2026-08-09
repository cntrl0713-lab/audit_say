import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { consumeInMemory, isMissingMigration } from '../lib/rateLimit.ts';

describe('isMissingMigration', () => {
    test('함수나 테이블이 없는 경우만 마이그레이션 미적용으로 본다', () => {
        assert.equal(isMissingMigration({ code: 'PGRST202' }), true);
        assert.equal(isMissingMigration({ code: '42883' }), true);
        assert.equal(isMissingMigration({ code: '42P01' }), true);
        assert.equal(isMissingMigration({
            message: 'Could not find the function public.consume_rate_limit',
        }), true);
    });

    test('권한 오류와 기타 오류는 폴백 대상이 아니다', () => {
        assert.equal(isMissingMigration({
            code: '42501',
            message: 'permission denied for table cpa_rate_limits',
        }), false);
        assert.equal(isMissingMigration({
            code: '57014',
            message: 'canceling statement due to statement timeout',
        }), false);
        assert.equal(isMissingMigration({}), false);
    });
});

describe('consumeInMemory', () => {
    test('한도까지 허용하고 이후 요청은 거절한다', () => {
        const buckets = new Map();
        for (let index = 0; index < 10; index += 1) {
            assert.equal(consumeInMemory(buckets, 'u1', 10, 60_000, 1_000), true);
        }
        assert.equal(consumeInMemory(buckets, 'u1', 10, 60_000, 1_000), false);
    });

    test('시간 창과 사용자별 버킷을 분리하고 만료 항목을 정리한다', () => {
        const buckets = new Map();
        for (let index = 0; index < 10; index += 1) {
            consumeInMemory(buckets, 'u1', 10, 60_000, 1_000);
        }
        assert.equal(consumeInMemory(buckets, 'u2', 10, 60_000, 1_000), true);
        assert.equal(consumeInMemory(buckets, 'u1', 10, 60_000, 61_001), true);
        assert.equal(buckets.size, 1);
        assert.ok(buckets.has('u1'));
    });
});
