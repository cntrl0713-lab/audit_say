import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import { publicGradeResult, publicLeaderboard, safeInteger } from './learningPublic';
import { UUID_PATTERN } from './learningSubmission';
import type { SubmissionClaims } from './learningSubmission';
import type { AttemptHistoryCursor, AttemptHistoryItem, ReviewItem, ReviewItemStatus, RankingPeriod } from './learningTypes';
import type { QuestionSetGradeResultV3, QuestionSetJudgmentV3 } from './questionV3Grading';

export async function learningRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await getSupabaseAdmin().rpc(name, args);
    if (error) {
        // Do not log Postgres detail: it can contain rejected answer or rubric data.
        console.error(`[learning] ${name} failed (${error.code || 'unknown'})`);
        throw new Error('학습 기록을 처리하지 못했습니다. 같은 제출로 다시 시도해 주세요.');
    }
    return data as T;
}

export interface StoredAttemptResult {
    attempt_id: string;
    status: 'queued' | 'grading' | 'completed' | 'failed';
    submitted_at: string;
    completed_at: string | null;
    expires_at: string | null;
    result: QuestionSetGradeResultV3 | null;
}

export async function beginAttempt(claims: SubmissionClaims, answers: Record<string, string>) {
    return learningRpc<{ attempt_id: string; status: string; current_grading_run_id: string | null }>('cpa_begin_attempt', {
        p_payload: {
            owner_user_id: claims.owner_user_id, actor_kind: claims.actor_kind,
            membership_version: claims.membership_version,
            release_id: claims.release_id, set_id: claims.set_id, set_version_id: claims.set_version_id,
            submission_key: claims.submission_key, answers_hash: claims.answers_hash,
            submitted_at: claims.submitted_at, expires_at: claims.expires_at, answers,
            ...(claims.v === 2 ? { learning_unit_id: claims.learning_unit_id,
                selected_subquestion_ids: claims.selected_subquestion_ids, classification_version_ids: claims.classification_version_ids } : {}),
        },
    });
}

export async function findAttemptForSubmission(owner: string, key: string): Promise<string | null> {
    const { data, error } = await getSupabaseAdmin().from('cpa_attempts').select('id')
        .eq('owner_user_id', owner).eq('submission_key', key).maybeSingle();
    if (error) throw new Error('제출 기록을 확인하지 못했습니다.');
    return data?.id ?? null;
}

export async function getAttemptResult(owner: string, id: string): Promise<StoredAttemptResult | null> {
    if (!UUID_PATTERN.test(id)) throw new Error('풀이 기록 식별자가 올바르지 않습니다.');
    const data = await learningRpc<StoredAttemptResult | null>('cpa_get_attempt_result', { p_attempt_id: id, p_owner_user_id: owner });
    if (!data) return null;
    return {
        attempt_id: data.attempt_id, status: data.status, submitted_at: data.submitted_at,
        completed_at: data.completed_at, expires_at: data.expires_at,
        result: data.result == null ? null : publicGradeResult(data.result),
    };
}

export type GradingClaim =
    | { state: 'claimed'; run_id: string; lease_token: string }
    | { state: 'completed' }
    | { state: 'busy' };

export async function claimGradingRun(owner: string, attempt: string, metadata: Record<string, unknown>) {
    return learningRpc<GradingClaim>('cpa_claim_grading_run', { p_attempt_id: attempt, p_owner_user_id: owner, p_metadata: metadata });
}

export async function completeGradingRun(owner: string, attempt: string, run: string, lease: string, result: QuestionSetGradeResultV3, rawJudgment?: QuestionSetJudgmentV3) {
    const saved = await learningRpc<StoredAttemptResult>('cpa_complete_grading_run', {
        p_attempt_id: attempt, p_owner_user_id: owner, p_run_id: run, p_lease_token: lease,
        p_result: { ...result, ...(rawJudgment ? { raw_judgment: rawJudgment } : {}) },
    });
    if (!saved.result) throw new Error('채점 결과 저장이 완료되지 않았습니다.');
    return { ...saved, result: publicGradeResult(saved.result) };
}

export async function failGradingRun(owner: string, attempt: string, run: string, lease: string, code: string) {
    await learningRpc('cpa_fail_grading_run', { p_attempt_id: attempt, p_owner_user_id: owner, p_run_id: run, p_lease_token: lease, p_error_code: code });
}

export async function getAttemptHistory(owner: string, cursor?: AttemptHistoryCursor): Promise<AttemptHistoryItem[]> {
    const values = await learningRpc<AttemptHistoryItem[]>('cpa_get_attempt_history', {
        p_owner_user_id: owner, p_limit: 50, p_before: cursor?.submitted_at ?? null, p_before_id: cursor?.id ?? null,
    });
    return values.map((entry) => ({
        id: entry.id, question_set_id: entry.question_set_id, title: entry.title,
        submitted_at: entry.submitted_at, status: entry.status, expires_at: entry.expires_at,
        score: entry.score === null ? null : safeInteger(entry.score), max_points: safeInteger(entry.max_points),
    }));
}

export async function getReviewItems(owner: string, status: ReviewItemStatus): Promise<ReviewItem[]> {
    const values = await learningRpc<ReviewItem[]>('cpa_get_review_items', { p_owner_user_id: owner, p_status: status });
    return values.map((entry) => ({
        id: entry.id, subquestion_id: entry.subquestion_id, question_set_id: entry.question_set_id,
        title: entry.title, prompt: entry.prompt, status: entry.status, memo: entry.memo,
        updated_at: entry.updated_at, last_attempt_id: entry.last_attempt_id, last_failed_attempt_id: entry.last_failed_attempt_id,
    }));
}

export async function updateReviewItem(owner: string, subquestion: string, status: ReviewItemStatus, memo: string | undefined, membershipVersion: number) {
    return learningRpc('cpa_update_review_item', {
        p_owner_user_id: owner, p_subquestion_id: subquestion, p_status: status, p_memo: memo ?? null,
        p_membership_version: membershipVersion,
    });
}

export async function getPeriodLeaderboard(period: RankingPeriod) {
    return publicLeaderboard(await learningRpc('cpa_get_leaderboard', { p_period: period }));
}
