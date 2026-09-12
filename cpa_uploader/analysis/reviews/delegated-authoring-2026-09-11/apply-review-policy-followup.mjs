import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const output = path.join(root, 'runtime-v2-policy');
if (fs.existsSync(output)) throw Error('새 정책 변경 기록을 덮어쓸 수 없습니다.');
const sha = value => createHash('sha256').update(value).digest('hex');
const changes = [
  ['cpa_uploader/questionSemanticReview.ts', [
    ['기존 은행 및 같은 세트 내 의미중복을 대조하라.', '기존 은행 및 같은 세트 내 의미중복을 대조하라. nonduplication은 의도하지 않은 중복 요구·이중 배점·새 커버리지의 과장 여부이다. authoring_plan에 기존 ID와 중복 범위가 명시되고 새 커버리지로 세지 않는 의도된 복습은 허용하며, 실제 겹치는 ID와 명제를 rationale에 적는다. 복습 표시만으로 숨은 중복 배점이나 잘못된 신규 주장을 허용하지 않는다. 사례·발문·답안 전체를 함께 읽고, 이미 주어진 조건의 반복이나 특정 결론 문구를 숨은 필수 요건으로 요구하지 않는다. 답안의 이유·조치가 결론을 분명히 함축하면 그 의미를 인정하되 명시적 반대 결론은 인정하지 않는다.'],
    ['2027에 2026 시행기준을 동일 적용한다는 명시적 가정은 최종 확정 공고와 구별하되 가정 자체만으로 fail 처리하지 않는다.', '선택한 보고기간·시점·판본을 명시한 가정은 최종 시험 적용 공고와 구별한다. 명시된 가정에 맞는 문항을 향후 시험의 최종 공고 미확정이라는 이유만으로 fail 또는 uncertain 처리하지 말고, 그 한계는 notes에 남긴다. 적용 판단에 필요한 실제 조건이 빠졌거나 가정한 판본의 근거가 미확인인 경우는 uncertain이며, 실제 적용 조건과 반대이거나 공식 확정을 거짓 주장하면 fail이다.'],
    ['criterion별 부분점수 계약을 보존하라.', 'criterion별 부분점수 계약을 보존하라. 조건 경계 사례도 같은 criterion의 논리적 그리고/또는, 주어진 전제, 필수 답안 요소를 일관되게 적용한다. 조건 경계라는 종류만으로 빠진 필수 요소를 충족한 것으로 보지 않는다. 답안 전체가 남은 이유나 조치로 명제를 충족하면 실제 누락이 아니므로 누락 사례를 다시 설계한다.'],
  ]],
  ['lib/questionV3Grading.ts', [
    ["'- contradicted: 주체·부정·수치·조건·결론을 명시적으로 반대로 작성한 경우',", "'- contradicted: 주체·부정·수치·조건·결론을 명시적으로 반대로 작성한 경우',\n        '- 필수 절차가 필요 없다는 답안처럼 명시적으로 의무를 부정한 경우는 단순 누락인 not_met가 아니다. 반대로 다른 명제가 오답이라는 이유만으로 쓰지 않은 별도 명제까지 contradicted로 확대하지 않는다.',"],
    ["'- 답안의 문장 수나 단순 나열 순서로 감점하지 말고 답안 전체에서 각 명제를 평가한다. 절차의 의미상 순서·시점·조건 및 명시적 반대 결론은 보존한다.',", "'- 답안의 문장 수나 단순 나열 순서로 감점하지 말고 답안 전체에서 각 명제를 평가한다. 절차의 의미상 순서·시점·조건 및 명시적 반대 결론은 보존한다.',\n        '- 발문과 shared_context에 이미 주어진 전제는 답안에서 반복하지 않아도 적용한다. 답안에 없는 새로운 요건을 추정해 채우지는 않는다. 이유·요구 조치가 판단을 분명히 함축하면 정해진 결론 문구 없이도 판단을 인정하되, 답안이 그 판단을 명시적으로 부정하면 인정하지 않는다.',\n        '- 한 문장에 정확한 명제와 잘못된 다른 명제가 함께 있어도 각각 평가한다. 잘못된 효과 설명이 붙었다는 이유로 독립적으로 정확한 방식·정의까지 부정하지 않는다.',"],
    ["'- 정상 명칭 나열은 salad가 아니다. 무관한 단어 조합은 criterion별로 판정하며 무관한 추가 문장 때문에 다른 정상 명제까지 부정하지 않는다.',", "'- salad_detected는 의미 관계 없이 키워드·단어를 뒤섞은 나열이 있을 때만 true이다. 정상 명칭 나열, 문법적으로 완성된 무관한 문장, 틀린 주장이나 조건 서술 자체는 salad가 아니다. 무관한 완전 문장 뒤에 정상 답안이 오는 경우에도 이 이유만으로 true를 반환하지 않는다. 무관한 단어 조합은 criterion별로 판정하며 다른 정상 명제까지 부정하지 않는다.',"],
  ]],
];
const prepared = changes.map(([file, replacements]) => {
  const before = fs.readFileSync(file);
  let after = before.toString('utf8');
  for (const [oldText, newText] of replacements) {
    if (after.split(oldText).length !== 2) throw Error(`${file}: 정확히 한 번 나타나야 하는 변경 기준 불일치`);
    after = after.replace(oldText, newText);
  }
  return { file, before, after };
});
fs.mkdirSync(output);
for (const value of prepared) {
  fs.writeFileSync(path.join(output, path.basename(value.file) + '.before.txt'), value.before, { flag: 'wx' });
  fs.writeFileSync(value.file, value.after);
}
const record = {
  created_at: new Date().toISOString(),
  policy_version: 2,
  reason: '실제 동일조건 3회 검수에서 N01 의도된 복습 fail/pass/fail, N06 판본 가정 uncertain/uncertain/pass, R01 무관한 정상문장 salad 오탐과 명시반대 누락 판정·독립 명제 점수 변동을 확인했다. 확정된 제작·검토 계약을 모델 지시에 명시한다.',
  changes: prepared.map(({ file, before, after }) => ({ file, before_sha256: sha(before), after_sha256: sha(after) })),
  inputs_changed: false, model_changed: false, scoring_engine_changed: false,
  prior_evidence: '기존 원시 응답·receipt·runtime-lock은 보존한다. 이전 지시의 검수 결과는 새 지시의 결과로 재사용하지 않는다. 실제 재검수·재채점 결과는 후속 경로에 별도로 기록한다.',
};
fs.writeFileSync(path.join(output, 'change-record.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(record));
