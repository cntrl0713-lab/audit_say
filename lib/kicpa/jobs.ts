import 'server-only';
import { getSupabaseServerClient } from '../supabaseServer';
import type { KicpaJob, KicpaJobsResult } from './types';

export const KICPA_JOBS_LIMIT = 50;
const PUBLIC_COLUMNS = 'board, id, title, company, posted_at, source_url, firm_id, created_at';

/** Public RLS applies to this client; no privileged subscriber access is needed. */
export async function getKicpaJobs(firmId?: number): Promise<KicpaJobsResult> {
    if (firmId !== undefined && (!Number.isSafeInteger(firmId) || firmId <= 0)) {
        throw new Error('올바른 회계법인을 선택해주세요.');
    }
    const db = await getSupabaseServerClient();
    let query = db.from('cpa_kicpa_jobs').select(PUBLIC_COLUMNS);
    if (firmId !== undefined) query = query.eq('firm_id', firmId);
    const { data, error } = await query
        .order('posted_at', { ascending: false, nullsFirst: false })
        // Same-day posts follow descending source IDs, independent of collection time.
        .order('id', { ascending: false })
        .order('board')
        .limit(KICPA_JOBS_LIMIT);
    // Before migration, absence of the relation is different from a valid empty listing.
    if (error?.code === 'PGRST205' || error?.code === '42P01') return { status: 'unavailable' };
    if (error) throw new Error('채용공고를 불러오지 못했습니다.', { cause: error });
    return { status: 'available', jobs: (data ?? []) as KicpaJob[] };
}
