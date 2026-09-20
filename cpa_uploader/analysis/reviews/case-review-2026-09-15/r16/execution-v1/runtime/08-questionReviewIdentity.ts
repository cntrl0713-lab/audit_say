import { createHash } from 'node:crypto';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

export function sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
}

/** Only the two promotion labels are excluded from the reviewed identity. */
export function reviewedContentHash(set: QuestionSetV3): string {
    const content = structuredClone(set) as Partial<QuestionSetV3>;
    delete content.status;
    if (content.verification) delete (content.verification as Partial<QuestionSetV3['verification']>).review_status;
    return sha256(JSON.stringify(content));
}

export function jsonHash(value: unknown): string {
    const ordered = (item: unknown): unknown => Array.isArray(item) ? item.map(ordered)
        : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, ordered(val)])) : item;
    return sha256(JSON.stringify(ordered(value)));
}
