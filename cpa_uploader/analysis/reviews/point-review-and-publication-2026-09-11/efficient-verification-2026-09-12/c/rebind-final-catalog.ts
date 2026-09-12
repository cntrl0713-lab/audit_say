import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../../../questionReviewIdentity.ts';
import { compileLearningCatalog, main as buildCatalog } from '../../../../../../scripts/build-learning-unit-catalog.ts';
import type { QuestionSetV3 } from '../../../../../../lib/questionV3.ts';

type ReviewEntries = Parameters<typeof compileLearningCatalog>[1];
interface Review {
    source_file: string;
    source_file_sha256: string;
    entries: ReviewEntries;
    [key: string]: unknown;
}
interface Options { bank: string; review: string; output: string; catalogOutput: string }
interface Snapshot { file: string; identity: string; bytes: Buffer; sha256: string }
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const slash = (file: string) => file.replaceAll('\\', '/');

function exists(file: string) {
    try { fs.lstatSync(file); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
function identity(file: string): string {
    if (exists(file)) return fs.realpathSync(file);
    const parent = path.dirname(file);
    return parent === file ? file : path.join(identity(parent), path.basename(file));
}
function comparable(file: string) {
    const value = identity(file);
    return process.platform === 'win32' ? value.toLowerCase() : value;
}
function parseOptions(args: string[]): Options {
    const names = new Map([['--bank', 'bank'], ['--review', 'review'], ['--output', 'output'], ['--catalog-output', 'catalogOutput']]);
    const options: Record<string, string> = {};
    for (let index = 0; index < args.length; index += 2) {
        const key = names.get(args[index]), value = args[index + 1];
        if (!key || options[key] || !value?.trim() || value.startsWith('--')) throw new Error('사용법: --bank <published bank> --review <original review> --output <new review> --catalog-output <new catalog>');
        options[key] = value;
    }
    if (Object.keys(options).length !== 4) throw new Error('네 입력·출력 경로를 모두 지정해야 합니다.');
    return options as unknown as Options;
}
function asBank(value: unknown, label: string): QuestionSetV3[] {
    if (!Array.isArray(value) || !value.length) throw new Error(`${label}: 비어 있지 않은 은행 배열이 필요합니다.`);
    const ids = new Set<string>();
    for (const row of value) {
        if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id || ids.has(row.id)
            || !Array.isArray(row.subquestions) || !row.subquestions.length || !row.verification) throw new Error(`${label}: 잘못되거나 중복된 세트입니다.`);
        ids.add(row.id);
    }
    return value as QuestionSetV3[];
}
function withoutLifecycle(set: QuestionSetV3) {
    const value = structuredClone(set) as Partial<QuestionSetV3>;
    delete value.status;
    delete (value.verification as Partial<QuestionSetV3['verification']>).review_status;
    return value;
}

/** Local lifecycle rebind only. No promotion, model call, API, or DB write. */
export function main(args = process.argv.slice(2), cwd = process.cwd()) {
    const options = parseOptions(args), absolute = (file: string) => path.resolve(cwd, file);
    const output = absolute(options.output), catalogOutput = absolute(options.catalogOutput);
    if (exists(output) || exists(catalogOutput)) throw new Error('출력 덮어쓰기 금지: review와 catalog 모두 새 경로여야 합니다.');
    if (comparable(output) === comparable(catalogOutput)) throw new Error('두 출력 경로는 달라야 합니다.');
    const snapshots = new Map<string, Snapshot>();
    const read = (file: string) => {
        const resolved = absolute(file);
        const cached = snapshots.get(resolved);
        if (cached) return cached;
        const bytes = fs.readFileSync(resolved);
        const snapshot = { file: resolved, identity: comparable(resolved), bytes, sha256: hash(bytes) };
        snapshots.set(resolved, snapshot);
        return snapshot;
    };
    const guard = () => {
        for (const input of snapshots.values()) {
            if (!exists(input.file) || comparable(input.file) !== input.identity || hash(fs.readFileSync(input.file)) !== input.sha256) throw new Error('재결속 중 입력 또는 실행 코드가 변경되었습니다. 출력은 수락하지 마십시오.');
        }
    };
    const originalReviewInput = read(options.review);
    const originalReview: Review = JSON.parse(originalReviewInput.bytes.toString('utf8'));
    if (!originalReview || typeof originalReview.source_file !== 'string' || !originalReview.source_file.trim()
        || !/^[a-f0-9]{64}$/.test(originalReview.source_file_sha256) || !Array.isArray(originalReview.entries)) throw new Error('원 review의 source_file/source_file_sha256/entries 계약이 올바르지 않습니다.');
    const originalBankInput = read(originalReview.source_file), finalBankInput = read(options.bank);
    if (originalBankInput.sha256 !== originalReview.source_file_sha256) throw new Error('원 review가 참조하는 은행의 실제 Buffer SHA가 다릅니다.');
    const originalBank = asBank(JSON.parse(originalBankInput.bytes.toString('utf8')), 'original');
    const finalBank = asBank(JSON.parse(finalBankInput.bytes.toString('utf8')), 'final');
    assert.deepEqual(finalBank.map(s => s.id), originalBank.map(s => s.id), '전후 전체 세트 ID 또는 순서 불일치');
    const transitions = finalBank.map(set => {
        const original = originalBank.find(row => row.id === set.id)!;
        if (set.status !== 'published' || set.verification.review_status !== 'verified') throw new Error(`${set.id}: published/verified 최종 상태가 아닙니다.`);
        const beforeHash = reviewedContentHash(original), afterHash = reviewedContentHash(set);
        if (beforeHash !== afterHash) throw new Error(`${set.id}: lifecycle 외 검토 내용이 바뀌었습니다.`);
        assert.deepEqual(withoutLifecycle(set), withoutLifecycle(original), `${set.id}: status/review_status 외 차이`);
        return { set_id: set.id, reviewed_content_hash: afterHash, before: { status: original.status, review_status: original.verification.review_status }, after: { status: set.status, review_status: set.verification.review_status } };
    });
    const allQuestions = finalBank.flatMap(s => s.subquestions.map(q => `${s.id}/${q.id}`));
    const classified = originalReview.entries.map(e => `${e.set_id}/${e.subquestion_id}`);
    if (new Set(classified).size !== classified.length) throw new Error('분류 entries에 중복 물음이 있습니다.');
    assert.deepEqual(classified.toSorted(), allQuestions.toSorted(), '전 물음 분류 누락 또는 추가');
    // The official compiler reads these inputs, and its local imports define projection semantics.
    for (const file of ['cpa_uploader/analysis/coverage/registry.json', 'cpa_uploader/wiki/scripts/ox-study-order.mjs',
        'scripts/build-learning-unit-catalog.ts', 'cpa_uploader/questionReviewIdentity.ts', 'lib/questionV3.ts',
        'lib/learningSubmission.ts', 'lib/learningUnits.ts', fileURLToPath(import.meta.url)]) read(file);
    for (const input of snapshots.values()) if ([comparable(output), comparable(catalogOutput)].includes(input.identity)) throw new Error('출력과 입력 경로가 겹칩니다.');
    const renderedBankPath = path.isAbsolute(options.bank) ? slash(finalBankInput.file) : slash(path.relative(cwd, finalBankInput.file));
    const newReview: Review = { ...originalReview, source_file: renderedBankPath, source_file_sha256: finalBankInput.sha256,
        lifecycle_rebind: { version: 1, created_at: new Date().toISOString(), original_review_file: slash(originalReviewInput.file),
            original_review_sha256: originalReviewInput.sha256, original_source_file: originalReview.source_file,
            original_source_file_sha256: originalBankInput.sha256, entries_sha256: hash(JSON.stringify(originalReview.entries)),
            allowed_changes: ['status', 'verification.review_status'], transitions,
            scope: '상태 변경에 따른 분류 원문 판본 재결속. 분류·내용 검토나 게시 승인을 새로 기록하지 않는다.' } };
    assert.deepEqual(newReview.entries, originalReview.entries);
    const reviewBytes = Buffer.from(JSON.stringify(newReview, null, 2) + '\n');
    const outputIdentities = [comparable(output), comparable(catalogOutput)];
    guard();
    if (exists(output) || exists(catalogOutput)) throw new Error('준비 중 출력 경로에 다른 파일이 생겼습니다.');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.mkdirSync(path.dirname(catalogOutput), { recursive: true });
    assert.deepEqual([comparable(output), comparable(catalogOutput)], outputIdentities, '출력 부모 경로가 바뀌었습니다.');
    fs.writeFileSync(output, reviewBytes, { flag: 'wx' });
    const generatedReview = read(output);
    assert.equal(generatedReview.identity, outputIdentities[0], 'review 출력의 실경로가 변경되었습니다.');
    assert.equal(generatedReview.sha256, hash(reviewBytes));
    guard();
    // The official builder may replace an existing catalog. Build privately, then
    // install the exact bytes with wx so this wrapper never replaces a raced output.
    const temporaryDirectory = fs.mkdtempSync(path.join(path.dirname(catalogOutput), '.rebind-catalog-'));
    const temporaryCatalog = path.join(temporaryDirectory, 'catalog.json');
    let catalogBytes: Buffer;
    try {
        buildCatalog(['--review', options.output, '--output', temporaryCatalog], cwd);
        guard();
        catalogBytes = fs.readFileSync(temporaryCatalog);
        assert.deepEqual([comparable(output), comparable(catalogOutput)], outputIdentities, '출력 실경로가 변경되었습니다.');
        fs.writeFileSync(catalogOutput, catalogBytes, { flag: 'wx' });
    } finally {
        // Only this invocation's exclusive temporary directory is removed.
        if (exists(temporaryCatalog)) fs.unlinkSync(temporaryCatalog);
        fs.rmdirSync(temporaryDirectory);
    }
    const generatedCatalog = read(catalogOutput), catalog = JSON.parse(generatedCatalog.bytes.toString('utf8'));
    assert.equal(generatedCatalog.sha256, hash(catalogBytes));
    assert.equal(generatedCatalog.identity, outputIdentities[1], 'catalog 출력의 실경로가 변경되었습니다.');
    if (catalog.source_file_sha256 !== finalBankInput.sha256 || catalog.review_file_sha256 !== generatedReview.sha256) throw new Error('생성 카탈로그의 원문·review 해시 결속 오류');
    const compiled = compileLearningCatalog(finalBank, newReview.entries, catalog.topics);
    assert.deepEqual(catalog.classifications, compiled.classifications);
    guard();
    buildCatalog(['--review', options.output, '--output', options.catalogOutput, '--check'], cwd);
    guard();
    const summary = { status: 'local_catalog_rebound_and_checked', output: options.output, catalog_output: options.catalogOutput,
        source_file_sha256: finalBankInput.sha256, review_file_sha256: generatedReview.sha256, catalog_file_sha256: generatedCatalog.sha256,
        set_count: finalBank.length, question_count: allQuestions.length, learning_unit_count: compiled.units.length,
        standard_question_count: newReview.entries.filter(e => e.question_style === 'standard').length,
        case_question_count: newReview.entries.filter(e => e.question_style === 'case').length,
        classification_entries_unchanged: true, model_calls: 0, db_calls: 0 };
    console.log(JSON.stringify(summary));
    return summary;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(); }
    catch (error) { console.error(`재결속 실패: ${error instanceof Error ? error.message : String(error)}. 생성 중 남은 출력은 성공 산출물로 사용하지 마십시오.`); process.exitCode = 1; }
}
