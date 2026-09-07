import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
    countFirmClientsByOpinion,
    getFirmSummaries,
    getFirmAnnualSummaries,
    getRegisteredFirm,
    listAllYears,
    listFirmClients,
    listFirmKam,
} from '../../../../lib/firm/queries';
import { clientDetailHref } from '../../../../lib/firm/navigation';
import { ANNUAL_DISPLAY_YEARS, annualPeriodsForYear } from '../../../../lib/firm/annualYears';
import { formatDecimal, formatKrw, formatNumber, formatRatio } from '../../../../lib/firm/format';
import {
    AUDIT_OPINIONS,
    DATA_STATUS_LABEL,
    MARKET_LABEL,
    type CorpCls,
} from '../../../../lib/firm/types';
import {
    buildFilterQuery,
    buildQuery,
    readBool,
    readEnum,
    readInt,
    readString,
    type SearchParams,
} from '../../../../lib/firm/params';
import {
    Chip,
    EmptyState,
    NotCollectedNotice,
    OpinionBadge,
    Pagination,
    SearchForm,
    StatTile,
} from '../../_components/ui';

const TABS = ['clients', 'kam', 'workforce'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
    clients: '고객사 포트폴리오',
    kam: '의견 · KAM',
    workforce: '회계법인 자체 정보',
};

const MARKETS: CorpCls[] = ['Y', 'K', 'N', 'E'];

export default async function FirmDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ firm_id: string }>;
    searchParams: Promise<SearchParams>;
}) {
    const { firm_id } = await params;
    const firmId = Number(firm_id);
    if (!Number.isSafeInteger(firmId) || firmId <= 0) notFound();

    const [firm, summaries, years, annualSummaries] = await Promise.all([
        getRegisteredFirm(firmId),
        getFirmSummaries(firmId),
        listAllYears(),
        getFirmAnnualSummaries(firmId),
    ]);
    if (!firm) notFound();

    const rawQuery = await searchParams;
    const base = `/firms/${firmId}`;
    const requestedYear = readInt(rawQuery, 'year', 0);
    const year = years.includes(requestedYear) ? requestedYear : (years[0] ?? null);
    const summary = summaries.find((row) => row.bsns_year === year) ?? null;
    const tab = readEnum(rawQuery, 'tab', TABS) ?? 'clients';
    const query = { ...rawQuery, tab, ...(year === null ? {} : { year: String(year) }) };

    return (
        <section>
            <header className="mb-4 rounded-lg border border-card-border bg-card px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl">{firm.firm_name}</h2>
                    <Link href={year === null ? "/firms" : `/firms?year=${year}`} className="text-xs text-foreground/50 hover:text-primary">
                        ← 목록으로
                    </Link>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                        <dt className="text-xs text-foreground/50">회계법인 등록번호</dt>
                        <dd>{firm.registration_no ?? '확인 자료 미확보'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">감사인 군 구분</dt>
                        <dd>{firm.tier ?? '확인 자료 미확보'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">DART 코드</dt>
                        <dd>{firm.dart_corp_code ?? '미수집'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">수집 대상 상태</dt>
                        <dd>{firm.status === 'active' ? '수집 대상' : '대상 제외'}</dd>
                    </div>
                </dl>
                <p className="mt-3 text-xs text-foreground/60">DART 고유번호와 수집 대상 상태는 상장회사 감사인 등록 여부를 뜻하지 않습니다.</p>
            </header>

            <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-card-border">
                {TABS.map((candidate) => <Link key={candidate} href={`${base}${buildFilterQuery(query, { tab: candidate })}`} aria-current={candidate === tab ? 'page' : undefined} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${candidate === tab ? 'border-primary' : 'border-transparent text-foreground/60'}`}>{TAB_LABEL[candidate]}</Link>)}
            </nav>

            {tab !== 'workforce' && years.length > 1 ? (
                <div className="mb-4 flex flex-wrap gap-1.5">
                    <span className="self-center text-xs text-foreground/60">고객사 사업연도</span>
                    {years.map((candidate) => (
                        <Chip
                            key={candidate}
                            href={`${base}${buildFilterQuery(query, { year: candidate })}`}
                            active={candidate === year}
                        >
                            {candidate}
                        </Chip>
                    ))}
                </div>
            ) : null}

            {tab === 'workforce' ? <WorkforceTab summaries={annualSummaries} requestedYear={readInt(rawQuery, 'fy_start_year', 0)} base={base} query={query} /> : year === null || summary === null ? (
                <NotCollectedNotice what={`${firm.firm_name}의 감사`} />
            ) : (
                <>
                    <dl className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <StatTile
                            label="확인된 고객사"
                            value={formatNumber(summary.client_count, '곳')}
                            hint={`상장 ${summary.listed_client_count} · 비상장 ${summary.unlisted_client_count}`}
                        />
                        <StatTile
                            label="의견변형"
                            value={formatNumber(summary.opinion_modified_count, '건')}
                            hint={`적정 ${summary.opinion_unqualified_count}건`}
                        />
                        <StatTile label="고객사 평균 매출액" value={formatKrw(summary.avg_client_revenue)} hint="금액이 확인된 고객사 기준" />
                        <StatTile label="고객사 평균 KAM 수" value={formatDecimal(summary.avg_kam_count, 1, '개')} hint="개수를 확인한 공시 기준" />
                    </dl>

                    <p className="mb-4 text-xs text-foreground/60">수집된 공시 중 식별된 고객사 기준이며, 미확보·검토 보류 건은 제외됩니다. ‘-’는 결측이며 0과 구분합니다. 고객사 재무금액은 회계법인 자체 실적이 아닙니다.</p>

                    {tab === 'clients' ? (
                        <ClientsTab firmId={firmId} year={year} base={base} query={query} />
                    ) : null}
                    {tab === 'kam' ? <KamTab firmId={firmId} year={year} base={base} query={query} /> : null}
                </>
            )}
        </section>
    );
}

// ── 고객사 포트폴리오 ───────────────────────────────────────────────────────

async function ClientsTab({
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
                    placeholder="이 회계법인의 고객사 이름 검색"
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

            <div className="mb-4 flex flex-wrap gap-1.5" aria-label="고객사 정렬">
                {([{ key: 'revenue', label: '고객사 매출액순' }, { key: 'operating_profit', label: '고객사 영업이익순' }, { key: 'name', label: '이름순' }] as const).map((option) => (
                    <Chip key={option.key} href={base + buildFilterQuery(query, { sort: option.key })} active={sort === option.key}>{option.label}</Chip>
                ))}
            </div>

            {result.rows.length === 0 ? (
                <EmptyState title="조건에 맞는 고객사가 없습니다." description="선택한 회계법인과 사업연도 안에서만 검색합니다." />
            ) : (
                <>
                    <p className="mb-2 text-xs text-foreground/50">
                        전체 {formatNumber(result.total)}곳 중 {result.page} / {result.pageCount} 쪽
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-card-border bg-card">
                        <table className="w-full min-w-[52rem] text-sm">
                            <thead>
                                <tr className="border-b border-card-border text-left text-xs text-foreground/50">
                                    <th className="px-4 py-2.5 font-medium">고객사</th>
                                    <th className="px-4 py-2.5 font-medium">시장</th>
                                    <th className="px-4 py-2.5 font-medium">업종</th>
                                    <th className="px-4 py-2.5 text-right font-medium">고객사 매출액</th>
                                    <th className="px-4 py-2.5 text-right font-medium">고객사 영업이익</th>
                                    <th className="px-4 py-2.5 font-medium">의견</th>
                                    <th className="px-4 py-2.5 text-right font-medium">KAM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.rows.map((row) => (
                                    <tr
                                        key={row.engagement_id}
                                        className="border-b border-card-border last:border-0 hover:bg-background"
                                    >
                                        <td className="px-4 py-2.5">
                                            <Link
                                                href={clientDetailHref(row.corp_code, firmId, year, query)}
                                                className="hover:text-primary"
                                            >
                                                {row.corp_name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-2.5 text-foreground/70">{row.market ?? '-'}</td>
                                        <td className="px-4 py-2.5 text-foreground/70">{row.induty ?? '-'}</td>
                                        <td className="px-4 py-2.5 text-right tabular-nums">
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
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground/70">
                                            {formatKrw(row.operating_profit)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <OpinionBadge opinion={row.adt_opinion} />
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground/70">
                                            {formatNumber(row.kam_count)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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

// ── 의견 · KAM ─────────────────────────────────────────────────────────────

async function KamTab({
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

    if (page > result.pageCount && result.total > 0) redirect(`${base}${buildQuery(query, { page: result.pageCount })}`);

    if (result.rows.length === 0) {
        return <EmptyState title="KAM·강조사항이 기록된 감사 건이 없습니다." />;
    }

    return (
        <>
            <p className="mb-2 text-xs text-foreground/50">
                전체 {formatNumber(result.total)}건 중 {result.page} / {result.pageCount} 쪽
            </p>
            <ul className="space-y-2">
                {result.rows.map((row) => (
                    <li
                        key={row.engagement_id}
                        className="rounded-lg border border-card-border bg-card px-4 py-3"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <Link
                                href={clientDetailHref(row.corp_code, firmId, year, query)}
                                className="text-sm font-medium hover:text-primary"
                            >
                                {row.corp_name}
                            </Link>
                            <span className="flex items-center gap-2 text-xs text-foreground/50">
                                <OpinionBadge opinion={row.adt_opinion} />
                                {row.kam_count === null ? 'KAM 수 미확인' : `KAM ${formatNumber(row.kam_count, '개')}`}
                            </span>
                        </div>
                        {row.kam_text ? (
                            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground/70">
                                {row.kam_text}
                            </p>
                        ) : null}
                        {row.emph_matter ? (
                            <p className="mt-2 border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-foreground/60">
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

// ── 회계법인 자체 정보 ────────────────────────────────────────────────────
function WorkforceTab({ summaries, requestedYear, base, query }: { summaries: Awaited<ReturnType<typeof getFirmAnnualSummaries>>; requestedYear: number; base: string; query: SearchParams }) {
    const { year, periods } = annualPeriodsForYear(summaries, requestedYear, readInt(query, 'fy_year', 0));
    return <>
        <div className="mb-3 flex items-center gap-2"><span className="text-xs text-foreground/60">보고기간 시작연도</span>{ANNUAL_DISPLAY_YEARS.map(y => <Chip key={y} active={y === year} href={`${base}${buildFilterQuery(query, { fy_start_year: y, fy_year: null })}`}>{y}</Chip>)}</div>
        <h3 className="mb-2 text-sm font-medium">{year}년 시작 실적 · 회계법인 자체 인력·재무</h3>
        <p className="mb-4 text-xs leading-relaxed text-foreground/60">실적은 보고기간 시작연도로 구분합니다. 고객사 사업연도와 실제 감사대상 기간이 같다는 뜻은 아닙니다. 인원은 각 보고기간 말 기준이며, 1인당 인건비는 이사 등을 포함한 전체 임직원 인건비를 기말 인원으로 나눈 값입니다.</p>
        {periods.length > 1 ? <p className="mb-3 text-sm">같은 연도에 시작한 보고기간이 {periods.length}개입니다. 실적을 합산하지 않고 기간별로 표시합니다.</p> : null}
        {periods.length ? <div className="space-y-5">{periods.map(current => <AnnualPeriodCard key={current.fy_end_date} current={current} />)}</div> : <EmptyState title="보고기간 정보 미확보" description="선택한 연도에 시작한 사업보고서가 아직 적재되지 않았거나 검토 보류 중입니다." />}
    </>;
}

function AnnualPeriodCard({ current }: { current: Awaited<ReturnType<typeof getFirmAnnualSummaries>>[number] }) {
    const fields = [
        { label: '회계법인 전 임직원 수', value: current?.employee_total, format: (n: number) => formatNumber(n, '명') },
        { label: '회계법인 이사 수', value: current?.director_count, format: (n: number) => formatNumber(n, '명') },
        { label: '회계법인 자체 매출액', value: current?.revenue_total, format: formatKrw },
        { label: '회계법인 자체 영업이익', value: current?.operating_income, format: formatKrw },
        { label: '회계법인 1인당 매출액', value: current?.revenue_per_employee, format: formatKrw },
        { label: '임직원 1인당 인건비', value: current?.salary_per_employee, format: formatKrw },
        { label: '감사부문 매출 비중', value: current?.audit_revenue_ratio, format: formatRatio },
    ];
    return (
        <>
            <p className="mb-3 text-xs">{current.fy_seq ? `제${current.fy_seq}기 · ` : ''}대상 기간 {current.fy_start_date} ~ {current.fy_end_date} · 접수일 {current.source_rcept_dt} · <a href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${current.source_rcept_no}`} target="_blank" rel="noreferrer" className="underline">DART 원문</a></p>
            {current?.consistency_warnings.length ? <p className="mb-3 rounded border border-card-border p-3 text-sm">이 공시에는 표 간 수치 차이 또는 검증할 수 없는 항목이 {current.consistency_warnings.length}건 있습니다. 원문 값을 보존했으므로 비교할 때 공시의 기준을 확인해 주세요.</p> : null}
            {!fields.some((field) => field.value != null) ? (
                <EmptyState title="수치 미확보" description="이 보고기간의 인력·재무 수치가 확인되지 않았습니다." />
            ) : (
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((field) => <StatTile key={field.label} label={field.label} value={field.value == null ? '-' : field.format(field.value)} hint={field.value == null ? '공시 값 미확보' : undefined} />)}
                </dl>
            )}
        </>
    );
}
