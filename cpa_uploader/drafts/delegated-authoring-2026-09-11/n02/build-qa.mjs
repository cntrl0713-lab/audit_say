import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { definitions } from './content.mjs';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/n02';
const hash = value => createHash('sha256').update(value).digest('hex');
// 답안의 조치·이유가 다른 명제를 함축하는 경우. 인덱스는 물음 안의 0부터 시작한다.
// 문장 삭제를 곧바로 1점 감점으로 취급하지 않고 실제 의미 누락과 구별한다.
const implied = {
  'T08-A/sub3': { 0: [1] }, 'T08-B/sub2': { 0: [1] }, 'T08-B/sub3': { 0: [1, 2] },
  'T06-A/sub1': { 0: [1], 2: [3] }, 'T06-A/sub2': { 0: [1], 2: [3] },
};
const oppositeAlso = {
  'T08-A/sub3': { 1: [0] }, 'T08-B/sub1': { 0: [1] },
  'T08-B/sub2': { 0: [1], 1: [0] }, 'T08-B/sub3': { 0: [1, 2], 1: [0, 2], 2: [0] },
};
const manifests = [];
for (const d of definitions) {
  const file = `${folder}/${d.id}.json`;
  const set = JSON.parse(fs.readFileSync(file, 'utf8'))[0];
  const cases = [];
  for (const [qi, q] of set.subquestions.entries()) {
    const definition = d.questions[qi], key = `${d.planId}/${q.id}`;
    const relations = implied[key] || {};
    const close = present => { const result = new Set(present); let changed = true; while (changed) { changed = false; for (const [target, evidence] of Object.entries(relations)) if (!result.has(+target) && evidence.some(i => result.has(i))) { result.add(+target); changed = true; } } return [...result]; };
    const add = (suffix, kind, answer, met, contradicted = [], note = '') => {
      const good = new Set(met), bad = new Set(contradicted);
      cases.push({ id: `${q.id}-${suffix}`, subquestion_id: q.id, kind, answer,
        expected_points: good.size,
        expected_verdicts: q.criteria.map((c, j) => ({ criterion_id: c.id, verdict: bad.has(j) ? 'contradicted' : good.has(j) ? 'met' : 'not_met',
          reason: bad.has(j) ? `해당 요구와 양립하지 않는 답을 명시하였다: ${c.claim}` : good.has(j) ? `답안 전체의 직접 표현 또는 조치·이유에 이 요구가 포함된다: ${c.claim}` : `답안에 이 요구를 뒷받침하는 의미가 없다: ${c.claim}` })),
        note: `${note} 작성자 원문 기반 기대판정이며 모델실측 결과가 아니다. 순서·개수 상한과 여분답안 절단을 적용하지 않는다.` });
    };
    const all = q.criteria.map((_, j) => j);
    add('model-answer', 'model_answer', q.model_answer.join('\n'), all);
    add('empty', 'empty_answer', '', []);
    add('reverse-order', 'reverse_order', [...q.model_answer].reverse().join('\n'), all);
    add('one-sentence', 'one_sentence_multiple_claims', q.model_answer.map(s => s.replace(/\.$/, '')).join('; ') + '.', all);
    add('irrelevant-prefix', 'irrelevant_prefix', '이 사례에는 기업과 감사팀이 등장한다.\n' + q.model_answer.join('\n'), all);
    add('duplicate-and-extra-correct', 'extra_correct_no_cap', [...q.model_answer, q.model_answer[0], '감사인은 업무를 수행할 때 전문가적 판단을 한다.'].join('\n'), all, [], '중복된 같은 명제는 추가 득점하지 않으며 요구 범위 밖의 올바른 문장은 기존 정답을 잘라내지 않는다.');
    add('all-paraphrases', 'all_paraphrases', definition.criteria.map(c => c.paraphrase).join('\n'), all);
    if (key === 'T08-A/sub1') add('alternative-control-evidence', 'alternative_valid', '연령 계산의 기준일·만기일·입력금액을 검토하는 관련 통제가 존재하고 설계·실행이 적절하다면 그 정확성 통제의 운영효과성을 테스트하여 계산 정확성의 증거를 얻는다. 전체 거래가 제외 없이 연령표로 추출되도록 하는 관련 통제도 같은 전제하에 테스트하여 완전성 증거를 얻을 수 있다.', all, [], '500.A61에 따른 관련 통제 테스트 경로. 직접 재계산·원천추적만이 유일한 허용 방법은 아니다.');
    if (key === 'T06-A/sub1') add('facts-copied-without-evaluation', 'given_facts_only', '흐름 A의 담당자는 거래처 계좌를 변경하고 지급파일을 승인한다. 흐름 B의 담당자는 지급을 실행하고 채무를 반제하며 은행대사를 한다.', [], [], '지문의 권한 목록만 복사했다. 독립 견제 판단과 발생·은폐 위험을 설명하지 않아 0점이다.');
    if (key === 'T06-A/sub2') add('alternative-independent-compensating-control', 'alternative_valid', '인력이 부족하다면 A의 계좌변경과 지급에 대해 당사자와 독립된 책임자가 변경의 유효성과 지급의 적정성을 충분히 검토하는 보완통제를 둔다. 검토한 변경 전후 정보와 독립 검토자의 승인·검토 일시 및 후속조치를 보존한다. B도 독립된 책임자가 은행명세와 장부의 대사 및 조정사유를 검토하도록 하고 차이 조사내역과 검토자의 확인 흔적을 남긴다.', all, [], '315 보론3.20의 보완통제 허용. 특정 직함·추가 채용·완벽한 업무분장만 정답으로 제한하지 않는다.');
    if (key === 'T06-B/sub3') add('automatic-control-itgc-route', 'alternative_valid', '설명만 듣지 말고 실제 권한과 변경기록을 검사하는 등 통제의 적용 증거를 얻어야 한다. 설계와 실행 확인만으로 기간 운영효과성까지 입증되는 것은 아니다. 자동통제는 일관된 운영을 지원하는 관련 IT 일반통제를 식별하고 테스트하는 방법으로 운영효과성의 증거를 얻을 수도 있다.', all, [], '315.A180의 자동통제 예외를 유지한다. 모든 자동통제에 직접 운영효과성 테스트만을 요구하지 않는다.');
    for (const [j, c] of definition.criteria.entries()) {
      const id = q.criteria[j].id;
      add(`${id}-paraphrase`, 'paraphrase', c.paraphrase, close([j]), [], `target=${id}; 한 명제의 동의 표현을 독립 입력한다. 관련 판단을 함께 함축하면 그 명제도 득점한다.`);
      add(`${id}-opposite`, 'opposite', c.opposite, [], [j, ...(oppositeAlso[key]?.[j] || [])], `target=${id}; 명시적 반대. 다른 명제까지 직접 부정하면 그 판정도 반영했다.`);
      add(`${id}-condition-boundary`, 'condition_boundary', c.boundary, [], [], `target=${id}; 필요 대상·목적·조건·인과·방법이 빠지거나 적용 전제를 바꾼 경계 답안. 정확한 0점 명칭의 not_met/contradicted만 총괄 runner 정책상 동등하게 볼 수 있다.`);
      const retained = all.filter(i => i !== j), surfaceMet = close(retained);
      if (surfaceMet.includes(j)) {
        add(`${id}-surface-omission-implicit`, 'implicit_judgment', retained.map(i => q.model_answer[i]).join('\n'), surfaceMet, [], `target=${id}; 해당 문장만 삭제했으나 다른 조치·이유가 여전히 이 명제를 함축한다. 이를 1점 누락으로 만들지 않는다.`);
        const remove = new Set([j, ...(relations[j] || [])]);
        const keep = all.filter(i => !remove.has(i));
        const answer = keep.length ? keep.map(i => q.model_answer[i]).join('\n') : '이 사례에는 회사의 업무와 감사가 나온다.';
        add(`${id}-true-omission`, 'omission', answer, close(keep), [], `target=${id}; 진짜 의미 누락을 만들기 위해 이 명제를 함축하는 연결 문장도 함께 제거했다. 독립적으로 남은 다른 요구만 득점한다.`);
      } else {
        add(`${id}-omission`, 'omission', retained.map(i => q.model_answer[i]).join('\n'), surfaceMet, [], `target=${id}; 한 명제를 누락하고 다른 독립 요구는 보존한 답안.`);
      }
    }
  }
  const qa = { version: 1, artifact_type: 'author_expected_judgments', set_id: d.id, plan_id: d.planId,
    draft_sha256: hash(fs.readFileSync(file)), live_model_grading: 'not_run', human_approval: false,
    interpretation: '수동으로 작성한 범위·인과·조건·허용표현에 근거한 기대값이다. 모델/회귀검사 실행을 대체하지 않는다. 모든 대상 물음의 criterion 기대값을 각 행에 한 번씩 기록했다. 판단을 함축하는 조치와 위험을 인정하며 표면적인 한 줄 삭제와 의미 누락을 구별한다.', cases };
  const qaFile = `${folder}/qa-cases-${d.planId.toLowerCase()}.json`;
  fs.writeFileSync(qaFile, JSON.stringify(qa, null, 2) + '\n');
  manifests.push({ plan_id: d.planId, set_id: d.id, file: qaFile, sha256: hash(fs.readFileSync(qaFile)), cases: cases.length, unique_inputs: new Set(cases.map(c => `${c.subquestion_id}\0${c.answer}`)).size,
    by_kind: Object.fromEntries([...new Set(cases.map(c => c.kind))].map(kind => [kind, cases.filter(c => c.kind === kind).length])) });
}
fs.writeFileSync(`${folder}/qa-manifest.json`, JSON.stringify({ checked_at: new Date().toISOString(), sets: manifests, total_cases: manifests.reduce((n, s) => n + s.cases, 0), model_calls: 0 }, null, 2) + '\n');
console.log(JSON.stringify(manifests.map(({ set_id, cases, unique_inputs }) => ({ set_id, cases, unique_inputs })), null, 2));
