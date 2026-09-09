import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import { validateQuestionSetV3 } from './questionV3';
import type { QuestionSetV3 } from './questionV3';
import { loadPublicQuestionSetsV3 } from './questionV3Store';
import { learningDbEnabled, UUID_PATTERN } from './learningSubmission';
import { publicLearningSet } from './learningPublic';
import type { PublicLearningQuestionSetV3 } from './learningTypes';

export async function loadLearningQuestionSetsV3(): Promise<PublicLearningQuestionSetV3[]> {
    if (!learningDbEnabled()) return loadPublicQuestionSetsV3();
    const { data, error } = await getSupabaseAdmin().rpc('cpa_get_active_question_bank');
    if (error) throw new Error(`문제은행 DB 조회 실패 (${error.code || 'unknown'})`);
    if (!Array.isArray(data) || data.length === 0) throw new Error('게시된 DB 문제은행이 없습니다.');
    return data.map(publicLearningSet);
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
