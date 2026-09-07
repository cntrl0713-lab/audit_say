import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    countFirmClientsByOpinion,
    getFirmContractSummary,
    getFirmSummaries,
    getRegisteredFirm,
    listFirmClients,
    listFirmKam,
} from '../../../../lib/firm/queries';
import { formatDecimal, formatKrw, formatNumber, formatRatio } from '../../../../lib/firm/format';
import {
    AUDIT_OPINIONS,
    DATA_STATUS_LABEL,
    MARKET_LABEL,
    type CorpCls,
} from '../../../../lib/firm/types';
import {
    buildFilterQuery,
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

const TABS = ['clients', 'kam', 'contracts', 'workforce'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
    clients: '고객사 포트폴리오',
    kam: '의견 · KAM',
    contracts: '용역',
    workforce: '인력 · 운영지표',
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
    if (!Number.isInteger(firmId) || firmId <= 0) notFound();

    const [firm, summaries] = await Promise.all([
        getRegisteredFirm(firmId),
        getFirmSummaries(firmId),
    ]);
    if (!firm) notFound();

    const query = await searchParams;
    const base = `/firms/${firmId}`;
    const years = summaries.map((row) => row.bsns_year);
    const requestedYear = readInt(query, 'year', 0);
    const year = years.includes(requestedYear) ? requestedYear : (years[0] ?? null);
    const summary = summaries.find((row) => row.bsns_year === year) ?? null;
    const tab = readEnum(query, 'tab', TABS) ?? 'clients';

    return (
        <section>
            <header className="mb-4 rounded-lg border border-card-border bg-card px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl">{firm.firm_name}</h2>
                    <Link href="/firms" className="text-xs text-foreground/50 hover:text-primary">
                        ← 목록으로
                    </Link>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                        <dt className="text-xs text-foreground/50">등록번호</dt>
                        <dd>{firm.registration_no ?? '미수집'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">군 구분</dt>
                        <dd>{firm.tier ?? '미수집'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">DART 코드</dt>
                        <dd>{firm.dart_corp_code ?? '미수집'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">상태</dt>
                        <dd>{firm.status === 'active' ? '활성' : '폐업'}</dd>
                    </div>
                </dl>
            </header>

            {year === null || summary === null ? (
                <NotCollectedNotice what={`${firm.firm_name}의 감사`} />
            ) : (
                <>
                    {years.length > 1 ? (
                        <div className="mb-4 flex flex-wrap gap-1.5">
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

                    <dl className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <StatTile
                            label="고객사"
                            value={formatNumber(summary.client_count, '곳')}
                            hint={`상장 ${summary.listed_client_count} · 비상장 ${summary.unlisted_client_count}`}
                        />
                        <StatTile
                            label="의견변형"
                            value={formatNumber(summary.opinion_modified_count, '건')}
                            hint={`적정 ${summary.opinion_unqualified_count}건`}
                        />
                        <StatTile
                            label="직원 수"
                            value={formatNumber(summary.employee_total, '명')}
                            hint={
                                summary.director_count !== null
                                    ? `이사 ${summary.director_count}명`
                                    : '이사 수 미수집'
                            }
                        />
                        <StatTile
                            label="1인당 매출"
                            value={formatKrw(summary.revenue_per_employee)}
                            hint={
                                summary.revenue_total !== null
                                    ? `영업수익 ${formatKrw(summary.revenue_total)}`
                                    : '영업수익 미수집'
                            }
                        />
                    </dl>

                    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-card-border">
                        {TABS.map((candidate) => (
                            <Link
                                key={candidate}
                                href={`${base}${buildFilterQuery(query, { tab: candidate })}`}
                                aria-current={candidate === tab ? 'page' : undefined}
                                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
                                    candidate === tab
                                        ? 'border-primary text-foreground'
                                        : 'border-transparent text-foreground/60 hover:text-foreground'
                                }`}
                            >
                                {TAB_LABEL[candidate]}
                            </Link>
                        ))}
                    </nav>

                    {tab === 'clients' ? (
                        <ClientsTab firmId={firmId} year={year} base={base} query={query} />
                    ) : null}
                    {tab === 'kam' ? <KamTab firmId={firmId} year={year} base={base} query={query} /> : null}
                    {tab === 'contracts' ? <ContractsTab firmId={firmId} year={year} /> : null}
                    {tab === 'workforce' ? <WorkforceTab summaries={summaries} year={year} /> : null}
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
    const page = readInt(query, 'page', 1);
    const market = readEnum(query, 'market', MARKETS);
    const opinion = readEnum(query, 'opinion', AUDIT_OPINIONS);
    const listed = readBool(query, 'listed');
    const q = readString(query, 'q');

    const [result, opinionCounts] = await Promise.all([
        listFirmClients({ firmId, year, page, market, opinion, listed, q }),
        countFirmClientsByOpinion(firmId, year),
    ]);

    return (
        <>
            <div className="mb-3">
                <SearchForm
                    action={base}
                    defaultValue={q}
                    placeholder="고객사 이름 검색"
                    hidden={{
                        tab: 'clients',
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

            {result.rows.length === 0 ? (
                <EmptyState title="조건에 맞는 고객사가 없습니다." />
            ) : (
                <>
                    <p className="mb-2 text-xs text-foreground/50">
                        전체 {formatNumber(result.total)}곳 중 {result.page} / {result.pageCount} 쪽
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-card-border bg-card">
                        <table className="w-full min-w-[52rem] text-sm">
                            <thead>
                                <tr className="border-b border-card-border text-left text-xs text-foreground/50">
                                    <th className="px-4 py-2.5 font-medium">회사</th>
                                    <th className="px-4 py-2.5 font-medium">시장</th>
                                    <th className="px-4 py-2.5 font-medium">업종</th>
                                    <th className="px-4 py-2.5 text-right font-medium">매출액</th>
                                    <th className="px-4 py-2.5 text-right font-medium">영업이익</th>
                                    <th className="px-4 py-2.5 font-medium">의견</th>
                                    <th className="px-4 py-2.5 text-right font-medium">KAM</th>
                                    <th className="px-4 py-2.5 text-right font-medium">감사보수</th>
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
                                                href={`/companies/${row.corp_code}`}
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
                                        <td className="px-4 py-2.5 text-right tabular-nums">
                                            {formatKrw(row.audit_fee_total)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        page={result.page}
                        pageCount={result.pageCount}
                        hrefFor={(n) => `${base}${buildFilterQuery(query, { page: n })}`}
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
    const page = readInt(query, 'page', 1);
    const result = await listFirmKam({ firmId, year, page });

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
                                href={`/companies/${row.corp_code}`}
                                className="text-sm font-medium hover:text-primary"
                            >
                                {row.corp_name}
                            </Link>
                            <span className="flex items-center gap-2 text-xs text-foreground/50">
                                <OpinionBadge opinion={row.adt_opinion} />
                                KAM {formatNumber(row.kam_count)}개
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
                hrefFor={(n) => `${base}${buildFilterQuery(query, { page: n })}`}
            />
        </>
    );
}

// ── 용역 ───────────────────────────────────────────────────────────────────

async function ContractsTab({ firmId, year }: { firmId: number; year: number }) {
    const summary = await getFirmContractSummary(firmId, year);

    if (summary.engagementCount === 0) {
        return <EmptyState title="용역 데이터가 없습니다." />;
    }

    return (
        <>
            <dl className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatTile label="감사보수 합계" value={formatKrw(summary.auditFeeTotal)} />
                <StatTile label="비감사보수 합계" value={formatKrw(summary.nonauditFeeTotal)} />
                <StatTile
                    label="비감사 비중"
                    value={formatRatio(summary.nonauditFeeRatio)}
                    hint="비감사 / 전체 보수"
                />
                <StatTile
                    label="비감사 계약"
                    value={formatNumber(summary.nonauditContractCount, '건')}
                    hint={`고객사 ${summary.clientsWithNonaudit}곳`}
                />
            </dl>

            {summary.topByAuditFee.length === 0 ? (
                <EmptyState title="감사보수가 기록된 고객사가 없습니다." />
            ) : (
                <div className="overflow-x-auto rounded-lg border border-card-border bg-card">
                    <table className="w-full min-w-[28rem] text-sm">
                        <caption className="px-4 pt-3 text-left text-xs text-foreground/50">
                            감사보수 상위 {summary.topByAuditFee.length}곳
                        </caption>
                        <thead>
                            <tr className="border-b border-card-border text-left text-xs text-foreground/50">
                                <th className="px-4 py-2.5 font-medium">회사</th>
                                <th className="px-4 py-2.5 text-right font-medium">감사보수</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary.topByAuditFee.map((row) => (
                                <tr key={row.corp_code} className="border-b border-card-border last:border-0">
                                    <td className="px-4 py-2.5">
                                        <Link href={`/companies/${row.corp_code}`} className="hover:text-primary">
                                            {row.corp_name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {formatKrw(row.audit_fee_total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}

// ── 인력 · 운영지표 ─────────────────────────────────────────────────────────

function WorkforceTab({
    summaries,
    year,
}: {
    summaries: Awaited<ReturnType<typeof getFirmSummaries>>;
    year: number;
}) {
    const current = summaries.find((row) => row.bsns_year === year);
    if (!current) return <EmptyState title="인력 데이터가 없습니다." />;

    const hasWorkforce = current.employee_total !== null || current.director_count !== null;

    return (
        <>
            <dl className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatTile label="직원 수" value={formatNumber(current.employee_total, '명')} />
                <StatTile label="이사 수" value={formatNumber(current.director_count, '명')} hint="등기임원 기준" />
                <StatTile
                    label="이사 대비 직원"
                    value={formatDecimal(current.employee_per_director, 1, '배')}
                />
                <StatTile label="1인 평균 급여" value={formatKrw(current.salary_per_employee)} />
                <StatTile label="영업수익" value={formatKrw(current.revenue_total)} />
                <StatTile label="영업이익" value={formatKrw(current.operating_income)} />
                <StatTile label="1인당 매출" value={formatKrw(current.revenue_per_employee)} />
                <StatTile
                    label="감사부문 매출 비중"
                    value={formatRatio(current.audit_revenue_ratio)}
                    hint="구조화 API 미지원 시 미수집"
                />
            </dl>

            {!hasWorkforce ? (
                <p className="mb-4 rounded-lg border border-dashed border-card-border bg-card px-4 py-3 text-xs text-foreground/60">
                    인력 지표는 회계법인 사업보고서에서 따로 수집합니다.{' '}
                    <code className="text-[11px]">npm run firm:collect:profiles</code> 를 돌리면 채워집니다.
                </p>
            ) : null}

            {summaries.length > 1 ? (
                <div className="overflow-x-auto rounded-lg border border-card-border bg-card">
                    <table className="w-full min-w-[40rem] text-sm">
                        <caption className="px-4 pt-3 text-left text-xs text-foreground/50">
                            연도별 추이
                        </caption>
                        <thead>
                            <tr className="border-b border-card-border text-left text-xs text-foreground/50">
                                <th className="px-4 py-2.5 font-medium">사업연도</th>
                                <th className="px-4 py-2.5 text-right font-medium">고객사</th>
                                <th className="px-4 py-2.5 text-right font-medium">직원 수</th>
                                <th className="px-4 py-2.5 text-right font-medium">영업수익</th>
                                <th className="px-4 py-2.5 text-right font-medium">1인당 매출</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaries.map((row) => (
                                <tr
                                    key={row.bsns_year}
                                    className={`border-b border-card-border last:border-0 ${
                                        row.bsns_year === year ? 'bg-background' : ''
                                    }`}
                                >
                                    <td className="px-4 py-2.5 tabular-nums">{row.bsns_year}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {formatNumber(row.client_count)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {formatNumber(row.employee_total)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {formatKrw(row.revenue_total)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums">
                                        {formatKrw(row.revenue_per_employee)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </>
    );
}
