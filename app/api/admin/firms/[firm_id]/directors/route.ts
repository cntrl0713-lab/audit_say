import { assertAdmin } from '@/lib/supabaseServer';
import { getFirmDirectorReport } from '@/lib/firm/adminQueries';
import { isAnnualStartYear, isAnnualYear } from '@/lib/firm/annualYears';

export async function GET(request: Request, { params }: { params: Promise<{ firm_id: string }> }) {
    const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
    try { await assertAdmin(); } catch { return Response.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403, headers }); }
    const { firm_id } = await params;
    const url = new URL(request.url);
    const id = Number(firm_id), startYear = Number(url.searchParams.get('fy_start_year') ?? '0'), legacyEndYear = Number(url.searchParams.get('year') ?? '0'), page = Number(url.searchParams.get('page') ?? '1');
    if (!Number.isSafeInteger(id) || id < 1 || (startYear !== 0 && !isAnnualStartYear(startYear)) || (legacyEndYear !== 0 && !isAnnualYear(legacyEndYear)) || !Number.isSafeInteger(page) || page < 1 || page > 10000) return Response.json({ error: '조회 조건 오류' }, { status: 400, headers });
    try { return Response.json(await getFirmDirectorReport(id, startYear, page, url.searchParams.get('fy_end_date') ?? undefined, legacyEndYear), { headers }); }
    catch (error) { return Response.json({ error: '조회 실패' }, { status: error instanceof Error && error.message === 'Invalid parameters' ? 400 : 500, headers }); }
}
