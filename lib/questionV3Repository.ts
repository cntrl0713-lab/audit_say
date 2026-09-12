import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import { validateQuestionSetV3 } from './questionV3';
import type { QuestionSetV3 } from './questionV3';
import { loadPublicQuestionSetsV3 } from './questionV3Store';
import { learningDbEnabled, UUID_PATTERN } from './learningSubmission';
import { publicLearningSet } from './learningPublic';
import type { PublicLearningQuestionSetV3 } from './learningTypes';
import { buildLearningUnits, learningUnitId, selectLearningQuestionSet, validateLearningClassification } from './learningUnits';
import type { LearningClassification, LearningTopic } from './learningUnits';
import { loadFileLearningUnits } from './learningUnitStore';

export async function loadLearningQuestionSetsV3(): Promise<PublicLearningQuestionSetV3[]> {
    if (!learningDbEnabled()) return loadFileLearningUnits(loadPublicQuestionSetsV3());
    const { data, error } = await getSupabaseAdmin().rpc('cpa_get_active_question_bank');
    if (error) throw new Error(`문제은행 DB 조회 실패 (${error.code || 'unknown'})`);
    if (!Array.isArray(data) || data.length === 0) throw new Error('게시된 DB 문제은행이 없습니다.');
    const sets = data.map(publicLearningSet);
    if (new Set(sets.map(set => set.release_id)).size !== 1) throw new Error('문제은행 릴리스가 일치하지 않습니다.');
    const [classifications, topics] = await Promise.all([
        readDatabaseClassifications(sets[0].release_id!), readLearningTopics(),
    ]);
    return buildLearningUnits(sets, classifications, topics);
}

async function readLearningTopics(): Promise<LearningTopic[]> {
    const { data, error } = await getSupabaseAdmin().from('cpa_learning_topics').select('id,title,part,position').order('position');
    if (error || !Array.isArray(data) || data.length === 0) throw new Error('물음별 주제 목록을 읽을 수 없습니다.');
    return data.map(topic => {
        if (typeof topic.id !== 'string' || typeof topic.title !== 'string' || typeof topic.part !== 'string'
            || !Number.isSafeInteger(topic.position)) throw new Error('물음별 주제 형식이 올바르지 않습니다.');
        return { id: topic.id, title: topic.title, part: topic.part, position: topic.position };
    });
}

export async function readDatabaseClassifications(releaseId: string, ids?: string[]): Promise<LearningClassification[]> {
    if (!UUID_PATTERN.test(releaseId) || ids && (ids.length < 1 || ids.length > 10
        || new Set(ids).size !== ids.length || ids.some(id => !UUID_PATTERN.test(id)))) throw new Error('물음 분류 판본 식별자가 올바르지 않습니다.');
    const { data, error } = await getSupabaseAdmin().rpc('cpa_get_learning_classifications', {
        p_release_id: releaseId, p_classification_version_ids: ids ?? null,
    });
    if (error || !Array.isArray(data)) throw new Error('물음 유형·주제 이관이 완료되지 않았거나 조회할 수 없습니다.');
    const entries = data.map(validateLearningClassification);
    if (!ids) return entries;
    if (entries.length !== ids.length || new Set(entries.map(entry => entry.classification_version_id)).size !== ids.length) {
        throw new Error('물음 분류 판본이 누락되었습니다.');
    }
    return ids.map(id => {
        const entry = entries.find(row => row.classification_version_id === id);
        if (!entry) throw new Error('다른 릴리스의 물음 판본입니다.');
        return entry;
    });
}

export async function findDatabaseLearningUnit(releaseId: string, versionId: string, classificationIds: string[], unitId: string, requireCompleteCurrentUnit = false): Promise<QuestionSetV3> {
    const [source, classifications] = await Promise.all([
        findDatabaseQuestionVersion(releaseId, versionId), readDatabaseClassifications(releaseId, classificationIds),
    ]);
    if (classifications.some(entry => entry.source_set_version_id !== versionId)) throw new Error('학습 물음의 원본 판본이 다릅니다.');
    if (requireCompleteCurrentUnit) {
        const all = await readDatabaseClassifications(releaseId);
        const expected = all.filter(entry => entry.source_set_version_id === versionId
            && learningUnitId(entry.source_set_id, entry.question_style, entry.subquestion_id) === unitId);
        if (expected.length !== classifications.length || expected.some(entry => !classificationIds.includes(entry.classification_version_id))) {
            throw new Error('현재 사례의 모든 물음 또는 기준서형 한 물음을 선택해야 합니다. 목록을 새로 불러와 주세요.');
        }
    }
    return selectLearningQuestionSet(source, classifications, unitId);
}

export async function findDatabaseQuestionVersion(releaseId: string, versionId: string): Promise<QuestionSetV3> {
    if (![releaseId, versionId].every((id) => UUID_PATTERN.test(id))) throw new Error('문제 버전 식별자가 올바르지 않습니다.');
    const client = getSupabaseAdmin();
    const { data: release, error: releaseError } = await client.from('cpa_question_bank_releases')
        .select('status').eq('id', releaseId).in('status', ['active', 'retired']).maybeSingle();
    if (releaseError || !release) throw new Error('게시된 문제은행 릴리스를 찾을 수 없습니다.');
    const { data: item, error: itemError } = await client.from('cpa_question_bank_release_items')
        .select('set_id').eq('release_id', releaseId).eq('set_version_id', versionId).maybeSingle();
    if (itemError || !item) throw new Error('문제가 해당 릴리스에 속하지 않습니다.');
    const { data, error } = await client.rpc('cpa_get_question_version', { p_version_id: versionId });
    if (error || !data) throw new Error('저장된 문제 버전을 읽을 수 없습니다.');
    // This version has already been bound to an immutable published release above.
    // Preserve its historical metadata; new authoring/imports use the strict default.
    const validated = validateQuestionSetV3(data, { verifySourceQuotes: false, allowStoredAnswerConstraints: true });
    if (validated.errors.length > 0) throw new Error('저장된 문제 버전의 계약이 올바르지 않습니다.');
    const set = data as QuestionSetV3;
    if (set.id !== item.set_id) throw new Error('저장된 문제 버전의 소속이 올바르지 않습니다.');
    return set;
}
