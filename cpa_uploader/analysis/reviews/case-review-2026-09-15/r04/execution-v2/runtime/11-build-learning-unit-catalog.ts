import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { contentHash } from '../lib/learningSubmission.ts';
import { buildLearningUnits } from '../lib/learningUnits.ts';
import type { LearningClassification, LearningTopic, QuestionStyle } from '../lib/learningUnits.ts';
import { studyTopics } from '../cpa_uploader/wiki/scripts/ox-study-order.mjs';

const reviewDirectory = 'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11';
const defaultOutput = 'cpa_uploader/data/learning-question-classifications.json';
const coverageFile = 'cpa_uploader/analysis/coverage/registry.json';
interface Entry {
    set_id: string; subquestion_id: string; question_style: QuestionStyle; topic_ids: string[];
    standalone_prompt: string | null; case_fact_ids: string[]; reason: string;
}
interface Review { source_file: string; source_file_sha256: string; entries: Entry[] }
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function localUuid(key: string) {
    const hash = sha(`audit-say:file-learning-unit:${key}`).slice(0, 32).split('');
    hash[12] = '5'; hash[16] = '8';
    return `${hash.slice(0, 8).join('')}-${hash.slice(8, 12).join('')}-${hash.slice(12, 16).join('')}-${hash.slice(16, 20).join('')}-${hash.slice(20).join('')}`;
}

export function compileLearningCatalog(sets: QuestionSetV3[], entries: Entry[], topics: LearningTopic[]) {
    const identities = new Set(entries.map(entry => `${entry.set_id}/${entry.subquestion_id}`));
    if (identities.size !== entries.length) throw new Error('중복 분류 항목이 있습니다.');
    const classifications: LearningClassification[] = entries.map(entry => {
        const set = sets.find(set => set.id === entry.set_id);
        const sub = set?.subquestions.find(sub => sub.id === entry.subquestion_id);
        if (!set || !sub || !entry.reason.trim()) throw new Error(`원본 물음 또는 판정 근거 누락: ${entry.set_id}/${entry.subquestion_id}`);
        if (entry.case_fact_ids.some(id => !set.shared_context.facts.some(fact => fact.id === id))
            || entry.question_style === 'standard' && entry.case_fact_ids.length !== 0) throw new Error('사실관계 연결이 올바르지 않습니다.');
        const sourceHash = contentHash(set);
        const metadata = { question_style: entry.question_style, topic_ids: entry.topic_ids,
            standalone_prompt: entry.question_style === 'standard' ? entry.standalone_prompt ?? sub.prompt : null,
            case_fact_ids: entry.case_fact_ids };
        const hash = contentHash({ sourceHash, subquestion_id: sub.id, ...metadata });
        return {
            learning_question_id: localUuid(`${set.id}/${sub.id}`), classification_version_id: localUuid(hash),
            source_set_id: set.id, source_set_version_id: localUuid(sourceHash),
            source_content_hash: sourceHash,
            source_subquestion_version_id: localUuid(`${sourceHash}/${sub.id}`), subquestion_id: sub.id,
            ...metadata, case_set_id: entry.question_style === 'case' ? set.id : null, content_hash: hash,
        };
    });
    const units = buildLearningUnits(sets.map(compilePublicQuestionSet), classifications, topics);
    return { classifications, units };
}

function parseArguments(args: string[]) {
    const options: { review?: string; output?: string; check: boolean } = { check: false };
    const seen = new Set<string>();
    for (let index = 0; index < args.length; index++) {
        const option = args[index];
        if (!['--review', '--output', '--check'].includes(option)) throw new Error(`지원하지 않는 옵션: ${option}`);
        if (seen.has(option)) throw new Error(`중복 옵션: ${option}`);
        seen.add(option);
        if (option === '--check') options.check = true;
        else {
            const value = args[++index];
            if (!value?.trim() || value.startsWith('--')) throw new Error(`${option} 값이 필요합니다.`);
            options[option === '--review' ? 'review' : 'output'] = value;
        }
    }
    return options;
}

/** Follow symlinks for path protection, including a not-yet-created output. */
function resolvedIdentity(file: string): string {
    if (fs.existsSync(file)) return fs.realpathSync(file);
    const parent = path.dirname(file);
    return parent === file ? file : path.join(resolvedIdentity(parent), path.basename(file));
}

export function main(args = process.argv.slice(2), cwd = process.cwd()) {
    const options = parseArguments(args);
    const output = options.output ?? defaultOutput;
    const absolute = (file: string) => path.resolve(cwd, file);
    const snapshots = new Map<string, { file: string; bytes: Buffer; sha256: string }>();
    const readInput = (file: string) => {
        const resolved = absolute(file);
        const cached = snapshots.get(resolved);
        if (cached) return cached.bytes;
        const bytes = fs.readFileSync(resolved);
        snapshots.set(resolved, { file: resolved, bytes, sha256: sha(bytes) });
        return bytes;
    };
    const outputPath = absolute(output);
    const previousOutput = fs.existsSync(outputPath) ? readInput(output) : null;
    let previousCatalog: { schema_version?: unknown; review_file?: unknown; classifications?: unknown } | null = null;
    if (previousOutput) {
        previousCatalog = JSON.parse(previousOutput.toString('utf8'));
        if (!previousCatalog || previousCatalog.schema_version !== 1 || typeof previousCatalog.review_file !== 'string'
            || !previousCatalog.review_file.trim() || !Array.isArray(previousCatalog.classifications)) {
            throw new Error('기존 출력은 분류 카탈로그여야 합니다. 검토 원본·문항·다른 입력 파일을 덮어쓸 수 없습니다.');
        }
    }
    const reviewFile = options.review ?? previousCatalog?.review_file as string | undefined
        ?? `${reviewDirectory}/canonical-classification.json`;
    const reviewBytes = readInput(reviewFile);
    const review: Review = JSON.parse(reviewBytes.toString('utf8'));
    if (!review || typeof review.source_file !== 'string' || !review.source_file.trim()
        || !/^[a-f\d]{64}$/.test(review.source_file_sha256) || !Array.isArray(review.entries)) {
        throw new Error('검토 파일에 원본 경로·SHA-256·전체 분류 배열이 필요합니다.');
    }
    const protectedFiles = [reviewFile, review.source_file, coverageFile,
        `${reviewDirectory}/canonical-classification.json`, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'];
    if (typeof previousCatalog?.review_file === 'string') protectedFiles.push(previousCatalog.review_file);
    const outputIdentity = resolvedIdentity(outputPath);
    for (const file of protectedFiles) {
        const identity = resolvedIdentity(absolute(file));
        const samePath = process.platform === 'win32' ? identity.toLowerCase() === outputIdentity.toLowerCase() : identity === outputIdentity;
        // Hard links have different paths but must not overwrite an input inode.
        const sameInode = fs.existsSync(outputPath) && fs.existsSync(absolute(file)) && (() => {
            const out = fs.statSync(outputPath), input = fs.statSync(absolute(file));
            return out.ino !== 0 && out.ino === input.ino && out.dev === input.dev;
        })();
        if (samePath || sameInode) throw new Error('분류 출력은 검토 원본·문항 정본·입력 파일과 다른 경로여야 합니다.');
    }
    const sourceBytes = readInput(review.source_file);
    if (sha(sourceBytes) !== review.source_file_sha256) throw new Error('분류 원본 해시가 변경되었습니다.');
    const sets: QuestionSetV3[] = JSON.parse(sourceBytes.toString('utf8'));
    const coverage = JSON.parse(readInput(coverageFile).toString('utf8')) as { topics: Array<{ id: string; title: string }> };
    const topics: LearningTopic[] = studyTopics.map((topic, index) => {
        if (!topic) throw new Error('OX 주제 정의가 없습니다.');
        const source = sets.find(set => set.classification.topic_id === topic.id);
        const name = coverage.topics.find(row => row.id === topic.id)?.title;
        if (!source || !name) throw new Error('주제 정의 또는 Part를 찾을 수 없습니다.');
        return { id: topic.id, title: name, part: source.classification.part, position: index + 1 };
    });
    const { classifications, units } = compileLearningCatalog(sets, review.entries, topics);
    const catalog = { schema_version: 1, source_file: review.source_file, source_file_sha256: sha(sourceBytes),
        public_content_hash: contentHash(sets.map(compilePublicQuestionSet)),
        review_file: reviewFile, review_file_sha256: sha(reviewBytes), topics, classifications };
    const bytes = JSON.stringify(catalog, null, 2) + '\n';
    for (const input of snapshots.values()) {
        if (!fs.existsSync(input.file) || sha(fs.readFileSync(input.file)) !== input.sha256) throw new Error('카탈로그 생성 중 입력 파일이 변경되었습니다.');
    }
    if (!previousOutput && fs.existsSync(outputPath)) throw new Error('카탈로그 생성 중 출력 경로에 다른 파일이 생겼습니다.');
    if (options.check) {
        if (!previousOutput || previousOutput.toString('utf8') !== bytes) throw new Error('물음 분류 산출물이 입력과 다릅니다.');
    } else {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, bytes, previousOutput ? undefined : { flag: 'wx' });
    }
    console.log(JSON.stringify({ output, question_count: classifications.length, learning_unit_count: units.length,
        standard: classifications.filter(row => row.question_style === 'standard').length,
        case: classifications.filter(row => row.question_style === 'case').length,
        topic_links: classifications.reduce((sum, row) => sum + row.topic_ids.length, 0), check: options.check }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
