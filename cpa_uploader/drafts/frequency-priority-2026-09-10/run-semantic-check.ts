import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { requestOpenAIStructured } from '../../../lib/ai/openaiStructured.ts';
import { gradingModelName } from '../../../lib/questionV3Grading.ts';
import type { QuestionSetV3 } from '../../../lib/questionV3.ts';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../..');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const bank: QuestionSetV3[] = read(path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'));
const frequency = read(path.join(base, 'frequency-links.json'));
const schema = { type: 'object', additionalProperties: false, required: ['checks', 'notes'], properties: {
  checks: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['criterion_id', 'status', 'reason', 'source_ref_id', 'source_quote'], properties: {
      criterion_id: { type: 'string' }, status: { type: 'string', enum: ['pass', 'fail', 'uncertain'] },
      reason: { type: 'string' }, source_ref_id: { type: 'string' }, source_quote: { type: 'string' },
    } } }, notes: { type: 'array', items: { type: 'string' } },
} };
void (async () => {
  for (const entry of frequency.sets) {
    const output = path.join(base, `semantic-check-${entry.set_id.replace('draft-', '')}.json`);
    if (fs.existsSync(output)) continue;
    const set: QuestionSetV3 = read(path.join(root, entry.draft_file));
    const input = JSON.stringify({ question: set, compared_bank: bank.filter(s => entry.compared_existing_ids.includes(s.id)),
      comparison_reason: entry.existing_question_difference, official_provenance: read(path.join(base, 'sources/provenance.json')),
      required_criterion_ids: set.subquestions.flatMap(q => q.criteria.map(c => c.id)) });
    try {
      const result = await requestOpenAIStructured<{ checks: Array<{ criterion_id: string; status: string; reason: string; source_ref_id: string; source_quote: string }>; notes: string[] }>({
        apiKey: process.env.OPENAI_API_KEY || '', model: gradingModelName(), name: 'audit_draft_content_check', schema,
        instructions: '회계감사 초안의 모든 criterion을 한 번씩 검토하라. 발문이 요구하는지, 정답·공식 인용·조건과 예외·배점이 일치하는지, 기존 문항과 부당하게 중복되는지 평가한다. 판본 가정과 공식 다운로드 대조 기록을 적용하되 미래 시험 확정으로 해석하지 않는다. source_quote는 해당 source_ref에서 실제 지지하는 짧은 구절을 글자 그대로 복사한다. 형식적인 pass를 채우지 말고 근거 부족·숨은 요구·이중 배점은 fail 또는 uncertain으로 밝힌다. 이것은 내용 검토 의견이며 사람 승인이나 정식 의미검수 receipt가 아니다.',
        input, maxOutputTokens: 8000, timeoutMs: 60000, maxAttempts: 1 });
      const ids = set.subquestions.flatMap(q => q.criteria.map(c => c.id));
      const errors: string[] = [];
      for (const id of ids) if (result.checks.filter(c => c.criterion_id === id).length !== 1) errors.push(`Missing/duplicate ${id}`);
      for (const c of result.checks) {
        const criterion = set.subquestions.flatMap(q => q.criteria).find(x => x.id === c.criterion_id);
        if (!criterion?.source_ref_ids.includes(c.source_ref_id) || !c.source_quote.trim() || !set.source_refs.find(r => r.id === c.source_ref_id)?.source_quote.includes(c.source_quote)) errors.push(`Invalid source evidence ${c.criterion_id}`);
      }
      fs.writeFileSync(output, JSON.stringify({ artifact_type: 'model_content_check_not_semantic_receipt', set_id: set.id, model: gradingModelName(),
        transport: 'live_model', performed_at: new Date().toISOString(), input_sha256: hash(input), input: JSON.parse(input), result, evidence_errors: errors,
        human_approval: false }, null, 2) + '\n');
      console.log(JSON.stringify({ set_id: set.id, checks: result.checks.length, issues: result.checks.filter(c => c.status !== 'pass'), evidence_errors: errors }));
    } catch (error) {
      const e = error as Error & { status?: number; code?: string };
      fs.writeFileSync(output, JSON.stringify({ set_id: set.id, transport: 'live_model_attempt', model: gradingModelName(),
        performed_at: new Date().toISOString(), input_sha256: hash(input), error: { message: e.message, status: e.status, code: e.code } }, null, 2) + '\n');
      console.log(JSON.stringify({ set_id: set.id, error: e.message }));
      break;
    }
  }
})();
