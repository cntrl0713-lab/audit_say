/**
 * 문항 수정 패치 경로: 기존 게시 세트를 고칠 때 편집 정본·전체 은행 사본을 다시 쓰지 않는다.
 *
 *   scaffold  현재 정본 값으로 correction 비계를 만든다(읽기 전용).
 *     npx tsx cpa_uploader/correct_cpa_v3.ts scaffold --set <set_id> --slug <slug> --summary "<요약>" --target <대상>...
 *   scaffold --replace  같은 ID로 세트 전체를 바꾸는 교체 명세(물음 구성 변경)의 비계를 만든다. 이후 절차는 correction과 같다.
 *     npx tsx cpa_uploader/correct_cpa_v3.ts scaffold --replace --set <set_id> --slug <slug> --summary "<요약>"
 *   check     correction·교체 명세를 메모리에서 적용해 세트·은행 전체를 검증하고 바뀌는 값을 보여 준다(쓰기 없음).
 *     npx tsx cpa_uploader/correct_cpa_v3.ts check cpa_uploader/corrections/<id>.json... [--json]
 *   evidence  검수·대표 채점이 참조할 부분 은행(수정 세트만)과 분류 카탈로그를 만든다.
 *     npx tsx cpa_uploader/correct_cpa_v3.ts evidence cpa_uploader/corrections/<id>.json... --out-dir <검토 배치 폴더>
 *   publish   tmp/ 스테이지에서 재검수·재게시·컴파일·분류 카탈로그·전체 검증을 한 뒤 정본에 원자적으로 설치한다.
 *     node --env-file=.env.local cpa_uploader/correct_cpa_v3.ts publish <id>.json... (--efficient-review <batch.json> | --review <review.json>) --evidence "<근거>" [--stage-only]
 *
 * 대상 표기: title | classification.tags | verification.notes | sub=<물음>:<필드> | crit=<물음>/<criterion>:<필드>
 *            | req=<물음>/<requirement>:<필드> | src=<출처>:<필드> | fact=<사실>:<필드>
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { contentHash } from '../lib/learningSubmission.ts';
import type { LearningTopic } from '../lib/learningUnits.ts';
import { compileLearningCatalog } from '../scripts/build-learning-unit-catalog.ts';
import {
    loadPromotionLedger, publicationPaths, reviewedContentHash, snapshotFile, withPublicationLock, writePublicationFiles,
} from './questionBankPublication.ts';
import type { FileSnapshot } from './questionBankPublication.ts';
import {
    changedSetIds, CORRECTIONS_DIRECTORY, correctionEvidenceBank, formatAppliedCorrection, parseCorrectionId,
    parseTargetExpression, readCorrectionFile, scaffoldCorrection, serializeBank, sha256, QuestionCorrectionError,
} from './questionCorrection.ts';
import type { AppliedBank, CorrectionFile, QuestionSetReplacement } from './questionCorrection.ts';
import {
    applyCoverageRetargets, applySpecs, bankLinksForSet, coverageRetargetProblems, readCoverageLinks, scaffoldReplacement, serializeCoverageLinks,
} from './questionReplacement.ts';
import type { CoverageLinksDocument, CoverageRetargetChange } from './questionReplacement.ts';
import { carryClassificationEntries, entriesForSets } from './questionCorrectionClassification.ts';
import type { ClassificationReview, ClassificationReviewEntry } from './questionCorrectionClassification.ts';

export const DEFAULT_CATALOG = 'cpa_uploader/data/learning-question-classifications.json';
export const DEFAULT_CLASSIFICATION_REVIEW = 'cpa_uploader/data/learning-question-classification-review.json';

export function correctionPaths(root = process.cwd()) {
    const resolve = (key: string, fallback: string) => path.resolve(root, process.env[key] || fallback);
    return {
        ...publicationPaths(root),
        catalog: resolve('CPA_QUESTION_V3_LEARNING_CATALOG_PATH', DEFAULT_CATALOG),
        classificationReview: resolve('CPA_QUESTION_V3_CLASSIFICATION_REVIEW_PATH', DEFAULT_CLASSIFICATION_REVIEW),
        applied: resolve('CPA_QUESTION_CORRECTIONS_APPLIED_DIR', `${CORRECTIONS_DIRECTORY}/applied`),
        stage: resolve('CPA_QUESTION_CORRECTIONS_STAGE_DIR', 'tmp/question-corrections'),
        coverageLinks: resolve('CPA_QUESTION_COVERAGE_LINKS_PATH', 'cpa_uploader/analysis/coverage/links.json'),
    };
}
type Paths = ReturnType<typeof correctionPaths>;

const relative = (root: string, file: string) => path.relative(root, file).split(path.sep).join('/');
const insideRoot = (root: string, file: string) => {
    const rel = path.relative(root, path.resolve(root, file));
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

interface Options { positional: string[]; values: Map<string, string[]>; flags: Set<string> }
function parseOptions(args: string[], valued: string[], flags: string[]): Options {
    const options: Options = { positional: [], values: new Map(), flags: new Set() };
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (flags.includes(arg)) { options.flags.add(arg); continue; }
        if (valued.includes(arg)) {
            const value = args[++index];
            if (value === undefined || value.startsWith('--')) throw new Error(`${arg} 값이 필요합니다.`);
            options.values.set(arg, [...(options.values.get(arg) ?? []), value]);
            continue;
        }
        if (arg.startsWith('--')) throw new Error(`지원하지 않는 옵션: ${arg}`);
        options.positional.push(arg);
    }
    return options;
}
const single = (options: Options, name: string): string | undefined => {
    const values = options.values.get(name);
    if (values && values.length > 1) throw new Error(`${name}는 한 번만 지정하십시오.`);
    return values?.[0];
};

function readCanonical(paths: Paths) {
    const document = fs.readFileSync(paths.authoring, 'utf8');
    const bank = JSON.parse(document) as QuestionSetV3[];
    if (!Array.isArray(bank) || serializeBank(bank) !== document) {
        throw new Error(`편집 정본이 직렬화 규칙(JSON.stringify 2칸 + 줄바꿈)과 다릅니다. 먼저 정본 상태를 확인하십시오: ${paths.authoring}`);
    }
    return { document, bank };
}

interface PreparedCoverage { file: string; document: CoverageLinksDocument; changes: CoverageRetargetChange[]; affected: Array<{ set_id: string; link_ids: string[] }> }
interface Prepared {
    coverage: PreparedCoverage | null;
    files: CorrectionFile[];
    document: string;
    bank: QuestionSetV3[];
    result: AppliedBank;
    candidate: string;
    ids: string[];
}

/** check·evidence·publish 공통: correction을 읽고 정본에 메모리로 적용해 검증한다. */
function prepare(root: string, paths: Paths, specFiles: string[]): Prepared {
    if (!specFiles.length) throw new Error('correction 파일을 하나 이상 지정하십시오.');
    const files = specFiles.map((file) => readCorrectionFile(path.resolve(root, file)));
    const recorded = files.filter((file) => fs.existsSync(path.join(paths.applied, `${file.correction.correction_id}.json`)));
    if (recorded.length) throw new Error(`이미 게시 기록이 있는 correction입니다: ${recorded.map((file) => file.correction.correction_id).join(', ')}`);
    const { document, bank } = readCanonical(paths);
    const result = applySpecs(bank, files.map((file) => file.correction), root);
    if (result.errors.length) throw new QuestionCorrectionError('수정 결과가 문항·은행 검증을 통과하지 못했습니다. 정본은 바꾸지 않았습니다.', result.errors);
    const unpublished = result.applied.filter((item) => item.before.status !== 'published');
    if (unpublished.length) throw new Error(`게시된 세트만 수정 경로로 고칩니다. 초안은 제작 경로를 따르십시오: ${unpublished.map((item) => item.before.id).join(', ')}`);
    const candidate = serializeBank(result.sets);
    const ids = result.applied.map((item) => item.after.id);
    const changed = changedSetIds(document, candidate);
    if (JSON.stringify([...changed].sort()) !== JSON.stringify([...ids].sort())) {
        throw new Error(`정본에서 대상 세트 밖의 바이트가 바뀌었습니다: ${changed.join(', ')}`);
    }
    return { files, document, bank, result, candidate, ids, coverage: prepareCoverage(paths, result) };
}

/** 교체 명세가 있으면 은행 관계 장부의 대상이 교체 후에도 살아 있는지 확인하고, 재연결을 적용한 장부를 메모리에 만든다(쓰기 없음). */
function prepareCoverage(paths: Paths, result: AppliedBank): PreparedCoverage | null {
    const replacements = result.applied.filter((item) => item.kind === 'replacement');
    if (!replacements.length || !fs.existsSync(paths.coverageLinks)) return null;
    let document = readCoverageLinks(paths.coverageLinks);
    const changes: CoverageRetargetChange[] = [], affected: PreparedCoverage['affected'] = [], problems: string[] = [];
    for (const item of replacements) {
        const spec = item.correction as QuestionSetReplacement;
        affected.push({ set_id: item.after.id, link_ids: bankLinksForSet(document, item.after.id).map((link) => link.id) });
        const found = coverageRetargetProblems(document, item.after, spec);
        if (found.length) { problems.push(...found.map((problem) => `${spec.correction_id}: ${problem}`)); continue; }
        const applied = applyCoverageRetargets(document, item.after, spec);
        document = applied.document;
        changes.push(...applied.changes);
    }
    if (problems.length) throw new QuestionCorrectionError('교체 후 은행 관계 장부(coverage links)를 정리해야 합니다. 정본은 바꾸지 않았습니다.', problems);
    return { file: paths.coverageLinks, document, changes, affected };
}

function checkReport(root: string, paths: Paths, prepared: Prepared) {
    return {
        version: 1, artifact_type: 'question_set_correction_check', checked_at: new Date().toISOString(),
        canonical: { file: relative(root, paths.authoring), sha256: sha256(prepared.document), set_count: prepared.bank.length },
        candidate: { sha256: sha256(prepared.candidate), changed_set_ids: prepared.ids, whole_bank_validation: 'passed' },
        coverage: prepared.coverage ? { file: relative(root, prepared.coverage.file), affected: prepared.coverage.affected,
            retargeted_link_ids: prepared.coverage.changes.map((change) => change.link_id) } : null,
        corrections: prepared.result.applied.map((item) => {
            const file = prepared.files.find((entry) => entry.correction.correction_id === item.correction.correction_id)!;
            return {
                correction_id: item.correction.correction_id, set_id: item.after.id, kind: item.kind,
                ...(item.kind === 'replacement' ? { lineage: summarizeLineage(item.correction as QuestionSetReplacement) } : {}),
                spec: { file: relative(root, file.file), sha256: file.sha256, git_blob: file.gitBlob },
                content_hash: item.contentHash, points: item.points, public_changed: item.publicChanged,
                learning_fields_changed: item.learningFieldsChanged,
                changes: item.changes.map(({ target, before, after }) => ({ target, before, after })),
            };
        }),
    };
}

function summarizeLineage(spec: QuestionSetReplacement) {
    const count = (rows: Array<{ disposition: string }>) => Object.fromEntries(['kept', 'rewritten', 'split', 'merged', 'added', 'removed']
        .map((name) => [name, rows.filter((row) => row.disposition === name).length]).filter(([, n]) => n));
    return { reason: spec.lineage.reason, subquestions: count(spec.lineage.subquestions), criteria: count(spec.lineage.criteria),
        dropped_requirements: spec.lineage.dropped_requirements?.length ?? 0, coverage_retargets: spec.coverage_retargets?.length ?? 0 };
}

// ---------------------------------------------------------------- scaffold

function scaffold(root: string, paths: Paths, args: string[]) {
    const options = parseOptions(args, ['--set', '--slug', '--summary', '--target', '--date', '--out'], ['--replace']);
    if (options.positional.length) throw new Error(`알 수 없는 인자: ${options.positional.join(' ')}`);
    const setId = single(options, '--set'), slug = single(options, '--slug'), summary = single(options, '--summary');
    if (!setId || !slug || !summary?.trim()) throw new Error('scaffold에는 --set, --slug, --summary가 필요합니다.');
    const replace = options.flags.has('--replace');
    if (replace && options.values.has('--target')) throw new Error('--replace에는 --target을 쓰지 않습니다. replacement에 새 판본 전체를 적습니다.');
    const now = new Date();
    const date = single(options, '--date') ?? `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const correctionId = `${date}-${setId}--${slug}`;
    parseCorrectionId(correctionId);
    const { bank } = readCanonical(paths);
    const set = bank.find((item) => item.id === setId);
    if (!set) throw new Error(`정본에 세트 ${setId}가 없습니다.`);
    const draft = replace
        ? scaffoldReplacement(set, { correctionId, summary: summary.trim(), entries: currentClassification(root, paths).review.entries })
        : scaffoldCorrection(set, { correctionId, summary: summary.trim(), targets: (options.values.get('--target') ?? []).map(parseTargetExpression) });
    const out = path.resolve(root, single(options, '--out') ?? `${CORRECTIONS_DIRECTORY}/${correctionId}.json`);
    if (path.basename(out) !== `${correctionId}.json`) throw new Error(`출력 파일 이름은 ${correctionId}.json이어야 합니다.`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, json(draft), { encoding: 'utf8', flag: 'wx' });
    if (!replace) {
        console.log(`비계를 만들었습니다: ${relative(root, out)}`);
        console.log('각 patch의 set에 고친 값을, reason에 수정 이유를 쓰십시오. expected_before와 base_content_hash는 고치지 마십시오.');
        return;
    }
    console.log(`교체 비계를 만들었습니다: ${relative(root, out)}`);
    console.log('replacement에 새 판본 전체를, lineage에 물음·criterion의 전후 대응과 이유를, classification_entries에 모든 물음의 분류 근거를 쓰십시오. base_content_hash·id·status·review_status·주제 구조는 고치지 마십시오.');
    if (fs.existsSync(paths.coverageLinks)) {
        const links = bankLinksForSet(readCoverageLinks(paths.coverageLinks), set.id);
        console.log(links.length
            ? `이 세트를 가리키는 은행 관계 ${links.length}건: ${links.map((link) => `${link.id}(${link.target!.subquestion_id}/${link.target!.criterion_ids.join(',')})`).join(', ')} — 가리키던 물음·criterion ID가 사라지면 coverage_retargets로 다시 연결합니다.`
            : '이 세트를 가리키는 은행 관계는 없습니다.');
    }
}

// ---------------------------------------------------------------- check

function check(root: string, paths: Paths, args: string[]) {
    const options = parseOptions(args, [], ['--json']);
    const prepared = prepare(root, paths, options.positional);
    if (options.flags.has('--json')) { console.log(JSON.stringify(checkReport(root, paths, prepared), null, 2)); return; }
    for (const item of prepared.result.applied) console.log(formatAppliedCorrection(item));
    if (prepared.coverage) console.log(`관계 장부: 대상 관계 ${prepared.coverage.affected.reduce((n, item) => n + item.link_ids.length, 0)}건, 재연결 ${prepared.coverage.changes.length}건 (설치 뒤 npm run analysis:build로 registry를 다시 만듭니다).`);
    console.log(`은행 전체 검증 통과: ${prepared.result.sets.length}세트. 바뀌는 세트 ${prepared.ids.length}개 외 정본 바이트는 같습니다. 정본은 바꾸지 않았습니다.`);
    console.log('다음: evidence로 검수용 부분 은행을 만들고 검수·대표 채점 후 publish를 실행합니다.');
}

// ---------------------------------------------------------------- evidence

interface CatalogFile {
    schema_version: 1; source_file: string; source_file_sha256: string; public_content_hash: string;
    review_file: string; review_file_sha256: string; topics: LearningTopic[]; classifications: unknown[];
}

function currentClassification(root: string, paths: Paths) {
    const catalog = JSON.parse(fs.readFileSync(paths.catalog, 'utf8')) as CatalogFile;
    if (catalog?.schema_version !== 1 || typeof catalog.review_file !== 'string' || !Array.isArray(catalog.topics)) {
        throw new Error(`분류 카탈로그 형식이 올바르지 않습니다: ${paths.catalog}`);
    }
    const reviewFile = path.resolve(root, catalog.review_file);
    const reviewBytes = fs.readFileSync(reviewFile);
    if (sha256(reviewBytes) !== catalog.review_file_sha256) throw new Error(`카탈로그가 가리키는 분류 입력의 해시가 다릅니다: ${catalog.review_file}`);
    const review = JSON.parse(reviewBytes.toString('utf8')) as ClassificationReview;
    if (!Array.isArray(review?.entries)) throw new Error(`분류 입력에 entries가 없습니다: ${catalog.review_file}`);
    return { catalog, reviewFile, review };
}

function catalogDocument(sets: QuestionSetV3[], entries: ClassificationReviewEntry[], topics: LearningTopic[],
    source: { file: string; sha256: string }, review: { file: string; sha256: string }): CatalogFile {
    const { classifications } = compileLearningCatalog(sets, entries, topics);
    return {
        schema_version: 1, source_file: source.file, source_file_sha256: source.sha256,
        public_content_hash: contentHash(sets.map(compilePublicQuestionSet)),
        review_file: review.file, review_file_sha256: review.sha256, topics, classifications,
    };
}

/** 검수용 부분 은행·분류 입력·카탈로그·검사 기록을 `directory`에 새로 쓴다. 기존 파일은 덮어쓰지 않는다. */
export function writeCorrectionEvidence(root: string, paths: Paths, specFiles: string[], directory: string) {
    const prepared = prepare(root, paths, specFiles);
    const { catalog, review } = currentClassification(root, paths);
    const entries = carryClassificationEntries(review.entries, prepared.result.applied);
    const subset = correctionEvidenceBank(prepared.result.sets, prepared.ids);
    fs.mkdirSync(directory, { recursive: true });
    const write = (name: string, content: string) => {
        const file = path.join(directory, name);
        fs.writeFileSync(file, content, { encoding: 'utf8', flag: 'wx' });
        return { file: relative(root, file), sha256: sha256(content) };
    };
    const bank = write('correction-bank.json', serializeBank(subset));
    const reviewRef = write('correction-classification-review.json',
        json({ source_file: bank.file, source_file_sha256: bank.sha256, entries: entriesForSets(entries, subset) }));
    const catalogRef = write('correction-catalog.json', json(catalogDocument(subset, entriesForSets(entries, subset), catalog.topics, bank, reviewRef)));
    // 의미검수 경로의 비교 은행(수정 후 전체 은행)은 커밋하지 않는 tmp/에만 둔다. receipt는 해시만 기록한다.
    const comparison = path.join(paths.stage, `evidence-${sha256(prepared.candidate).slice(0, 12)}`, 'candidate-bank.json');
    fs.mkdirSync(path.dirname(comparison), { recursive: true });
    if (!fs.existsSync(comparison)) fs.writeFileSync(comparison, prepared.candidate, { encoding: 'utf8', flag: 'wx' });
    const report = { ...checkReport(root, paths, prepared), evidence: { bank, classification_review: reviewRef, catalog: catalogRef },
        comparison_bank: { file: relative(root, comparison), sha256: sha256(prepared.candidate), committed: false } };
    const reportRef = write('correction-check.json', json(report));
    return { prepared, subset, bank, catalog: catalogRef, classificationReview: reviewRef, report: reportRef, comparison: report.comparison_bank };
}

function evidence(root: string, paths: Paths, args: string[]) {
    const options = parseOptions(args, ['--out-dir'], []);
    const outDir = single(options, '--out-dir');
    if (!outDir) throw new Error('evidence에는 --out-dir <검토 배치 폴더>가 필요합니다.');
    const directory = path.resolve(root, outDir);
    // receipt는 증거를 저장소 상대 경로로 다시 읽는다. cpa_uploader/data의 JSON 배열은 미편입 초안으로 읽히므로 피한다.
    if (!insideRoot(root, directory) || !/^cpa_uploader\/(analysis\/reviews|drafts)\/[^/]/u.test(relative(root, directory))) {
        throw new Error('검수 증거는 저장소의 cpa_uploader/analysis/reviews/ 또는 cpa_uploader/drafts/ 아래 배치 폴더에 둡니다.');
    }
    const written = writeCorrectionEvidence(root, paths, options.positional, directory);
    for (const item of written.prepared.result.applied) console.log(formatAppliedCorrection(item));
    console.log(`검수용 부분 은행: ${written.bank.file} (${written.subset.length}세트, ${Buffer.byteLength(serializeBank(written.subset))}바이트)`);
    console.log(`분류 카탈로그: ${written.catalog.file}`);
    console.log(`검사 기록: ${written.report.file}`);
    console.log(`의미검수 경로의 --bank(커밋 안 함): ${written.comparison.file}`);
    console.log('대표 채점 manifest의 bank·classifications에는 위 부분 은행과 카탈로그를 씁니다. 전체 은행 사본을 만들지 않습니다.');
}

// ---------------------------------------------------------------- publish

function childEnvironment(extra: Record<string, string> = {}) {
    const env: NodeJS.ProcessEnv = { ...process.env };
    // 스테이지 명령은 외부 API·DB에 연결하지 않는다.
    for (const key of Object.keys(env)) if (/OPENAI|ANTHROPIC|SUPABASE/iu.test(key)) delete env[key];
    delete env.NODE_OPTIONS;
    return { ...env, ...extra };
}

function run(root: string, logDirectory: string, id: string, script: string, args: string[], env: NodeJS.ProcessEnv, timeout = 600_000) {
    const started = Date.now();
    const result = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, ...args], {
        cwd: root, env, encoding: 'utf8', timeout, windowsHide: true, shell: false, maxBuffer: 64 * 1024 * 1024,
    });
    const log = path.join(logDirectory, `${id}.log`);
    fs.writeFileSync(log, `${result.stdout ?? ''}\n${result.stderr ?? ''}`, { flag: 'wx' });
    if (result.error || result.status !== 0) {
        throw new Error(`${id} 실패(exit ${result.status}${result.error ? `, ${result.error.message}` : ''}). 기록: ${log}\n${(result.stderr || result.stdout || '').trim().split('\n').slice(-12).join('\n')}`);
    }
    console.log(`✓ ${id} (${Math.round((Date.now() - started) / 1000)}초)`);
}

export interface PublishOptions { review?: string; efficientReview?: string; evidence: string; stageOnly?: boolean }

export function publish(root: string, paths: Paths, specFiles: string[], options: PublishOptions) {
    if (Boolean(options.review) === Boolean(options.efficientReview)) throw new Error('--efficient-review 또는 --review 중 하나를 지정하십시오.');
    if (!options.evidence?.trim()) throw new Error('--evidence에 실제 검수·게시 근거를 적으십시오.');
    const reviewFile = path.resolve(root, (options.efficientReview ?? options.review)!);
    if (!fs.existsSync(reviewFile)) throw new Error(`검수 근거 파일이 없습니다: ${reviewFile}`);
    // 대표 채점 receipt는 배치 파일을 저장소 상대 경로로 기록하고 다시 읽는다.
    if (options.efficientReview && !insideRoot(root, reviewFile)) throw new Error('--efficient-review 배치는 저장소 안에 있어야 합니다.');
    if (!process.env.CPA_QUESTION_V3_ENCRYPTION_KEY) throw new Error('CPA_QUESTION_V3_ENCRYPTION_KEY가 필요합니다(node --env-file=.env.local).');
    if (new Set(Object.values(paths)).size !== Object.values(paths).length) throw new Error('정본·산출물·기록 경로는 서로 달라야 합니다.');

    const canonicalFiles = { authoring: paths.authoring, ledger: paths.ledger, public: paths.public, encrypted: paths.encrypted, catalog: paths.catalog };
    const before = Object.fromEntries(Object.entries(canonicalFiles).map(([name, file]) => [name, snapshotFile(file)])) as Record<keyof typeof canonicalFiles, FileSnapshot>;
    for (const [name, snapshot] of Object.entries(before)) if (!snapshot.hash) throw new Error(`정본 파일이 없습니다(${name}): ${snapshot.file}`);
    const env = childEnvironment();
    const catalogCheck = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/build-learning-unit-catalog.ts', '--check', '--output', paths.catalog],
        { cwd: root, env, encoding: 'utf8', timeout: 120_000, windowsHide: true, shell: false });
    if (catalogCheck.status !== 0) throw new Error(`현재 분류 카탈로그가 입력과 맞지 않아 이어받을 수 없습니다.\n${catalogCheck.stderr || catalogCheck.stdout}`);

    const prepared = prepare(root, paths, specFiles);
    const { catalog, reviewFile: currentReviewFile, review } = currentClassification(root, paths);
    const entries = carryClassificationEntries(review.entries, prepared.result.applied);
    const guards: FileSnapshot[] = [...Object.values(before), snapshotFile(currentReviewFile), snapshotFile(reviewFile),
        snapshotFile(paths.classificationReview), ...prepared.files.map((file) => snapshotFile(file.file)),
        ...(prepared.coverage ? [snapshotFile(prepared.coverage.file)] : [])];

    const runId = `${new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d+Z$/u, 'Z')}-${process.pid}`;
    const stage = path.join(paths.stage, runId);
    fs.mkdirSync(stage, { recursive: true });
    const staged = { authoring: path.join(stage, 'authoring.json'), ledger: path.join(stage, 'promotions.json'),
        public: path.join(stage, 'public.json'), encrypted: path.join(stage, 'encrypted.json'),
        review: path.join(stage, 'classification-review.json'), catalog: path.join(stage, 'catalog.json') };
    fs.writeFileSync(staged.authoring, prepared.candidate, { flag: 'wx' });
    fs.copyFileSync(paths.ledger, staged.ledger, fs.constants.COPYFILE_EXCL);
    const stagedEnv = childEnvironment({
        CPA_QUESTION_V3_AUTHORING_PATH: staged.authoring, CPA_QUESTION_V3_PROMOTIONS_PATH: staged.ledger,
        CPA_QUESTION_V3_PUBLIC_PATH: staged.public, CPA_QUESTION_V3_ENCRYPTED_PATH: staged.encrypted,
    });
    const sets = prepared.ids.join(',');
    const route = options.efficientReview ? ['--efficient-review', relative(root, reviewFile)] : ['--review', relative(root, reviewFile)];
    const evidenceText = `${options.evidence.trim()}; corrections: ${prepared.files.map((file) => `${file.correction.correction_id}@${file.sha256.slice(0, 12)}`).join(', ')}`;
    run(root, stage, '01-reverify', 'cpa_uploader/promote_cpa_v3.ts', ['--reverify', '--to', 'verified', '--sets', sets, ...route, '--evidence', evidenceText], stagedEnv);
    run(root, stage, '02-publish', 'cpa_uploader/promote_cpa_v3.ts', ['--to', 'published', '--sets', sets, '--evidence', evidenceText], stagedEnv);
    run(root, stage, '03-compile', 'scripts/compile-question-bank-v3.ts', [], { ...stagedEnv, CPA_QUESTION_V3_ENCRYPTION_KEY: process.env.CPA_QUESTION_V3_ENCRYPTION_KEY });
    const stagedDocument = fs.readFileSync(staged.authoring, 'utf8');
    fs.writeFileSync(staged.review, json({ source_file: staged.authoring, source_file_sha256: sha256(stagedDocument), entries }), { flag: 'wx' });
    run(root, stage, '04-catalog', 'scripts/build-learning-unit-catalog.ts', ['--review', staged.review, '--output', staged.catalog], stagedEnv, 120_000);
    run(root, stage, '05-validate', 'cpa_uploader/validate_cpa_v3.ts', [], stagedEnv);

    // 재검수·재게시는 수명주기 라벨을 제자리로 돌려놓으므로 최종 원문은 메모리에서 검증한 수정본과 같아야 한다.
    if (stagedDocument !== prepared.candidate) throw new Error('재검수·재게시 후 원문이 검증한 수정본과 다릅니다.');
    const priorLedger = loadPromotionLedger(paths.ledger), nextLedger = loadPromotionLedger(staged.ledger);
    const added = nextLedger.entries.slice(priorLedger.entries.length);
    if (JSON.stringify(nextLedger.entries.slice(0, priorLedger.entries.length)) !== JSON.stringify(priorLedger.entries)) throw new Error('승급 장부의 기존 항목이 바뀌었습니다.');
    for (const item of prepared.result.applied) {
        const rows = added.filter((entry) => entry.set_id === item.after.id);
        if (JSON.stringify(rows.map((entry) => [entry.from_status, entry.to_status])) !== JSON.stringify([['published', 'verified'], ['verified', 'published']])
            || rows.some((entry) => entry.content_hash !== reviewedContentHash(item.after))) throw new Error(`${item.after.id}: 승급 장부에 재검수·재게시 두 항목이 정확히 추가되지 않았습니다.`);
    }
    if (added.length !== prepared.ids.length * 2) throw new Error('승급 장부에 대상 밖 항목이 추가되었습니다.');
    const priorPublic = JSON.parse(fs.readFileSync(paths.public, 'utf8')) as ReturnType<typeof compilePublicQuestionSet>[];
    const nextPublic = JSON.parse(fs.readFileSync(staged.public, 'utf8')) as ReturnType<typeof compilePublicQuestionSet>[];
    for (const [index, set] of nextPublic.entries()) {
        const target = prepared.result.applied.find((item) => item.after.id === set.id);
        if (!target && JSON.stringify(set) !== JSON.stringify(priorPublic[index])) throw new Error(`${set.id}: 대상 밖 세트의 공개본이 바뀌었습니다.`);
    }

    const canonicalDocument = stagedDocument;
    const reviewDocument = json({ source_file: relative(root, paths.authoring), source_file_sha256: sha256(canonicalDocument), entries });
    const stagedCatalog = JSON.parse(fs.readFileSync(staged.catalog, 'utf8')) as CatalogFile;
    const canonicalCatalog: CatalogFile = { ...stagedCatalog, source_file: relative(root, paths.authoring),
        review_file: relative(root, paths.classificationReview), review_file_sha256: sha256(reviewDocument) };
    const catalogDocumentText = json({ schema_version: 1, source_file: canonicalCatalog.source_file, source_file_sha256: canonicalCatalog.source_file_sha256,
        public_content_hash: canonicalCatalog.public_content_hash, review_file: canonicalCatalog.review_file, review_file_sha256: canonicalCatalog.review_file_sha256,
        topics: canonicalCatalog.topics, classifications: canonicalCatalog.classifications });
    const untouched = prepared.result.sets.filter((set) => !prepared.ids.includes(set.id)).map((set) => set.id);
    const classificationRows = (value: CatalogFile, ids: string[]) => JSON.stringify((value.classifications as { source_set_id: string }[]).filter((row) => ids.includes(row.source_set_id)));
    if (classificationRows(canonicalCatalog, untouched) !== classificationRows(catalog, untouched)
        || JSON.stringify(canonicalCatalog.topics) !== JSON.stringify(catalog.topics)) throw new Error('대상 밖 세트의 물음 분류나 주제가 바뀌었습니다.');

    const writes = [
        { file: paths.authoring, content: canonicalDocument },
        { file: paths.ledger, content: fs.readFileSync(staged.ledger, 'utf8') },
        { file: paths.public, content: fs.readFileSync(staged.public, 'utf8') },
        { file: paths.encrypted, content: fs.readFileSync(staged.encrypted, 'utf8') },
        { file: paths.classificationReview, content: reviewDocument },
        { file: paths.catalog, content: catalogDocumentText },
        ...(prepared.coverage ? [{ file: prepared.coverage.file, content: serializeCoverageLinks(prepared.coverage.document) }] : []),
    ];
    const summary = {
        run_id: runId, stage: relative(root, stage), stage_only: Boolean(options.stageOnly), corrections: prepared.files.map((file) => file.correction.correction_id),
        changed_set_ids: prepared.ids, ledger_entries_added: added.length,
        bytes: Object.fromEntries(writes.map((write) => [relative(root, write.file), Buffer.byteLength(write.content)])),
    };
    fs.writeFileSync(path.join(stage, 'stage-completion.json'), json({ status: 'staged_and_validated', ...summary,
        files: writes.map((write) => ({ file: relative(root, write.file), sha256: sha256(write.content) })) }), { flag: 'wx' });
    if (options.stageOnly) {
        for (const item of prepared.result.applied) console.log(formatAppliedCorrection(item));
        console.log(`스테이지 검증 완료(설치 안 함): ${relative(root, stage)}`);
        return summary;
    }

    const previous = writes.map((write) => ({ file: write.file, content: fs.existsSync(write.file) ? fs.readFileSync(write.file) : null }));
    withPublicationLock(paths.authoring, () => writePublicationFiles(writes, guards));
    const installed = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/build-learning-unit-catalog.ts', '--check', '--output', paths.catalog],
        { cwd: root, env, encoding: 'utf8', timeout: 120_000, windowsHide: true, shell: false });
    if (installed.status !== 0) {
        // 설치한 바이트가 그대로일 때만 되돌린다. 다른 작업이 이미 바꿨으면 손대지 않고 알린다.
        withPublicationLock(paths.authoring, () => writePublicationFiles(
            previous.filter((item) => item.content !== null).map((item) => ({ file: item.file, content: item.content!.toString('utf8') })),
            writes.map((write) => ({ file: write.file, hash: sha256(write.content) }))));
        if (previous.some((item) => item.content === null)) {
            for (const item of previous) if (item.content === null && fs.existsSync(item.file)) fs.unlinkSync(item.file);
        }
        throw new Error(`설치 후 분류 카탈로그 검사가 실패해 이전 정본으로 되돌렸습니다.\n${installed.stderr || installed.stdout}`);
    }
    const after = Object.fromEntries(writes.map((write) => [relative(root, write.file), sha256(write.content)]));
    const reviewSha = sha256(fs.readFileSync(reviewFile));
    const ledgerOffset = priorLedger.entries.length;
    fs.mkdirSync(paths.applied, { recursive: true });
    for (const item of prepared.result.applied) {
        const file = prepared.files.find((entry) => entry.correction.correction_id === item.correction.correction_id)!;
        const ledgerEntries = added.map((entry, index) => ({ index: ledgerOffset + index, entry })).filter(({ entry }) => entry.set_id === item.after.id)
            .map(({ index, entry }) => ({ index, from_status: entry.from_status, to_status: entry.to_status, review_receipt_hash: entry.review_receipt_hash ?? null }));
        const record = {
            version: 1, artifact_type: item.kind === 'replacement' ? 'question_set_replacement_application' : 'question_set_correction_application',
            correction_id: item.correction.correction_id, set_id: item.after.id,
            ...(item.kind === 'replacement' ? { lineage: (item.correction as QuestionSetReplacement).lineage,
                coverage: (prepared.coverage?.changes ?? []).filter((change) => ((item.correction as QuestionSetReplacement).coverage_retargets ?? []).some((retarget) => retarget.link_id === change.link_id)) } : {}),
            applied_at: new Date().toISOString(), run_id: runId,
            spec: { file: relative(root, file.file), sha256: file.sha256, git_blob: file.gitBlob },
            review: { route: options.efficientReview ? 'efficient_review' : 'semantic_review', file: relative(root, reviewFile), sha256: reviewSha },
            evidence: evidenceText, content_hash: item.contentHash, points: item.points, public_changed: item.publicChanged,
            ledger_entries: ledgerEntries,
            canonical: { before: Object.fromEntries(Object.values(before).map((snapshot) => [relative(root, snapshot.file), snapshot.hash])), after },
        };
        fs.writeFileSync(path.join(paths.applied, `${item.correction.correction_id}.json`), json(record), { encoding: 'utf8', flag: 'wx' });
    }
    for (const item of prepared.result.applied) console.log(formatAppliedCorrection(item));
    console.log(`정본 설치 완료: 세트 ${prepared.ids.length}개, 승급 장부 +${added.length}건. 적용 기록: ${relative(root, paths.applied)}/`);
    if (prepared.coverage?.changes.length) console.log(`관계 장부 ${relative(root, prepared.coverage.file)}의 ${prepared.coverage.changes.length}건을 다시 연결했습니다.`);
    console.log('다음: npm run analysis:build → analysis:check → wiki:build → wiki:check, 운영 반영은 cpa_uploader/publish_question_release.ts');
    return summary;
}

export function main(args = process.argv.slice(2), root = process.cwd()) {
    const [command, ...rest] = args;
    const paths = correctionPaths(root);
    if (command === 'scaffold') return scaffold(root, paths, rest);
    if (command === 'check') return check(root, paths, rest);
    if (command === 'evidence') return evidence(root, paths, rest);
    if (command === 'publish') {
        const options = parseOptions(rest, ['--review', '--efficient-review', '--evidence'], ['--stage-only']);
        return publish(root, paths, options.positional, {
            review: single(options, '--review'), efficientReview: single(options, '--efficient-review'),
            evidence: single(options, '--evidence') ?? '', stageOnly: options.flags.has('--stage-only'),
        });
    }
    throw new Error('사용법: correct_cpa_v3.ts <scaffold|check|evidence|publish> …');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(); } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
