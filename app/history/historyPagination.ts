/** Preserve the server's keyset order while ignoring overlapping page entries. */
export function appendHistoryPage<T extends { id: string }>(current: T[], incoming: T[]): T[] {
    const seen = new Set(current.map((item) => item.id));
    const appended: T[] = [];
    for (const item of incoming) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        appended.push(item);
    }
    return [...current, ...appended];
}
