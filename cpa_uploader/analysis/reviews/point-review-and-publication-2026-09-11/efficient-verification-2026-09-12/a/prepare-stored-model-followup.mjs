import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const A = path.dirname(fileURLToPath(import.meta.url));
let root = A;
while (!fs.existsSync(path.join(root, 'AGENTS.md'))) root = path.dirname(root);
const preserved = path.join(A, 'handoff-v1-preserved');
const out = path.join(A, 'stored-model-followup-v1');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = (file) => fs.readFileSync(path.resolve(root, file));
const read = (file) => JSON.parse(bytes(file).toString('utf8'));
const rel = (file) => path.relative(root, file).replaceAll('\\', '/');
const clone = (value) => structuredClone(value);
const now = new Date().toISOString();
const assert = (value, message) => { if (!value) throw new Error(message); };
const write = (file, value) => {
  const full = path.resolve(file);
  assert(full.startsWith(A + path.sep), `Outside ownership: ${file}`);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(value, null, 2) + '\n', 'utf8');
};
assert(!fs.existsSync(out), 'Followup already exists; preserve it and use a new version');
const oldHandoff = read(path.join(preserved, 'handoff.json'));
const preservation = read(path.join(preserved, 'preservation-manifest.json'));
for (const entry of preservation.entries) {
  assert(sha(bytes(entry.preserved_file)) === entry.sha256, `Preserved bytes changed: ${entry.preserved_file}`);
  assert(sha(bytes(entry.original_file)) === entry.sha256, `Active input changed before followup: ${entry.original_file}`);
}

// Manually read on this followup: each list gives stored model-answer element
// indexes for each criterion in its existing order. This is not a text-matching
// algorithm or an API verdict. Conditions and logical scope were read separately.
const decisions = {
  'pilot-01-002/sub2': [[0, 0, 1, 2, 2, 2], '정보 입수와 위협평가, 위반정보 평가, 안전장치, 적합·법규가능 조건부 해지, 해결불가 시 신속보고가 모두 있다. 조건불성립의 부작위만 쓴 과거 반례와 달리 양의 해지조치를 명시한다.'],
  'pilot-01-004/sub2': [[0, 1], '기준·법규에 따른 수행 적격성과 적합한 보고서 발행 역량 두 요구를 모두 제시한다.'],
  'pilot-02-004/sub2': [[0, 1, 1], '주어진 감사위험 조건하 역관계, 제거불가 판단, 고유한계 이유가 모두 있다.'],
  'pilot-02-005/sub1': [[0, 1, 1], '중요왜곡 재무제표에 부적합 의견이라는 정의와 두 위험의 함수 관계를 모두 제시한다.'],
  'pilot-02-005/sub2': [[0, 1], '개별·합산 중요왜곡의 미발견 위험 정의와 감소가능·제거불가를 모두 제시한다.'],
  'pilot-03-004/sub1': [[0, 1], '재무보고체계의 수용가능성 결정과 경영진의 세 책임 인정·이해 동의 입수 절차를 모두 제시한다.'],
  'pilot-03-004/sub2': [[0, 1, 2], '210.19 예외가 붙은 체계 부적합과 책임동의 부재의 수임금지 및 법규상 감사 요구 시 수임금지 예외를 구별한다.'],
  'pilot-04-002/sub2': [[0, 1, 2, 2], '전략 자체, 계획 자체, 중요한 변경과 변경 이유를 모두 기록한다. 변경대상 명칭만으로 원계획 문서화를 추정한 답이 아니다.'],
  'pilot-04-004/sub2': [[0, 0, 0, 1, 1, 2, 2, 2], '절차 성격·시기·범위, 결과·증거, 유의적 사항·결론·전문가적 판단의 여덟 문서화 요구가 모두 있다.'],
  'pilot-04-005/sub2': [[0, 1, 2, 3, [0, 1, 2, 3]], '세 중요성 금액·해당되는 별도 중요성과 수정내용 및 각 금액 결정 요소가 모두 있다. 공통 요소기준은 네 문장을 함께 대조했다.'],
  'pilot-05-001/sub1': [[0, 1, 1, 1], '의심을 지배기구에 적시에 전달함과 감사완료 절차의 성격·시기·범위 논의를 모두 제시한다.'],
  'pilot-05-002/sub2': [[0, 0, 1, 2], '편의 검토, 개별적으로 합리적 판단도 포함한 부정위험 평가, 편의 시 전반 재평가, 전기 판단·가정 소급검토가 모두 있다.'],
  'pilot-05-003/sub2': [[0, 1, 2, 3, 3, 4], '미비점 내역·영향, 재무제표 의견 목적, 통제효과성 의견 목적의 명시적 배제, 감사절차 설계 목적의 통제 고려, 보고사항 한정의 여섯 요구를 모두 담는다.'],
  'pilot-05-005/sub2': [[0, 1, 1, 1], '부정위험을 유의적 위험으로 취급하고 미수행 부분의 통제 식별·설계평가·실행결정을 요구한다. 운영효과성으로 대체하지 않는다.'],
  'pilot-05-007/sub1': [[0, 0, 1], '전문가·법률 책임, 선임당사자 또는 해당 규제기관 보고 요구 결정, 법규상 가능할 때 해지 적절성 고려가 모두 있다.'],
  'pilot-05-007/sub2': [[0, 0, 0, 0, 1, 1, 1, 1], '경영진·지배기구와 해지 사실·이유 토의 및 외부 상대방에 대한 해지 사실·이유 보고요구 존재 결정의 대상·내용을 모두 명시한다.'],
  'pilot-06-002/sub1': [[0, 1, 2, 2], '경영진·관련자 질문과 내부감사기능 조건, 분석적절차, 관찰, 검사의 네 요구를 제시한다.'],
  'pilot-06-003/sub2': [[0, 0, 1, 2, 3, 4], '응용프로그램·기타 환경, IT 위험, 일반통제 식별, 설계평가, 질문에 추가한 절차로 실행결정을 모두 제시한다.'],
  'pilot-06-005/sub1': [[0, 0, 1, 1], '고유위험요소와 재무제표 수준 위험 각각의 영향을 방법과 정도 양쪽에서 고려한다.'],
  'pilot-06-005/sub2': [[0, 0, 1], '통제테스트가 유일 증거수단일 수 있다는 이유, 추가절차 설계·수행 영향, 관련 통제테스트 설계·수행 조치가 모두 있다.'],
  'pilot-02-006/sub3': [[0, 1, 2], '제안 부적절, 신뢰성 문제 추가조사·절차결정, 과거 신뢰가 의구심 경감·낮은 증거 수용을 허용하지 않는다는 제한을 모두 직접 제시한다.'],
  'pilot-01-005/sub3': [[0, 1, 2, 3, 4, 5, 6], '낮은 보수 자체 허용, 기준준수 곤란 조건과 이기적 위협, 시간·적격인력 및 보수기준·서비스 내용 고지의 네 안전장치를 모두 담는다.'],
  'pilot-03-005/sub2': [[0, 1, 2, 3, 4, 5, 6, 7], '감사의 목적·범위, 감사인·경영진 책임, 체계 식별, 보고서 예상형태·내용 및 달라질 수 있는 상황 기술의 여덟 기록사항이 모두 있다.'],
  'pilot-04-006/sub1': [[0, 1, 2], '갑의 지연 제안 부적절과 최초 적시 문서화, 보고서일 후 취합의 행정적 성격을 각각 설명한다.'],
  'pilot-04-006/sub2': [[0, 1, 2, 3, 4, 5], '교체문서 삭제, 분류·병합·상호참조, 완결점검표 서명, 보고서일 전 입수·토의·합의 증거 문서화 조건이 모두 있다.'],
  'pilot-04-006/sub3': [[0, 1, 2, 3, 4], '230.13 상황을 제외한 발문에서 변경 이유, 변경자·시기, 검토자·시기를 모두 제시한다. 주어진 오기 사실만 반복한 답이 아니다.'],
  'pilot-08-007/sub1': [[0, 1, 2, 3], '발생사실·과대계상 방향과 완전성 미충족 및 미기록 거래가 기록 모집단에 없어 선택불가라는 사실 적용을 모두 제시한다.'],
  'pilot-08-007/sub2': [[0, 1, 2, 3, 4], '별도 출고·인수 기초자료 모집단, 목적관련성과 신뢰성, 기초자료에서 기록으로 추적, 계약상 인수·통제 이전 및 증빙날짜와 회계기간 대조를 모두 제시한다.'],
  'pilot-08-007/sub3': [[0, 1, 2], '7일 범위 자동적용 부적절, 인수·통제 이전 시차가 종전 범위를 벗어날 수 있다는 이유, 실제 기간에 맞춘 대상기간 보완의 세 요구를 제시한다. 제거된 중복증빙기준은 재추가하지 않는다.'],
  'pilot-06-007/sub3': [[0, 1, 2], '질문만으로 실행 확인 불충분, 관찰·검사 보완, 설계·실행과 기간 전체 운영효과성의 한계를 구별한다.'],
  'pilot-07-006/sub1': [[0, 1, 2, 3, 4, 5], '계속 관련성·신뢰성, 관찰/검사와 결합 질문, 변화 시 당기테스트, 무변화 시 매3회 감사 최소1회, 매 감사 일부 통제 테스트가 모두 있다.'],
  'pilot-05-009/sub1': [[0, 1, 2], '주된 예방·발견 책임 주체를 바로잡고 감사인이 얻는 확신의 대상과 합리적 수준을 구별한다.'],
  'pilot-05-009/sub3': [[0, 1, 2], '평가와 관계없는 대응절차 계획·수행, 예측불가능성, 부정 유의적 위험 분류를 모두 제시한다.'],
  'pilot-02-007/sub2': [[0, 1, 2], '갑의 제안 부적절, 대체절차 없는 필요한 절차 생략불가, 낮은 설득력 증거 수용불가의 두 이유를 구별한다.'],
  'pilot-01-006/sub2': [[0, 1, 2, 3, 4, 5], '종전체계 일반검토의 논의, 재무제표·보고서초안 검토, 선정문서 검토, 결론 평가·보고서 적합성의 여섯 요구이며 상장 추가목록은 제외된다.'],
  'pilot-03-006/sub1': [[0, 1, 2, 3], '갑의 오해·실제 정보수요와 을의 증거부족 변형의견 회피를 각 판단과 이유로 연결한다.'],
  'pilot-03-006/sub3': [[0, 1, 2, 3], '변경업무·보고서 적합성, 종전 감사업무 언급 배제, 절차 언급 원칙과 병-2 합의된 절차 예외를 구별한다.'],
  'pilot-04-007/sub2': [[0, 1, 2, 3, 4], '기계적 비율 판단 부적절과 전문가적 판단, 갱신기업이해, 과거 왜곡 성격·범위, 당기 예상을 모두 제시한다.'],
  'pilot-08-008/sub1': [[0, 1, 2], '전문성 적격성, 상황에서의 발휘 역량, 보수 연동과 전문적 판단 훼손이라는 객관성 적용을 구별한다.'],
  'pilot-08-008/sub2': [[0, 1, 2, 3, 4, 5, 6, 7], '업무의 성격·범위·목적·전문영역 이해와 발견·결론의 관련성·합리성·일관성·재무제표 반영을 모두 제시한다.'],
  'pilot-08-008/sub4': [[0, 1, 2, 3, 4, 5, 6, 7, 8], '가정·방법 각각의 관련성·합리성, 회사데이터 관련성·완전성·정확성, 외부시장자료 관련성·신뢰성을 모두 제시한다.'],
  'pilot-06-008/sub2': [[0, 1, 2, 3], '기술발전을 변화, 관측데이터 부족을 불확실성에 연결하고 자산평가의 발생가능성과 거액투자의 중요 규모를 평가한다.'],
  'pilot-07-008/sub3': [[0, 1, 2], '전기경험·총액일치만으로 생략 부적절, 기초자료 정확성 및 완전성 증거 입수의 두 조치를 모두 제시한다.'],
};

const selected = read(path.join(preserved, 'selected-files.json'));
const reviews = read(path.join(preserved, 'question-reviews.json'));
const representatives = read(path.join(preserved, 'representative-cases.json'));
const originals = clone(representatives);
const qaUpdates = new Map();
const reviewRows = [];
const inputPins = new Map();
function pin(file, expected) {
  const hash = sha(bytes(file));
  assert(!expected || hash === expected, `Input hash mismatch: ${file}`);
  inputPins.set(file, hash);
  return hash;
}
for (const entry of selected.entries) {
  pin(entry.file, entry.sha256); pin(entry.plan_file, entry.plan_sha256); pin(entry.qa_file, entry.qa_sha256);
}
for (const representative of representatives.entries.filter((item) => item.role === 'stored_model_answer')) {
  let set = read(representative.question_file);
  if (Array.isArray(set)) set = set.find((item) => item.id === representative.set_id);
  const question = set.subquestions.find((item) => item.id === representative.subquestion_id);
  const answer = question.model_answer.join('\n');
  if (answer === representative.case.answer) continue;
  const id = `${representative.set_id}/${representative.subquestion_id}`;
  const decision = decisions[id];
  assert(decision, `No manual review: ${id}`);
  const [indexes, reason] = decision;
  assert(indexes.length === question.criteria.length, `Manual criterion map incomplete: ${id}`);
  const old = clone(representative);
  const chosen = selected.entries.find((entry) => entry.set_id === representative.set_id);
  if (!qaUpdates.has(chosen.set_id)) {
    const original = read(chosen.qa_file);
    qaUpdates.set(chosen.set_id, { original_file: chosen.qa_file, original_sha256: chosen.qa_sha256,
      original, updated: clone(original), file: path.join(out, 'qa', `qa-${chosen.set_id}.json`) });
  }
  const qa = qaUpdates.get(chosen.set_id);
  const newID = `efficient/${representative.subquestion_id}/stored-model-exact-v1`;
  assert(!qa.updated.cases.some((item) => item.id === newID), `New case collision: ${id}`);
  const criterionReviews = question.criteria.map((criterion, index) => {
    const modelIndexes = Array.isArray(indexes[index]) ? indexes[index] : [indexes[index]];
    const quotes = modelIndexes.map((number) => {
      assert(Number.isInteger(number) && typeof question.model_answer[number] === 'string', `Missing answer segment: ${id}`);
      return question.model_answer[number];
    });
    return { criterion_id: criterion.id, verdict: 'met', points: criterion.max_points,
      model_answer_indexes: modelIndexes, answer_quotes: quotes,
      claim: criterion.claim, critical_facts: criterion.critical_facts,
      source_ref_ids: criterion.source_ref_ids,
      reason: `저장 모범답안의 위 실제 구간이 요구를 충족한다. ${reason}` };
  });
  const expectedPoints = question.criteria.reduce((total, criterion) => total + criterion.max_points, 0);
  assert(expectedPoints === old.expected_points, `Previously selected full was not full: ${id}`);
  const newCase = { id: newID, subquestion_id: question.id, kind: 'stored_model_answer', answer,
    expected_points: expectedPoints,
    expected_verdicts: criterionReviews.map(({ criterion_id, verdict, reason: criterionReason }) =>
      ({ criterion_id, verdict, reason: criterionReason })),
    note: '현재 저장 model_answer 배열을 줄바꿈으로 결합한 바이트 그대로이다. agent가 발문·모든 criterion·조건을 직접 재대조한 기대값이며 API 판정이 아니다. 기존 QA 답안과 기대값은 원파일 및 후속 QA의 앞부분에 그대로 보존한다.',
    origin: { question_file: chosen.file, question_sha256: chosen.sha256,
      replaced_representative_qa_file: old.qa_file, replaced_representative_case_id: old.case_id,
      replaced_answer_sha256: sha(Buffer.from(old.case.answer)) } };
  qa.updated.cases.push(newCase);
  Object.assign(representative, { case_id: newID, qa_file: rel(qa.file), answer_sha256: sha(Buffer.from(answer)),
    expected_points: expectedPoints, expected_verdicts: clone(newCase.expected_verdicts), case: clone(newCase),
    reason: `실제 저장 모범답안 바이트를 그대로 사용한다. ${reason}` });
  const review = reviews.entries.find((entry) => entry.set_id === representative.set_id && entry.subquestion_id === question.id);
  const role = review.representatives.find((entry) => entry.role === 'stored_model_answer');
  Object.assign(role, { case_id: newID, qa_file: rel(qa.file), answer_sha256: representative.answer_sha256,
    expected_points: expectedPoints, expected_verdicts: clone(newCase.expected_verdicts), reason: representative.reason });
  review.stored_model_answer_recheck = { reviewed_at: now, reviewer: 'agent', reviewer_agent: 'plan_foundations',
    answer_sha256: representative.answer_sha256, exact_join_newline: true, criterion_ids: question.criteria.map((item) => item.id),
    expected_points: expectedPoints, reason, evidence_file: rel(path.join(out, 'manual-answer-review.json')), api_calls: 0 };
  reviewRows.push({ set_id: chosen.set_id, subquestion_id: question.id, reviewer: 'agent', reviewer_agent: 'plan_foundations',
    reviewed_at: now, discrepancy: answer.replace(/\s/g, '') === old.case.answer.replace(/\s/g, '') ? 'whitespace_only' : 'different_wording',
    question_file: chosen.file, question_sha256: chosen.sha256, prompt: question.prompt,
    actual_stored_answer: answer, actual_stored_answer_sha256: representative.answer_sha256,
    old_representative: old, new_qa_file: rel(qa.file), new_case: newCase,
    reason, criterion_reviews: criterionReviews, source_evidence: review.source_evidence,
    status: 'agent_full_answer_confirmed', api_calls: 0 });
}
assert(reviewRows.length === 43 && qaUpdates.size === 31, 'Expected 43 replacements in 31 QA sets');
assert(reviewRows.filter((row) => row.discrepancy === 'whitespace_only').length === 20, 'Expected 20 whitespace cases');
for (const [file, hash] of inputPins) assert(pin(file) === hash, `Input changed during preparation: ${file}`);
let oldCases = 0;
for (const [setID, qa] of qaUpdates) {
  assert(isDeepStrictEqual(qa.updated.cases.slice(0, qa.original.cases.length), qa.original.cases), `Original cases altered: ${setID}`);
  const additions = qa.updated.cases.length - qa.original.cases.length;
  assert(additions > 0 && new Set(qa.updated.cases.map((item) => item.id)).size === qa.updated.cases.length, `Case identity mismatch: ${setID}`);
  write(qa.file, qa.updated);
  oldCases += qa.original.cases.length;
  const selection = selected.entries.find((entry) => entry.set_id === setID);
  selection.qa_file = rel(qa.file); selection.qa_sha256 = sha(bytes(qa.file));
}
for (const entry of reviewRows) {
  entry.new_qa_sha256 = sha(bytes(entry.new_qa_file));
  const representative = representatives.entries.find((item) => item.set_id === entry.set_id
    && item.subquestion_id === entry.subquestion_id && item.role === 'stored_model_answer');
  representative.qa_sha256 = entry.new_qa_sha256;
  const review = reviews.entries.find((item) => item.set_id === entry.set_id && item.subquestion_id === entry.subquestion_id);
  review.representatives.find((item) => item.role === 'stored_model_answer').qa_sha256 = entry.new_qa_sha256;
}
const retainedRoles = (rows) => rows.filter((entry) => entry.role !== 'stored_model_answer');
assert(isDeepStrictEqual(retainedRoles(originals.entries), retainedRoles(representatives.entries)), 'Partial/wrong selection changed');
assert(representatives.entries.length === 388, 'Representative denominator changed');
let fullCount = 0;
for (const representative of representatives.entries) {
  const qaCase = read(representative.qa_file).cases.find((item) => item.id === representative.case_id);
  assert(isDeepStrictEqual(qaCase, representative.case), `Representative QA differs: ${representative.case_id}`);
  assert(sha(Buffer.from(qaCase.answer)) === representative.answer_sha256, `Answer hash mismatch: ${representative.case_id}`);
  if (representative.role !== 'stored_model_answer') continue;
  let set = read(representative.question_file);
  if (Array.isArray(set)) set = set.find((item) => item.id === representative.set_id);
  const question = set.subquestions.find((item) => item.id === representative.subquestion_id);
  assert(qaCase.answer === question.model_answer.join('\n'), `Nonexact model answer remains: ${representative.set_id}/${question.id}`);
  assert(qaCase.expected_verdicts.length === question.criteria.length && question.criteria.every((criterion) =>
    qaCase.expected_verdicts.some((verdict) => verdict.criterion_id === criterion.id && verdict.verdict === 'met')), 'Incomplete full expected verdicts');
  assert(qaCase.expected_points === question.criteria.reduce((sum, criterion) => sum + criterion.max_points, 0), 'Full point sum mismatch');
  fullCount++;
}
assert(fullCount === 132, 'Full model coverage is incomplete');
const checks = { version: 1, checked_at: now, sets: 56, questions: 132, points: 473, representatives: 388,
  stored_model_answers_exact: 132, replaced_representatives: 43, whitespace_only: 20, different_wording: 23,
  original_qa_files_unchanged: qaUpdates.size, original_qa_cases_preserved_in_followups: oldCases,
  new_qa_cases: 43, unchanged_partial_and_wrong_representatives: retainedRoles(originals.entries).length,
  question_plan_source_changes: 0, preserved_handoff_files: preservation.entries.length,
  errors: 0, api_calls: 0, database_writes: 0 };
write(path.join(out, 'manual-answer-review.json'), { version: 1, reviewed_at: now, reviewer: 'agent', entries: reviewRows });
write(path.join(out, 'changes.json'), { version: 1, created_at: now,
  before_handoff: { file: rel(path.join(preserved, 'handoff.json')), sha256: sha(bytes(path.join(preserved, 'handoff.json'))) },
  preservation_manifest: rel(path.join(preserved, 'preservation-manifest.json')),
  scope: '대표43개를 실제 저장 모범답안과 일치시키는 후속 QA 추가. 문항·채점기준·기존 QA의 원답안과 기대값은 그대로 보존한다.',
  qa_files: [...qaUpdates.entries()].map(([set_id, qa]) => ({ set_id, before_file: qa.original_file,
    before_sha256: qa.original_sha256, after_file: rel(qa.file), after_sha256: sha(bytes(qa.file)),
    original_cases_preserved: qa.original.cases.length, new_cases: qa.updated.cases.length - qa.original.cases.length })),
  input_pins: [...inputPins].map(([file, sha256]) => ({ file, sha256 })), checks });
write(path.join(out, 'checks.json'), checks);
// Only after preservation and validation, publish the refreshed A selection.
write(path.join(A, 'selected-files.json'), selected);
write(path.join(A, 'representative-cases.json'), representatives);
write(path.join(A, 'question-reviews.json'), reviews);
const local = read(path.join(preserved, 'local-checks.json'));
local.stored_model_followup = checks;
write(path.join(A, 'local-checks.json'), local);
const handoff = clone(oldHandoff);
handoff.version = 2; handoff.frozen_at = now;
handoff.previous_handoff = { file: rel(path.join(preserved, 'handoff.json')), sha256: sha(bytes(path.join(preserved, 'handoff.json'))) };
handoff.stored_model_followup = { file: rel(path.join(out, 'changes.json')), sha256: sha(bytes(path.join(out, 'changes.json'))), checks };
handoff.validation.stored_model_answers132_exact_join_newline = true;
handoff.validation.original_qa_answers_and_expected_preserved = true;
for (const field of ['question_reviews', 'representatives', 'selected_files']) handoff[field].sha256 = sha(bytes(handoff[field].file));
const extra = [fileURLToPath(import.meta.url), path.join(out, 'manual-answer-review.json'), path.join(out, 'changes.json'),
  path.join(out, 'checks.json'), ...[...qaUpdates.values()].map((qa) => qa.file)];
handoff.files = [...new Set([...oldHandoff.files.map((entry) => path.resolve(root, entry.file)), ...extra])].map((file) =>
  ({ file: rel(file), sha256: sha(bytes(file)), bytes: bytes(file).length }));
write(path.join(A, 'handoff.json'), handoff);
for (const entry of preservation.entries) assert(sha(bytes(entry.preserved_file)) === entry.sha256, 'Preservation changed');
for (const [file, hash] of inputPins) assert(sha(bytes(file)) === hash, `Original selected input changed: ${file}`);
console.log(JSON.stringify({ ...checks, handoff: rel(path.join(A, 'handoff.json')), handoff_sha256: sha(bytes(path.join(A, 'handoff.json'))) }, null, 2));
