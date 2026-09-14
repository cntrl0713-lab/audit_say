import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signature verification for events that actually carry Toss signatures. */
export function verifyTossSignature(raw: string, signature: string, transmissionTime: string, secret: string | undefined): boolean {
    if (!secret || !transmissionTime) return false;
    const expected = createHmac('sha256', secret).update(`${raw}:${transmissionTime}`).digest();
    return signature.split(',').some((part) => {
        const match = /^v1:([A-Za-z0-9+/]+={0,2})$/.exec(part.trim());
        if (!match) return false;
        const supplied = Buffer.from(match[1], 'base64');
        return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    });
}
