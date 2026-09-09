import fs from 'node:fs';
import path from 'node:path';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { validateQuestionAuthoringPlan } from './questionAuthoringPlan.ts';

export function readQuestionBank(root = process.cwd()): QuestionSetV3[] {
    const file = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(raw)) throw new Error(`문제은행 루트는 배열이어야 합니다: ${file}`);
    return raw as QuestionSetV3[];
}

export function draftConflicts(drafts: QuestionSetV3[], existing: QuestionSetV3[] = []): string[] {
    const ids = new Set(existing.map((set) => set.id));
    const prompts = new Map(existing.flatMap((set) => (set.subquestions ?? []).map((q) => [
        q.prompt.replace(/\s+/gu, '').toLowerCase(), `${set.id}/${q.id}`,
    ])));
    const errors: string[] = [];
    for (const set of drafts) {
        if (ids.has(set.id)) errors.push(`[${set.id}] 기존 은행 또는 draft 배치에 이미 존재하는 세트 id입니다.`);
        ids.add(set.id);
        for (const q of set.subquestions ?? []) {
            if (typeof q.prompt !== 'string') continue;
            const key = q.prompt.replace(/\s+/gu, '').toLowerCase();
            const owner = prompts.get(key);
            if (owner) errors.push(`[${set.id}/${q.id}] 발문이 기존 ${owner}와 중복됩니다.`);
            else prompts.set(key, `${set.id}/${q.id}`);
        }
    }
    return errors;
}

export function allocateQuestionSetId(topicId: string, existing: Iterable<string>): string {
    if (!/^\d{2}$/u.test(topicId)) throw new Error('주제 ID는 두 자리 문자열이어야 합니다.');
    const ids = new Set(existing);
    const prefix = `pilot-${topicId}-`;
    let sequence = 1;
    for (const id of ids) {
        if (!id.startsWith(prefix)) continue;
        const suffix = id.slice(prefix.length);
        if (/^\d+$/u.test(suffix)) sequence = Math.max(sequence, Number(suffix) + 1);
    }
    if (!Number.isSafeInteger(sequence)) throw new Error('새 세트 ID 일련번호가 범위를 벗어났습니다.');
    return `${prefix}${String(sequence).padStart(3, '0')}`;
}

export function readPendingDrafts(root = process.cwd(), extraDirectory?: string, excludedFiles: string[] = []): QuestionSetV3[] {
    const excluded = new Set(excludedFiles.map((file) => path.resolve(file).toLowerCase()));
    const files = new Set<string>();
    const visit = (directory: string): void => {
        if (!fs.existsSync(directory)) return;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(file);
            else if (entry.name.endsWith('.json')
                && !/^cpa_question_sets_v3\.(?:authoring|public|promotions)\.json$/u.test(entry.name)
                && !excluded.has(path.resolve(file).toLowerCase())) files.add(file);
        }
    };
    visit(path.join(root, 'cpa_uploader/data'));
    if (extraDirectory) visit(extraDirectory);
    return [...files].sort().flatMap((file) => {
        const namedDraft = /draft|checkpoint/iu.test(path.basename(file));
        let raw: unknown;
        try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {
            if (namedDraft) throw error;
            return [];
        }
        // These audit artifacts describe a draft; they are not additional question sets.
        const possiblePlans = Array.isArray(raw) ? raw : [raw];
        if (possiblePlans.length > 0 && possiblePlans.every(value => validateQuestionAuthoringPlan(value, false).length === 0)) return [];
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
            const artifact = raw as Record<string, unknown>;
            if (artifact.version === 1 && artifact.artifact_type === 'question_authoring_plan' && Array.isArray(artifact.plans)) return [];
            if (artifact.version === 1 && artifact.artifact_type === 'question_source_packet' && Array.isArray(artifact.packets)) return [];
            if (artifact.schema_version === '1.0' && Array.isArray(artifact.reviews)) return [];
        }
        const sets = Array.isArray(raw) ? raw : typeof raw === 'object' && raw !== null && 'sets' in raw
            ? (raw as { sets: unknown }).sets : [raw];
        if (!Array.isArray(sets) || sets.some((set) => typeof set !== 'object' || set === null || typeof set.id !== 'string' || !Array.isArray(set.subquestions))) {
            if (!namedDraft) return [];
            throw new Error(`draft/checkpoint 형식이 올바르지 않습니다: ${file}`);
        }
        return sets as QuestionSetV3[];
    });
}
