import type { GradeRequestItem, GradeResult } from './serverUtils';
import type { UserRoleLookup } from './dbAdmin';
import { hydrateModelAnswers } from './quizGrading.ts';
import { sanitizeExpGain, validateGradeRequest } from './utils.ts';

// 채점 요청의 관문 순서를 한 곳에 모은 파이프라인.
//
// 이 순서 자체가 보안 경계다: 등급 조회 → 페이로드 검증 → 레이트 리밋 → DB 수화 →
// Gemini 호출 → 서버 계산 경험치 적립. 한 단계라도 앞뒤가 바뀌거나 빠지면 (예: 검증
// 전에 Gemini를 부르면) 상한이 없는 것과 같다.
//
// 의존성을 주입받는 이유는 이 순서를 테스트로 고정하기 위해서다. app/actions.ts에
// 인라인으로 두면 Supabase·Gemini 없이는 한 줄도 검증할 수 없고, 관문 호출을 지워도
// 테스트가 전부 통과한다.

export interface GradePipelineDeps {
    getUserRole: (userId: string) => Promise<UserRoleLookup>;
    consumeQuota: (userId: string) => Promise<boolean>;
    fetchQuestions: (qids: number[]) => Promise<unknown[]>;
    gradeBatch: (items: ReturnType<typeof hydrateModelAnswers>) => Promise<{ [id: number]: GradeResult }>;
    incrementProgress: (userId: string, exp: number) => Promise<boolean>;
}

export interface GradeBatchResponse {
    results: { [id: number]: GradeResult };
    /** 이번 제출로 서버가 실제 적립한 경험치. 적립하지 않았으면 0. */
    awardedExp: number;
}

export const RATE_LIMIT_MESSAGE = (limit: number) =>
    `채점 요청이 너무 잦습니다. 분당 ${limit}회까지 채점할 수 있습니다.`;

export async function runGradePipeline(
    userId: string,
    items: GradeRequestItem[],
    rateLimit: number,
    deps: GradePipelineDeps
): Promise<GradeBatchResponse> {
    const roleLookup = await deps.getUserRole(userId);

    // 서버 액션은 누구나 POST할 수 있는 엔드포인트다. 화면의 등급별 문항 수 제한이나
    // textarea 길이는 방어선이 아니므로, 개수·길이·타입을 여기서 확인한 뒤에야
    // 비용이 드는 단계로 넘어간다.
    const validationError = validateGradeRequest(items, roleLookup.role);
    if (validationError) {
        throw new Error(validationError);
    }

    if (!(await deps.consumeQuota(userId))) {
        throw new Error(RATE_LIMIT_MESSAGE(rateLimit));
    }

    // 프롬프트에 들어갈 값(질문 본문·모범 답안·루브릭)은 전부 DB 행으로 확정한다 —
    // 클라이언트가 보낸 값은 id·qid·답안뿐이다.
    const rows = await deps.fetchQuestions(items.map((i) => i.qid));
    const batchItems = hydrateModelAnswers(items, rows as any[]);

    const validItems = batchItems.filter((item) => !item.invalid);
    const invalidItems = batchItems.filter((item) => item.invalid);

    const results: { [id: number]: GradeResult } = {};
    for (const item of invalidItems) {
        results[item.id] = {
            score: -1,
            evaluation: `⚠️ 채점 불가: ${item.errorMsg || '루브릭 유효성 검증 실패'}`,
        };
    }

    if (validItems.length > 0) {
        Object.assign(results, await deps.gradeBatch(validItems));
    }

    // 검토 화면에 보여줄 모범 답안을 결과에 실어준다.
    for (const [id, res] of Object.entries(results)) {
        const item = batchItems.find((i) => i.id.toString() === id);
        if (item) {
            res.model_answer = item.m;
        }
    }

    // 경험치는 서버가 방금 매긴 점수로만 계산한다. 클라이언트가 합계를 보내던 예전
    // 구조에서는 문제를 풀지 않고 액션만 반복 호출해도 EXP가 무제한으로 올랐다.
    //
    // 등급 조회가 실패한 경우(known: false)에도 적립을 시도한다. 진짜 익명 게스트는
    // user_cpa에 행이 없어 incrementProgress가 자연히 false를 돌려주므로 게스트 정책은
    // 그대로 유지되고, 일시적인 DB 오류로 정상 사용자의 학습 기록이 조용히 사라지는
    // 경우만 사라진다.
    const isConfirmedGuest = roleLookup.known && roleLookup.role === 'GUEST';
    let awardedExp = 0;
    if (!isConfirmedGuest) {
        // 채점 불가(-1)는 0점이 아니라 '점수 없음'이므로 합계에서 제외한다.
        const earned = Object.values(results).reduce((sum, r) => sum + Math.max(0, r.score), 0);
        const safeExp = sanitizeExpGain(earned);
        if (safeExp > 0 && (await deps.incrementProgress(userId, safeExp))) {
            awardedExp = safeExp;
        }
    }

    return { results, awardedExp };
}
