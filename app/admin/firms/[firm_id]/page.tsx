import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertAdmin } from '@/lib/supabaseServer';
import { getFirmDirectorReport } from '@/lib/firm/adminQueries';
import { getRegisteredFirm } from '@/lib/firm/queries';
import { formatKrw } from '@/lib/firm/format';
import { readInt, readString, type SearchParams } from '@/lib/firm/params';
import { ANNUAL_DISPLAY_YEARS, isAnnualStartYear } from '@/lib/firm/annualYears';

export default async function FirmDirectorAdminPage({ params, searchParams }: {
    params: Promise<{ firm_id: string }>; searchParams: Promise<SearchParams>;
}) {
    try { await assertAdmin(); } catch { notFound(); }
    const id = Number((await params).firm_id), query = await searchParams;
    const requested = readInt(query, 'fy_start_year', 0), page = readInt(query, 'page', 1);
    if (!Number.isSafeInteger(id) || id < 1 || (requested !== 0 && !isAnnualStartYear(requested)) || page > 10000) notFound();
    const [firm, details] = await Promise.all([getRegisteredFirm(id), getFirmDirectorReport(id, requested, page, readString(query, 'fy_end_date'), readInt(query, 'year', 0)).catch(error => {
        if (error instanceof Error && error.message === 'Invalid parameters') notFound();
        throw error;
    })]);
    if (!firm) notFound();
    const year = details.basisYear;
    const periodQuery = details.period ? `&fy_end_date=${details.period.fy_end_date}` : '';
    const pages = Math.max(1, Math.ceil(Math.max(details.directorCount ?? 0, details.payCount ?? 0) / details.pageSize));
    return <main className="mx-auto max-w-6xl space-y-5 p-6">
        <h1 className="text-xl font-semibold">{firm.firm_name} · 관리자 전용 개인 명세</h1>
        <p className="text-sm text-foreground/60">보고기간 시작연도 기준입니다. 보수 명세는 공시 대상자 일부의 금액이며 전체 이사 평균으로 해석하지 않습니다. 마스킹된 성명은 복원하지 않습니다.</p>
        <nav className="flex gap-4">{ANNUAL_DISPLAY_YEARS.map(y => <Link key={y} href={`/admin/firms/${id}?fy_start_year=${y}`} aria-current={y === year ? 'page' : undefined} className="underline">{y}년 시작</Link>)}</nav>
        <nav className="flex flex-wrap gap-4 text-sm">{details.periods.map(p => <Link key={p.fy_end_date} href={`/admin/firms/${id}?fy_start_year=${year}&fy_end_date=${p.fy_end_date}`} aria-current={p.fy_end_date === details.period?.fy_end_date ? 'page' : undefined} className="underline">제{p.fy_seq ?? '-'}기 · {p.fy_start_date}~{p.fy_end_date}</Link>)}</nav>
        {details.period ? <p className="text-sm">선택한 보고기간: {details.period.fy_start_date} ~ {details.period.fy_end_date}</p> : <p>이 시작연도의 보고기간이 없습니다.</p>}
        <section><h2 className="mb-2 font-medium">사원·이사 경력 명세 ({details.directorCount ?? 0}행)</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['성명', '직위', '담당업무', '근무기간(개월)', '개업경력(개월)', '출자비율(%)'].map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{details.directors.map(r => <tr key={r.seq_no} className="border-t border-card-border">{[r.name, r.position, r.duty, r.tenure_months, r.practice_months, r.invest_rate].map((v, i) => <td key={i} className="p-2">{v ?? '-'}</td>)}</tr>)}</tbody></table></div>
        </section>
        <section><h2 className="mb-2 font-medium">보수 명세 ({details.payCount ?? 0}행)</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['성명', '직위', '소득 구분', '보수', '공시 표기'].map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{details.pay.map(r => <tr key={r.seq_no} className="border-t border-card-border"><td className="p-2">{r.name}</td><td className="p-2">{r.position ?? '-'}</td><td className="p-2">{r.pay_kind ?? '-'}</td><td className="p-2">{formatKrw(r.amount)}</td><td className="p-2">{r.masked ? '마스킹' : '실명'}</td></tr>)}</tbody></table></div>
        </section>
        <nav className="flex gap-4 text-sm">{page > 1 ? <Link href={`/admin/firms/${id}?fy_start_year=${year}${periodQuery}&page=${page - 1}`}>이전</Link> : null}<span>{page} / {pages}</span>{page < pages ? <Link href={`/admin/firms/${id}?fy_start_year=${year}${periodQuery}&page=${page + 1}`}>다음</Link> : null}</nav>
        <Link href={`/firms/${id}?tab=workforce&fy_start_year=${year}`} className="text-sm underline">법인 공개 정보로</Link>
    </main>;
}
