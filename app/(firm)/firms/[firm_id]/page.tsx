import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFirmSummaries, getFirmAnnualSummaries, getFirmCpaTenure, getRegisteredFirm, listAllYears } from '../../../../lib/firm/queries';
import { ANNUAL_DISPLAY_YEARS, annualPeriodsForYear } from '../../../../lib/firm/annualYears';
import { formatDecimal, formatKrw, formatNumber } from '../../../../lib/firm/format';
import { buildFilterQuery, readEnum, readInt, type SearchParams } from '../../../../lib/firm/params';
import { Basis, NotCollectedNotice, StatTile, YearAxis } from '../../_components/ui';
import ClientsTab from './ClientsTab';
import KamTab from './KamTab';
import WorkforceTab from './WorkforceTab';
import PersonnelTab from './PersonnelTab';

const TABS = ['clients', 'kam', 'workforce', 'personnel'] as const;
type Tab = (typeof TABS)[number];

/** 회계법인 자체 공시를 보는 탭. 감사대상회사 사업연도가 아니라 보고기간으로 고른다. */
const FIRM_OWN_TABS: readonly Tab[] = ['workforce', 'personnel'];

const TAB_LABEL: Record<Tab, string> = {
    clients: '포트폴리오',
    kam: '의견 · KAM',
    workforce: '개요·재무',
    personnel: '인력 구성 · 인건비',
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

    const [firm, summaries, years, annualSummaries, tenure] = await Promise.all([
        getRegisteredFirm(firmId),
        getFirmSummaries(firmId),
        listAllYears(),
        getFirmAnnualSummaries(firmId),
        getFirmCpaTenure(firmId),
    ]);
    if (!firm) notFound();

    const rawQuery = await searchParams;
    const base = `/firms/${firmId}`;
    const requestedYear = readInt(rawQuery, 'year', 0);
    const year = years.includes(requestedYear) ? requestedYear : (years[0] ?? null);
    const summary = summaries.find((row) => row.bsns_year === year) ?? null;
    const tab = readEnum(rawQuery, 'tab', TABS) ?? 'clients';
    const query = { ...rawQuery, tab, ...(year === null ? {} : { year: String(year) }) };

    const { year: annualYear, periods } = annualPeriodsForYear(annualSummaries, readInt(rawQuery, 'fy_start_year', 0), readInt(rawQuery, 'fy_year', 0));
    return (
        <section>
            <header className="mb-4 rounded-lg border border-card-border bg-card px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl">{firm.firm_name}</h2>
                    <Link href={year === null ? "/firms" : `/firms?year=${year}`} className="text-[13px] text-foreground/50 hover:text-primary">
                        ← 목록으로
                    </Link>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-base sm:grid-cols-4">
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
                <p className="mt-3 text-[13px] text-foreground/60">DART 고유번호와 수집 대상 상태는 상장회사 감사인 등록 여부를 뜻하지 않습니다.</p>
            </header>

            <nav aria-label="리서치 탭" className="mb-6 grid gap-3 border-b border-card-border pb-4 md:grid-cols-2">
                {([{ label: '감사대상회사 · 사업연도', tabs: ['clients', 'kam'] }, { label: '회계법인 자체 · 보고기간 시작연도', tabs: ['workforce', 'personnel'] }] as const).map(group => <div key={group.label}>
                    <p className="mb-2 text-[13px] text-foreground/70">{group.label}</p>
                    <div className="flex flex-wrap gap-2">{group.tabs.map(candidate => <Link key={candidate} href={`${base}${buildFilterQuery(query, { tab: candidate })}`} aria-current={candidate === tab ? 'page' : undefined} className={`rounded border px-3 py-2 text-[15px] ${candidate === tab ? 'border-primary text-primary' : 'border-card-border'}`}>{TAB_LABEL[candidate]}</Link>)}</div>
                </div>)}
            </nav>
            {FIRM_OWN_TABS.includes(tab) ? <YearAxis label="보고기간 시작연도" years={ANNUAL_DISPLAY_YEARS} current={annualYear} hrefFor={y => `${base}${buildFilterQuery(query, { fy_start_year: y, fy_year: null })}`} /> : <YearAxis label="감사대상회사 사업연도" years={years} current={year} hrefFor={y => `${base}${buildFilterQuery(query, { year: y })}`} />}

            {tab === 'workforce' ? <WorkforceTab periods={periods} year={annualYear} /> : tab === 'personnel' ? <PersonnelTab firmId={firmId} periods={periods} year={annualYear} tenure={tenure} /> : year === null || summary === null ? (
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
                        <StatTile label="감사대상회사 평균 매출액" value={formatKrw(summary.avg_client_revenue)} hint="금액이 감사대상회사 기준" />
                        <StatTile label="감사대상회사 평균 KAM 수" value={formatDecimal(summary.avg_kam_count, 1, '개')} hint="개수를 확인한 공시 기준" />
                    </dl>

                    <Basis>외부감사법상 감사대상회사 중 수집된 공시에서 식별된 회사 기준이며, 미확보·검토 보류 건은 제외됩니다. ‘-’는 결측이며 0과 구분합니다. 감사대상회사 재무금액은 회계법인 자체 실적이 아닙니다.</Basis>

                    {tab === 'clients' ? (
                        <ClientsTab firmId={firmId} year={year} base={base} query={query} />
                    ) : null}
                    {tab === 'kam' ? <KamTab firmId={firmId} year={year} base={base} query={query} /> : null}
                </>
            )}
        </section>
    );
}

