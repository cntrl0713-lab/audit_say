import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const drafts = 'cpa_uploader/drafts/delegated-authoring-2026-09-11';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(control, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const repeats = [2, 3].map(n => {
    const file = `${drafts}/r01/phase-two-v3/t04-a/source-locator-repeat${n}.json`, value = read(file);
    return { file, sha256: sha(file), input_hash: value.input_hash, schema_hash: value.schema_hash, instructions_hash: value.instructions_hash,
        original: value.original_grounded.units, actual: value.grounded.units, http_status: value.http_status, changed_files: value.changed_files };
});
if (new Set(repeats.map(row => row.input_hash + row.schema_hash + row.instructions_hash)).size !== 1 || repeats.some(row => row.changed_files.length)) throw Error('위치 재현 입력·코드 불일치');
write('v3-semantic-mismatch-decision.json', { recorded_at: new Date().toISOString(),
    source_locator: { plan_id: 'T04-A', unit_id: 'criterion:q2:q2.c1', sequence: ['uncertain', 'pass', 'pass'], evidence: repeats,
        source_investigation: 't04-a-locator-investigation.json', decision: '실제 내용/문단은 일치한다. 제공 입력의 행 위치 확인 가능성을 개선하고 새 의미검수로 검증한다. 원 uncertain을 재현의 pass로 덮어쓰지 않는다.' },
    target_criterion: { plan_id: 'T09-A', prior_evidence: `${drafts}/r01/phase-two-v3/t09-a/generated3-01`,
        decision: '다른 독립 criterion의 기록방식 적용 범위 오류가 목표 통제 설계/실행 명제의 반대로 전가되었다. 실제 grader가 정확한 독립 명제에 준 점수에 맞춰 모델 receipt를 수작업 변경하지 않고 사례 생성 계약을 명료화하여 재검수한다.' },
    runtime_followup: 'runtime-v4-followup/change-record.json' });
for (const [plan, folder] of [['T01-A', 't01-a-qa-v2'], ['T04-B', 't04-b-qa-v2']]) {
    const file = `${drafts}/n01/phase-two-followup/${folder}/qa-cases-${plan.toLowerCase()}.json`;
    const qa = read(file);
    write(`qa-followup-${plan.toLowerCase()}-v2.json`, { recorded_at: new Date().toISOString(), plan_id: plan, set_id: qa.set_id,
        file, sha256: sha(file), cases: qa.cases.length, global_author_qa_count: 2389,
        validation_linkage: `${drafts}/n01/phase-two-followup/${folder}/validation-linkage.json`,
        decision: '원 답안에 두 명제의 명시적 반대가 있으므로 두 번째 criterion의 기대를 contradicted로 정정. 점수 변화 없음. 원 기대와 실제 3회 판정·공식 근거 및 후속 실측을 보존한다.',
        original_question_and_qa_unchanged: true, comparison_bank_changed: false });
}
const lockFile = `${control}/runtime-v4-stable/runtime-lock.json`, lock = read(lockFile);
if (lock.code_files.some(row => sha(row.file) !== row.sha256)) throw Error('v4 고정 코드 변경');
write('runtime-v4-stable/activation.json', { at: new Date().toISOString(), runtime_lock: { file: lockFile, sha256: sha(lockFile) },
    scope: '새 grader 실제 선행회귀. 최종 전체 의미검수는 T08-B 발문/QA 후속본 선택 및 비교은행 v2 고정 뒤 시작한다.',
    checks: { existing_related_tests: 45, new_line_location_test: 1, tsc: 'pass', targeted_eslint: 'pass',
        test_followup: '첫 혼합 줄바꿈 테스트가 파일 끝 줄바꿈의 보존 때문에 기대문자열에서 실패했다. 줄번호·원인 대조 뒤 테스트가 선택한 마지막 줄바꿈을 포함하도록 수정해 해당 테스트가 통과했다. 제품 코드는 이 후속에서 변경하지 않았다.' },
    phase: 'phase-two-v4', completion_claim: false });
console.log(JSON.stringify({ records: 4, runtime_code_unchanged: true }));
