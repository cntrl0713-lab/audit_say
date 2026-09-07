import Link from 'next/link';
import {
    listAllYears,
    listFirmSummaries,
    listRegisteredFirms,
    type FirmSort,
} from '../../../lib/firm/queries';
import { formatDecimal, formatKrw, formatNumber } from '../../../lib/firm/format';
import {
    buildFilterQuery,
    readEnum,
    readInt,
    readString,
    type SearchParams,
} from '../../../lib/firm/params';
import { Chip, EmptyState, NotCollectedNotice, SearchForm } from '../_components/ui';

const SORTS: { key: FirmSort; label: string }[] = [
    { key: 'clients', label: '고객사 수' },
    { key: 'employees', label: '직원 수' },
    { key: 'revenue_per_employee', label: '1인당 매출' },
    { key: 'name', label: '이름순' },
];

export default async function FirmsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;
    const q = readString(params, 'q');
    const sort = readEnum(params, 'sort', SORTS.map((s) => s.key)) ?? 'clients';

    const years = await listAllYears();
    // 요청한 연도가 데이터에 없으면 가장 최근 연도로 떨어진다
    const requested = readInt(params, 'year', 0);
    const year = years.includes(requested) ? requested : (years[0] ?? null);

    // 공시 데이터가 아직 없으면 마스터만이라도 보여 준다 — 빈 화면보다 낫다.
    if (year === null) {
        const firms = await listRegisteredFirms();
        return (
            <section>
                <h2 className="mb-4 text-lg">등록회계법인 {firms.length}곳</h2>
                <ul className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {firms.map((firm) => (
                        <li key={firm.firm_id}>
                            <Link
                                href={`/firms/${firm.firm_id}`}
                                className="block rounded-lg border border-card-border bg-card px-4 py-3 transition-colors hover:border-primary"
                            >
                                <span className="block text-sm font-medium">{firm.firm_name}</span>
                                <span className="mt-0.5 block text-xs text-foreground/50">
                                    {firm.tier ?? '군 미상'} · 등록번호 {firm.registration_no ?? '미수집'}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
                <NotCollectedNotice what="감사 포트폴리오" />
            </section>
        );
    }

    const rows = await listFirmSummaries({ year, q, sort });

    return (
        <section>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">
                    회계법인 {rows.length}곳
                    <span className="ml-2 text-sm text-foreground/50">{year} 사업연도</span>
                </h2>
            </div>

            <div className="mb-3">
                <SearchForm
                    action="/firms"
                    defaultValue={q}
                    placeholder="회계법인 이름 검색"
                    hidden={{ sort, year: String(year) }}
                />
            </div>

            {years.length > 1 ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                    {years.map((candidate) => (
                        <Chip
                            key={candidate}
                            href={`/firms${buildFilterQuery(params, { year: candidate })}`}
                            active={candidate === year}
                        >
                            {candidate}
                        </Chip>
                    ))}
                </div>
            ) : null}

            <div className="mb-4 flex flex-wrap gap-1.5">
                {SORTS.map((option) => (
                    <Chip
                        key={option.key}
                        href={`/firms${buildFilterQuery(params, { sort: option.key })}`}
                        active={sort === option.key}
                    >
                        {option.label}
                    </Chip>
                ))}
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    title="조건에 맞는 회계법인이 없습니다."
                    description={q ? `"${q}" 검색 결과가 없습니다.` : undefined}
                />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-card-border bg-card">
                    <table className="w-full min-w-[46rem] text-sm">
                        <thead>
                            <tr className="border-b border-card-border text-left text-xs text-foreground/50">
                                <th className="px-4 py-2.5 font-medium">회계법인</th>
                                <th className="px-4 py-2.5 text-right font-medium">고객사</th>
                                <th className="px-4 py-2.5 text-right font-medium">상장</th>
                                <th className="px-4 py-2.5 text-right font-medium">의견변형</th>
                                <th className="px-4 py-2.5 text-right font-medium">평균 KAM</th>
                                <th className="px-4 py-2.5 text-right font-medium">직원 수</th>
                                <th className="px-4 py-2.5 text-right font-medium">1인당 매출</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.firm_id}
                                    className="border-b border-card-border last:border-0 hover:bg-background"
                                >
                                    <td className="px-4 py-2.5">
                                        <Link
                                            href={`/firms/${row.firm_id}?year=${row.bsns_year}`}
                                            className="font-medium hover:text-primary"
                                        >
                                            {row.firm_name}
                                        </Link>
                                        {row.tier ? (
                                            <span className="ml-2 text-xs text-foreground/50">{row.tier}</span>
                                        ) : null}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {formatNumber(row.client_count)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground/70">
                                        {formatNumber(row.listed_client_count)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {row.opinion_modified_count > 0 ? (
                                            <span className="text-danger">{row.opinion_modified_count}</span>
                                        ) : (
                                            <span className="text-foreground/40">0</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground/70">
                                        {formatDecimal(row.avg_kam_count)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground/70">
                                        {formatNumber(row.employee_total)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {formatKrw(row.revenue_per_employee)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
