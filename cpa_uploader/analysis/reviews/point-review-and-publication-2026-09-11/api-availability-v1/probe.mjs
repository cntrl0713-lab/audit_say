import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { fileURLToPath } from 'node:url';

// One bounded availability diagnostic. It is not question-verification evidence.
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json');
const fd = fs.openSync(output, 'wx');
const started = new Date().toISOString();
let result;
try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
    const response = await client.responses.create({
        model: 'gpt-5.6-luna', input: 'Reply OK.', store: false, max_output_tokens: 16,
    }, { timeout: 30000 });
    result = { status: 'provider_accepted_request', response_status: response.status,
        model: response.model, usage: response.usage, incomplete_details: response.incomplete_details };
} catch (error) {
    const headers = {};
    for (const key of ['retry-after', 'x-ratelimit-limit-requests', 'x-ratelimit-limit-tokens',
        'x-ratelimit-remaining-requests', 'x-ratelimit-remaining-tokens',
        'x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens']) {
        const value = error.headers?.get?.(key);
        if (value !== null && value !== undefined) headers[key] = value;
    }
    result = { status: 'provider_error', http_status: error.status ?? null,
        error_code: error.code ?? null, error_type: error.type ?? null, headers };
}
const record = { purpose: 'availability_diagnostic_only', question_validation: false,
    started_at: started, finished_at: new Date().toISOString(), max_attempts: 1,
    requested_model: 'gpt-5.6-luna', ...result };
fs.writeFileSync(fd, `${JSON.stringify(record, null, 2)}\n`);
fs.closeSync(fd);
process.stdout.write(`${JSON.stringify(record)}\n`);
