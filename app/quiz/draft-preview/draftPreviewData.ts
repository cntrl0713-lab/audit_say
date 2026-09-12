import 'server-only';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import type { QuestionSetV3 } from '../../../lib/questionV3';

export type QuestionStyle = 'standard' | 'case';
export const styleLabels: Record<QuestionStyle, string> = { standard: '기준서형', case: '사례형' };
type StyleEntry = { set_id: string; subquestion_id: string; style: QuestionStyle; reason: string; mixed: boolean; topic_ids: string[]; display_number: number };
type ManifestEntry = { set_id: string; plan_id: string; file: string; sha256: string };
export type LearningGroup = { source_set_id: string; style: QuestionStyle; topic_ids: string[]; shared_context: QuestionSetV3['shared_context']; subquestions: QuestionSetV3['subquestions']; max_points: number };
export type PreviewSet = { entry: ManifestEntry; set: QuestionSetV3; styles: StyleEntry[]; groups: LearningGroup[]; topic_order: string[] };
type SourceStyleEntry = Omit<StyleEntry, 'topic_ids'> & { question_file: string; question_sha256: string; standalone_prompt: string | null };
type ClassificationEntry = {
    set_id: string; subquestion_id: string; question_style: QuestionStyle; topic_ids: string[];
    reason: string; case_fact_ids: string[]; standalone_prompt: string | null; question_file: string; question_sha256: string;
};
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const manifestFile = `${control}/final-153-style-v2/manifest.json`;
const styleFile = `${control}/question-style-v2/index.json`;
const classificationFile = 'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/draft-classification.json';
const classificationSha256 = '0c5386f1416ed14206a7724e20f8e00c38724b3ddf5fcf447845bcad3a14f498';
const hash = (text: string) => crypto.createHash('sha256').update(text).digest('hex');

export async function loadDraftPreviewData(): Promise<PreviewSet[]> {
    if (process.env.NODE_ENV !== 'development') return [];
    const [manifestText, stylesText, classificationText] = await Promise.all([
        fs.readFile(path.join(process.cwd(), manifestFile), 'utf8'),
        fs.readFile(path.join(process.cwd(), styleFile), 'utf8'),
        fs.readFile(path.join(process.cwd(), classificationFile), 'utf8'),
    ]);
    if (hash(classificationText) !== classificationSha256) throw new Error('확인한 초안 분류의 내용이 변경되었습니다.');
    const manifest = JSON.parse(manifestText) as { entries: ManifestEntry[] };
    const index = JSON.parse(stylesText) as { manifest_sha256: string; topic_order: string[]; entries: SourceStyleEntry[] };
    const classification = JSON.parse(classificationText) as {
        source_manifest: { file: string; sha256: string }; source_index: { file: string; sha256: string };
        topic_order: string[]; entries: ClassificationEntry[];
    };
    if (classification.source_manifest.file !== manifestFile || classification.source_index.file !== styleFile
        || hash(manifestText) !== classification.source_manifest.sha256 || hash(stylesText) !== classification.source_index.sha256
        || index.manifest_sha256 !== classification.source_manifest.sha256
        || JSON.stringify(index.topic_order) !== JSON.stringify(classification.topic_order)) {
        throw new Error('초안·원분류 색인·물음별 주제의 버전이 다릅니다.');
    }
    const key = (row: { set_id: string; subquestion_id: string }) => `${row.set_id}/${row.subquestion_id}`;
    const byQuestion = new Map(classification.entries.map(row => [key(row), row]));
    const sourceStyles = new Map(index.entries.map(row => [key(row), row]));
    if (byQuestion.size !== classification.entries.length || sourceStyles.size !== index.entries.length
        || byQuestion.size !== sourceStyles.size || new Set(manifest.entries.map(entry => entry.set_id)).size !== manifest.entries.length) {
        throw new Error('초안 물음 또는 분류가 중복되거나 누락되었습니다.');
    }
    const sortTopics = (topics: string[]) => [...new Set(topics)]
        .sort((a, b) => classification.topic_order.indexOf(a) - classification.topic_order.indexOf(b));
    const data = await Promise.all(manifest.entries.map(async entry => {
        const text = await fs.readFile(path.join(process.cwd(), entry.file), 'utf8');
        if (hash(text) !== entry.sha256) throw new Error('선택한 초안의 내용이 변경되었습니다.');
        const raw = JSON.parse(text) as QuestionSetV3 | QuestionSetV3[];
        const set = Array.isArray(raw) ? raw.find(set => set.id === entry.set_id) : raw;
        if (!set || set.id !== entry.set_id) throw new Error('선택한 초안을 찾을 수 없습니다.');
        if (new Set(set.subquestions.map(sub => sub.id)).size !== set.subquestions.length
            || set.learning_order.length !== set.subquestions.length || new Set(set.learning_order).size !== set.subquestions.length
            || set.subquestions.some(sub => !set.learning_order.includes(sub.id))) throw new Error('초안 물음 순서가 올바르지 않습니다.');
        const questions = [...set.subquestions].sort((a, b) => set.learning_order.indexOf(a.id) - set.learning_order.indexOf(b.id));
        const selected: StyleEntry[] = questions.map(sub => {
            const id = `${set.id}/${sub.id}`;
            const row = byQuestion.get(id);
            const prior = sourceStyles.get(id);
            if (!row || !prior || !['case', 'standard'].includes(row.question_style)
                || row.question_style !== prior.style || row.question_file !== entry.file || row.question_sha256 !== entry.sha256
                || prior.question_file !== entry.file || prior.question_sha256 !== entry.sha256
                || row.standalone_prompt !== prior.standalone_prompt
                || !row.topic_ids.length || new Set(row.topic_ids).size !== row.topic_ids.length
                || row.topic_ids.some(topic => !classification.topic_order.includes(topic))
                || row.case_fact_ids.some(id => !set.shared_context.facts.some(fact => fact.id === id))) {
                throw new Error('물음별 유형·주제·원문 연결이 올바르지 않습니다.');
            }
            if (row.question_style === 'standard'
                ? !row.standalone_prompt?.trim() || row.standalone_prompt !== sub.prompt || row.case_fact_ids.length > 0
                : row.standalone_prompt !== null || set.shared_context.facts.length === 0) {
                throw new Error('기준서형 독립 발문 또는 사례형 부모 사실이 올바르지 않습니다.');
            }
            return { set_id: set.id, subquestion_id: sub.id, style: row.question_style, reason: row.reason,
                mixed: prior.mixed, topic_ids: sortTopics(row.topic_ids), display_number: prior.display_number };
        });
        // Historical learning-groups.json remains unchanged. Build current units from checked sources.
        const groups: LearningGroup[] = [];
        for (const sub of questions) {
            const row = selected.find(row => row.subquestion_id === sub.id)!;
            if (row.style === 'standard') groups.push({ source_set_id: set.id, style: 'standard', topic_ids: row.topic_ids,
                shared_context: { facts: [] }, subquestions: [sub], max_points: questionPoints(sub) });
        }
        const cases = questions.filter(sub => selected.find(row => row.subquestion_id === sub.id)!.style === 'case');
        if (cases.length) groups.push({ source_set_id: set.id, style: 'case',
            topic_ids: sortTopics(selected.filter(row => row.style === 'case').flatMap(row => row.topic_ids)),
            shared_context: set.shared_context, subquestions: cases, max_points: cases.reduce((sum, sub) => sum + questionPoints(sub), 0) });
        return { entry, set, styles: selected, groups, topic_order: classification.topic_order };
    }));
    if (data.reduce((sum, item) => sum + item.styles.length, 0) !== byQuestion.size) throw new Error('원문에 없는 물음 분류가 포함되어 있습니다.');
    const firstTopic = (item: PreviewSet) => Math.min(...item.styles.flatMap(row => row.topic_ids.map(topic => classification.topic_order.indexOf(topic))));
    return data.sort((a, b) => firstTopic(a) - firstTopic(b) || a.entry.plan_id.localeCompare(b.entry.plan_id));
}

export const questionPoints = (question: QuestionSetV3['subquestions'][number]) =>
    question.criteria.reduce((sum, criterion) => sum + criterion.max_points, 0);

export function previewHref(setId: string, group: LearningGroup, topic?: string): string {
    const query = new URLSearchParams({ set: setId, style: group.style });
    if (group.style === 'standard') query.set('sub', group.subquestions[0].id);
    if (topic) query.set('topic', topic);
    return `/quiz/draft-preview?${query}`;
}
