import Link from 'next/link';
import { listAllYears, listFirmSummaries, listRegisteredFirms } from '../../../lib/firm/queries';
import { formatDecimal, formatKrw, formatNumber } from '../../../lib/firm/format';
import {
    buildFirmList, clientCountChange, DEFAULT_FIRM_LIST_YEAR, defaultFirmSortDirection,
    FIRM_SORTS, resolveFirmListYear, type FirmSort,
} from '../../../lib/firm/list';
import { buildFilterQuery, readEnum, readInt, readString, type SearchParams } from '../../../lib/firm/params';
import { DataTable, EmptyState, SearchForm } from '../_components/ui';

export default async function FirmsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const params = await searchParams;
    const q = readString(params, 'q');
    const sort = readEnum(params, 'sort', FIRM_SORTS.map((option) => option.key)) ?? 'clients';
    const order = readEnum(params, 'order', ['asc', 'desc'] as const) ?? defaultFirmSortDirection(sort);
    const [years, firms] = await Promise.all([listAllYears(), listRegisteredFirms()]);
    const year = resolveFirmListYear(years, readInt(params, 'year', 0));
    const selectableYears = [...new Set([...years, DEFAULT_FIRM_LIST_YEAR])].sort((a, b) => b - a);
    const [summaries, previousSummaries] = await Promise.all([
        listFirmSummaries(year), listFirmSummaries(year - 1),
    ]);
    const previousByFirm = new Map(previousSummaries.map((summary) => [summary.firm_id, summary]));
    const rows = buildFirmList(firms, summaries, q, sort, order);
    const query = { ...params, year: String(year), sort, order };
    const sortHeader = (key: FirmSort, label: string) => {
        const option = FIRM_SORTS.find((candidate) => candidate.key === key)!;
        return (
            <div className={`flex items-center gap-1 ${key === 'name' ? '' : 'justify-end'}`}>
                <span className="min-w-0 break-keep">{label}</span>
                <span role="group" aria-label={`${option.label} 정렬`} className="inline-flex shrink-0 flex-row gap-0.5">
                    {([{ value: 'asc', label: '오름차순', arrow: '↑' }, { value: 'desc', label: '내림차순', arrow: '↓' }] as const).map((direction) => {
                        const active = sort === key && order === direction.value;
                        return (
                            <Link key={direction.value}
                                href={`/firms${buildFilterQuery(query, { sort: key, order: direction.value })}`}
                                aria-label={`${option.label} ${direction.label}`}
                                title={`${option.label} ${direction.label}`}
                                aria-current={active ? 'true' : undefined}
                                className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-base transition-colors ${active ? 'bg-foreground font-medium text-white' : 'text-foreground/65 hover:bg-foreground/5'}`}>
                                <span aria-hidden="true">{direction.arrow}</span>
                            </Link>
                        );
                    })}
                </span>
            </div>
        );
    };

    return (
        <section>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl">회계법인 {rows.length}곳</h2>
                <p className="text-[13px] text-foreground/70">
                    회계법인을 선택하면 외부감사법 감사대상회사를 수집 공시 기준으로 볼 수 있습니다.
                </p>
            </div>
            <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-sm text-foreground/75">대상 사업연도</span>
                <nav aria-label="대상 사업연도" className="inline-flex max-w-full flex-wrap rounded-lg border border-card-border bg-foreground/5 p-1">
                    {selectableYears.map((candidate) => (
                        <Link key={candidate}
                            href={`/firms${buildFilterQuery(query, { year: candidate })}`}
                            aria-current={candidate === year ? 'date' : undefined}
                            className={`inline-flex min-h-11 min-w-14 items-center justify-center rounded-md px-3 text-sm tabular-nums transition-colors ${candidate === year ? 'bg-foreground font-medium text-white' : 'text-foreground/75 hover:bg-card'}`}>
                            {candidate}
                        </Link>
                    ))}
                </nav>
            </div>
            <div className="mb-4">
                <SearchForm action="/firms" defaultValue={q} placeholder="회계법인 이름 검색"
                    hidden={{ sort, order, year: String(year) }} />
            </div>
            <p className="mb-4 text-[13px] leading-relaxed text-foreground/70">
                외부감사법 감사대상회사 중 수집 공시에서 감사인을 확인한 회사 기준입니다. 식별 보류·미확보 건은 제외됩니다.
                전년 대비는 {year}년과 {year - 1}년의 수집 공시 기준 회사 수 차이이며, 자료가 없으면 계산하지 않습니다.
                평균 매출액은 재무금액이 확인된 감사대상회사 기준입니다. ‘-’는 미확보 값으로 0과 구분합니다.
                목록에 있다는 사실만으로 상장회사 감사인 등록 여부가 확인되는 것은 아닙니다.
            </p>
            {rows.length === 0 ? (
                <EmptyState title="조건에 맞는 회계법인이 없습니다." description={q ? `“${q}” 검색 결과가 없습니다.` : undefined} />
            ) : (
                <div className="max-md:[&_th:nth-child(1)]:w-[34%] max-md:[&_th:nth-child(2)]:w-[46%] max-md:[&_th:nth-child(4)]:w-[20%]">
                <DataTable
                    columns={[
                        { key: 'firm', label: '회계법인', header: sortHeader('name', '회계법인'), sortDirection: sort === 'name' ? order : undefined, priority: 'always' },
                        { key: 'clients', label: '외부감사법 감사대상회사', header: sortHeader('clients', '외부감사법 감사대상회사'), sortDirection: sort === 'clients' ? order : undefined, align: 'right', priority: 'always' },
                        { key: 'listed', label: '상장 감사대상회사', align: 'right', priority: 'wide' },
                        { key: 'modified', label: '의견변형', align: 'right', priority: 'always' },
                        { key: 'kam', label: '평균 KAM', align: 'right', priority: 'wide' },
                        { key: 'revenue', label: '감사대상회사 평균 매출액', header: sortHeader('client_revenue', '감사대상회사 평균 매출액'), sortDirection: sort === 'client_revenue' ? order : undefined, align: 'right', priority: 'wide' },
                    ]}
                    rows={rows.map(({ firm, summary }) => {
                        const previous = previousByFirm.get(firm.firm_id);
                        const change = clientCountChange(summary, previous);
                        const changeLabel = change === null
                            ? (!summary ? '비교 자료 미확보' : !previous ? '전년 자료 미확보' : '비교 수치 미확보')
                            : `전년 대비 ${change > 0 ? '+' : change < 0 ? '−' : ''}${formatNumber(Math.abs(change), '곳')}`;
                        return [
                            <span key="firm" className="block">
                                <Link href={`/firms/${firm.firm_id}?year=${year}`} className="font-medium hover:text-primary">{firm.firm_name}</Link>
                                {!summary ? <span className="mt-1 block text-[13px] text-foreground/60">선택 연도 자료 미확보</span> : null}
                            </span>,
                            <span key="clients" className="block">
                                {formatNumber(summary?.client_count, '곳')}
                                <span className="mt-1 block text-[13px] leading-relaxed text-foreground/65">{changeLabel}</span>
                            </span>,
                            <span key="listed">{formatNumber(summary?.listed_client_count, '곳')}</span>,
                            <span key="modified" className={summary && summary.opinion_modified_count > 0 ? 'text-danger' : ''}>{formatNumber(summary?.opinion_modified_count)}</span>,
                            <span key="kam">{formatDecimal(summary?.avg_kam_count)}</span>,
                            <span key="revenue">{formatKrw(summary?.avg_client_revenue)}</span>,
                        ];
                    })}
                />
                </div>
            )}
        </section>
    );
}
