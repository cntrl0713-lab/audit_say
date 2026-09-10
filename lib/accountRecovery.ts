import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const RECOVERY_COOKIE = 'audit-account-recovery';
export const RECOVERY_TTL_SECONDS = 600;
function mac(payload: string, key: string) {
    if (Buffer.byteLength(key) < 32) throw new Error('Recovery signing configuration is missing');
    return createHmac('sha256', key).update(`audit-account-recovery:v1:${payload}`).digest();
}
export function issueRecoveryGrant(userId: string, accessToken: string, key: string, now = Date.now()): string {
    const payload = Buffer.from(JSON.stringify({ id: userId, token: createHash('sha256').update(accessToken).digest('hex'), exp: now + RECOVERY_TTL_SECONDS * 1000 })).toString('base64url');
    return `${payload}.${mac(payload, key).toString('base64url')}`;
}
export function verifyRecoveryGrant(grant: unknown, userId: string, accessToken: string, key: string, now = Date.now()): boolean {
    if (typeof grant !== 'string' || grant.length > 1000 || !/^[\w-]+\.[\w-]+$/.test(grant)) return false;
    try {
        const [payload, signature] = grant.split('.');
        const supplied = Buffer.from(signature, 'base64url');
        if (supplied.length !== 32 || !timingSafeEqual(supplied, mac(payload, key))) return false;
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return decoded.id === userId && decoded.token === createHash('sha256').update(accessToken).digest('hex')
            && Number.isSafeInteger(decoded.exp) && now < decoded.exp && decoded.exp <= now + RECOVERY_TTL_SECONDS * 1000;
    } catch { return false; }
}
