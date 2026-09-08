import { createHash } from 'node:crypto';
import { assertBoundAnswers, contentHash, verifySubmissionToken } from './learningSubmission.ts';
import type { SubmissionClaims } from './learningSubmission.ts';
import { buildGradingPrompt, gradingModelName } from './questionV3Grading.ts';
import type { QuestionSetV3 } from './questionV3.ts';
import type { QuestionSetGradeResultV3, QuestionSetJudgmentV3 } from './questionV3Grading.ts';
import type { GradingClaim, StoredAttemptResult } from './learningRepository.ts';
import type { AttemptResultActionResult } from './learningTypes.ts';

export interface LearningServiceDependencies {
    signingKeys: string[];
    apiKey: string;
    now?: () => number;
    loadSet: (release: string, version: string) => Promise<QuestionSetV3>;
    findAttempt: (owner: string, key: string) => Promise<string | null>;
    begin: (claims: SubmissionClaims, answers: Record<string, string>) => Promise<{ attempt_id: string }>;
    readResult: (owner: string, attempt: string) => Promise<StoredAttemptResult | null>;
    claim: (owner: string, attempt: string, metadata: Record<string, unknown>) => Promise<GradingClaim>;
    complete: (owner: string, attempt: string, run: string, lease: string, result: QuestionSetGradeResultV3, raw?: QuestionSetJudgmentV3) => Promise<StoredAttemptResult>;
    fail: (owner: string, attempt: string, run: string, lease: string, code: string) => Promise<void>;
    consumeQuota: (owner: string) => Promise<boolean>;
    consumeSubmissionQuota: (owner: string) => Promise<boolean>;
    grade: (set: QuestionSetV3, answers: Record<string, string>, key: string, onJudgment?: (judgment: QuestionSetJudgmentV3) => void) => Promise<QuestionSetGradeResultV3>;
}

const failure = (code: string, message: string): AttemptResultActionResult => ({ ok: false, code, message });
function success(saved: StoredAttemptResult | null): AttemptResultActionResult | null {
    return saved?.status === 'completed' && saved.result
        ? { ok: true, result: saved.result, attempt_id: saved.attempt_id } : null;
}

/** Owns orchestration only; score calculations stay in the existing criterion engine. */
export async function gradeLearningSubmission(
    owner: string,
    questionSetId: string,
    token: unknown,
    input: unknown,
    deps: LearningServiceDependencies,
): Promise<AttemptResultActionResult> {
    const now = (deps.now ?? Date.now)();
    let claims: SubmissionClaims;
    try { claims = verifySubmissionToken(token, owner, deps.signingKeys, now); }
    catch { return failure('submission_invalid', '제출 정보를 확인할 수 없습니다. 풀이 기록을 확인한 뒤 다시 제출해 주세요.'); }
    if (claims.set_id !== questionSetId) return failure('submission_conflict', '다른 문제의 제출 정보입니다.');
    if (claims.expires_at !== null && now >= Date.parse(claims.expires_at)) {
        return failure('submission_expired', '비회원 풀이 기록의 7일 보관기간이 지났습니다.');
    }
    let set: QuestionSetV3;
    let answers: Record<string, string>;
    let attempt: string;
    try {
        set = await deps.loadSet(claims.release_id, claims.set_version_id);
        answers = assertBoundAnswers(claims, set, input);
        const existing = await deps.findAttempt(owner, claims.submission_key);
        if (!existing && now >= Date.parse(claims.accept_until)) return failure('submission_expired', '제출 준비 정보가 만료되었습니다. 새 제출로 요청해 주세요.');
        if (!existing && !await deps.consumeSubmissionQuota(owner)) return failure('rate_limited', '제출 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
        attempt = existing ?? (await deps.begin(claims, answers)).attempt_id;
        const stored = success(await deps.readResult(owner, attempt));
        if (stored) return stored;
    } catch {
        return failure('submission_unavailable', '문제 버전·답안·제출 기록을 확인하지 못했습니다. 답안을 변경했다면 새 제출로 요청해 주세요.');
    }

    const blank = set.subquestions.every((subquestion) => !answers[subquestion.id].trim());
    const metadata = {
        engine_version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.CPA_GRADING_ENGINE_VERSION || 'v3-db-20260908',
        grading_contract_hash: contentHash(set.subquestions.map(({ id, criteria, selection, constraints }) => ({ id, criteria, selection, constraints }))),
        prompt_hash: blank ? null : createHash('sha256').update(buildGradingPrompt(set, answers)).digest('hex'),
        provider: blank ? null : 'openai', model: blank ? null : gradingModelName(),
    };
    let claimed: GradingClaim;
    try { claimed = await deps.claim(owner, attempt, metadata); }
    catch { return failure('persistence_unavailable', '제출 저장 준비를 완료하지 못했습니다. 같은 제출로 다시 시도해 주세요.'); }
    if (claimed.state === 'completed') {
        try { return success(await deps.readResult(owner, attempt)) ?? failure('persistence_unavailable', '저장된 결과를 다시 불러와 주세요.'); }
        catch { return failure('persistence_unavailable', '저장된 결과를 다시 불러와 주세요.'); }
    }
    if (claimed.state === 'busy') return failure('submission_busy', '같은 제출을 처리 중입니다. 잠시 후 다시 확인해 주세요.');
    const { run_id: run, lease_token: lease } = claimed;
    const markFailed = async (code: string) => {
        try { await deps.fail(owner, attempt, run, lease, code); } catch { /* Lease expiry permits recovery without reporting a false completion. */ }
    };
    let result: QuestionSetGradeResultV3;
    let raw: QuestionSetJudgmentV3 | undefined;
    try {
        if (!blank && !deps.apiKey) { await markFailed('grading_key_missing'); return failure('grading_key_missing', 'AI 채점 서비스 설정이 누락되었습니다.'); }
        if (!blank && !await deps.consumeQuota(owner)) { await markFailed('rate_limited'); return failure('rate_limited', '채점 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'); }
        result = await deps.grade(set, answers, deps.apiKey, (judgment) => { raw = judgment; });
    } catch {
        await markFailed('grading_service_unavailable');
        return failure('grading_service_unavailable', 'AI 채점 서비스 호출에 실패했습니다. 같은 제출로 다시 시도해 주세요.');
    }
    // Retrying finalization is safe even if the first commit succeeded but its response was lost.
    for (let retry = 0; retry < 2; retry++) {
        try { return success(await deps.complete(owner, attempt, run, lease, result, raw))
            ?? failure('persistence_unavailable', '채점 결과 저장이 아직 완료되지 않았습니다.'); }
        catch {
            try { const saved = success(await deps.readResult(owner, attempt)); if (saved) return saved; }
            catch { /* Keep the submission key and lease; do not grant progress outside the transaction. */ }
        }
    }
    return failure('persistence_unavailable', '채점 결과 저장을 확인하지 못했습니다. 같은 제출로 다시 확인해 주세요.');
}
