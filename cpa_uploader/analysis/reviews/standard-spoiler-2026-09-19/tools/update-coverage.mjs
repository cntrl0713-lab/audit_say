// 기준서형 수정·스포일러 검토(2026-09-19)로 바뀐 물음을 가리키는 coverage 관계를 재대조 결과대로 갱신한다.
//   node cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19/tools/update-coverage.mjs [--apply]
// 정본 설치 뒤에 실행한다. --apply가 없으면 바뀔 내용만 출력한다.
// - 요구 범위가 그대로인 관계: 대상·관계·사유를 유지하고 문항 해시만 새 정본으로 바꾸며 재대조 이력을 남긴다.
// - KGA 600.40 criterion 재배치(69b535e26ab0 crit3 → 4760b36cae38 crit3, 4760b36cae38 crit10 → 69b535e26ab0)에 걸린 두 관계:
//   대상 criterion과 사유를 고치고, 옮겨진 한도기준 부분을 4760b36cae38 sub2에 잇는 관계를 새로 둔다.
// 요소·원자료 단위의 해시가 기록과 다르면 이 도구의 범위 밖이므로 멈춘다.
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

const plan = read(`${B}/plan-v1.json`).entries;
const corrections = read(`${B}/corrections-v1.json`).files;
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = new Map(read('cpa_uploader/analysis/question-elements/question-elements.json').elements.map((e) => [e.id, e]));
// 정본 설치 확인: 모든 correction이 적용 기록을 가진다.
for (const file of corrections) {
  const id = file.split('/').pop().replace(/\.json$/u, '');
  assert(fs.existsSync(`cpa_uploader/corrections/applied/${id}.json`), `정본 설치 전입니다: ${id}`);
}
const changed = new Set(plan.filter((e) => e.prompt || e.claims || e.facts || e.type || e.model_answer || e.remove_criteria || e.move || e.decision === null)
  .map((e) => `${e.set}/${e.sub}`));
const linksText = bytes(LINKS).toString('utf8');
const document = read(LINKS);
const beforeFile = `${B}/coverage-links-before-v1.json`;
const reviewer = 'agent:claude-opus-5 (author agent; no independent peer review)';
const planRef = { file: `${B}/plan-v1.json`, sha256: sha(bytes(`${B}/plan-v1.json`)) };
const question = (setId, subId) => {
  const set = bank.find((s) => s.id === setId); assert(set, `정본에 없는 세트 ${setId}`);
  const sub = set.subquestions.find((q) => q.id === subId); assert(sub, `정본에 없는 물음 ${setId}/${subId}`);
  return { set, sub };
};
const MOVE_A = 'std-points-20260914-69b535e26ab0', MOVE_B = 'std-points-20260914-4760b36cae38';
const special = {
  'standard-priority-20260914-component-2015-planning': {
    criterion_ids: ['crit1', 'crit2', 'crit10', 'crit4', 'crit4.sp2'],
    reason: '2015:6:3 계획단계 네 가지 열거의 후보 중 협조 확인·윤리적 요구사항·식별된 유의적 위험의 전달·새 위험과 대응의 통지 요청에 해당한다. 2026-09-19 KGA 600.40 criterion 재배치로 한도기준(40(c))은 std-points-20260914-4760b36cae38 sub2로 옮겨 별도 관계로 이었다. 부문중요성 등 다른 계획 요구는 별도 물음에 남으며 이 출력 하나로 전체를 충족했다고 보지 않는다.',
    split: { id: 'standard-priority-20260914-component-2015-planning-40c-20260919',
      reason: '2015:6:3 계획단계 열거 후보 중 명백하게 사소한 왜곡표시의 한도기준(40(c))에 해당한다. 2026-09-19 KGA 600.40 재배치로 std-points-20260914-69b535e26ab0의 crit3가 이 물음으로 옮겨져 원 관계의 해당 부분을 잇는다. 부문중요성(crit9·crit9.p2)은 원 관계의 범위가 아니어서 연결하지 않는다.' },
  },
  'standard-priority-20260914-component-2025-instruction': {
    criterion_ids: ['crit2', 'crit4', 'crit4.sp2'],
    reason: '2025:9:1 지침서한에는 협조·일정·방문·업무용도·관계자 목록이 이미 제시되어 있다. 윤리적 요구사항과 새 유의위험·대응의 통지 요청을 관련시킨다. 왜곡표시 한도(40(c))는 2026-09-19 KGA 600.40 재배치로 std-points-20260914-4760b36cae38 sub2로 옮겨 별도 관계로 이었다. 그룹업무팀이 식별해 전달하는 위험(crit10)과 중요성 수준은 원 관계 판단대로 이 원발문의 누락 사항으로 연결하지 않는다.',
    split: { id: 'standard-priority-20260914-component-2025-instruction-40c-20260919',
      reason: '2025:9:1 지침서한의 누락 커뮤니케이션 후보 중 명백하게 사소한 왜곡표시의 한도기준(40(c))에 해당한다. 2026-09-19 KGA 600.40 재배치로 std-points-20260914-69b535e26ab0의 crit3가 이 물음으로 옮겨져 원 관계의 해당 부분을 잇는다. 중요성 수준(crit9·crit9.p2)은 원 관계 판단대로 연결하지 않는다.' },
  },
};
const method = '기준서형 발문 정답 암시 제거(standard-spoiler-2026-09-19)에 따른 재대조. 요소의 원발문·관계 사유와 새 발문·criterion을 대조해, 물음이 요구하는 기준서 범위와 대응 criterion이 발문 문구 변경과 무관하게 그대로임을 확인하고 문항 해시를 새 정본으로 갱신했다. 명제가 바뀐 criterion은 바뀐 뜻이 관계를 바꾸지 않는지 함께 확인했다.';
const moveMethod = 'KGA 600.40 criterion 재배치(standard-spoiler-2026-09-19)에 따른 재대조. 옮겨진 criterion의 원 관계 부분을 새 위치의 물음에 잇고, 남은 criterion과 새로 받은 criterion이 원발문의 요구와 대응하는지 원 사유를 기준으로 다시 확인했다.';

const out = { updated: [], added: [], unchanged_outside_scope: 0 };
const links = document.links.map((link) => {
  const target = link.target;
  if (!target || target.scope === 'draft' || !changed.has(`${target.set_id}/${target.subquestion_id}`)) return link;
  const element = elements.get(link.element_id); assert(element, `요소 없음 ${link.element_id}`);
  assert.equal(link.snapshot.element_sha256, hashObject(element), `${link.id}: 요소가 바뀌었다(이 도구의 범위 밖)`);
  const next = structuredClone(link);
  const spec = special[link.id];
  if (spec) { next.target = { ...next.target, criterion_ids: spec.criterion_ids }; next.reason = spec.reason; }
  const { set, sub } = question(next.target.set_id, next.target.subquestion_id);
  for (const id of next.target.criterion_ids ?? []) assert(sub.criteria.some((c) => c.id === id), `${link.id}: criterion ${id} 없음`);
  next.snapshot = { ...next.snapshot, question_sha256: questionHash(set, sub) };
  next.review_history = [...(link.review_history ?? []), {
    reviewed_at: '2026-09-19', reviewer, kind: 'agent_semantic_relationship_review', method: spec ? moveMethod : method,
    input: { ...planRef, source_link_id: link.id },
    preserved_snapshot: { file: beforeFile, sha256: sha(Buffer.from(linksText, 'utf8')) },
    prior: { target: link.target, relationship: link.relationship, review_status: link.review_status, reason: link.reason,
      source_unit_ids: link.source_unit_ids, snapshot: link.snapshot },
  }];
  out.updated.push(link.id);
  return next;
});
for (const [sourceId, spec] of Object.entries(special)) {
  const original = document.links.find((l) => l.id === sourceId); assert(original);
  assert(!links.some((l) => l.id === spec.split.id), `이미 있는 관계 ${spec.split.id}`);
  const { set, sub } = question(MOVE_B, 'sub2');
  assert(sub.criteria.some((c) => c.id === 'crit3'), '4760b36cae38 sub2에 crit3 없음');
  links.splice(links.findIndex((l) => l.id === sourceId) + 1, 0, {
    id: spec.split.id, element_id: original.element_id, source_unit_ids: [...original.source_unit_ids],
    target: { set_id: MOVE_B, subquestion_id: 'sub2', criterion_ids: ['crit3'] },
    relationship: original.relationship, review_status: 'reviewed', reason: spec.split.reason,
    provenance: { file: planRef.file, sha256: planRef.sha256, split_from: sourceId, moved_criterion: { from: `${MOVE_A}/sub1/crit3`, to: `${MOVE_B}/sub2/crit3` } },
    snapshot: { element_sha256: original.snapshot.element_sha256, question_sha256: questionHash(set, sub),
      source_hashes: { ...original.snapshot.source_hashes }, source_metadata_hashes: { ...original.snapshot.source_metadata_hashes } },
    review_history: [{ reviewed_at: '2026-09-19', reviewer, kind: 'agent_semantic_relationship_review', method: moveMethod,
      input: { ...planRef, source_link_id: sourceId }, preserved_snapshot: { file: beforeFile, sha256: sha(Buffer.from(linksText, 'utf8')) } }],
  });
  out.added.push(spec.split.id);
}
console.log(JSON.stringify({ apply, updated: out.updated.length, added: out.added, special: Object.keys(special) }, null, 2));
if (apply) {
  fs.writeFileSync(beforeFile, linksText, { flag: 'wx' });
  const text = `${JSON.stringify({ ...document, links }, null, 2)}\n`;
  // 원래 파일의 줄바꿈 규칙을 따른다.
  fs.writeFileSync(LINKS, linksText.includes('\r\n') ? text.replace(/\n/gu, '\r\n') : text);
  console.log(`갱신: ${LINKS}, 보존본: ${beforeFile}`);
}
