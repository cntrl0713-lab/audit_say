import Link from 'next/link';
import { listAllYears, listFirmSummaries, listRegisteredFirms } from '../../../lib/firm/queries';
import { formatDecimal, formatKrw, formatNumber } from '../../../lib/firm/format';
import { buildFirmList, FIRM_SORTS } from '../../../lib/firm/list';
import { buildFilterQuery, readEnum, readInt, readString, type SearchParams } from '../../../lib/firm/params';
import { Chip, EmptyState, SearchForm } from '../_components/ui';

export default async function FirmsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const params = await searchParams;
    const q = readString(params, 'q');
    const sort = readEnum(params, 'sort', FIRM_SORTS.map((s) => s.key)) ?? 'clients';
    const [years, firms] = await Promise.all([listAllYears(), listRegisteredFirms()]);
    const requested = readInt(params, 'year', 0);
    const year = years.includes(requested) ? requested : (years[0] ?? null);
    const summaries = year === null ? [] : await listFirmSummaries(year);
    const rows = buildFirmList(firms, summaries, q, sort);
    const query = { ...params, ...(year === null ? {} : { year: String(year) }) };

    return (
        <section>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">회계법인 {rows.length}곳
                    {year !== null ? <span className="ml-2 text-sm text-foreground/50">{year} 사업연도</span> : null}
                </h2>
                <p className="text-xs text-foreground/60">회계법인을 선택하면 해당 법인의 고객사를 볼 수 있습니다.</p>
            </div>
            <div className="mb-3">
                <SearchForm action="/firms" defaultValue={q} placeholder="회계법인 이름 검색"
                    hidden={{ sort, ...(year === null ? {} : { year: String(year) }) }} />
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5" aria-label="사업연도">
                {years.map((candidate) => <Chip key={candidate}
                    href={`/firms${buildFilterQuery(query, { year: candidate })}`} active={candidate === year}>
                    {candidate}
                </Chip>)}
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5" aria-label="회계법인 정렬">
                {FIRM_SORTS.map((option) => <Chip key={option.key}
                    href={`/firms${buildFilterQuery(query, { sort: option.key })}`} active={sort === option.key}>
                    {option.label}
                </Chip>)}
            </div>
            <p className="mb-4 text-xs leading-relaxed text-foreground/60">
                수집된 공시에서 감사인을 확인한 고객사 기준입니다. 식별 보류·미확보 건은 집계에서 제외됩니다.
                고객사 평균 매출액은 재무금액이 확인된 고객사 기준이며, 회계법인 자체 매출이 아닙니다.
                ‘-’는 미확보 값으로 0과 구분합니다. 회계법인 목록에 있다는 사실만으로 상장회사 감사인 등록 여부가 확인되는 것은 아닙니다.
            </p>
            {rows.length === 0 ? <EmptyState title="조건에 맞는 회계법인이 없습니다." description={q ? `“${q}” 검색 결과가 없습니다.` : undefined} /> : (
                <div className="overflow-x-auto rounded-lg border border-card-border bg-card">
                    <table className="w-full min-w-[48rem] text-sm">
                        <thead><tr className="border-b border-card-border text-left text-xs text-foreground/60">
                            {['회계법인', '확인된 고객사', '상장 고객사', '의견변형', '평균 KAM', '고객사 평균 매출액'].map((label, i) => (
                                <th key={label} scope="col" className={`px-4 py-3 font-medium ${i ? 'text-right' : ''}`}>{label}</th>
                            ))}
                        </tr></thead>
                        <tbody>{rows.map(({ firm, summary }) => (
                            <tr key={firm.firm_id} className="border-b border-card-border last:border-0 hover:bg-background">
                                <td className="px-4 py-3">
                                    <Link href={`/firms/${firm.firm_id}${year === null ? '' : `?year=${year}`}`} className="font-medium hover:text-primary">{firm.firm_name}</Link>
                                    {!summary ? <span className="mt-1 block text-xs text-foreground/50">선택 연도 고객사 데이터 미확보</span> : null}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(summary?.client_count)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(summary?.listed_client_count)}</td>
                                <td className="px-4 py-3 text-right tabular-nums"><span className={summary && summary.opinion_modified_count > 0 ? 'text-danger' : ''}>{formatNumber(summary?.opinion_modified_count)}</span></td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatDecimal(summary?.avg_kam_count)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{formatKrw(summary?.avg_client_revenue)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
