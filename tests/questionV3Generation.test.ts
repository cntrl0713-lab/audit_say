import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../cpa_uploader/generate_cpa_v3.ts';

test('question generation CLI can be imported without starting a generation run', async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
        await assert.rejects(() => main(), /OPENAI_API_KEY/);
    } finally {
        if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = previousKey;
    }
});
