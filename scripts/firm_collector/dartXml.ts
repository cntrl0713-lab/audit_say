import { readZipEntries } from './zip.ts';

export interface Cell { code: string | null; text: string; attrs: Record<string, string>; column: number; colspan: number; }
export interface TableGroup { unitMultiplier: number | null; unitRaw: string | null; rows: Cell[][]; byCode: Map<string, Cell[]>; }
export interface ParsedDocument {
    companyName: string; corpCode: string; formulaVersion: string; fyEndDate: string | null;
    fyStartDate: string | null; fySeq: number | null; groups: Map<string, TableGroup>;
}

export function decodeDartXml(buffer: Buffer): string {
    let text = new TextDecoder('utf-8').decode(buffer);
    if (text.includes('\uFFFD')) text = new TextDecoder('euc-kr', { fatal: true }).decode(buffer);
    return text;
}

export function xmlText(raw: string): string {
    return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<\/?(?:P|BR)\b[^>]*>/gi, '\n')
        .replace(/<[^>]*>/g, '').replace(/&#(x[\da-f]+|\d+);/gi, (_, n: string) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)))
        .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[n]!)
        .replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
}
function attributes(raw: string): Record<string, string> {
    return Object.fromEntries([...raw.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1], xmlText(m[2] ?? m[3])]));
}
export function unitMultiplier(raw: string | null): number | null {
    if (!raw) return null;
    const text = raw.replace(/\s/g, '');
    const units = [...text.matchAll(/(?:단위[:：]?|[,(/])((?:백만|천)?원)(?=[,)/]|$)/g)].map(m => m[1]);
    if (new Set(units).size !== 1) return null;
    return ({ 원: 1, 천원: 1000, 백만원: 1000000 })[units[0]] ?? null;
}
function dartDate(raw: string | undefined): string | null {
    if (!raw || !/^\d{8}$/.test(raw)) return null;
    const str = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
    const date = new Date(str + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().startsWith(str) ? str : null;
}
export function indexDartXml(xml: string): ParsedDocument {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('외부 엔티티/DTD는 지원하지 않습니다.');
    const groups = new Map<string, TableGroup>();
    for (const match of xml.matchAll(/<TABLE-GROUP\b([^>]*)>([\s\S]*?)<\/TABLE-GROUP>/g)) {
        const name = attributes(match[1]).ACLASS;
        if (!name || groups.has(name)) throw new Error('표 그룹 키 누락/중복');
        const byCode = new Map<string, Cell[]>();
        const rows: Cell[][] = [];
        const unitTexts: string[] = [];
        for (const table of match[2].matchAll(/<TABLE\b[^>]*>([\s\S]*?)<\/TABLE>/g)) {
            let carry = new Map<number, { cell: Cell; remaining: number }>();
            for (const tr of table[1].matchAll(/<TR\b[^>]*>([\s\S]*?)<\/TR>/g)) {
                const row: Cell[] = [];
                const occupied = new Set<number>();
                const next = new Map<number, { cell: Cell; remaining: number }>();
                for (const [column, inherited] of carry) {
                    row.push(inherited.cell);
                    for (let c = column; c < column + inherited.cell.colspan; c++) occupied.add(c);
                    if (inherited.remaining > 1) next.set(column, { cell: inherited.cell, remaining: inherited.remaining - 1 });
                }
                let col = 0;
                for (const m of tr[1].matchAll(/<(TD|TE|TU|TH)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
                    while (occupied.has(col)) col++;
                    const attrs = attributes(m[2]);
                    const cell: Cell = { code: attrs.ACODE ?? attrs.AUNIT ?? null, text: xmlText(m[3]), attrs, column: col, colspan: Number(attrs.COLSPAN ?? 1) };
                    row.push(cell);
                    if (cell.code) byCode.set(cell.code, [...(byCode.get(cell.code) ?? []), cell]);
                    if (m[1] === 'TU' && /단위/.test(cell.text)) unitTexts.push(cell.text);
                    if (Number(attrs.ROWSPAN) > 1) next.set(col, { cell, remaining: Number(attrs.ROWSPAN) - 1 });
                    col += cell.colspan;
                }
                carry = next;
                if (row.length) rows.push(row.sort((a, b) => a.column - b.column));
            }
        }
        const unitRaw = [...new Set(unitTexts)].join(' / ') || null;
        groups.set(name, { unitRaw, unitMultiplier: unitMultiplier(unitRaw), rows, byCode });
    }
    const company = xml.match(/<COMPANY-NAME\b([^>]*)>([\s\S]*?)<\/COMPANY-NAME>/);
    const cover = groups.get('COVER');
    return {
        companyName: xmlText(company?.[2] ?? ''), corpCode: attributes(company?.[1] ?? '').AREGCIK ?? '',
        formulaVersion: xmlText(xml.match(/<FORMULA-VERSION\b[^>]*>(.*?)<\/FORMULA-VERSION>/)?.[1] ?? ''),
        fyEndDate: dartDate(cover?.byCode.get('PERIODTO')?.[0]?.attrs.AUNITVALUE),
        fyStartDate: dartDate(cover?.byCode.get('PERIODFROM')?.[0]?.attrs.AUNITVALUE),
        fySeq: Number(xml.match(/\(제\s*(\d+)\s*기\)/)?.[1]) || null, groups,
    };
}
export function parseDocumentZip(zip: Buffer): ParsedDocument {
    const docs = readZipEntries(zip).filter(e => /\.xml$/i.test(e.fileName)).map(e => decodeDartXml(e.data)).filter(x => /<DOCUMENT-NAME\b[^>]*ACODE="11051"/.test(x));
    if (docs.length !== 1) throw new Error('회계법인사업보고서 XML이 1개가 아닙니다.');
    return indexDartXml(docs[0]);
}
