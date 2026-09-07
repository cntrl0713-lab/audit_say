import { normalizeAuditOpinion, normalizeFirmName } from './normalize.ts';

export type DartRow = Record<string, string>;

export function hasAuditor(row: DartRow): boolean {
    return !/^(?:|-+|해당사항없음\.?|해당없음\.?|없음\.?)$/.test(normalizeFirmName(row.adtor ?? ''));
}

/** stlm_dt is the filing's settlement date, including on comparative rows. */
export function termNumber(label: string | undefined): number | null {
    const match = label?.replace(/\s/g, '').match(/제?(\d+)기/);
    return match ? Number(match[1]) : null;
}

/** Use the opinion table as the period anchor: contract labels can say 당기 on prior terms. */
export function currentPeriod(rows: DartRow[], year: number): { rows: DartRow[]; term: number | null } {
    let current = rows.filter((row) => {
        const label = (row.bsns_year ?? '').replace(/\s/g, '');
        if (/(?:당(?:기|해|년|분기|반기)|\(당\)기)/.test(label) && !/전기|전년/.test(label)) return true;
        const explicitYear = label.match(/(?:^|\D)((?:19|20)\d{2})(?:연도|년도|년|[.()]|$)/)?.[1]
            ?? label.match(/\(((?:19|20)\d{2})기\)/)?.[1];
        if (explicitYear) return Number(explicitYear) === year;
        const shortYear = label.match(/['’](\d{2})[./]/)?.[1];
        return shortYear !== undefined && Number(shortYear) === year % 100;
    });
    // Bare fiscal-term labels are also used. Only accept consecutive terms in the requested filing year.
    if (!current.length && rows.every((r) => /^제?\d+기(?:\((?:전|전전)기\))?$/.test((r.bsns_year ?? '').replace(/\s/g, ''))
        && r.stlm_dt?.startsWith(`${year}-`))) {
        const terms = [...new Set(rows.map((r) => termNumber(r.bsns_year)!))].sort((a, b) => b - a);
        if (terms.length >= 2 && terms.every((value, i) => value === terms[0] - i)) {
            current = rows.filter((r) => termNumber(r.bsns_year) === terms[0]
                && /^제?\d+기$/.test((r.bsns_year ?? '').replace(/\s/g, '')));
        }
    }
    if (!current.length) throw new Error('당기 감사의견 행을 식별할 수 없습니다. bsns_year 원문 검토 필요');
    const terms = current.map((row) => termNumber(row.bsns_year)).filter((n): n is number => n !== null);
    const term = terms.length ? Math.max(...terms) : null;
    return { rows: current.filter((row) => term === null || termNumber(row.bsns_year) === term), term };
}

/** Duplicate CFS/OFS rows must not overwrite a current opinion with a comparative one. */
export function mergeCurrentOpinions(rows: DartRow[]): DartRow[] {
    const groups = new Map<string, DartRow[]>();
    for (const row of rows) {
        const key = normalizeFirmName(row.adtor ?? '');
        if (!hasAuditor(row)) continue;
        const group = groups.get(key) ?? [];
        group.push(row);
        groups.set(key, group);
    }
    return [...groups.values()].map((group) => {
        const stated = group.filter((row) => row.adt_opinion?.trim() && row.adt_opinion.trim() !== '-');
        const verdicts = new Set(stated.map((row) => normalizeAuditOpinion(row.adt_opinion)));
        if (verdicts.size > 1) throw new Error('같은 당기 감사인의 연결/별도 의견이 다릅니다. 수동 검토 필요');
        const merged = { ...group[0] };
        for (const field of ['adt_opinion', 'emphs_matter', 'core_adt_matter']) {
            merged[field] = [...new Set(group.map((r) => r[field]?.trim()).filter(Boolean))].join('\n');
        }
        return merged;
    });
}

export function requireFields(rows: DartRow[], fields: string[], endpoint: string): void {
    if (rows.length && fields.some((field) => !rows.some((row) => Object.hasOwn(row, field)))) {
        throw new Error(`${endpoint}: 응답 필드 불일치 (${fields.join(', ')})`);
    }
}

/** Short aliases such as 삼일 also identify unrelated ordinary corporations. */
export function firmCorpCandidates(
    firm: { firm_name: string; alias: string[] },
    corps: { corp_code: string; corp_name: string }[],
): string[] {
    // Candidate discovery can inspect prefix/suffix variants, but must return ALL legal identities.
    // Unlike an explicit, verified alias, this key must never directly assign an engagement.
    const candidateKey = (name: string) => normalizeFirmName(name).replace(/^회계법인(.+)$/, '$1회계법인');
    const names = new Set([firm.firm_name, ...firm.alias]
        .filter((name) => name.includes('회계법인')).map(candidateKey));
    return [...new Set(corps.filter((corp) => names.has(candidateKey(corp.corp_name)))
        .map((corp) => corp.corp_code))];
}
