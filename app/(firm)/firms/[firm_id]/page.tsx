import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFirmSummaries, getFirmAnnualSummaries, getFirmCpaTenure, getFirmHeadcount, getRegisteredFirm, listAllYears, listRegisteredFirms } from '../../../../lib/firm/queries';
import { ANNUAL_DISPLAY_YEARS, annualPeriodsForYear } from '../../../../lib/firm/annualYears';
import { formatDecimal, formatKrw, formatNumber } from '../../../../lib/firm/format';
import { buildFilterQuery, readInt, type SearchParams } from '../../../../lib/firm/params';
import { resolveFirmDetailView, type ClientView, type FirmDetailTab } from '../../../../lib/firm/detailView';
import { Basis, NotCollectedNotice, StatTile } from '../../_components/ui';
import ClientsTab from './ClientsTab';
import KamTab from './KamTab';
import RevenueTab from './RevenueTab';
import CompensationTab from './CompensationTab';
import PeopleTab from './PeopleTab';
import OverviewTab from './OverviewTab';
import FirmQuickSearch from './FirmQuickSearch';

const TAB_LABEL: Record<FirmDetailTab, string> = {
    overview: '주요정보',
    revenue: '매출',
    clients: '감사대상회사',
    compensation: '인건비·보수',
    people: '인력 구조',
};



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

    const [firm, summaries, years, annualSummaries, tenure, headcounts, firms] = await Promise.all([
        getRegisteredFirm(firmId),
        getFirmSummaries(firmId),
        listAllYears(),
        getFirmAnnualSummaries(firmId),
        getFirmCpaTenure(firmId),
        getFirmHeadcount(firmId),
        listRegisteredFirms(),
    ]);
    if (!firm) notFound();

    const rawQuery = await searchParams;
    const base = `/firms/${firmId}`;
    const requestedYear = readInt(rawQuery, 'year', 0);
    const year = years.includes(requestedYear) ? requestedYear : (years[0] ?? null);
    const listHref = years.includes(requestedYear) ? `/firms?year=${requestedYear}` : '/firms';
    const summary = summaries.find((row) => row.bsns_year === year) ?? null;
    const { tab, clientView, group, isFirmOwnTab } = resolveFirmDetailView(rawQuery);
    const query = { ...rawQuery, tab, ...(tab === 'clients' ? { client_view: clientView } : {}), ...(year === null ? {} : { year: String(year) }) };
    const tabHref = (next: FirmDetailTab, view: ClientView = 'list') => `${base}${buildFilterQuery(query, {
        tab: next, client_view: next === 'clients' ? view : null,
        ...(next === 'clients' && view === 'list' ? { opinion: null } : {}),
    })}`;

    const { year: annualYear, periods } = annualPeriodsForYear(annualSummaries, readInt(rawQuery, 'fy_start_year', 0), readInt(rawQuery, 'fy_year', 0));
    const selectedYear = isFirmOwnTab ? annualYear : year;
    const selectableYears = isFirmOwnTab ? ANNUAL_DISPLAY_YEARS : years;
    return (
        <section>
            <header className="mb-6 border-b border-card-border pb-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3 lg:grid-cols-[auto_minmax(240px,360px)_1fr]">
                    <h2 className="text-2xl sm:text-3xl">{firm.firm_name}</h2>
                    <div className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
                        <FirmQuickSearch key={firmId} firms={firms.map(({ firm_id, firm_name }) => ({ firm_id, firm_name }))} currentFirmId={firmId} />
                    </div>
                    <Link href={listHref} className="col-start-2 row-start-1 justify-self-end whitespace-nowrap py-2 text-sm text-foreground/70 hover:text-primary lg:col-start-3">
                        ← 목록으로
                    </Link>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                    <nav aria-label={isFirmOwnTab ? '보고기간 시작연도' : '감사대상회사 사업연도'} className="inline-flex max-w-full shrink-0 rounded-lg border border-card-border bg-foreground/5 p-1">
                        {selectableYears.map(candidate => (
                            <Link
                                key={candidate}
                                href={`${base}${buildFilterQuery(query, isFirmOwnTab ? { fy_start_year: candidate, fy_year: null } : { year: candidate })}`}
                                aria-current={candidate === selectedYear ? 'date' : undefined}
                                className={`inline-flex min-h-11 min-w-14 items-center justify-center rounded-md px-3 text-sm tabular-nums transition-colors ${candidate === selectedYear ? 'bg-foreground font-medium text-white' : 'text-foreground/75 hover:bg-card'}`}
                            >{candidate}</Link>
                        ))}
                    </nav>
                    <div className="min-w-0 text-sm leading-relaxed text-foreground/75">
                        {isFirmOwnTab ? (
                            <>
                                <p className="text-[13px]">{annualYear}년 시작 보고기간</p>
                                {periods.length ? periods.map(period => (
                                    <p key={period.source_rcept_no} className="tabular-nums text-foreground">
                                        {period.fy_seq ? `제${period.fy_seq}기 · ` : ''}{period.fy_start_date} ~ {period.fy_end_date}
                                    </p>
                                )) : <p>보고기간 자료 미확보</p>}
                            </>
                        ) : <p>감사대상회사 사업연도 {year ?? '미확보'}</p>}
                    </div>
                </div>
                <details className="mt-2 text-sm">
                    <summary className="w-fit cursor-pointer py-2 text-foreground/70">기본정보 더 보기</summary>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg bg-card p-4 text-base sm:grid-cols-4">
                    <div>
                        <dt className="text-[13px] text-foreground/50">회계법인 등록번호</dt>
                        <dd>{firm.registration_no ?? '확인 자료 미확보'}</dd>
                    </div>
                    <div>
                        <dt className="text-[13px] text-foreground/50">감사인 군 구분</dt>
                        <dd>{firm.tier ?? '확인 자료 미확보'}</dd>
                    </div>
                    <div>
                        <dt className="text-[13px] text-foreground/50">DART 코드</dt>
                        <dd>{firm.dart_corp_code ?? '미수집'}</dd>
                    </div>
                    <div>
                        <dt className="text-[13px] text-foreground/50">수집 대상 상태</dt>
                        <dd>{firm.status === 'active' ? '수집 대상' : '대상 제외'}</dd>
                    </div>
                </dl>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/70">DART 고유번호와 수집 대상 상태는 상장회사 감사인 등록 여부를 뜻하지 않습니다.</p>
                </details>
            </header>

            <nav aria-label="정보 구분" className="mb-4 flex gap-2 border-b border-card-border pb-4">
                {([
                    { group: 'overview', label: '주요정보', target: 'overview' },
                    { group: 'business', label: '사업·고객', target: 'revenue' },
                    { group: 'internal', label: '인력·보수', target: 'compensation' },
                ] as const).map(item => (
                    <Link key={item.group} href={tabHref(item.target)} aria-current={group === item.group ? 'page' : undefined}
                        className={`flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm ${group === item.group ? 'bg-foreground font-medium text-white' : 'text-foreground/75 hover:bg-card'}`}>
                        {item.label}
                    </Link>
                ))}
            </nav>
            {group !== 'overview' ? <nav aria-label={group === 'business' ? '사업·고객 상세' : '인력·보수 상세'} className="mb-6 flex gap-2">
                {(group === 'business' ? ['revenue', 'clients'] as const : ['compensation', 'people'] as const).map(candidate => (
                    <Link key={candidate} href={tabHref(candidate)} aria-current={candidate === tab ? 'page' : undefined}
                        className={`flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm ${candidate === tab ? 'border-primary bg-primary/5 font-medium text-primary' : 'border-card-border bg-card text-foreground/75'}`}>
                        {TAB_LABEL[candidate]}
                    </Link>
                ))}
            </nav> : null}
            {tab === 'clients' ? <nav aria-label="감사대상회사 보기" className="mb-5 flex flex-wrap gap-x-5 gap-y-2">
                {([{ value: 'list', label: '회사 목록' }, { value: 'opinions', label: '감사의견' }, { value: 'kam', label: 'KAM·강조사항' }] as const).map(view => (
                    <Link key={view.value} href={tabHref('clients', view.value)} aria-current={clientView === view.value ? 'page' : undefined}
                        className={`inline-flex min-h-11 items-center border-b-2 px-1 text-sm ${clientView === view.value ? 'border-foreground font-medium' : 'border-transparent text-foreground/65 hover:text-foreground'}`}>
                        {view.label}
                    </Link>
                ))}
            </nav> : null}

            {tab === 'overview' ? <OverviewTab summaries={annualSummaries} periods={periods} tenure={tenure} headcounts={headcounts} />
                : tab === 'revenue' ? <RevenueTab summaries={annualSummaries} periods={periods} year={annualYear} />
                : tab === 'compensation' ? <CompensationTab firmId={firmId} periods={periods} year={annualYear} />
                : tab === 'people' ? <PeopleTab firmId={firmId} summaries={annualSummaries} periods={periods} year={annualYear} tenure={tenure} headcounts={headcounts} />
                : year === null || summary === null ? (
                <NotCollectedNotice what={`${firm.firm_name}의 감사`} />
            ) : (
                <>
                    <dl className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <StatTile
                            label="감사대상회사"
                            value={formatNumber(summary.client_count, '곳')}
                            hint={`수집 공시에서 감사인이 확인된 회사 · 상장 ${summary.listed_client_count} · 비상장 ${summary.unlisted_client_count}`}
                        />
                        <StatTile
                            label="의견변형"
                            value={formatNumber(summary.opinion_modified_count, '건')}
                            hint={`적정 ${summary.opinion_unqualified_count}건`}
                        />
                        <StatTile label="감사대상회사 평균 매출액" value={formatKrw(summary.avg_client_revenue)} hint="금액이 확인된 감사대상회사 기준" />
                        <StatTile label="감사대상회사 평균 KAM 수" value={formatDecimal(summary.avg_kam_count, 1, '개')} hint="개수를 확인한 공시 기준" />
                    </dl>

                    <Basis>외부감사법상 감사대상회사 중 수집된 공시에서 식별된 회사 기준이며, 미확보·검토 보류 건은 제외됩니다. ‘-’는 결측이며 0과 구분합니다. 감사대상회사 재무금액은 회계법인 자체 실적이 아닙니다.</Basis>

                    {clientView === 'kam' ? <KamTab firmId={firmId} year={year} base={base} query={query} />
                        : <ClientsTab firmId={firmId} year={year} base={base} query={query} view={clientView} />}
                </>
            )}
        </section>
    );
}
