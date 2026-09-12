import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compilePublicQuestionSet, computeQuestionSetMaxPoints, computeSubquestionMaxPoints } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import { contentHash } from '../../../../lib/learningSubmission.ts';
import { validateAuthoringBank, reviewedContentHash } from '../../../questionBankPublication.ts';
import { compileLearningCatalog } from '../../../../scripts/build-learning-unit-catalog.ts';
import { learningCatalogForBank, inspectBankSnapshot } from '../../../../scripts/import-question-bank-v3.ts';

// This creates review artifacts only. It does not promote content or call the DB/API.
const directory = path.dirname(fileURLToPath(import.meta.url));
const relative = (file: string) => path.relative(process.cwd(), file).replaceAll('\\', '/');
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const args = process.argv.slice(2);
if (args.some(arg => !['--with-reviewed', '--new-only'].includes(arg)) || args.length !== 1) throw new Error('Use --new-only or --with-reviewed.');
const withReviewed = args[0] === '--with-reviewed';
const output = path.join(directory, withReviewed ? 'prepared-reviewed-v1' : 'prepared-new-v1');
if (fs.existsSync(output)) throw new Error('An existing preparation is immutable; select a new version in a follow-up script.');
const inputs: Array<{file: string; sha256: string}> = [];
function fixed(file: string, expected?: string) {
    const bytes = fs.readFileSync(file);
    const hash = sha(bytes);
    if (expected && hash !== expected) throw new Error(`Changed input: ${file}`);
    inputs.push({ file: relative(path.resolve(file)), sha256: hash });
    return JSON.parse(bytes.toString('utf8'));
}
const baseline = fixed(path.join(directory, 'baseline.json'));
for (const input of baseline.inputs) fixed(input.file, input.sha256);
const original: QuestionSetV3[] = fixed(path.join(directory, 'canonical-before.json'), baseline.inputs[0].sha256);
const manifestPath = baseline.inputs.find((input: {file: string}) => input.file.endsWith('/manifest.json')).file;
const manifest = read(manifestPath);
const originalById = new Map(original.map(set => [set.id, set]));
const candidates = new Map(original.map(set => [set.id, structuredClone(set)]));
const ownerFiles: string[] = [];
let splitLineage: Array<{set_id:string;source_subquestion_id:string;parts:Array<{subquestion_id:string;criterion_ids:string[]}>}> = [];
let classificationOverrides: Array<Record<string, unknown>> = [];
if (withReviewed) {
    const assigned = new Set<string>();
    for (const [owner, first, last] of [['a', 1, 6], ['b', 7, 12], ['c', 13, 19]] as const) {
        const file = path.join(directory, owner, 'sets.json');
        const sets: QuestionSetV3[] = fixed(file);
        ownerFiles.push(relative(file));
        const expected = original.filter(set => Number(set.classification.topic_id) >= first && Number(set.classification.topic_id) <= last);
        if (sets.length !== expected.length) throw new Error(`${owner}: missing or extra assigned source sets`);
        for (const set of sets) {
            if (!expected.some(before => before.id === set.id) || assigned.has(set.id)) throw new Error(`${owner}: ownership violation ${set.id}`);
            const before = originalById.get(set.id)!;
            if (JSON.stringify(before.subquestions.map(sub => sub.id)) !== JSON.stringify(set.subquestions.map(sub => sub.id))) throw new Error(`${set.id}: question identity changes require an explicit lineage review`);
            assigned.add(set.id);
            candidates.set(set.id, set);
        }
    }
    if (assigned.size !== original.length) throw new Error('Canonical set coverage is incomplete.');
    const rootFile = path.join(directory, 'root', 'sets.json');
    if (fs.existsSync(rootFile)) {
        const rootSets: QuestionSetV3[] = fixed(rootFile);
        const lineage = fixed(path.join(directory, 'root', 'lineage.json'));
        for (const input of lineage.inputs) fixed(input.file, input.sha256);
        splitLineage = lineage.entries;
        classificationOverrides = fixed(path.join(directory, 'root', 'classification-overrides.json')).entries;
        for (const set of rootSets) {
            const before = candidates.get(set.id);
            const split = splitLineage.find(row => row.set_id === set.id);
            if (!before || !split || before.subquestions.some(sub => !set.subquestions.some(after => after.id === sub.id))) throw new Error(`Invalid split lineage: ${set.id}`);
            const beforeIds = before.subquestions.flatMap(sub => sub.criteria.map(c => c.id)).sort();
            const afterIds = set.subquestions.flatMap(sub => sub.criteria.map(c => c.id)).sort();
            if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) throw new Error(`Split added or removed a criterion: ${set.id}`);
            candidates.set(set.id, set);
        }
    }
}
const newSets: QuestionSetV3[] = manifest.entries.map((entry: {file: string; sha256: string; set_id: string; qa_file: string; qa_sha256: string; plan_files: Array<{file: string;sha256: string}>;source_files: Array<{file: string;sha256: string}>}) => {
    const raw = fixed(entry.file, entry.sha256);
    const set: QuestionSetV3 = Array.isArray(raw) ? raw[0] : raw;
    if (Array.isArray(raw) && raw.length !== 1 || set.id !== entry.set_id || originalById.has(set.id)) throw new Error('Invalid new set identity.');
    fixed(entry.qa_file, entry.qa_sha256);
    for (const plan of entry.plan_files) fixed(plan.file, plan.sha256);
    for (const source of entry.source_files) {
        const hash = sha(fs.readFileSync(source.file));
        if (hash !== source.sha256) throw new Error(`Changed source: ${source.file}`);
        inputs.push({file: source.file, sha256: hash});
    }
    return set;
});
if (new Set(newSets.map(set => set.id)).size !== manifest.collected_sets) throw new Error('New set inventory differs.');
const changedSets = [...candidates.values()].filter(set => reviewedContentHash(set) !== reviewedContentHash(originalById.get(set.id)!));
const changedIds = new Set(changedSets.map(set => set.id));
const allSets = [...candidates.values(), ...newSets].map(set => {
    const copy = structuredClone(set);
    if (changedIds.has(copy.id)) {
        copy.status = 'needs_review';
        copy.verification.review_status = 'needs_human_review';
    }
    return copy;
});
const authoringValidation = validateAuthoringBank(allSets);
if (authoringValidation.errors.length) throw new Error(JSON.stringify(authoringValidation.errors, null, 2));
const canonicalReview = fixed('cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/canonical-classification.json');
const draftReview = read(baseline.inputs.find((input: {file: string}) => input.file.endsWith('/draft-classification.json')).file);
const classificationEntries = [...canonicalReview.entries, ...draftReview.entries].filter(entry => !classificationOverrides.some(override => override.set_id === entry.set_id)).map(entry => ({
    set_id: entry.set_id, subquestion_id: entry.subquestion_id, question_style: entry.question_style,
    topic_ids: entry.topic_ids, reason: entry.reason, case_fact_ids: entry.case_fact_ids,
    standalone_prompt: entry.standalone_prompt,
    predecessor: originalById.has(entry.set_id)
        ? { review_file: 'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/canonical-classification.json', source_file_sha256: entry.source_file_sha256 }
        : { review_file: 'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/draft-classification.json', question_file: entry.question_file, question_sha256: entry.question_sha256 },
}));
classificationEntries.push(...classificationOverrides as typeof classificationEntries);
const changedStandalonePrompts: string[] = [];
for (const entry of classificationEntries) {
    const before = originalById.get(entry.set_id)?.subquestions.find(sub => sub.id === entry.subquestion_id);
    const after = allSets.find(set => set.id === entry.set_id)?.subquestions.find(sub => sub.id === entry.subquestion_id);
    if (before && after && before.prompt !== after.prompt && entry.standalone_prompt != null) {
        // A revised source may incorporate the already reviewed standalone prompt verbatim.
        if (after.prompt === entry.standalone_prompt) {
            entry.standalone_prompt = null;
            entry.reason += ' 기존에 검토한 독립 발문이 수정 원본 발문에 그대로 편입되어 별도 대체 발문은 필요하지 않다.';
        } else changedStandalonePrompts.push(`${entry.set_id}/${entry.subquestion_id}`);
    }
}
if (changedStandalonePrompts.length) throw new Error(`Standalone prompt overlay requires manual review: ${changedStandalonePrompts.join(', ')}`);
const topics = read(baseline.inputs.find((input: {file: string}) => input.file.endsWith('/learning-question-classifications.json')).file).topics;
const compiled = allSets.map(compilePublicQuestionSet);
const { classifications, units } = compileLearningCatalog(allSets, classificationEntries, topics);
const dbMetadata = learningCatalogForBank(allSets, { topics, classifications });
const authoringBytes = JSON.stringify(allSets, null, 2) + '\n';
const publicBytes = JSON.stringify(compiled, null, 2) + '\n';
const inspection = inspectBankSnapshot(authoringBytes, publicBytes);
const sourceFile = relative(path.join(output, 'candidate-authoring.json'));
const reviewFile = relative(path.join(output, 'classification-review.json'));
const classificationReview = {
    schema_version: 1, source_file: sourceFile, source_file_sha256: sha(authoringBytes),
    status: 'candidate_classification_structurally_checked',
    predecessor_files: [canonicalReview.source_file, draftReview.source_manifest],
    entries: classificationEntries,
};
const reviewBytes = JSON.stringify(classificationReview, null, 2) + '\n';
const catalog = { schema_version: 1, source_file: sourceFile, source_file_sha256: sha(authoringBytes),
    public_content_hash: contentHash(compiled), review_file: reviewFile, review_file_sha256: sha(reviewBytes), topics, classifications };
const pointRows = original.flatMap(beforeSet => {
    const afterSet = candidates.get(beforeSet.id)!;
    return beforeSet.subquestions.map(before => {
        const after = afterSet.subquestions.find(sub => sub.id === before.id)!;
        const split = splitLineage.find(row => row.set_id === beforeSet.id && row.source_subquestion_id === before.id);
        const parts = split ? split.parts.map(part => afterSet.subquestions.find(sub => sub.id === part.subquestion_id)!) : [after];
        return { set_id: beforeSet.id, subquestion_id: before.id, topic_id: beforeSet.classification.topic_id,
            old_points: computeSubquestionMaxPoints(before), new_points: parts.reduce((n,sub) => n + computeSubquestionMaxPoints(sub), 0),
            changed: JSON.stringify(before) !== JSON.stringify(after), source_changed: JSON.stringify(beforeSet.source_refs) !== JSON.stringify(afterSet.source_refs),
            before, after, after_subquestions: parts, split: Boolean(split) };
    });
});
const summary = {
    created_at: new Date().toISOString(), phase: withReviewed ? 'all_candidates_prepared' : 'new_candidates_prepared',
    canonical: { sets: original.length, questions: pointRows.length, candidate_questions: [...candidates.values()].reduce((n,set) => n + set.subquestions.length, 0),
        split_questions: splitLineage.map(row => `${row.set_id}/${row.source_subquestion_id}`), old_points: original.reduce((n,set) => n + computeQuestionSetMaxPoints(set), 0),
        candidate_points: [...candidates.values()].reduce((n,set) => n + computeQuestionSetMaxPoints(set), 0), changed_sets: [...changedIds],
        changed_questions: pointRows.filter(row => row.changed).length, points_changed_questions: pointRows.filter(row => row.old_points !== row.new_points).length,
        source_changed_sets: original.filter(before => JSON.stringify(before.source_refs) !== JSON.stringify(candidates.get(before.id)!.source_refs)).map(set => set.id) },
    new: { sets: newSets.length, questions: newSets.reduce((n,set) => n + set.subquestions.length, 0), points: newSets.reduce((n,set) => n + computeQuestionSetMaxPoints(set), 0) },
    combined: { sets: allSets.length, questions: classifications.length, points: allSets.reduce((n,set) => n + computeQuestionSetMaxPoints(set), 0),
        learning_units: units.length, standard_questions: classifications.filter(row => row.question_style === 'standard').length,
        case_questions: classifications.filter(row => row.question_style === 'case').length, case_sets: units.filter(unit => unit.question_style === 'case').length,
        topic_links: classifications.reduce((n,row) => n + row.topic_ids.length, 0) },
    validation: { structure_source_quotes_duplicates: 'passed', learning_units_and_import_metadata: 'passed',
        publication_ready: false, model_semantic_review: 'not_completed', model_grading: fs.existsSync(path.join(directory, 'refill-grading-result.json')) ? 'representative_refill_probe_passed_full_validation_pending' : 'halted_after_HTTP_429',
        human_review: 'not_asserted', production_db: 'not_applied', import_preconditions: inspection.report },
    lifecycle_note: 'Changed existing sets are marked needs_review only in this candidate. Actual prior published lifecycle and ledger remain untouched; publication must use the explicit --reverify contract.',
    owner_files: ownerFiles, inputs: [...new Map(inputs.map(input => [input.file, input])).values()],
};
for (const input of inputs) if (sha(fs.readFileSync(input.file)) !== input.sha256) throw new Error(`Input changed while preparing: ${input.file}`);
fs.mkdirSync(output, {recursive: true});
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(output, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {encoding: 'utf8', flag: 'wx'});
write('candidate-authoring.json', authoringBytes);
write('candidate-public.json', publicBytes);
write('classification-review.json', reviewBytes);
write('learning-question-classifications.json', catalog);
write('db-learning-metadata.json', dbMetadata);
write('point-diff.json', pointRows);
write('summary.json', summary);
console.log(JSON.stringify({output: relative(output), canonical: summary.canonical, new: summary.new, combined: summary.combined, publication_ready: false}, null, 2));
