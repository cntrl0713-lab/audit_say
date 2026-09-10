export const KICPA_BOARDS = ['trainee_cpa', 'cpa'] as const;
export type KicpaBoard = (typeof KICPA_BOARDS)[number];

/** Public job fields only. Subscription and delivery data never enter the page. */
export interface KicpaJob {
    board: KicpaBoard;
    id: string;
    title: string;
    company: string | null;
    posted_at: string | null;
    deadline: string | null;
    source_url: string;
    firm_id: number | null;
    created_at: string;
}

export type KicpaJobsResult =
    | { status: 'available'; jobs: KicpaJob[] }
    | { status: 'unavailable' };
