import type { PublicQuestionSetV3 } from './questionV3.ts';
import type { QuestionSetGradeResultV3 } from './questionV3Grading.ts';

export type RankingPeriod = 'all' | 'week' | 'month';
export type ReviewItemStatus = 'open' | 'resolved' | 'removed';
export type AttemptStatus = 'queued' | 'grading' | 'completed' | 'failed';

export interface PublicLearningQuestionSetV3 extends PublicQuestionSetV3 {
    release_id?: string;
    set_version_id?: string;
    subquestions: Array<PublicQuestionSetV3['subquestions'][number] & {
        logical_subquestion_id?: string;
    }>;
}

export interface LeaderboardEntry {
    rank: number;
    username: string;
    role: 'MEMBER' | 'PRO' | 'ADMIN' | 'GUEST';
    level: number;
    exp: number;
}

export interface AttemptHistoryItem {
    id: string;
    question_set_id: string;
    title: string;
    submitted_at: string;
    status: AttemptStatus;
    score: number | null;
    max_points: number;
    expires_at?: string | null;
}

export interface ReviewItem {
    // Stable logical subquestion, independent of the displayed grading revision.
    id: string;
    subquestion_id: string;
    question_set_id: string;
    title: string;
    prompt: string;
    status: ReviewItemStatus;
    memo: string;
    updated_at: string;
    last_attempt_id?: string | null;
    last_failed_attempt_id?: string | null;
    last_result?: QuestionSetGradeResultV3 | null;
}

export interface AttemptHistoryCursor { submitted_at: string; id: string }

export interface SubmissionPreparationInput {
    release_id: string;
    set_version_id: string;
    answers: Record<string, string>;
}

export interface LearningActionFailure {
    ok: false;
    code: string;
    message: string;
}

export type SubmissionPreparationResult =
    | { ok: true; submission_token: string }
    | LearningActionFailure;

export type AttemptResultActionResult =
    | { ok: true; result: QuestionSetGradeResultV3; attempt_id: string }
    | LearningActionFailure;

export interface ReviewItemUpdateInput {
    subquestion_id: string;
    status: ReviewItemStatus;
    memo?: string;
}

export type ReviewItemUpdateResult = { ok: true } | LearningActionFailure;
