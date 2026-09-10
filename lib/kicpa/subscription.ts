import { KICPA_BOARDS, type KicpaBoard } from './types.ts';

/** Keep consent wording, saved version, and the delivery eligibility version in sync. */
export const JOBS_CONSENT_VERSION = '2026-09-09-v1';
export const JOBS_CONSENT_TEXT = '선택한 게시판 조건에 맞는 신규 수습·신입 CPA 채용공고를 카카오 알림톡으로 반복 안내받는 데 동의합니다. 공고 한 건당 1회 안내하며, 여러 공고가 등록되면 각각 안내합니다. 언제든 이 설정에서 수신 희망을 해제하거나 설정을 삭제해 중단할 수 있습니다. 실제 발송은 서비스 준비 후 휴대전화 인증을 완료해야 시작됩니다.';
export const JOBS_PREPARING_MESSAGE = '현재는 알림 수신 희망과 게시판 선택만 저장합니다. 실제 발송은 서비스 준비 후 휴대전화 인증을 완료해야 시작됩니다.';
export const JOBS_BOARD_LABELS: Record<KicpaBoard, string> = {
    trainee_cpa: '수습CPA 게시판의 전체 공고',
    cpa: 'CPA 게시판에서 제목에 ‘수습’ 또는 ‘신입’이 포함된 공고',
};

export interface JobsSubscriptionStatus {
    saved: boolean;
    active: boolean;
    boards: KicpaBoard[];
    consentRequired: boolean;
    deliveryStatus: 'preparing';
}

export interface JobsSubscriptionProjection {
    is_active: boolean;
    boards: KicpaBoard[];
    consent_version: string | null;
    consented_at: string | null;
}

export interface JobsSubscriptionInput {
    active: boolean;
    boards: KicpaBoard[];
    consent: boolean;
}

export class SubscriptionValidationError extends Error {}

export function parseSubscriptionInput(body: unknown): JobsSubscriptionInput {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SubscriptionValidationError('invalid_request');
    const value = body as Record<string, unknown>;
    if (Object.keys(value).length !== 3 || typeof value.active !== 'boolean' || typeof value.consent !== 'boolean'
        || !Array.isArray(value.boards) || value.boards.length < 1 || value.boards.length > KICPA_BOARDS.length
        || value.boards.some((board) => !KICPA_BOARDS.includes(board)) || new Set(value.boards).size !== value.boards.length) {
        throw new SubscriptionValidationError('invalid_request');
    }
    const boards = value.boards as KicpaBoard[];
    return { active: value.active, consent: value.consent, boards: KICPA_BOARDS.filter((board) => boards.includes(board)) };
}

export function hasCurrentJobsConsent(row: JobsSubscriptionProjection | null, now = Date.now()): boolean {
    const consentedAt = row?.consented_at ? Date.parse(row.consented_at) : NaN;
    return row?.consent_version === JOBS_CONSENT_VERSION && Number.isFinite(consentedAt) && consentedAt <= now;
}

/** No phone fields are selected or returned, including verification timestamps. */
export function jobsSubscriptionStatus(row: JobsSubscriptionProjection | null, now = Date.now()): JobsSubscriptionStatus {
    return {
        saved: row !== null,
        active: row?.is_active === true,
        boards: row ? KICPA_BOARDS.filter((board) => row.boards.includes(board)) : [...KICPA_BOARDS],
        consentRequired: !hasCurrentJobsConsent(row, now),
        deliveryStatus: 'preparing',
    };
}

export function subscriptionWrite(input: JobsSubscriptionInput, row: JobsSubscriptionProjection | null,
    now = Date.now()) {
    const consentRequired = !hasCurrentJobsConsent(row, now);
    if (input.active && consentRequired && !input.consent) throw new SubscriptionValidationError('consent_required');
    const timestamp = new Date(now).toISOString();
    const boardsChanged = row && (row.boards.length !== input.boards.length || input.boards.some((board) => !row.boards.includes(board)));
    return {
        is_active: input.active,
        boards: input.boards,
        consent_version: input.consent ? JOBS_CONSENT_VERSION : row?.consent_version ?? null,
        consented_at: input.consent ? timestamp : row?.consented_at ?? null,
        updated_at: timestamp,
        // Resuming, renewing consent or changing active filters cannot revive an old queue.
        ...((!row || (input.active && (!row.is_active || consentRequired || boardsChanged))) ? { notifications_since: timestamp } : {}),
    };
}

/** Missing/null/sibling origins are not sufficient authorization for a cookie-authenticated mutation. */
export function isSameOrigin(request: Request): boolean {
    const origin = new URL(request.url).origin;
    return request.headers.get('origin') === origin
        && !['cross-site', 'none'].includes(request.headers.get('sec-fetch-site') ?? '');
}
