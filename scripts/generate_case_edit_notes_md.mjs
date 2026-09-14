import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const bankFile = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const classificationFile = path.join(root, 'cpa_uploader/data/learning-question-classifications.json');
const outputFile = path.join(root, 'docs/case-question-edit-notes-2026-09-14.md');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const clean = value => String(value ?? '').trim();
const oneLine = value => clean(value).replaceAll(/\s+/gu, ' ');
const escapeTable = value => oneLine(value).replaceAll('|', '\\|');
const inlineCode = value => '`' + String(value) + '`';
const points = question => (question.criteria ?? []).reduce((sum, criterion) => sum + Number(criterion.max_points ?? 0), 0);

const bank = readJson(bankFile);
const classificationsDoc = readJson(classificationFile);
const classifications = classificationsDoc.classifications;
const topics = new Map((classificationsDoc.topics ?? []).map(topic => [topic.id, topic]));
if (!Array.isArray(bank) || !Array.isArray(classifications)) throw new Error('Unexpected question-bank/classification shape.');

const bySet = new Map();
for (const entry of classifications) {
  if (entry.question_style !== 'case') continue;
  if (!bySet.has(entry.source_set_id)) bySet.set(entry.source_set_id, new Map());
  bySet.get(entry.source_set_id).set(entry.subquestion_id, entry);
}

const cases = [];
for (const set of bank) {
  const selected = bySet.get(set.id);
  if (!selected) continue;
  const questions = (set.subquestions ?? [])
    .filter(question => selected.has(question.id))
    .map(question => ({ question, classification: selected.get(question.id) }));
  if (questions.length !== selected.size) {
    const found = new Set(questions.map(item => item.question.id));
    const missing = [...selected.keys()].filter(id => !found.has(id));
    throw new Error(`Classification points to missing subquestion(s): ${set.id}/${missing.join(',')}`);
  }
  const topicIds = [...new Set(questions.flatMap(item => item.classification.topic_ids ?? []))];
  cases.push({ set, questions, topicIds });
}
if (cases.length !== bySet.size) throw new Error('Some classified case parent is absent from the authoring bank.');

const topicLabel = topicId => {
  const topic = topics.get(topicId);
  return topic ? `${topic.id} ${topic.title}` : `${topicId} (주제명 미확인)`;
};
const topicLabels = ids => ids.length ? ids.map(topicLabel).join(' · ') : '(주제 미지정)';
const caseFactText = set => (set.shared_context?.facts ?? []).map(fact => clean(fact.text)).filter(Boolean);
const factIds = set => (set.shared_context?.facts ?? []).map(fact => clean(fact.id)).filter(Boolean);

const lines = [
  '# 사례형 문제 수정 요청서',
  '',
  `- 대상: 사례형 부모 ${cases.length}개 · 사례형 물음 ${cases.reduce((sum, item) => sum + item.questions.length, 0)}개`,
  `- 기준: 분류 정본의 ${inlineCode('question_style: case')}`,
  `- 정본 ID: ${inlineCode(path.relative(root, bankFile).replaceAll('\\', '/'))}`,
  '',
];

for (const [caseIndex, item] of cases.entries()) {
  const set = item.set;
  lines.push(
    `## ${caseIndex + 1}. ${clean(set.title)}`,
    `- 주제: ${topicLabels(item.topicIds)}`,
    `- ID: ${inlineCode(set.id)}`,
    '',
    '수정할 점:',
    '',
  );
}

fs.writeFileSync(outputFile, lines.join('\n'), { encoding: 'utf8', flag: 'w' });
console.log(JSON.stringify({
  output: path.relative(root, outputFile).replaceAll('\\', '/'),
  cases: cases.length,
  case_questions: cases.reduce((sum, item) => sum + item.questions.length, 0),
  bytes: fs.statSync(outputFile).size,
  authoring_sha256: sha256(bankFile),
  classifications_sha256: sha256(classificationFile),
}, null, 2));
