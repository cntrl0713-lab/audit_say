import { buildQuery, type SearchParams } from './params.ts';

// Carry only portfolio state. Never accept an arbitrary return URL.
function portfolioParams(params: SearchParams): SearchParams {
    return Object.fromEntries(['tab', 'q', 'market', 'opinion', 'listed', 'sort', 'page']
        .filter((key) => params[key] !== undefined).map((key) => [key, params[key]]));
}

export function clientDetailHref(corpCode: string, firmId: number, year: number, params: SearchParams): string {
    return `/companies/${corpCode}${buildQuery(portfolioParams(params), { firm_id: firmId, year })}`;
}

export function firmReturnHref(firmId: number, year: number, params: SearchParams): string {
    return `/firms/${firmId}${buildQuery(portfolioParams(params), { year })}`;
}
