import Link from 'next/link';
import { listCompanies } from '../../../lib/firm/queries';
import { formatNumber } from '../../../lib/firm/format';
import { MARKET_LABEL, type CorpCls } from '../../../lib/firm/types';
import {
    buildFilterQuery,
    readBool,
    readEnum,
    readInt,
    readString,
    type SearchParams,
} from '../../../lib/firm/params';
import { Chip, EmptyState, NotCollectedNotice, Pagination, SearchForm } from '../_components/ui';

const MARKETS: CorpCls[] = ['Y', 'K', 'N', 'E'];

export default async function CompaniesPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const query = await searchParams;
    const page = readInt(query, 'page', 1);
    const q = readString(query, 'q');
    const market = readEnum(query, 'market', MARKETS);
    const listed = readBool(query, 'listed');

    const result = await listCompanies({ page, q, market, listed });
    const hasFilters = q !== undefined || market !== undefined || listed !== undefined;

    // 필터 없이도 0건이면 아직 수집 전이다. 필터 때문에 빈 것과 구분해서 알린다.
    if (result.total === 0 && !hasFilters) {
        return <NotCollectedNotice what="감사대상회사" />;
    }

    return (
        <section>
            <h2 className="mb-4 text-lg">
                감사대상회사 {formatNumber(result.total)}곳
            </h2>

            <div className="mb-3">
                <SearchForm
                    action="/companies"
                    defaultValue={q}
                    placeholder="회사 이름 검색"
                    hidden={{
                        ...(market ? { market } : {}),
                        ...(listed !== undefined ? { listed: String(listed) } : {}),
                    }}
                />
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
                <Chip href={`/companies${buildFilterQuery(query, { listed: null })}`} active={listed === undefined}>
                    전체
                </Chip>
                <Chip href={`/companies${buildFilterQuery(query, { listed: 'true' })}`} active={listed === true}>
                    상장
                </Chip>
                <Chip href={`/companies${buildFilterQuery(query, { listed: 'false' })}`} active={listed === false}>
                    비상장
                </Chip>
                <span className="mx-1 w-px bg-card-border" aria-hidden />
                {MARKETS.map((code) => (
                    <Chip
                        key={code}
                        href={`/companies${buildFilterQuery(query, { market: market === code ? null : code })}`}
                        active={market === code}
                    >
                        {MARKET_LABEL[code]}
                    </Chip>
                ))}
            </div>

            {result.rows.length === 0 ? (
                <EmptyState
                    title="조건에 맞는 회사가 없습니다."
                    description={q ? `"${q}" 검색 결과가 없습니다.` : undefined}
                />
            ) : (
                <>
                    <p className="mb-2 text-xs text-foreground/50">
                        {result.page} / {result.pageCount} 쪽
                    </p>
                    <ul className="divide-y divide-card-border rounded-lg border border-card-border bg-card">
                        {result.rows.map((company) => (
                            <li key={company.corp_code}>
                                <Link
                                    href={`/companies/${company.corp_code}`}
                                    className="flex items-baseline justify-between gap-4 px-4 py-3 transition-colors hover:bg-background"
                                >
                                    <span className="text-sm">
                                        {company.corp_name}
                                        {company.stock_code ? (
                                            <span className="ml-2 text-xs tabular-nums text-foreground/40">
                                                {company.stock_code}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="whitespace-nowrap text-xs text-foreground/50">
                                        {company.corp_cls ? MARKET_LABEL[company.corp_cls] : '미분류'}
                                        {company.induty ? ` · ${company.induty}` : ''}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <Pagination
                        page={result.page}
                        pageCount={result.pageCount}
                        hrefFor={(n) => `/companies${buildFilterQuery(query, { page: n })}`}
                    />
                </>
            )}
        </section>
    );
}
