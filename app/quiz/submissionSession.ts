export interface SubmissionSession {
    release_id: string;
    set_version_id: string;
    submission_token: string;
    answers: Record<string, string>;
    saved_at: number;
    attempt_id?: string;
    completed?: boolean;
}

export function submissionSessionKey(userId: string, questionSetId: string): string {
    return `cpa-v3-submission:${encodeURIComponent(userId)}:${encodeURIComponent(questionSetId)}`;
}

export function sameSubmissionAnswers(left: Record<string, string>, right: Record<string, string>): boolean {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

/** A new bank release may reuse the same immutable question version. */
export function canResumeSubmissionVersion(saved: SubmissionSession, current: { release_id?: string; set_version_id?: string }): boolean {
    return saved.set_version_id === current.set_version_id;
}

export function parseSubmissionSession(raw: string | null, now = Date.now()): SubmissionSession | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw) as Partial<SubmissionSession>;
        if (!value || typeof value !== 'object'
            || typeof value.release_id !== 'string' || typeof value.set_version_id !== 'string'
            || typeof value.submission_token !== 'string' || !value.submission_token
            || typeof value.saved_at !== 'number' || !Number.isFinite(value.saved_at)
            || value.saved_at > now || now - value.saved_at >= 7 * 24 * 60 * 60 * 1000
            || !value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers)
            || Object.entries(value.answers).length > 10
            || !Object.entries(value.answers).every(([key, answer]) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(key) && typeof answer === 'string' && answer.length <= 5000)
            || (value.attempt_id !== undefined && typeof value.attempt_id !== 'string')
            || (value.completed !== undefined && typeof value.completed !== 'boolean')) return null;
        return value as SubmissionSession;
    } catch {
        return null;
    }
}
