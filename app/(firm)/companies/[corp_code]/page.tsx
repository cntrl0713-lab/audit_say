import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
    getCompany,
    getCompanyAuditHistory,
    getCompanyEngagements,
    getCompanyKam,
    getRegisteredFirm,
} from '../../../../lib/firm/queries';
import { firmReturnHref } from '../../../../lib/firm/navigation';
import { buildFilterQuery, readInt, type SearchParams } from '../../../../lib/firm/params';
import { formatKrw, formatNumber } from '../../../../lib/firm/format';
import { DATA_STATUS_LABEL, MARKET_LABEL } from '../../../../lib/firm/types';
import { Chip, DataTable, type DataColumn, EmptyState, OpinionBadge, StatTile } from '../../_components/ui';

const HISTORY_COLUMNS: DataColumn[] = [
    { key: 'bsns_year', label: '사업연도' },
    { key: 'firm', label: '감사인' },
    { key: 'opinion', label: '의견' },
    { key: 'kam', label: 'KAM', align: 'right', priority: 'wide' },
    { key: 'change', label: '변동', priority: 'wide' },
];

export default async function CompanyDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ corp_code: string }>;
    searchParams: Promise<SearchParams>;
}) {
    const { corp_code } = await params;
    // DART corp_code 는 8자리 숫자다. 형식이 아니면 조회 없이 404.
    if (!/^\d{8}$/.test(corp_code)) notFound();

    const query = await searchParams;
    const firmId = readInt(query, 'firm_id', 0);
    if (firmId === 0) redirect('/firms');
    const [company, firm] = await Promise.all([getCompany(corp_code), getRegisteredFirm(firmId)]);
    if (!firm) notFound();
    if (!company) notFound();

    const [history, engagements, kams] = await Promise.all([
        getCompanyAuditHistory(corp_code),
        getCompanyEngagements(corp_code),
        getCompanyKam(corp_code),
    ]);

    const scoped = engagements.filter((row) => row.firm_id === firmId);
    if (scoped.length === 0) notFound();
    const year = readInt(query, 'year', scoped[0].bsns_year);
    const selected = scoped.find((row) => row.bsns_year === year) ?? null;
    if (!selected) notFound();
    const returnHref = firmReturnHref(firmId, year, query);
    const selectedKams = kams.filter((row) => row.bsns_year === year && row.firm_id === firmId);

    return (
        <section>
            <header className="mb-4 rounded-lg border border-card-border bg-card px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div><p className="mb-1 text-xs text-foreground/60">{firm.firm_name} · {year} 사업연도 · 외부감사법상 감사대상회사</p><h2 className="text-xl">{company.corp_name}</h2></div>
                    <Link href={returnHref} className="text-xs text-foreground/50 hover:text-primary">
                        ← {firm.firm_name} 감사대상회사 목록
                    </Link>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                        <dt className="text-xs text-foreground/50">시장</dt>
                        <dd>{company.corp_cls ? MARKET_LABEL[company.corp_cls] : '미분류'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">종목코드</dt>
                        <dd className="tabular-nums">{company.stock_code ?? '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">상장 여부</dt>
                        <dd>{company.listed_yn ? '상장' : '비상장'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">업종</dt>
                        <dd>{company.induty ?? '-'}</dd>
                    </div>
                </dl>
            </header>

            <div className="mb-4 flex flex-wrap gap-1.5" aria-label="감사대상회사 사업연도">
                {scoped.map((row) => <Chip key={row.bsns_year} href={'/companies/' + corp_code + buildFilterQuery(query, { year: row.bsns_year })} active={row.bsns_year === year}>{row.bsns_year}</Chip>)}
            </div>
            <>
                    <h3 className="mb-2 text-sm text-foreground/60">
                        감사대상회사 재무 3지표
                        <span className="ml-2 text-xs text-foreground/40">
                            {selected.bsns_year} 사업연도 · {selected.fs_div === 'OFS' ? '별도' : selected.fs_div === 'CFS' ? '연결' : '재무제표 구분 미확보'}
                            {selected.data_status !== 'ok' ? ` · ${DATA_STATUS_LABEL[selected.data_status]}` : ''}
                        </span>
                    </h3>
                    <dl className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <StatTile label="감사대상회사 매출액" value={formatKrw(selected.revenue)} />
                        <StatTile label="감사대상회사 영업이익" value={formatKrw(selected.operating_profit)} />
                        <StatTile label="감사대상회사 당기순이익" value={formatKrw(selected.net_income)} />
                    </dl>

                    <p className="mb-4 text-xs text-foreground/60">‘-’는 미확보 값이며 0과 다릅니다. 금액 확인 보류에는 외화 공시 등이 포함되며 원화로 임의 환산하지 않습니다.</p>
                    <h3 className="mb-2 text-sm text-foreground/60">감사대상회사 감사 이력 · 수집된 연도 기준</h3>
                    <DataTable
                        columns={HISTORY_COLUMNS}
                        rows={history.map((row) => [
                            row.bsns_year,
                            <Link key="firm" href={`/firms/${row.firm_id}?year=${row.bsns_year}`} className="hover:text-primary">
                                {row.firm_name}
                            </Link>,
                            <OpinionBadge key="opinion" opinion={row.adt_opinion} />,
                            formatNumber(row.kam_count),
                            // 첫 연도(null)는 "변동 없음"이 아니라 비교 대상이 없는 것이다
                            row.auditor_changed === null ? (
                                <span key="change" className="text-foreground/30">
                                    첫 기록
                                </span>
                            ) : (
                                <span key="change" className="flex flex-wrap gap-2">
                                    {row.auditor_changed ? (
                                        <span className="text-primary">감사인 교체 · 이전 {row.prev_firm_name}</span>
                                    ) : null}
                                    {row.opinion_changed ? (
                                        <span className="text-danger">의견 변경 · 이전 {row.prev_adt_opinion ?? '미상'}</span>
                                    ) : null}
                                    {!row.auditor_changed && !row.opinion_changed ? (
                                        <span className="text-foreground/30">-</span>
                                    ) : null}
                                </span>
                            ),
                        ])}
                    />

                    <h3 className="mb-2 text-sm text-foreground/60">선택 법인·연도의 KAM · 강조사항</h3>
                    {selectedKams.length === 0 ? (
                        <EmptyState title="기록된 KAM·강조사항이 없습니다." />
                    ) : (
                        <ul className="space-y-2">
                            {selectedKams.map((row) => (
                                <li
                                    key={row.engagement_id}
                                    className="rounded-lg border border-card-border bg-card px-4 py-3"
                                >
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <span className="text-sm font-medium tabular-nums">
                                            {row.bsns_year}
                                            <span className="ml-2 font-normal text-foreground/60">
                                                {row.firm_name}
                                            </span>
                                        </span>
                                        <span className="text-xs text-foreground/50">
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
                    )}
            </>
        </section>
    );
}
