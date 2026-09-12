import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const E = `${D}/efficient-verification-2026-09-12/c`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const master = read(`${D}/a/execution-all-v9/manifest.json`), bank = read(master.bank_file);
const classification = read(`${D}/c/prepared-reviewed-v8/learning-question-classifications.json`).classifications;
const topic = process.argv[2]; assert(/^(?:1[0-9])$/.test(topic));
const jobs = master.jobs.filter(j => bank.find(s => s.id === j.set_id).classification.topic_id === topic);
const sources = new Map();
const entries = jobs.map(job => {
  const set = bank.find(s => s.id === job.set_id), qa = read(job.qa_file);
  const planValue = read(job.plan_file), plan = planValue.plans?.find(p => p.set_id === set.id) ?? planValue;
  for (const ref of set.source_refs) {
    const text = fs.readFileSync(ref.file, 'utf8'); assert(text.includes(ref.source_quote)); assert.equal(hash(ref.source_quote), ref.content_hash);
    sources.set(ref.content_hash, { ref: ref.id, file: ref.file, file_sha256: hash(fs.readFileSync(ref.file)), title: ref.title, page: ref.page, quote: ref.source_quote });
  }
  const questions = set.subquestions.map(q => {
    const cl = classification.find(c => c.source_set_id === set.id && c.subquestion_id === q.id); assert(cl, `${set.id}/${q.id}`);
    const cases = (Array.isArray(qa.cases) ? qa.cases : qa.cases[set.id]).filter(c => c.subquestion_id === q.id && c.answer.trim());
    const max = q.criteria.reduce((n, c) => n + c.max_points, 0);
    const model = cases.find(c => c.answer === (Array.isArray(q.model_answer) ? q.model_answer.join('\n') : q.model_answer) && c.expected_points === max) ?? cases.find(c => c.expected_points === max && /model|complete|full/.test(c.id + c.kind));
    const partials = cases.filter(c => c.expected_points > 0 && c.expected_points < max);
    const partial = partials.find(c => /partial|independent|only/.test(c.id + c.kind)) ?? partials.find(c => /omit/.test(c.id + c.kind)) ?? partials[0];
    const wrong = cases.find(c => c.expected_points === 0 && /opposite|contradict|wrong/.test(c.id + c.kind)) ?? cases.find(c => c.expected_points === 0 && !/security|salad|injection/.test(c.kind + c.id));
    return { id: q.id, type: q.type, classification: cl, prompt: q.prompt, answer: q.model_answer, max,
      requirements: q.requirements.map(r => ({ id: r.id, text: r.text, source_ref_id: r.source_ref_id, source_span: r.source_span })),
      criteria: q.criteria, proposed_representatives: { model, partial: partial ?? null, wrong: wrong ?? null }, candidate_cases_count: cases.length };
  });
  return { set_id: set.id, title: set.title, source_file: job.file, source_sha256: hash(fs.readFileSync(job.file)),
    source_refs: set.source_refs.map(r => ({ id: r.id, quote_hash: r.content_hash, title: r.title })), facts: set.shared_context,
    edition_assumption: plan.edition_assumption, questions };
});
const dossier = { status: 'read_dossier_not_a_verdict', topic, entries, sources: [...sources].map(([sha256, value]) => ({ sha256, ...value })) };
fs.mkdirSync(`${E}/dossiers`, { recursive: true });
fs.writeFileSync(`${E}/dossiers/topic-${topic}.json`, JSON.stringify(dossier, null, 2) + '\n', { flag: 'wx' });
if (process.argv.includes('--quiet')) { console.log(JSON.stringify({topic,sets:entries.length,questions:entries.flatMap(e=>e.questions).length,sources:sources.size})); process.exit(0); }
console.log(JSON.stringify({ ...dossier, entries: entries.map(e => ({ ...e, questions: e.questions.map(q => ({ ...q,
  criteria: q.criteria.map(c => ({ id: c.id, claim: c.claim, points: c.max_points, refs: c.source_ref_ids,
    extra_facts: c.critical_facts.filter(f => f.expected !== c.claim || f.scope || f.forbidden_meaning).map(f => f) })),
  proposed_representatives: Object.fromEntries(Object.entries(q.proposed_representatives).map(([key, c]) => [key, c ? { id: c.id, kind: c.kind, answer: c.answer, points: c.expected_points, verdicts: c.expected_verdicts } : null])) })) })) }, null, 2));
