import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildGradingPrompt, buildGradingResponseSchema, applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import type { QuestionSetJudgmentV3, QuestionSetGradeResultV3 } from '../../../../lib/questionV3Grading.ts';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const batch = 'cpa_uploader/drafts/delegated-authoring-2026-09-11';
const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label)) throw Error('새 집계 라벨 필요');
const output = path.join(control, `required-qa-index-${label}.json`);
if (fs.existsSync(output)) throw Error('과거 집계는 덮어쓰지 않습니다.');
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const fileHash = (file: string) => hash(fs.readFileSync(file));
const read = <T>(file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const normalized = (value: unknown): unknown => Array.isArray(value) ? value.map(normalized) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalized(item)])) : value;
const equivalent = (a: unknown, b: unknown) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
type Identity = { file: string; sha256: string };
type QA = { id: string; subquestion_id: string; kind: string; answer: string; expected_points: number; expected_verdicts: Array<{ criterion_id: string; verdict: string }> };
type Entry = { plan_id: string; set_id: string; file: string; sha256: string; package: string; qa_file: string; qa_sha256: string; source_files: Identity[] };
type RecordRow = { set_id: string; case_id: string; model: string; started_at: string; finished_at: string; transport: string;
    expected: QA; answers: Record<string, string>; request_hash?: string; schema_hash?: string; raw_judgment: QuestionSetJudgmentV3 | null;
    result?: QuestionSetGradeResultV3; trace?: unknown[]; error?: unknown; matched: boolean };
type Inputs = { question_set: QuestionSetV3; hashes?: Record<string, string>; guarded_files?: Identity[]; model: string; mock: boolean; transport: string };
const manifestFile = process.argv[3] || `${control}/final-153-v2/manifest.json`;
const manifest = read<{ entries: Entry[] }>(manifestFile);
const overlayFile = process.argv[5] === 'none' ? null : process.argv[5] || `${control}/active-qa-overrides-v2-followup.json`;
const overlays = overlayFile ? read<{ overrides: Array<{ plan_id: string; identity: Identity }> }>(overlayFile) : { overrides: [] };
const lockFile = process.argv[4] || `${control}/runtime-v5-stable/runtime-lock.json`;
const lock = read<{ settings: { grading_model: string }; code_files: Identity[]; manifest_sha256: string }>(lockFile);
if (fileHash(manifestFile) !== lock.manifest_sha256) throw Error('Manifest and runtime lock differ');
const graderFiles = ['lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts', 'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts', `${control}/run-author-qa.ts`];
const currentCode = graderFiles.map(file => {
    const item = lock.code_files.find(item => item.file === file);
    if (!item || fileHash(file) !== item.sha256) throw Error(`현재 채점 코드 변경: ${file}`);
    return item;
});
const index = new Map(manifest.entries.map(entry => {
    if (fileHash(entry.file) !== entry.sha256) throw Error(`현재 문항 변경: ${entry.plan_id}`);
    const raw = read<QuestionSetV3 | QuestionSetV3[]>(entry.file), set = Array.isArray(raw) ? raw[0] : raw;
    const qaIdentity = overlays.overrides.find(item => item.plan_id === entry.plan_id)?.identity || { file: entry.qa_file, sha256: entry.qa_sha256 };
    if (fileHash(qaIdentity.file) !== qaIdentity.sha256) throw Error(`현재 QA 변경: ${entry.plan_id}`);
    const qa = read<{ cases: QA[] }>(qaIdentity.file).cases;
    const cases = qa.map(test => ({ test, observations: [] as Array<{ file: string; sha256: string; original_case_id: string; mapping: string; matched_current_expectation: boolean; original_record_matched: boolean; score: number; transport: string; finished_at: string }> }));
    return [set.id, { entry, set, qaIdentity, cases }];
}));
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]);
const inputCache = new Map<string, Inputs | null>();
const skipped: Record<string, number> = {};
const skip = (reason: string) => { skipped[reason] = (skipped[reason] || 0) + 1; };
const invalid: Array<{ file: string; reason: string }> = [];
const zero = new Set(['not_met', 'contradicted']);
for (const file of walk(batch).filter(file => /case-\d+-attempt-\d+\.json$/.test(file))) {
    let record: RecordRow;
    try { record = read<RecordRow>(file); } catch { skip('incomplete_json_during_snapshot'); continue; }
    const selected = index.get(record.set_id || record.result?.question_set_id || '');
    if (!selected || !record.expected || !record.result || record.error) { skip('not_completed_author_qa'); continue; }
    const inputFile = path.join(path.dirname(file), 'inputs.json');
    if (!inputCache.has(inputFile)) inputCache.set(inputFile, fs.existsSync(inputFile) ? read<Inputs>(inputFile) : null);
    const inputs = inputCache.get(inputFile);
    const inputHashes = inputs?.hashes || Object.fromEntries((inputs?.guarded_files || []).map(item => [item.file, item.sha256]));
    if (!inputs || inputs.mock !== false || inputs.transport !== 'production_gradeQuestionSetV3' || inputs.model !== lock.settings.grading_model
        || currentCode.some(item => inputHashes[item.file] !== item.sha256)) { skip('other_runtime'); continue; }
    if (!equivalent(inputs.question_set, selected.set) || selected.entry.source_files.some(item => inputHashes[item.file] !== item.sha256 || fileHash(item.file) !== item.sha256)) { skip('other_question_or_source'); continue; }
    const exactTest = selected.cases.find(item => item.test.id === record.case_id);
    const aliases = exactTest ? [] : selected.cases.filter(item => item.test.subquestion_id === record.expected.subquestion_id && item.test.answer === record.expected.answer
        && item.test.expected_points === record.expected.expected_points && equivalent(item.test.expected_verdicts.map(v => [v.criterion_id, v.verdict]), record.expected.expected_verdicts.map(v => [v.criterion_id, v.verdict])));
    const test = exactTest || (aliases.length === 1 ? aliases[0] : undefined);
    if (!test) { skip('supplement_or_case_alias'); continue; }
    const answers = Object.fromEntries(selected.set.subquestions.map(sub => [sub.id, sub.id === test.test.subquestion_id ? test.test.answer : '']));
    if (!equivalent(record.answers, answers)) { skip('other_answer'); continue; }
    if (record.request_hash !== hash(buildGradingPrompt(selected.set, answers)) || record.schema_hash !== hash(JSON.stringify(buildGradingResponseSchema(selected.set, answers)))) {
        invalid.push({ file, reason: 'actual input/schema identity mismatch' }); continue;
    }
    const nonempty = Object.values(answers).some(answer => answer.trim());
    if (nonempty ? record.transport !== 'live_model' || !record.raw_judgment || !record.trace?.length : record.transport !== 'production_empty_answer_no_model') {
        invalid.push({ file, reason: 'actual execution evidence missing' }); continue;
    }
    const judgment: QuestionSetJudgmentV3 = record.raw_judgment || { subquestions: selected.set.subquestions.map(sub => ({ subquestion_id: sub.id, verdicts: sub.criteria.map(criterion => ({ criterion_id: criterion.id, verdict: 'not_met' as const })) })) };
    const replayed = applyQuestionSetJudgment(selected.set, answers, judgment);
    if (!equivalent(replayed, record.result)) { invalid.push({ file, reason: 'recorded raw judgment does not reproduce result' }); continue; }
    const target = replayed.subquestions.find(sub => sub.subquestion_id === test.test.subquestion_id)!;
    const boundary = ['condition_boundary', 'condition-boundary'].includes(test.test.kind);
    const rawSecurityFlag = judgment.injection_detected || judgment.salad_detected || judgment.subquestions.some(sub => sub.injection_detected || sub.salad_detected);
    const matched = !rawSecurityFlag && replayed.security_flag === 'none' && replayed.score === test.test.expected_points && test.test.expected_verdicts.every(expected => {
        const actual = target.criteria.find(criterion => criterion.criterion_id === expected.criterion_id)?.verdict || '';
        return actual === expected.verdict || boundary && zero.has(expected.verdict) && zero.has(actual);
    });
    test.observations.push({ file: file.replaceAll('\\', '/'), sha256: fileHash(file), original_case_id: record.case_id,
        mapping: exactTest ? 'same_case_id_and_exact_actual_input' : 'unique_same_answer_and_expectations_with_exact_actual_input', matched_current_expectation: matched,
        original_record_matched: record.matched, score: replayed.score, transport: record.transport, finished_at: record.finished_at });
}
const sets = [...index.values()].map(({ entry, qaIdentity, cases }) => ({ plan_id: entry.plan_id, set_id: entry.set_id, package: entry.package,
    question: { file: entry.file, sha256: entry.sha256 }, qa: qaIdentity, required_cases: cases.length,
    covered: cases.filter(item => item.observations.length).length,
    unresolved: cases.filter(item => item.observations.some(row => !row.matched_current_expectation)).length,
    cases: cases.map(({ test, observations }) => ({ case_id: test.id, subquestion_id: test.subquestion_id, kind: test.kind, expected_points: test.expected_points,
        state: !observations.length ? 'not_observed_by_this_index' : observations.every(row => row.matched_current_expectation) ? 'all_recorded_observations_match' : 'mismatch_recorded', observations })) }));
fs.writeFileSync(output, JSON.stringify({ created_at: new Date().toISOString(), manifest: { file: manifestFile, sha256: fileHash(manifestFile) },
    qa_overlay: overlayFile ? { file: overlayFile, sha256: fileHash(overlayFile) } : null, grader_code: currentCode, model: lock.settings.grading_model,
    runtime_lock: { file: lockFile, sha256: fileHash(lockFile) }, index_script: { file: process.argv[1], sha256: fileHash(process.argv[1]) },
    scope: '필수 QA와 동일 답안·문항·모델·grader 6파일·출처·요청·스키마를 가진 원시 author record를 연결하고 실제 판정을 합산 재검증한다. 별칭은 답안·대상·기대가 유일하게 같은 사례만 연결하고 원래 사례ID를 보존한다. 모호한 별칭·생성 QA는 담당 장부로 추가 확인한다. 모든 동일 버전 관측을 보존하여 실패를 마지막 성공으로 지우지 않는다. 실행 중인 큐의 순간 집계이며 전수 검증 완료나 API HTTP 요청 수가 아니다.',
    required_cases: sets.reduce((sum, item) => sum + item.required_cases, 0), covered_cases: sets.reduce((sum, item) => sum + item.covered, 0),
    cases_with_mismatch: sets.reduce((sum, item) => sum + item.unresolved, 0), skipped, invalid, sets }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, required_cases: sets.reduce((n, item) => n + item.required_cases, 0), covered_cases: sets.reduce((n, item) => n + item.covered, 0),
    cases_with_mismatch: sets.reduce((n, item) => n + item.unresolved, 0), invalid, skipped }));
