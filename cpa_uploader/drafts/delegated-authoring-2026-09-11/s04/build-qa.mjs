import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { definitions } from './content.mjs';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s04';
const hash = value => createHash('sha256').update(value).digest('hex');
// 답안의 조치·이유가 다른 명제를 함축하는 경우. 인덱스는 물음 안의 0부터 시작한다.
// 문장 삭제를 곧바로 1점 감점으로 취급하지 않고 실제 의미 누락과 구별한다.
const implied = { 'T10-C/sub2': { 0: [1, 2, 3] }, 'T12-C/sub1': { 0: [1] }, 'T12-C/sub2': { 0: [1] }, 'T12-D/sub1': { 0: [1, 2] } };
const oppositeAlso = {};
const boundaryContradictions = { 'T10-B/sub1':[0], 'T10-B/sub2':[1], 'T10-B/sub3':[0,1], 'T10-C/sub1':[1,2], 'T10-C/sub2':[1,2,3], 'T10-C/sub3':[0,1], 'T12-C/sub1':[1], 'T12-C/sub2':[0,1], 'T12-C/sub3':[0,1,2], 'T12-D/sub1':[0,1,2], 'T12-D/sub2':[0,1,2,3] };
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
    if (key === 'T10-B/sub1') {
      add('facts-only-no-classification', 'condition_boundary', 'A는 모집단에 중요한 왜곡표시가 있는데 표본에서 없다고 결론을 내렸고, B는 모집단에 없는데 표본에서 있다고 결론을 내렸다.', [], [], '지문 사실만 반복하고 부당한 수용/기각 분류를 식별하지 않았다.');
      add('names-only', 'alternative_valid', 'A는 부당수용위험, B는 부당기각위험이다.', all, [], '본 물음은 명칭 또는 같은 위험방향 설명을 허용한다.');
      add('numbers-only', 'condition_boundary', 'A는 제2종, B는 제1종이다.', [], [], '교재별 번호만으로 위험방향을 확정하지 않는다.');
    }
    if (key === 'T10-B/sub3') {
      add('both-alternative-paths', 'alternative_valid', q.model_answer.join('\n') + '\n이 두 가지는 선택할 수 있는 경로이므로 언제나 동시에 해야 한다는 뜻은 아니다.', all);
      add('management-adjustment-only', 'condition_boundary', '감사인이 직접 조사를 끝내고 경영진에게 발견한 오류의 분개만 고치도록 한다.', [], [], '530.A23의 경영진 조사·잠재오류 범위까지 요청하는 첫 경로가 빠짐.');
      add('two-paths-compulsory', 'condition_boundary', '경영진 조사·필요한 수정요청과 감사인의 추가절차 성격·시기·범위 조정은 모든 경우 반드시 둘 다 수행하여야만 한다.', [], [0,1], '선택 가능한 경로를 예외 없는 동시 의무로 바꾼다.');
    }
    if (key === 'T10-C/sub1') add('risk-assessment-not-520-design-duty', 'alternative_valid', q.model_answer.join('\n') + '\n위험평가 분석을520의 실증분석 설계요건에 따라 수행할 필요는 없지만520 지침은 참고할 수 있다.', all, [], '315.A30의 단계별 적용 경계를 보존한다.');
    if (key === 'T10-C/sub2') {
      add('previous-true-omission-implicit', 'implicit_judgment', q.model_answer.slice(2).join('\n'), [0,2,3], [], '이전 진짜누락으로 잘못 분류한 입력이다. 정확성·수용차이 보완조치가 종료부적절 판단을 함축하여3점이다. 이전QA바이트와정정근거를보존한다.');
      add('wrong-judgment-right-three-actions', 'explicit_contradiction_with_valid_action', '그대로 종료하는 계획은 적절하다.\n' + q.model_answer.slice(1).join('\n'), [1,2,3], [0], '명시적으로 잘못된 종료 판단을 세 올바른 보완 조치와 독립 평가한다.');
      add('controls-as-evidence', 'alternative_valid', q.model_answer.join('\n') + '\n필요한 경우 자료 작성에 관한 통제의 운영효과성 테스트 결과도 데이터 신뢰성 평가에 이용할 수 있다.', all);
      add('partial-reliability-list', 'condition_boundary', '원천이 외부이고 합계가 일치하므로 비교가능성·성격과 관련성·작성통제는 고려하지 않아도 된다.', [], [1], '발문에 요구된 종합 고려의 일부를 명시적으로 제외했다.');
      add('expectation-only-no-reliability', 'implicit_judgment', q.model_answer[2], [0,2], [], '기대치 정확성의 보완 조치는 종료부적절 판단을 함축하므로 판단과 정확성2점. 기초데이터 신뢰성 평가는 여전히 충족하지 않는다.');
    }
    if (key === 'T10-C/sub3') add('questioning-alone', 'condition_boundary', '경영진에게 질문하여 설명을 들었다.', [], [], '이미 주어진 사실이고 설명 관련 증거 및 필요한 기타절차가 없다.');
    if (key === 'T12-C/sub1') add('wrong-judgment-right-followup', 'explicit_contradiction_with_valid_action', '추가절차가 필요 없다는 주장은 적절하다.\n' + q.model_answer[1], [1], [0]);
    if (key === 'T12-C/sub3') {
      add('performance-materiality-only', 'condition_boundary', '전체 중요성의 적합성은 확인하지 않고 수행중요성만 다시 계산한다.', [], [0], '450.10과수행중요성을교체한답.');
      add('no-automatic-reduction', 'alternative_valid', q.model_answer.join('\n') + '\n재평가한다고 중요성이 반드시 낮아지는 것은 아니다. 낮아진 경우에는 수행중요성과 추가절차의 적합성도 재고려한다.', all, [], '450.A15의정상추가설명은새점수없이허용.');
    }
    if (key === 'T12-D/sub1') {
      add('modified-but-reliable', 'alternative_valid', q.model_answer.join('\n') + '\n요청문구와 달라도 신뢰할 수 있는 진술을 제공했다고 결론내린 경우에는 그 변형만으로20의 미제공이 되지는 않으며 변형 이유의 다른 의견 영향을 평가한다.', all, [], '580.A27의조건부허용표현.');
      add('suspicion-without-conclusion', 'condition_boundary', '성실성에 대한 우려가 조금이라도 제기되면 책임진술을 믿을 수 없다는 결론이 없어도 무조건 의견거절이다.', [], [0,2], '단순의문과불신결론경계.');
    }
    if (key === 'T12-D/sub2') {
      add('no-substitute-other-evidence', 'alternative_valid', q.model_answer.join('\n') + '\n필수 책임진술의 미제공이나 이 성실성 문제에 따른 불신을 다른 증거만으로 대체하여 해결할 수는 없다.', all);
      add('core-information-without-transactions', 'condition_boundary', '경영진은 합의한 모든 정보를 제공하고 접근을 허용하였다는 진술을 하되 거래의 기록과 재무제표 반영은 확인할 필요가 없다.', [], [1], '두번째책임영역의거래완전성부분누락.');
    }
    for (const [j, c] of definition.criteria.entries()) {
      const id = q.criteria[j].id;
      add(`${id}-paraphrase`, 'paraphrase', c.paraphrase, close([j]), [], `target=${id}; 한 명제의 동의 표현을 독립 입력한다. 관련 판단을 함께 함축하면 그 명제도 득점한다.`);
      add(`${id}-opposite`, 'opposite', c.opposite, [], [j, ...(oppositeAlso[key]?.[j] || [])], `target=${id}; 명시적 반대. 다른 명제까지 직접 부정하면 그 판정도 반영했다.`);
      add(`${id}-condition-boundary`, 'condition_boundary', c.boundary, [], (boundaryContradictions[key] || []).includes(j) ? [j] : [], `target=${id}; 필요 대상·목적·조건·인과·방법이 빠지거나 적용 전제를 바꾼 경계 답안. 정확한 0점 명칭의 not_met/contradicted만 총괄 runner 정책상 동등하게 볼 수 있다.`);
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
