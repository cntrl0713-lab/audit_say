import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { definitions } from './content.mjs';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/n03';
const hash = value => createHash('sha256').update(value).digest('hex');
// 답안의 조치·이유가 다른 명제를 함축하는 경우. 인덱스는 물음 안의 0부터 시작한다.
// 문장 삭제를 곧바로 1점 감점으로 취급하지 않고 실제 의미 누락과 구별한다.
const implied = { 'T07-A/sub2': { 0: [1] }, 'T05-B/sub2': { 0: [1] } };
const oppositeAlso = { 'T07-A/sub2': { 0: [1] } };
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
    if (key === 'T07-A/sub1') add('three-audits-clarified-wording', 'alternative_valid', [q.model_answer[0], q.model_answer[1], '최소 매 3년의 감사에 한 번, 즉 달력 경과와 구별한 매 세 차례의 감사 중 한 번은 해당 통제를 테스트한다.', q.model_answer[3]].join('\n'), all, [], 'A38 원문 표현에 감사3회라는 의미를 명확히 보완한 답은 허용한다. 달력상3년만을 유일기준으로 삼는 경계와 다르다.');
    if (key === 'T07-A/sub2') add('right-action-explicit-wrong-judgment', 'explicit_contradiction_with_valid_action', '전기 결과만으로 충분하다는 계획은 타당하다. 그러나 유의적 위험에 의존하려는 해당 통제는 반드시 당기에 테스트해야 한다.', [1], [0], '반대 결론을 명시했으므로 판단은0점이고 독립된 올바른 당기 테스트 요구는1점이다.');
    if (key === 'T07-A/sub3') add('factor-names-only-complete', 'complete_factor_names', '경영진주장 수준의 평가된 중요왜곡표시위험의 유의성; 중간기간에 테스트한 통제 및 이후의 유의적 변경; 입수한 운영효과성 증거의 정도; 잔여기간의 길이; 실증절차를 줄이기 위한 통제의존 정도; 통제환경.', all, [], '요소를 묻는 발문이므로 명료한 요소명 전체가 있으면 방향·사례 설명을 별도 숨은 요건으로 추가하지 않는다.');
    if (key === 'T07-B/sub1') add('analytical-substantive-alternative', 'alternative_valid', q.model_answer.join('\n') + '\n상황에 적합하게 실증절차로 설계했다면 실증적 분석절차만으로 충분할 수도 있고 세부테스트만 또는 양자를 함께 사용할 수도 있다. 모든 중요한 항목의 모든 주장을 일률적으로 테스트해야 한다는 뜻은 아니다.', all, [], '330.A44/.A45의 허용 범위. 종결총괄분석과 구별한 실증적 분석절차의 대안을 허용한다.');
    if (key === 'T05-B/sub2') add('wrong-comparison-right-reason', 'explicit_contradiction_with_valid_reason', q.model_answer[1] + '\n그렇지만 감사인이 발견하지 못할 위험은 경영진의 부정이 일반 종업원의 부정보다 더 낮다.', [1], [0], '명시적 반대 비교는0점이고 별도로 충족한 지위·조작·무력화 이유는1점이다.');
    if (key === 'T05-B/sub2') add('alternative-control-override-reason', 'alternative_valid', '경영진 부정의 중요한 왜곡표시를 발견하지 못할 위험이 종업원 부정보다 높다. 경영진은 다른 종업원의 유사한 부정을 막을 통제를 무력화할 수 있는 지위에 있어 은폐가 가능하기 때문이다.', all, [], '240.7의 기록·정보 조작 또는 통제무력화의 동등한 설명 경로. 양 경로를 모두 서술해야만 이유1점을 주는 숨은 완전열거를 만들지 않는다.');
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
