import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { computeQuestionSetMaxPoints } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';

const [previousFile, overridesFile, label] = process.argv.slice(2);
if (!previousFile || !overridesFile || !/^[a-z0-9-]+$/.test(label || '')) throw Error('이전 manifest, 명시적 후속 선택표, 새 고정 이름 필요');
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const output = path.join(control, label);
if (fs.existsSync(output)) throw Error('기존 고정을 덮어쓰지 않습니다.');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
type Identity = { file: string; sha256: string };
type Entry = { plan_id: string; set_id: string; file: string; sha256: string; qa_file: string; qa_sha256: string; qa_cases: number;
    plan_files: Identity[]; source_files: Identity[]; output_directory: string; question_ids: string[]; actual_questions: number; criteria: number; points: number };
type Override = { plan_id: string; file?: string; plan_file?: string; qa_file?: string; rationale: string; evidence: string[] };
const previous = read(previousFile) as { entries: Entry[]; bank_file: string; bank_sha256: string; purpose: string; errors: string[] };
const overrides = read(overridesFile) as { entries: Override[] };
if (previous.purpose !== 'fixed_comparison_bank' || previous.errors.length || previous.entries.length !== 49) throw Error('이전 49세트 고정이 아님');
if (sha(previous.bank_file) !== previous.bank_sha256) throw Error('보호 정본 변경');
if (new Set(overrides.entries.map(row => row.plan_id)).size !== overrides.entries.length || overrides.entries.some(row => !previous.entries.some(entry => entry.plan_id === row.plan_id))) throw Error('후속 선택 ID 오류');
const sets: QuestionSetV3[] = [];
const entries = previous.entries.map(entry => {
    for (const identity of [{ file: entry.file, sha256: entry.sha256 }, { file: entry.qa_file, sha256: entry.qa_sha256 }, ...entry.plan_files, ...entry.source_files]) {
        if (sha(identity.file) !== identity.sha256) throw Error(`과거 고정 바이트 변경: ${identity.file}`);
    }
    const override = overrides.entries.find(row => row.plan_id === entry.plan_id);
    const file = override?.file || entry.file, qaFile = override?.qa_file || entry.qa_file;
    const raw = read(file), set = (Array.isArray(raw) && raw.length === 1 ? raw[0] : raw) as QuestionSetV3;
    if (set.id !== entry.set_id || JSON.stringify(set.subquestions.map(sub => sub.id)) !== JSON.stringify(entry.question_ids)) throw Error(`문항 ID 변경: ${entry.plan_id}`);
    if (set.status !== 'needs_review' || set.verification.review_status !== 'needs_human_review') throw Error('검수 전 상태 승급 금지');
    const qa = read(qaFile);
    if (qa.set_id !== set.id || qa.cases.length !== entry.qa_cases) throw Error(`49/131 필수 QA 연결/수 변경: ${entry.plan_id}`);
    const plans = override?.plan_file ? [{ file: override.plan_file, sha256: sha(override.plan_file) }] : entry.plan_files;
    if (plans.length !== 1) throw Error('계획 선택 불명확');
    const planRaw = read(plans[0].file), plan = planRaw.plans?.find((candidate: { set_id: string }) => candidate.set_id === set.id) || planRaw;
    if (plan.set_id !== set.id || plan.topic_id !== set.classification.topic_id) throw Error('후속 계획 연결 오류');
    for (const evidence of override?.evidence || []) if (!fs.existsSync(evidence)) throw Error(`후속 근거 부재: ${evidence}`);
    sets.push(set);
    return { ...entry, file, sha256: sha(file), qa_file: qaFile, qa_sha256: sha(qaFile), plan_files: plans,
        actual_questions: set.subquestions.length, criteria: set.subquestions.reduce((n, sub) => n + sub.criteria.length, 0), points: computeQuestionSetMaxPoints(set),
        source_files: [...new Set(set.source_refs.map(source => source.file))].map(file => ({ file, sha256: sha(file) })),
        predecessor: { manifest: previousFile, manifest_sha256: sha(previousFile), file: entry.file, sha256: entry.sha256, qa_file: entry.qa_file, qa_sha256: entry.qa_sha256, plan_files: entry.plan_files },
        followup: override || null };
});
const combined = [...(read(previous.bank_file) as QuestionSetV3[]).filter(set => !sets.some(candidate => candidate.id === set.id)), ...sets].sort((a, b) => a.id.localeCompare(b.id));
const validation = validateAuthoringBank(combined);
const totals = { sets: sets.length, questions: entries.reduce((n, entry) => n + entry.actual_questions, 0), points: entries.reduce((n, entry) => n + entry.points, 0), qa: entries.reduce((n, entry) => n + entry.qa_cases, 0) };
if (validation.errors.length || totals.sets !== 49 || totals.questions !== 131 || totals.points !== 433 || totals.qa !== 2389 || combined.length !== 153) throw Error(JSON.stringify({ totals, errors: validation.errors }));
const manifest = { created_at: new Date().toISOString(), purpose: 'fixed_comparison_bank', bank_file: previous.bank_file, bank_sha256: previous.bank_sha256,
    predecessor: { file: previousFile, sha256: sha(previousFile) }, overrides: { file: overridesFile, sha256: sha(overridesFile) },
    planned_sets: 49, planned_questions: 131, collected_sets: totals.sets, collected_questions: totals.questions, collected_points: totals.points,
    comparison_sets: combined.length, author_qa_cases: totals.qa, errors: [], validation, entries };
fs.mkdirSync(output);
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
write('manifest.json', manifest);
write('comparison-bank.json', combined);
fs.writeFileSync(path.join(output, 'comparison-bank.sha256'), sha(path.join(output, 'comparison-bank.json')) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, ...totals, bank_sha256: sha(path.join(output, 'comparison-bank.json')), errors: 0 }));
