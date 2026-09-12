import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const drafts = 'cpa_uploader/drafts/delegated-authoring-2026-09-11';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const identity = file => ({ file, sha256: hash(file) });
const write = (name, value) => fs.writeFileSync(path.join(control, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const lockFile = `${control}/runtime-v5-stable/runtime-lock.json`;
const lock = read(lockFile), previous = read(`${control}/runtime-v4-bank-v2/runtime-lock.json`);
const changed = lock.code_files.filter(item => previous.code_files.find(old => old.file === item.file)?.sha256 !== item.sha256);
if (changed.length !== 1 || changed[0].file !== 'cpa_uploader/questionSemanticReview.ts') throw Error('Unexpected code transition');
for (const item of [...lock.code_files, ...lock.source_files, lock.comparison_bank]) if (hash(item.file) !== item.sha256) throw Error(`Changed input: ${item.file}`);
if (JSON.stringify(lock.settings) !== JSON.stringify(previous.settings)) throw Error('Model/settings changed');
write('runtime-v5-stable/activation.json', {
  recorded_at: new Date().toISOString(), runtime_lock: identity(lockFile), previous_runtime_lock: identity(`${control}/runtime-v4-bank-v2/runtime-lock.json`),
  changed_code_files: changed, grading_code_model_inputs_unchanged: true,
  grading_evidence_reuse: 'v4 실제 채점의 grader 6개 파일·모델·문항·답안·출처가 일치하는 사례만 같은 현재 채점 버전으로 연결한다. 의미검수 지침 변경 자체로 해당 채점을 무효화하거나 재호출하지 않는다.',
  semantic_followup: { phase_directory: lock.phase_directory, cohort: 'semantic-cohort-v5-01',
    decision: '출처 범위 포함 관계 및 구체적인 평가 요구의 중복 여부를 현재 입력으로 실제 모델 재검수한다. 과거 판정을 수작업 pass로 교체하지 않는다.',
    evidence: [identity(`${control}/runtime-v5-source-ranges/change-record.json`), identity(`${control}/runtime-v5-source-ranges/source-range-evidence.json`),
      identity(`${drafts}/r01/phase-two-case-investigation/t10-a-nonduplication/evidence.json`),
      identity(`${drafts}/r01/phase-two-v4/t10-a-meaning-repeat2.json`), identity(`${drafts}/r01/phase-two-v4/t10-a-meaning-repeat3.json`)] },
  checks: { semantic_tests_passed: 19, type_check: 'pass', targeted_eslint: 'pass' },
  status: 'actual_validation_in_progress', completion_claim: false, promotion_publication_deployment: false,
});
const proposal = `${drafts}/n02/evidence/phase2/phase-two-v4-proposals`;
const overrides = [
  { plan_id: 'T08-A', file: `${proposal}/qa-cases-t08-a.followup-02-reasons.json`, diff: `${proposal}/t08-a-reason-only-followup-diff.json`,
    expected_cases: 47, change: '이미 수용한 두 0점 판정 기대의 근거 문구만 수정. 답안·판정·점수·채점 입력·필수 사례 수 불변. v4 실제 실행의 동일 사례를 연결하되 0점 판정 분류 불일치는 미해결로 유지한다.' },
  { plan_id: 'T06-A', file: `${proposal}/qa-cases-t06-a.followup-01.json`, diff: `${proposal}/t06-a-qa-followup-diff.json`,
    expected_cases: 67, change: '실행 여부 확인이라는 실제 발문 맥락과 315.26(d)(ii)/A176/A177을 대조하여 2사례 기대를 수정한다. 절차 수행 관찰의 실행 상태 함축은 met, 규정 기재만으로 충분하다는 배제는 contradicted. 원 답안과 원시 3회 판정을 보존한다.' },
].map(item => {
  const qa = read(item.file);
  if (qa.cases.length !== item.expected_cases) throw Error(`QA count: ${item.plan_id}`);
  const original = read(item.diff).original;
  if (hash(original.file) !== original.sha256) throw Error('Original QA changed');
  return { ...item, identity: identity(item.file), diff_identity: identity(item.diff), original };
});
write('active-qa-overrides-v2-followup.json', { recorded_at: new Date().toISOString(),
  base_manifest: identity(`${control}/final-153-v2/manifest.json`), overrides,
  required_author_qa_cases: 2389, question_plan_bank_changed: false, frozen_manifest_unchanged: true,
  status: 'accepted_expectations_actual_validation_in_progress',
  supplementary_cases_are_additional: true,
});
console.log(JSON.stringify({ activation_written: true, qa_overrides: overrides.length, actual_model_calls: 0 }));
