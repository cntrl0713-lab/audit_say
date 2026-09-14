import { AccountError } from '../accountPolicy.ts';

/** Enforce byte limits even without Content-Length, before buffering the whole body. */
export async function readBillingText(request: Request, maxBytes = 64 * 1024): Promise<string> {
    if (Number(request.headers.get('content-length')) > maxBytes) throw new AccountError('요청 내용이 너무 큽니다.', 413);
    const reader = request.body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) {
            await reader.cancel();
            throw new AccountError('요청 내용이 너무 큽니다.', 413);
        }
        text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
}
