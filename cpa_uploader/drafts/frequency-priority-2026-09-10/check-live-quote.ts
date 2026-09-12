import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestOpenAIStructured } from '../../../lib/ai/openaiStructured.ts';
import { applyQuestionSetJudgment, buildGradingPrompt, buildGradingResponseSchema, gradingModelName } from '../../../lib/questionV3Grading.ts';
import type { QuestionSetJudgmentV3 } from '../../../lib/questionV3Grading.ts';

const base = path.dirname(fileURLToPath(import.meta.url));
const set = JSON.parse(fs.readFileSync(path.join(base, 'draft-09-501-freq01.json'), 'utf8'));
const sample = JSON.parse(fs.readFileSync(path.join(base, 'live-grading/r1/09-501-freq01-q2-equivalent.json'), 'utf8'));
const additionalRule = '- 반환 전에 각 quote가 해당 user_answer에 연속된 문자열로 실제 존재하는지 확인하라. 존재하지 않으면 답안 원문에서 다시 복사하라. 인용의 맞춤법·조사·띄어쓰기·문자를 교정하거나 바꾸지 마라.';
void (async () => {
  const input = buildGradingPrompt(set, sample.answers).replace('[인용 규칙]', `[인용 규칙]\n${additionalRule}`);
  const raw = await requestOpenAIStructured<QuestionSetJudgmentV3>({ apiKey: process.env.OPENAI_API_KEY || '', model: gradingModelName(),
    name: 'audit_grading_judgment', instructions: 'KICPA 회계감사 답안의 criterion 충족 여부만 판정하고 점수는 계산하지 마십시오.',
    input, schema: buildGradingResponseSchema(set), maxOutputTokens: 8000, timeoutMs: 45000, maxAttempts: 3 });
  const result = applyQuestionSetJudgment(set, sample.answers, raw);
  const file = path.join(base, 'quote-prompt-diagnostic.json');
  if (fs.existsSync(file)) throw new Error('Diagnostic output already exists');
  fs.writeFileSync(file, JSON.stringify({ performed_at: new Date().toISOString(), transport: 'live_model_diagnostic_prompt', model: gradingModelName(),
    additional_rule: additionalRule, input, raw, result, expected_points: 4, matched: result.score === 4 }, null, 2) + '\n');
  console.log(JSON.stringify({ score: result.score, expected: 4 }));
})();
