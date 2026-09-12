export interface SubmissionSession {
    release_id: string;
    set_version_id: string;
    learning_unit_id?: string;
    classification_version_ids?: string[];
    submission_token: string;
    answers: Record<string, string>;
    saved_at: number;
    attempt_id?: string;
    completed?: boolean;
}

export function submissionSessionKey(userId: string, questionSetId: string): string {
    return `cpa-v3-submission:${encodeURIComponent(userId)}:${encodeURIComponent(questionSetId)}`;
}

/** User-authorized retirement of full-set drafts, scoped to this owner and known source IDs only. */
export function retireLegacySubmissionSessions(storage: Pick<Storage, 'getItem' | 'removeItem'>, userId: string, sourceIds: string[]): number {
    let removed = 0;
    for (const sourceId of new Set(sourceIds)) {
        const key = submissionSessionKey(userId, sourceId);
        const raw = storage.getItem(key);
        if (raw === null) continue;
        const session = parseSubmissionSession(raw);
        if (!session || session.learning_unit_id === undefined) { storage.removeItem(key); removed++; }
    }
    return removed;
}

export function sameSubmissionAnswers(left: Record<string, string>, right: Record<string, string>): boolean {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

/** A new bank release may reuse the same immutable question version. */
export function canResumeSubmissionVersion(saved: SubmissionSession, current: { release_id?: string; set_version_id?: string; learning_unit_id?: string; classification_version_ids?: string[] }): boolean {
    return saved.set_version_id === current.set_version_id && saved.learning_unit_id === current.learning_unit_id
        && JSON.stringify(saved.classification_version_ids) === JSON.stringify(current.classification_version_ids);
}

export function parseSubmissionSession(raw: string | null, now = Date.now()): SubmissionSession | null {
    if (!raw) return null;
    try {
        const value = JSON.parse(raw) as Partial<SubmissionSession>;
        if (!value || typeof value !== 'object'
            || typeof value.release_id !== 'string' || typeof value.set_version_id !== 'string'
            || typeof value.submission_token !== 'string' || !value.submission_token
            || (value.learning_unit_id !== undefined && typeof value.learning_unit_id !== 'string')
            || (value.classification_version_ids !== undefined && (!Array.isArray(value.classification_version_ids)
                || value.classification_version_ids.length === 0 || value.classification_version_ids.some(id => typeof id !== 'string')))
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
