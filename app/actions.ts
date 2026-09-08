'use server';

import { assertAdmin, assertAuthenticated } from '../lib/supabaseServer';
import type { UserProfile } from '../lib/db';
import {
    checkUsernameExists,
    getAllUsers,
    getLeaderboardData,
    incrementProgress,
    updateUserRole,
} from '../lib/dbAdmin';
import { consumeGradeQuota, consumeSubmissionQuota } from '../lib/rateLimit';
import {
    classifyQuestionBankV3LoadError,
    findAuthoringQuestionSetV3,
} from '../lib/questionV3Store';
import type { QuestionBankV3LoadErrorCode } from '../lib/questionV3Store';
import { gradeQuestionSetV3 } from '../lib/questionV3Grading';
import { isQuestionSetAnswerPayloadV3, type PublicQuestionSetV3 } from '../lib/questionV3';
import type { QuestionSetGradeResultV3 } from '../lib/questionV3Grading';
import { findDatabaseQuestionVersion, loadLearningQuestionSetsV3 } from '../lib/questionV3Repository';
import { issueSubmissionToken, learningDbEnabled, submissionSigningKeys, UUID_PATTERN } from '../lib/learningSubmission';
import { gradeLearningSubmission } from '../lib/learningService';
import {
    beginAttempt, claimGradingRun, completeGradingRun, failGradingRun,
    findAttemptForSubmission, getAttemptHistory, getAttemptResult,
    getPeriodLeaderboard, getReviewItems, updateReviewItem,
} from '../lib/learningRepository';
import { publicGradeResult, safeInteger } from '../lib/learningPublic';
import type {
    AttemptHistoryCursor, AttemptHistoryItem, AttemptResultActionResult, LeaderboardEntry, RankingPeriod,
    ReviewItem, ReviewItemStatus, ReviewItemUpdateInput, ReviewItemUpdateResult,
    SubmissionPreparationInput, SubmissionPreparationResult,
} from '../lib/learningTypes';

type GradeQuestionSetV3FailureCode =
    | 'rate_limited'
    | 'grading_key_missing'
    | `question_bank_${QuestionBankV3LoadErrorCode}`
    | 'grading_service_unavailable';

export type GradeQuestionSetV3ActionResult =
    | { ok: true; result: QuestionSetGradeResultV3; attempt_id?: string }
    | { ok: false; code: GradeQuestionSetV3FailureCode | string; message: string };

function questionBankFailureMessage(code: QuestionBankV3LoadErrorCode): string {
    if (code === 'file_missing') return '채점 문제은행 배포 파일을 찾을 수 없습니다.';
    if (code === 'key_missing') return '채점 문제은행 암호화 키가 운영 환경에 설정되지 않았습니다.';
    if (code === 'decryption_failed') return '채점 문제은행 복호화에 실패했습니다. 운영 암호화 키를 확인해 주세요.';
    return '채점 문제은행 데이터 검증에 실패했습니다.';
}

export async function getQuestionSetsV3(): Promise<PublicQuestionSetV3[]> {
    await assertAdmin();
    return loadLearningQuestionSetsV3();
}

export async function checkUsernameExistsAction(username: string): Promise<boolean> {
    if (typeof username !== 'string' || username.length > 100) return true;
    const trimmed = username.trim();
    if (!trimmed) return true;
    return checkUsernameExists(trimmed);
}

export async function gradeQuestionSetV3Action(
    questionSetId: string,
    answers: Record<string, string>,
    submissionToken?: string,
): Promise<GradeQuestionSetV3ActionResult> {
    const session = await assertAuthenticated();

    if (learningDbEnabled()) {
        if (!submissionToken) return { ok: false, code: 'submission_required', message: '새 제출 정보를 준비한 뒤 채점해 주세요.' };
        try {
            return await gradeLearningSubmission(session.user.id, questionSetId, submissionToken, answers, {
                signingKeys: submissionSigningKeys(), apiKey: process.env.OPENAI_API_KEY || '',
                loadSet: findDatabaseQuestionVersion, findAttempt: findAttemptForSubmission,
                begin: beginAttempt, readResult: getAttemptResult, claim: claimGradingRun,
                complete: completeGradingRun, fail: failGradingRun,
                consumeQuota: consumeGradeQuota, consumeSubmissionQuota, grade: gradeQuestionSetV3,
            });
        } catch {
            return { ok: false, code: 'persistence_unavailable', message: '학습 기록 저장 설정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
        }
    }
    if (submissionToken) return { ok: false, code: 'database_disabled', message: 'DB 학습 기록이 일시 중단되었습니다. 기존 제출 정보를 보관해 주세요.' };

    if (typeof questionSetId !== 'string' || !/^pilot-\d{2}-\d{3}$/.test(questionSetId)) {
        throw new Error('유효하지 않은 v3 문제 세트 ID입니다.');
    }
    if (!isQuestionSetAnswerPayloadV3(answers)) {
        throw new Error('답안 데이터가 허용된 범위를 벗어났습니다.');
    }
    const answerEntries = Object.entries(answers);
    let questionSet;
    try {
        questionSet = findAuthoringQuestionSetV3(questionSetId);
    } catch (error) {
        const code = classifyQuestionBankV3LoadError(error);
        console.error(`[questionV3] authoring load failed (${code}):`, error);
        return {
            ok: false,
            code: `question_bank_${code}`,
            message: questionBankFailureMessage(code),
        };
    }
    const allowedAnswerIds = new Set(questionSet.subquestions.map((subquestion) => subquestion.id));
    if (answerEntries.some(([id]) => !allowedAnswerIds.has(id))) {
        throw new Error('문제 세트에 속하지 않는 답안이 포함되어 있습니다.');
    }
    const allBlank = questionSet.subquestions.every((subquestion) => !(answers[subquestion.id] ?? '').trim());
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!allBlank) {
        if (!apiKey) {
            return { ok: false, code: 'grading_key_missing', message: 'AI 채점 서비스 설정이 누락되었습니다.' };
        }
        if (!await consumeGradeQuota(session.user.id)) {
            return { ok: false, code: 'rate_limited', message: '채점 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' };
        }
    }
    let result: QuestionSetGradeResultV3;
    try {
        result = await gradeQuestionSetV3(questionSet, answers, apiKey);
    } catch (error) {
        console.error('[questionV3] grading service failed:', error);
        return { ok: false, code: 'grading_service_unavailable', message: 'AI 채점 서비스 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
    }
    if (result.score > 0) await incrementProgress(session.user.id, result.score);
    return { ok: true, result: publicGradeResult(result) };
}

export async function getLeaderboardAction(period: RankingPeriod = 'all'): Promise<LeaderboardEntry[]> {
    if (!['all', 'week', 'month'].includes(period)) throw new Error('지원하지 않는 랭킹 기간입니다.');
    if (learningDbEnabled()) return getPeriodLeaderboard(period);
    if (period !== 'all') throw new Error('주간·월간 순위는 DB 학습 기록 전환 후 제공됩니다.');
    let rank = 0;
    let lastExp: number | null = null;
    return (await getLeaderboardData()).map((entry) => {
        const exp = safeInteger(entry.exp);
        if (exp !== lastExp) { rank++; lastExp = exp; }
        return { rank, username: entry.username, role: entry.role, level: safeInteger(entry.level), exp };
    });
}

export async function prepareQuestionSetSubmissionAction(input: SubmissionPreparationInput): Promise<SubmissionPreparationResult> {
    const session = await assertAuthenticated();
    if (!learningDbEnabled()) return { ok: false, code: 'database_disabled', message: 'DB 학습 기록 전환을 준비 중입니다.' };
    if (!input || typeof input.release_id !== 'string' || typeof input.set_version_id !== 'string'
        || !UUID_PATTERN.test(input.release_id) || !UUID_PATTERN.test(input.set_version_id)
        || !isQuestionSetAnswerPayloadV3(input.answers)) {
        return { ok: false, code: 'invalid_submission', message: '문제 버전이나 답안이 올바르지 않습니다.' };
    }
    try {
        const questionSet = await findDatabaseQuestionVersion(input.release_id, input.set_version_id);
        return { ok: true, submission_token: issueSubmissionToken({
            owner_user_id: session.user.id, actor_kind: session.user.is_anonymous ? 'guest' : 'member',
            release_id: input.release_id, set_version_id: input.set_version_id, questionSet, answers: input.answers,
        }, submissionSigningKeys()[0]) };
    } catch {
        return { ok: false, code: 'submission_unavailable', message: '제출 정보를 준비하지 못했습니다. 문제를 다시 불러와 주세요.' };
    }
}

export async function getAttemptHistoryAction(cursor?: AttemptHistoryCursor): Promise<AttemptHistoryItem[]> {
    const session = await assertAuthenticated();
    if (!learningDbEnabled()) throw new Error('풀이 기록 저장을 준비 중입니다. DB 전환 후의 기록부터 제공됩니다.');
    if (cursor && (typeof cursor.id !== 'string' || !UUID_PATTERN.test(cursor.id)
        || typeof cursor.submitted_at !== 'string' || !Number.isFinite(Date.parse(cursor.submitted_at)))) throw new Error('올바르지 않은 기록 페이지입니다.');
    return getAttemptHistory(session.user.id, cursor);
}

export async function getAttemptResultAction(attemptId: string): Promise<AttemptResultActionResult> {
    const session = await assertAuthenticated();
    if (!learningDbEnabled()) return { ok: false, code: 'database_disabled', message: 'DB 학습 기록을 준비 중입니다.' };
    if (typeof attemptId !== 'string' || !UUID_PATTERN.test(attemptId)) return { ok: false, code: 'invalid_attempt', message: '올바르지 않은 풀이 기록입니다.' };
    try {
        const saved = await getAttemptResult(session.user.id, attemptId);
        if (!saved) return { ok: false, code: 'attempt_not_found', message: '기록을 찾을 수 없거나 보관기간이 지났습니다.' };
        if (!saved.result || saved.status !== 'completed') return { ok: false, code: 'attempt_pending', message: '아직 채점을 완료하지 않은 제출입니다. 문제 화면에서 같은 제출로 다시 시도해 주세요.' };
        return { ok: true, result: saved.result, attempt_id: saved.attempt_id };
    } catch {
        return { ok: false, code: 'attempt_unavailable', message: '풀이 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }
}

export async function getReviewItemsAction(status: ReviewItemStatus = 'open'): Promise<ReviewItem[]> {
    const session = await assertAuthenticated();
    if (session.user.is_anonymous) throw new Error('오답노트는 회원에게 제공됩니다. 비회원 풀이 결과는 7일간 확인할 수 있습니다.');
    if (!learningDbEnabled()) throw new Error('오답노트 저장을 준비 중입니다.');
    if (!['open', 'resolved', 'removed'].includes(status)) throw new Error('올바르지 않은 오답노트 상태입니다.');
    return getReviewItems(session.user.id, status);
}

export async function updateReviewItemAction(input: ReviewItemUpdateInput): Promise<ReviewItemUpdateResult> {
    const session = await assertAuthenticated();
    if (session.user.is_anonymous) return { ok: false, code: 'member_required', message: '오답노트는 회원에게 제공됩니다.' };
    if (!learningDbEnabled()) return { ok: false, code: 'database_disabled', message: '오답노트 저장을 준비 중입니다.' };
    if (!input || typeof input.subquestion_id !== 'string' || !UUID_PATTERN.test(input.subquestion_id)
        || !['open', 'resolved', 'removed'].includes(input.status)
        || (input.memo !== undefined && (typeof input.memo !== 'string' || input.memo.length > 5000))) {
        return { ok: false, code: 'invalid_review_item', message: '물음·상태·메모를 확인해 주세요. 메모는 5,000자 이하입니다.' };
    }
    try { await updateReviewItem(session.user.id, input.subquestion_id, input.status, input.memo); return { ok: true }; }
    catch { return { ok: false, code: 'review_item_unavailable', message: '오답노트를 저장하지 못했습니다. 다시 시도해 주세요.' }; }
}

export async function getAllUsersAction(): Promise<UserProfile[]> {
    await assertAdmin();
    return getAllUsers();
}

export async function updateUserRoleAction(userId: string, newRole: string): Promise<boolean> {
    await assertAdmin();

    const whitelist = ['MEMBER', 'ADMIN', 'PRO', 'GUEST'];
    if (!whitelist.includes(newRole)) {
        throw new Error('Invalid role');
    }

    return updateUserRole(userId, newRole);
}
