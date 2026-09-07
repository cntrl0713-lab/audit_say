import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    getCompany,
    getCompanyAuditHistory,
    getCompanyEngagements,
    getCompanyKam,
} from '../../../../lib/firm/queries';
import { formatKrw, formatNumber } from '../../../../lib/firm/format';
import { DATA_STATUS_LABEL, MARKET_LABEL } from '../../../../lib/firm/types';
import { EmptyState, NotCollectedNotice, OpinionBadge, StatTile } from '../../_components/ui';

export default async function CompanyDetailPage({
    params,
}: {
    params: Promise<{ corp_code: string }>;
}) {
    const { corp_code } = await params;
    // DART corp_code 는 8자리 숫자다. 형식이 아니면 조회 없이 404.
    if (!/^\d{8}$/.test(corp_code)) notFound();

    const company = await getCompany(corp_code);
    if (!company) notFound();

    const [history, engagements, kams] = await Promise.all([
        getCompanyAuditHistory(corp_code),
        getCompanyEngagements(corp_code),
        getCompanyKam(corp_code),
    ]);

    // 재무 3지표는 가장 최근 사업연도 기준으로 보여 준다.
    const latest = engagements[0] ?? null;

    return (
        <section>
            <header className="mb-4 rounded-lg border border-card-border bg-card px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl">{company.corp_name}</h2>
                    <Link href="/companies" className="text-xs text-foreground/50 hover:text-primary">
                        ← 목록으로
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

            {latest === null ? (
                <NotCollectedNotice what={`${company.corp_name}의 감사`} />
            ) : (
                <>
                    <h3 className="mb-2 text-sm text-foreground/60">
                        재무 3지표
                        <span className="ml-2 text-xs text-foreground/40">
                            {latest.bsns_year} 사업연도 · {latest.fs_div === 'OFS' ? '별도' : '연결'}
                            {latest.data_status !== 'ok' ? ` · ${DATA_STATUS_LABEL[latest.data_status]}` : ''}
                        </span>
                    </h3>
                    <dl className="mb-6 grid grid-cols-3 gap-2">
                        <StatTile label="매출액" value={formatKrw(latest.revenue)} />
                        <StatTile label="영업이익" value={formatKrw(latest.operating_profit)} />
                        <StatTile label="당기순이익" value={formatKrw(latest.net_income)} />
                    </dl>

                    <h3 className="mb-2 text-sm text-foreground/60">감사 이력</h3>
                    <div className="mb-6 overflow-x-auto rounded-lg border border-card-border bg-card">
                        <table className="w-full min-w-[40rem] text-sm">
                            <thead>
                                <tr className="border-b border-card-border text-left text-xs text-foreground/50">
                                    <th className="px-4 py-2.5 font-medium">사업연도</th>
                                    <th className="px-4 py-2.5 font-medium">감사인</th>
                                    <th className="px-4 py-2.5 font-medium">의견</th>
                                    <th className="px-4 py-2.5 text-right font-medium">KAM</th>
                                    <th className="px-4 py-2.5 font-medium">변동</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((row) => (
                                    <tr
                                        key={`${row.bsns_year}-${row.firm_id}`}
                                        className="border-b border-card-border last:border-0"
                                    >
                                        <td className="px-4 py-2.5 tabular-nums">{row.bsns_year}</td>
                                        <td className="px-4 py-2.5">
                                            <Link
                                                href={`/firms/${row.firm_id}?year=${row.bsns_year}`}
                                                className="hover:text-primary"
                                            >
                                                {row.firm_name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <OpinionBadge opinion={row.adt_opinion} />
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground/70">
                                            {formatNumber(row.kam_count)}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs">
                                            {/* 첫 연도(null)는 "변동 없음"이 아니라 비교 대상이 없는 것이다 */}
                                            {row.auditor_changed === null ? (
                                                <span className="text-foreground/30">첫 기록</span>
                                            ) : (
                                                <span className="flex flex-wrap gap-2">
                                                    {row.auditor_changed ? (
                                                        <span className="text-primary">
                                                            감사인 교체 · 이전 {row.prev_firm_name}
                                                        </span>
                                                    ) : null}
                                                    {row.opinion_changed ? (
                                                        <span className="text-danger">
                                                            의견 변경 · 이전 {row.prev_adt_opinion ?? '미상'}
                                                        </span>
                                                    ) : null}
                                                    {!row.auditor_changed && !row.opinion_changed ? (
                                                        <span className="text-foreground/30">-</span>
                                                    ) : null}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h3 className="mb-2 text-sm text-foreground/60">KAM · 강조사항</h3>
                    {kams.length === 0 ? (
                        <EmptyState title="기록된 KAM·강조사항이 없습니다." />
                    ) : (
                        <ul className="space-y-2">
                            {kams.map((row) => (
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
                    )}
                </>
            )}
        </section>
    );
}
