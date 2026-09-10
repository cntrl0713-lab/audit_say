export type AccountStatus = 'active' | 'locked' | 'deleting';
export type MembershipStatus = 'active' | 'suspended' | 'withdrawing' | 'withdrawn';
export type AccountRole = 'MEMBER' | 'PRO' | 'ADMIN';

export interface CommonProfile { id: string; nickname: string; account_status: AccountStatus }
export interface AuditMembership {
    id: string; membership_status: MembershipStatus; membership_version: number;
    is_service_admin: boolean; role: string; level: number; exp: number;
}
export interface AccountSnapshot {
    user: { id: string; email: string; nickname: string };
    accountStatus: AccountStatus;
    membership: { status: MembershipStatus; version: number; isAdmin: boolean; role: AccountRole } | null;
    entitlement: { kind: 'free' | 'pro'; expiresAt: string | null };
    progress: { level: number; exp: number };
    recoveryAllowed?: boolean;
}

export class AccountError extends Error {
    status: number;
    constructor(message: string, status = 400) { super(message); this.name = 'AccountError'; this.status = status; }
}

export function validateNickname(value: unknown): string {
    if (typeof value !== 'string' || !/^[가-힣a-zA-Z0-9]{2,12}$/.test(value.trim())) {
        throw new AccountError('닉네임은 한글·영문·숫자 2~12자로 입력해 주세요.');
    }
    return value.trim();
}
export function validateEmail(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        throw new AccountError('이메일 주소를 확인해 주세요.');
    }
    return value.trim().toLowerCase();
}
export function validatePassword(value: unknown): string {
    if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
        throw new AccountError('비밀번호는 8~128자로 입력해 주세요.');
    }
    return value;
}
export function activeAuditMembership(profile: CommonProfile | null, member: AuditMembership | null): AuditMembership {
    if (!profile || profile.account_status !== 'active') throw new AccountError('통합 계정 상태를 확인해 주세요.', 403);
    if (!member || member.membership_status !== 'active' || !Number.isSafeInteger(member.membership_version) || member.membership_version < 1) {
        throw new AccountError('감사 서비스 이용 시작 또는 가입 상태를 확인해 주세요.', 403);
    }
    return member;
}
export function auditRole(member: AuditMembership): AccountRole {
    // A historical ADMIN tier is not a grant of the new, separate admin permission.
    if (member.is_service_admin === true) return 'ADMIN';
    return member.role === 'PRO' ? 'PRO' : 'MEMBER';
}
export function assertAccountOrigin(request: Request): void {
    if (request.headers.get('origin') !== new URL(request.url).origin
        || ['cross-site', 'none'].includes(request.headers.get('sec-fetch-site') ?? '')) {
        throw new AccountError('요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.', 403);
    }
}
export function validateExpectedVersion(value: unknown): number {
    if (!Number.isSafeInteger(value) || (value as number) < 1) throw new AccountError('가입 상태를 새로고침한 뒤 다시 시도해 주세요.', 409);
    return value as number;
}
