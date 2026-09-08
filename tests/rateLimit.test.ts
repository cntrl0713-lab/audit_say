import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumeQuota } from '../lib/rateLimitPolicy.ts';

const request = { p_key: 'grade:test-user', p_limit: 10, p_window_seconds: 60 };

test('only an explicit database grant allows a request', async () => {
    for (const data of [true, false, null, undefined, 1, 'true']) {
        assert.equal(await consumeQuota(async (args) => {
            assert.deepEqual(args, request);
            return { data, error: null };
        }, request), data === true);
    }
});

test('missing RPC, missing table, permission and timeout errors all fail closed', async () => {
    for (const code of ['PGRST202', '42883', '42P01', '42501', '57014']) {
        assert.equal(await consumeQuota(async () => ({ data: true, error: { code } }), request), false);
    }
    assert.equal(await consumeQuota(async () => { throw new Error('private credential detail'); }, request), false);
});
