import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listFirmKam } from '../../../../lib/firm/queries';
import { clientDetailHref } from '../../../../lib/firm/navigation';
import { formatNumber } from '../../../../lib/firm/format';
import { buildQuery, readInt, type SearchParams } from '../../../../lib/firm/params';
import { EmptyState, OpinionBadge, Pagination } from '../../_components/ui';

export default async function KamTab({
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
    const result = await listFirmKam({ firmId, year, page });

    if (page > result.pageCount && result.total > 0)
        redirect(`${base}${buildQuery(query, { page: result.pageCount })}`);

    if (result.rows.length === 0) {
        return <EmptyState title="KAM·강조사항이 기록된 감사 건이 없습니다." />;
    }

    return (
        <>
            <p className="mb-2 text-[13px] text-foreground/50">
                전체 {formatNumber(result.total)}건 중 {result.page} / {result.pageCount} 쪽
            </p>
            <ul className="space-y-2">
                {result.rows.map((row) => (
                    <li key={row.engagement_id} className="rounded-lg border border-card-border bg-card px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <Link
                                href={clientDetailHref(row.corp_code, firmId, year, query)}
                                className="text-lg font-medium hover:text-primary"
                            >
                                {row.corp_name}
                            </Link>
                            <span className="flex items-center gap-2 text-[13px] text-foreground/50">
                                <OpinionBadge opinion={row.adt_opinion} />
                                {row.kam_count === null ? 'KAM 수 미확인' : `KAM ${formatNumber(row.kam_count, '개')}`}
                            </span>
                        </div>
                        {row.kam_text ? (
                            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/70">
                                {row.kam_text}
                            </p>
                        ) : null}
                        {row.emph_matter ? (
                            <p className="mt-2 border-l-2 border-primary/40 pl-3 text-[13px] leading-relaxed text-foreground/60">
                                <span className="font-medium">강조사항</span> {row.emph_matter}
                            </p>
                        ) : null}
                    </li>
                ))}
            </ul>
            <Pagination
                page={result.page}
                pageCount={result.pageCount}
                hrefFor={(n) => `${base}${buildQuery(query, { page: n })}`}
            />
        </>
    );
}
