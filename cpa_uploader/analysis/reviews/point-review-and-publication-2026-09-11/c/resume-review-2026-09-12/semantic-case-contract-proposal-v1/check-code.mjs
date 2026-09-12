import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const out = `${D}/c/resume-review-2026-09-12/semantic-case-contract-proposal-v1`;
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const runtimeFile = `${D}/execution-runtime-v7.json`;
const runtime = json(runtimeFile);
const previous = json(runtime.predecessor.file);
assert.equal(sha(runtimeFile), '17e99d1dff7f6ecaba48658796788be0b1f47b03364cc23c348932474d18a250');
assert.equal(sha(runtime.predecessor.file), runtime.predecessor.sha256);
const p = json(`${out}/proposal.json`);
const semanticNow = read(p.code_file);
const semanticBefore = read(p.before_snapshot.file);
assert.equal(semanticNow.split(p.after).length - 1, 1);
assert.equal(semanticNow.replace(p.after, p.before), semanticBefore);
const graderFile = 'lib/questionV3Grading.ts';
const graderNow = read(graderFile);
const graderBeforeFile = `${D}/grading-inference-followup-v2/lib__questionV3Grading.ts.before.txt`;
const graderBefore = read(graderBeforeFile);
const added = [
  "        '- met를 정하기 전에 선택한 답안 구간이 해당 claim의 구체 내용을 실제로 표현하는지 확인하라. model_answer·claim·발문에만 있고 user_answer에는 없는 답을 옮겨 채우지 말라. 근거 ID가 존재하는 것만으로 그 안에 요구 명제가 있다는 뜻은 아니다.',",
  "        '- 시점·속도·빈도 수식어가 어떤 행위에 붙는지 구별하라. 문제를 감사 중에 식별했다는 말은 그 문제를 적시에 전달했다는 뜻이 아니다. 식별 시점·전달 시점처럼 서로 다른 행위의 요건은 각각 답안의 실제 의미로 확인한다.',",
];
for (const line of added) assert.equal(graderNow.split(line).length - 1, 1);
const restored = graderNow.split(/(?<=\n)/).filter(line => !added.includes(line.replace(/\r?\n$/, ''))).join('');
assert.equal(restored.replaceAll('\r\n', '\n'), graderBefore.replaceAll('\r\n', '\n'));
const oldLines = graderBefore.split(/(?<=\n)/);
const restoredLines = restored.split(/(?<=\n)/);
const newlineOnlyChanges = restoredLines.flatMap((line, i) => line === oldLines[i] ? [] : [{ original_line: i + 1, text: line.replace(/\r?\n$/, ''), before_crlf: oldLines[i].endsWith('\r\n'), after_crlf: line.endsWith('\r\n') }]);
assert.equal(newlineOnlyChanges.length, 2);
const files = runtime.code_files.map(entry => ({ ...entry, actual_sha256: sha(entry.file), predecessor_sha256: previous.code_files.find(x => x.file === entry.file)?.sha256 }));
for (const file of files) assert.equal(file.actual_sha256, file.sha256);
const changed = files.filter(x => x.sha256 !== x.predecessor_sha256);
assert.deepEqual(changed.map(x => x.file).sort(), [graderFile, p.code_file].sort());
assert.equal(runtime.grading_model, previous.grading_model);
assert.equal(runtime.review_model, previous.review_model);
const result = {
  version: 1, status: 'independent_static_check_pass', api_calls: 0, checked_at: new Date().toISOString(),
  runtime: { file: runtimeFile, sha256: sha(runtimeFile), model: runtime.grading_model, review_model: runtime.review_model },
  semantic: { file: p.code_file, before_sha256: sha(p.before_snapshot.file), after_sha256: sha(p.code_file), exact_one_sentence_replaced_with_two: true, undo_bytes_equal_before: true },
  grader: { file: graderFile, before_sha256: sha(graderBeforeFile), after_sha256: sha(graderFile), added_instruction_lines: added, remove_two_lines_bytes_equal_before: false, remove_two_lines_and_normalize_crlf_equals_before: true, newline_only_changes: newlineOnlyChanges },
  runtime_files: files,
  conclusion: 'semantic 한 문장 교체, grader 지시 두 줄 추가와 인접 두 줄의 CRLF→LF 변경뿐이다. 타입·schema·파서·점수합산·불일치비교·transport·실행분기는 변경되지 않았다. 중립 누락/명시반대와 수식어의 실제 행위 귀속을 명료화하여 기존 요구를 보존한다. 만/제외는 의무를 실제 배제한 경우라는 의미 조건이 있으므로 키워드만으로 자동 반대 판정하는 규칙이 아니다.',
  earlier_local_check: '첫 바이트 역복원 검사는 grader의 인접 두 줄 CRLF→LF 때문에 실패했다. 이를 숨기지 않고 줄별 차이를 기록한 뒤 지시 두 줄 외의 모든 내용이 동일함을 검증했다. API는 호출하지 않았다.',
  constraints: ['새 지침으로 원래 유효 답안의 점수를 낮추거나 모범답안과 단어 일치를 요구해서는 안 된다.', '명시적 함축 인정과 각 독립 criterion의 정수 부분점수 계약은 그대로다.', '이 검사는 코드 차이와 잠금의 정적 검사이며 실제 모델 회귀 통과가 아니다.', 'grader 지침이 달라져 이전 QA의 실제 판정을 현재 실측으로 자동 승계하지 않는다.'],
  errors: [],
};
const outputFile = `${out}/code-runtime-v7-independent-check.json`;
fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ file: outputFile, sha256: sha(outputFile), runtime_files: files.length, changed_files: changed.length, errors: [] }));
