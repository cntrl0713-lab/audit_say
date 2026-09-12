import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { definitions } from './content.mjs';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s02';
const hash = value => createHash('sha256').update(value).digest('hex');
// 답안의 조치·이유가 다른 명제를 함축하는 경우. 인덱스는 물음 안의 0부터 시작한다.
// 문장 삭제를 곧바로 1점 감점으로 취급하지 않고 실제 의미 누락과 구별한다.
const implied = { 'T06-C/sub2': { 0: [2], 1: [2] }, 'T06-C/sub3': { 0: [1] }, 'T07-C/sub1': { 2: [1] }, 'T07-C/sub3': { 0: [1] } };
const oppositeAlso = { 'T07-C/sub3': { 0: [1] } };
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
    if (key === 'T08-C/sub1') add('threat-not-certain-fraud', 'alternative_valid', q.model_answer.join('\n') + '\n보수연동은 객관성의 우려이지 모든 결론이 허위라는 증거는 아니다. 이해관계와 적용할 안전장치를 경영진 및 전문가와 논의하고 적절성을 평가할 수 있다.', all, [], '객관성 위협을 자동 부정확정으로 강화하지 않는 허용 설명.');
    if (key === 'T08-C/sub2') {
      add('inputs-only-not-conclusion-review', 'independent_scope_boundary', q.model_answer[2], [2], [], '가정·자료 검토만으로 업무이해 및 발견사항·결론/재무제표 반영 평가까지 수행했다고 자동 인정하지 않는다.');
      add('assumptions-only-missing-data', 'condition_boundary', '유의적 성장률 가정과 평가방법의 관련성과 합리성을 확인한다. 사용자료에 대해서는 검토하지 않아도 된다.', [], [], '세 영역 중 입력검토의 자료 부분을 명시적으로 제외한 답.');
      add('data-only-missing-assumptions', 'condition_boundary', '회사 원천데이터의 관련성·완전성·정확성과 외부 시장자료의 관련성·신뢰성을 확인한다. 중요한 가정과 방법은 검토하지 않아도 된다.', [], [], '입력검토가 요구한 가정·방법 부분을 명시적으로 제외한 답.');
    }
    if (key === 'T08-C/sub3') add('different-source-not-automatic-discard', 'alternative_valid', q.model_answer.join('\n') + '\n차이만으로 외부자료가 언제나 옳거나 보고서를 즉시 폐기해야 한다고 단정하지 않는다.', all);
    if (key === 'T06-C/sub1') add('informal-risk-process', 'alternative_valid', q.model_answer.join('\n') + '\n공식 문서가 부족해도 기업의 성격과 복잡성에 적합한 비공식 위험평가가 존재할 수 있으므로 문서 누락과 절차 부재를 구별한다.', all, [], '315.A113 비공식 절차 허용 문맥.');
    if (key === 'T06-C/sub2') {
      add('labels-without-case-connection', 'condition_boundary', '변화와 불확실성이다.', [], [], '발문은 사례와의 연결 및 영향을 명시적으로 요구한다. 명칭만으로 완전한 답을 대신하지 않는다.');
      add('factors-with-case-without-impact', 'alternative_valid', definition.criteria.slice(0, 2).map(c => c.paraphrase).join('\n'), [0, 1], [], '사례와 연결한 두 요소만으로 발생가능성·규모 결합 평가까지 자동 충족시키지 않는다.');
    }
    if (key === 'T06-C/sub3') add('new-info-supports-original', 'condition_boundary', '기존 평가를 지지하는 보강증거든 모순되는 자료든 새 정보가 있으면 무조건 모든 위험을 유의적 위험으로 바꾸고 모든 절차를 늘린다.', [], [], '일관성 없는 새 정보라는 적용 조건을 지우지 않는다.');
    if (key === 'T07-C/sub2') add('no-count-calculation-needed', 'alternative_valid', q.model_answer.join('\n') + '\n특정 표본수나 금액을 계산하지 않고, 그 위험과 관련된 확인범위를 넓히는 방향을 설명한다.', all, [], '수량계산이나 유일 표본크기를 숨은 요건으로 넣지 않는다.');
    if (key === 'T07-C/sub3') {
      add('related-controls-valid-route', 'alternative_valid', '그 계획은 적절하지 않다. 오류나 누락을 예방·발견·수정하는 관련 통제에 대한 적합한 테스트로 연령표 기초자료의 정확성과 완전성 증거를 얻을 수도 있다.', all, [], '500.A61에 따라 정보 자체 직접검사만을 유일한 정답으로 삼지 않는다.');
      add('wrong-judgment-right-verification', 'explicit_contradiction_with_valid_action', '추가 확인을 생략하는 계획은 타당하다. 그렇지만 기초자료의 정확성과 완전성에 관해서는 오류와 누락이 없는지 검사하여 증거를 얻어야 한다.', [1], [0], '명시적인 반대 판단과 별도로 올바른 검증 조치는 독립 평가한다.');
    }
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
