import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isQuestionSetAnswerPayloadV3 } from './questionV3.ts';
import type { QuestionSetV3 } from './questionV3.ts';

export const SUBMISSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SubmissionClaims {
    v: 1;
    owner_user_id: string;
    actor_kind: 'member' | 'guest';
    release_id: string;
    set_id: string;
    set_version_id: string;
    submission_key: string;
    answers_hash: string;
    submitted_at: string;
    accept_until: string;
    expires_at: string | null;
}

export function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
            .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
    }
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('직렬화할 수 없는 값입니다.');
    return encoded;
}

export function contentHash(value: unknown): string {
    return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function normalizeSubmissionAnswers(set: QuestionSetV3, input: unknown): Record<string, string> {
    if (!isQuestionSetAnswerPayloadV3(input)) throw new Error('답안 형식이나 길이가 올바르지 않습니다.');
    const allowed = new Set(set.subquestions.map((subquestion) => subquestion.id));
    if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error('문제에 속하지 않는 물음입니다.');
    return Object.fromEntries(set.subquestions.map((subquestion) => [subquestion.id, input[subquestion.id] ?? '']));
}

function signingKey(key: string): Buffer {
    if (Buffer.byteLength(key, 'utf8') < 32) throw new Error('제출 서명키는 32바이트 이상이어야 합니다.');
    return createHmac('sha256', key).update('audit-say:submission:v1').digest();
}

function signature(payload: string, key: string): Buffer {
    return createHmac('sha256', signingKey(key)).update(payload, 'ascii').digest();
}

export function submissionSigningKeys(): string[] {
    const current = process.env.CPA_SUBMISSION_SIGNING_KEY || process.env.CPA_QUESTION_V3_ENCRYPTION_KEY || '';
    signingKey(current);
    return [current, process.env.CPA_SUBMISSION_PREVIOUS_SIGNING_KEY].filter((key): key is string => Boolean(key));
}

export function issueSubmissionToken(input: {
    owner_user_id: string;
    actor_kind: 'member' | 'guest';
    release_id: string;
    set_version_id: string;
    questionSet: QuestionSetV3;
    answers: unknown;
}, key: string, now = Date.now()): string {
    for (const id of [input.owner_user_id, input.release_id, input.set_version_id]) {
        if (!UUID_PATTERN.test(id)) throw new Error('제출 식별자가 올바르지 않습니다.');
    }
    const answers = normalizeSubmissionAnswers(input.questionSet, input.answers);
    const acceptUntil = new Date(now + SUBMISSION_TTL_MS).toISOString();
    const claims: SubmissionClaims = {
        v: 1,
        owner_user_id: input.owner_user_id,
        actor_kind: input.actor_kind,
        release_id: input.release_id,
        set_id: input.questionSet.id,
        set_version_id: input.set_version_id,
        submission_key: randomUUID(),
        answers_hash: contentHash({ set_version_id: input.set_version_id, answers }),
        submitted_at: new Date(now).toISOString(),
        accept_until: acceptUntil,
        expires_at: input.actor_kind === 'guest' ? acceptUntil : null,
    };
    const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
    return `${payload}.${signature(payload, key).toString('base64url')}`;
}

/** Expiry is returned, not ignored: callers may read existing member history but never recreate expired claims. */
export function verifySubmissionToken(token: unknown, owner: string, keys: string[], now = Date.now()): SubmissionClaims {
    const invalid = () => new Error('유효하지 않은 제출 토큰입니다.');
    if (typeof token !== 'string' || token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw invalid();
    const [payload, encodedSignature] = token.split('.');
    const supplied = Buffer.from(encodedSignature, 'base64url');
    if (supplied.length !== 32 || !keys.some((key) => timingSafeEqual(signature(payload, key), supplied))) throw invalid();
    let claims: SubmissionClaims;
    try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SubmissionClaims; }
    catch { throw invalid(); }
    if (!claims || claims.v !== 1 || claims.owner_user_id !== owner
        || !['member', 'guest'].includes(claims.actor_kind)
        || ![claims.owner_user_id, claims.release_id, claims.set_version_id, claims.submission_key].every((id) => typeof id === 'string' && UUID_PATTERN.test(id))
        || typeof claims.set_id !== 'string' || !/^pilot-\d{2}-\d{3}$/.test(claims.set_id)
        || typeof claims.answers_hash !== 'string' || !/^[a-f0-9]{64}$/.test(claims.answers_hash)) throw invalid();
    const submitted = Date.parse(claims.submitted_at);
    const acceptUntil = Date.parse(claims.accept_until);
    if (!Number.isFinite(submitted) || acceptUntil !== submitted + SUBMISSION_TTL_MS || submitted > now + 60_000
        || (claims.actor_kind === 'guest' ? claims.expires_at !== claims.accept_until : claims.expires_at !== null)) throw invalid();
    return claims;
}

export function assertBoundAnswers(claims: SubmissionClaims, set: QuestionSetV3, input: unknown): Record<string, string> {
    const answers = normalizeSubmissionAnswers(set, input);
    if (set.id !== claims.set_id || contentHash({ set_version_id: claims.set_version_id, answers }) !== claims.answers_hash) {
        throw new Error('제출 후 답안이 변경되었습니다. 새 제출로 다시 요청해 주세요.');
    }
    return answers;
}

export function learningDbEnabled(): boolean {
    return process.env.CPA_LEARNING_DB_ENABLED === 'true';
}
