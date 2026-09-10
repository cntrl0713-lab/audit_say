/** Only official HTTPS source links may leave the job listing. */
export function safeKicpaSourceUrl(value: string): string | null {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || !['kicpa.or.kr', 'www.kicpa.or.kr'].includes(url.hostname)
            || url.username || url.password || url.port) return null;
        return url.href;
    } catch {
        return null;
    }
}

export function firmJobsHref(firmId: number | null): string | null {
    return firmId !== null && Number.isSafeInteger(firmId) && firmId > 0 ? `/firms/${firmId}?tab=jobs` : null;
}
