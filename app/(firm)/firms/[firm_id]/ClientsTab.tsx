import Link from 'next/link';
import { redirect } from 'next/navigation';
import { countFirmClientsByOpinion, listFirmClients } from '../../../../lib/firm/queries';
import { clientDetailHref } from '../../../../lib/firm/navigation';
import { formatKrw, formatNumber } from '../../../../lib/firm/format';
import { AUDIT_OPINIONS, DATA_STATUS_LABEL, MARKET_LABEL, type CorpCls } from '../../../../lib/firm/types';
import { buildFilterQuery, buildQuery, readBool, readEnum, readInt, readString, type SearchParams } from '../../../../lib/firm/params';
import { Chip, DataTable, EmptyState, OpinionBadge, Pagination, SearchForm } from '../../_components/ui';
const MARKETS: CorpCls[] = ['Y', 'K', 'N', 'E'];

export default async function ClientsTab({
    firmId,
    year,
    base,
    query,
}: {
    firmId: number;
    year: number;
    base: string;
    query: SearchParams;
}) {
    const page = Math.min(readInt(query, 'page', 1), 1_000_000);
    const market = readEnum(query, 'market', MARKETS);
    const opinion = readEnum(query, 'opinion', AUDIT_OPINIONS);
    const listed = readBool(query, 'listed');
    const q = readString(query, 'q');
    const sort = readEnum(query, 'sort', ['revenue', 'operating_profit', 'name'] as const) ?? 'revenue';

    const [result, opinionCounts] = await Promise.all([
        listFirmClients({ firmId, year, page, market, opinion, listed, q, sort }),
        countFirmClientsByOpinion(firmId, year),
    ]);

    if (page > result.pageCount && result.total > 0) redirect(`${base}${buildQuery(query, { page: result.pageCount })}`);

    return (
        <>
            <div className="mb-3">
                <SearchForm
                    action={base}
                    defaultValue={q}
                    placeholder="이 회계법인의 감사대상회사 이름 검색"
                    hidden={{
                        tab: 'clients',
                        sort,
                        year: String(year),
                        ...(market ? { market } : {}),
                        ...(opinion ? { opinion } : {}),
                        ...(listed !== undefined ? { listed: String(listed) } : {}),
                    }}
                />
            </div>

            <div className="mb-2 flex flex-wrap gap-1.5">
                <Chip href={`${base}${buildFilterQuery(query, { listed: null })}`} active={listed === undefined}>
                    전체
                </Chip>
                <Chip href={`${base}${buildFilterQuery(query, { listed: 'true' })}`} active={listed === true}>
                    상장
                </Chip>
                <Chip href={`${base}${buildFilterQuery(query, { listed: 'false' })}`} active={listed === false}>
                    비상장
                </Chip>
                <span className="mx-1 w-px bg-card-border" aria-hidden />
                {MARKETS.map((code) => (
                    <Chip
                        key={code}
                        href={`${base}${buildFilterQuery(query, { market: market === code ? null : code })}`}
                        active={market === code}
                    >
                        {MARKET_LABEL[code]}
                    </Chip>
                ))}
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5">
                {AUDIT_OPINIONS.map((candidate) => (
                    <Chip
                        key={candidate}
                        href={`${base}${buildFilterQuery(query, {
                            opinion: opinion === candidate ? null : candidate,
                        })}`}
                        active={opinion === candidate}
                    >
                        {candidate} {opinionCounts[candidate] ?? 0}
                    </Chip>
                ))}
            </div>

            <div className="mb-4 flex flex-wrap gap-1.5" aria-label="감사대상회사 정렬">
                {([{ key: 'revenue', label: '감사대상회사 매출액순' }, { key: 'operating_profit', label: '감사대상회사 영업이익순' }, { key: 'name', label: '이름순' }] as const).map((option) => (
                    <Chip key={option.key} href={base + buildFilterQuery(query, { sort: option.key })} active={sort === option.key}>{option.label}</Chip>
                ))}
            </div>

            {result.rows.length === 0 ? (
                <EmptyState title="조건에 맞는 감사대상회사가 없습니다." description="선택한 회계법인과 사업연도 안에서만 검색합니다." />
            ) : (
                <>
                    <p className="mb-2 text-[13px] text-foreground/50">
                        전체 {formatNumber(result.total)}곳 중 {result.page} / {result.pageCount} 쪽
                    </p>
                    <DataTable columns={[{"key":"0","label":"회사명","align":"left","priority":"always"},{"key":"1","label":"시장","align":"right","priority":"wide"},{"key":"2","label":"업종","align":"right","priority":"wide"},{"key":"3","label":"매출액","align":"right","priority":"always"},{"key":"4","label":"영업이익","align":"right","priority":"wide"},{"key":"5","label":"의견","align":"right","priority":"always"},{"key":"6","label":"KAM","align":"right","priority":"wide"}]} rows={result.rows.map(row => [<span key="0">
                                            <Link
                                                href={clientDetailHref(row.corp_code, firmId, year, query)}
                                                className="hover:text-primary"
                                            >
                                                {row.corp_name}
                                            </Link>
                                        </span>,
<span key="1">{row.market ?? '-'}</span>,
<span key="2">{row.induty ?? '-'}</span>,
<span key="3">
                                            {formatKrw(row.revenue)}
                                            {row.data_status !== 'ok' ? (
                                                <span className="ml-1 text-[11px] text-foreground/40">
                                                    {DATA_STATUS_LABEL[row.data_status]}
                                                </span>
                                            ) : null}
                                            {row.fallback_yn ? (
                                                <span
                                                    className="ml-1 text-[11px] text-foreground/40"
                                                    title="연결재무제표가 없어 별도재무제표로 대체했습니다"
                                                >
                                                    별도
                                                </span>
                                            ) : null}
                                        </span>,
<span key="4">
                                            {formatKrw(row.operating_profit)}
                                        </span>,
<span key="5">
                                            <OpinionBadge opinion={row.adt_opinion} />
                                        </span>,
<span key="6">
                                            {formatNumber(row.kam_count)}
                                        </span>])} />
                    <Pagination
                        page={result.page}
                        pageCount={result.pageCount}
                        hrefFor={(n) => `${base}${buildQuery(query, { page: n })}`}
                    />
                </>
            )}
        </>
    );
}

