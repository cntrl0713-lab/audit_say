import fs from 'node:fs';
import OpenAI from 'openai';
import { gradingModelName } from '../../../../lib/questionV3Grading.ts';

// Read-only model availability check. No question, answer or credential is logged.
const output = process.argv[2];
if (!output || fs.existsSync(output)) throw Error('새 출력 파일을 지정하십시오.');
const model = gradingModelName();
void (async () => {
    let result: Record<string, unknown>;
    try {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 30000 });
        const response = await client.models.retrieve(model);
        result = { status: 'model_visible', requested_model: model, returned_model: response.id };
    } catch (error) {
        const value = error as { name?: string; status?: number; code?: string };
        result = { status: 'lookup_failed', requested_model: model, error: { name: value.name, http_status: value.status, code: value.code } };
    }
    const record = { checked_at: new Date().toISOString(), operation: 'GET model metadata', generation_calls: 0, grading_calls: 0, result };
    fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(record));
})();
