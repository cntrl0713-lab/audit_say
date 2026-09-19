// 기준서형 검토 둘째 후속(v3, 명제의 기준서 번호 요건 정리)으로 바뀐 물음을 가리키는 coverage 관계를 재대조 결과대로 갱신한다.
//   node cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19/tools/update-coverage-v3.mjs [--apply]
// v3 정본 설치 뒤에 실행한다. --apply가 없으면 바뀔 내용만 출력한다. v2 대상 물음에는 coverage 관계가 없다.
// 명제의 뜻(요구 범위)은 그대로이고 기준서 번호의 인용을 요구하지 않는다고 밝힌 변경이므로 대상·관계·사유를 유지하고
// 문항 해시만 새 정본으로 바꾸며 재대조 이력을 남긴다. 요소·원자료 단위의 해시가 기록과 다르면 멈춘다.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { questionHash } from '../../../coverage/build-coverage.mjs';

const B = 'cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19';
const LINKS = 'cpa_uploader/analysis/coverage/links.json';
const apply = process.argv.includes('--apply');
const bytes = (p) => fs.readFileSync(p);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const read = (p) => JSON.parse(bytes(p).toString('utf8').replace(/^﻿/u, ''));
const hashObject = (value) => sha(JSON.stringify(value));

const plan = read(`${B}/plan-v3.json`).entries;
const corrections = read(`${B}/corrections-v3.json`).files;
for (const file of corrections) {
  const id = file.split('/').pop().replace(/\.json$/u, '');
  assert(fs.existsSync(`cpa_uploader/corrections/applied/${id}.json`), `정본 설치 전입니다: ${id}`);
}
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = new Map(read('cpa_uploader/analysis/question-elements/question-elements.json').elements.map((e) => [e.id, e]));
const changed = new Map(plan.filter((e) => e.claims).map((e) => [`${e.set}/${e.sub}`, e]));
const linksText = bytes(LINKS).toString('utf8');
const document = read(LINKS);
const beforeFile = `${B}/coverage-links-before-v3.json`;
const reviewer = 'agent:claude-opus-5 (author agent; no independent peer review)';
const planRef = { file: `${B}/plan-v3.json`, sha256: sha(bytes(`${B}/plan-v3.json`)) };
// 관계별로 대조한 결과. 새 관계가 생기면 이 표에 대조 결과를 적어야 갱신한다.
const decisions = {
  'standard-new-verification-20260914-o5-45': 'crit1은 여전히 감사기준서 701이 적용되는 경우 강조사항문단이 개별 핵심감사사항의 기술을 대체하지 않는다는 명제다. v3은 기준서 번호의 인용을 요구하지 않는다고 밝혔을 뿐 요구 범위를 바꾸지 않았으므로 원발문(핵심감사사항 일부를 강조사항문단으로 보고하는 방안)과의 broader 관계와 사유를 유지한다.',
};
const method = '명제의 기준서 번호 요건 정리(standard-spoiler-2026-09-19 v3)에 따른 재대조. 요소의 원발문·관계 사유와 새 명제·critical_facts를 대조해 연결된 criterion의 요구 범위가 그대로임을 확인하고 문항 해시를 새 정본으로 갱신했다.';

const updated = [];
const links = document.links.map((link) => {
  const target = link.target;
  if (!target || target.scope === 'draft' || !changed.has(`${target.set_id}/${target.subquestion_id}`)) return link;
  const decision = decisions[link.id];
  assert(decision, `${link.id}: 대조 결과가 없는 관계`);
  const element = elements.get(link.element_id); assert(element, `요소 없음 ${link.element_id}`);
  assert.equal(link.snapshot.element_sha256, hashObject(element), `${link.id}: 요소가 바뀌었다(이 도구의 범위 밖)`);
  const set = bank.find((s) => s.id === target.set_id); assert(set);
  const sub = set.subquestions.find((q) => q.id === target.subquestion_id); assert(sub);
  for (const id of target.criterion_ids ?? []) assert(sub.criteria.some((c) => c.id === id), `${link.id}: criterion ${id} 없음`);
  const next = structuredClone(link);
  next.snapshot = { ...next.snapshot, question_sha256: questionHash(set, sub) };
  next.review_history = [...(link.review_history ?? []), {
    reviewed_at: '2026-09-19', reviewer, kind: 'agent_semantic_relationship_review', method, decision,
    input: { ...planRef, source_link_id: link.id },
    preserved_snapshot: { file: beforeFile, sha256: sha(Buffer.from(linksText, 'utf8')) },
    prior: { target: link.target, relationship: link.relationship, review_status: link.review_status, reason: link.reason,
      source_unit_ids: link.source_unit_ids, snapshot: link.snapshot },
  }];
  updated.push(link.id);
  return next;
});
for (const id of Object.keys(decisions)) assert(updated.includes(id), `${id}: 갱신 대상이 아니다`);
console.log(JSON.stringify({ apply, updated }, null, 2));
if (apply) {
  fs.writeFileSync(beforeFile, linksText, { flag: 'wx' });
  const text = `${JSON.stringify({ ...document, links }, null, 2)}\n`;
  fs.writeFileSync(LINKS, linksText.includes('\r\n') ? text.replace(/\n/gu, '\r\n') : text);
  console.log(`갱신: ${LINKS}, 보존본: ${beforeFile}`);
}
