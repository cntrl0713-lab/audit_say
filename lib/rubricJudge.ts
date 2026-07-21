import type { RubricSub, RubricItem } from './rubric.ts';

export interface ItemVerdict {
    id: string; // "subNum-itemNum" 형태, 예: "1-1"
    verdict: '포함' | '부분' | '누락';
    quote?: string;
}

export interface VerdictFlags {
    injection_detected?: boolean;
    salad_detected?: boolean;
    irrelevant_severity?: 'none' | 'minor' | 'major';
    order_ok?: { [sub: number]: boolean };
}

/**
 * 텍스트의 모든 공백을 제거하고 소문자로 정규화합니다.
 */
export function normalizeText(text: string): string {
    return text.replace(/\s+/g, '').toLowerCase();
}

/**
 * [R2] 인용 검증
 * 포함/부분 판정이 내려진 verdict의 quote가 사용자 답안 내에 substring으로 존재하는지 검증합니다.
 * quote가 없거나 사용자 답안에 존재하지 않는 경우 '누락'으로 강등 처리합니다.
 */
export function verifyVerdicts(userAnswer: string, verdicts: ItemVerdict[]): ItemVerdict[] {
    const normAnswer = normalizeText(userAnswer);
    return verdicts.map(v => {
        if (v.verdict === '포함' || v.verdict === '부분') {
            if (!v.quote) {
                return { ...v, verdict: '누락' };
            }
            const normQuote = normalizeText(v.quote);
            if (normQuote === '' || !normAnswer.includes(normQuote)) {
                return { ...v, verdict: '누락' };
            }
        }
        return v;
    });
}

/**
 * [R3] 중복 인용 차단
 * 정규화된 quote가 완전 동일한 여러 개의 득점 항목(포함/부분)이 존재할 경우,
 * 그 중 배점(points)이 가장 높은 항목 1개만 인정하고 나머지는 '누락'으로 강등합니다.
 * 배점이 같을 경우에는 ID 문자열 순서(알파벳순)로 1순위를 결정하여 일관성을 보장합니다.
 */
export function deduplicateQuotes(rubric: RubricSub[], verdicts: ItemVerdict[]): ItemVerdict[] {
    // 모든 item의 points 배점 매핑
    const itemPointsMap = new Map<string, number>();
    rubric.forEach(sub => {
        if (sub.items && Array.isArray(sub.items)) {
            sub.items.forEach((item: RubricItem) => {
                itemPointsMap.set(item.id, item.points);
            });
        }
    });

    const activeVerdicts = verdicts.filter(v => v.verdict === '포함' || v.verdict === '부분');
    const quoteGroups = new Map<string, ItemVerdict[]>();

    activeVerdicts.forEach(v => {
        if (v.quote) {
            const normQuote = normalizeText(v.quote);
            if (!quoteGroups.has(normQuote)) {
                quoteGroups.set(normQuote, []);
            }
            quoteGroups.get(normQuote)!.push(v);
        }
    });

    const forceMissingIds = new Set<string>();

    quoteGroups.forEach((group) => {
        if (group.length > 1) {
            // 배점 기준으로 내림차순 정렬, 배점이 같으면 id 알파벳순(안정 정렬)
            group.sort((a, b) => {
                const pa = itemPointsMap.get(a.id) || 0;
                const pb = itemPointsMap.get(b.id) || 0;
                if (pb !== pa) return pb - pa;
                return a.id.localeCompare(b.id);
            });
            // 첫 번째 항목(가장 높은 배점)을 제외한 나머지는 누락 강등 대상
            for (let i = 1; i < group.length; i++) {
                forceMissingIds.add(group[i].id);
            }
        }
    });

    return verdicts.map(v => {
        if (forceMissingIds.has(v.id)) {
            return { ...v, verdict: '누락' };
        }
        return v;
    });
}

/**
 * [R4] 산술 순수 함수
 * 루브릭 배점과 각 항목 판정(verdict) 및 추가 플래그들을 종합하여 최종 점수(0~10점, 0.5점 단위)를 계산합니다.
 */
export function scoreFromVerdicts(rubric: RubricSub[], verdicts: ItemVerdict[], flags: VerdictFlags): number {
    // 1. 보안 공격 시 무조건 0점 처리
    if (flags.injection_detected || flags.salad_detected) {
        return 0;
    }

    const verdictMap = new Map<string, ItemVerdict>();
    verdicts.forEach(v => verdictMap.set(v.id, v));

    let totalScore = 0;

    rubric.forEach(sub => {
        let subRawScore = 0;

        if (sub.mode === 'all') {
            if (sub.items && Array.isArray(sub.items)) {
                sub.items.forEach((item: RubricItem) => {
                    const v = verdictMap.get(item.id);
                    if (v) {
                        if (v.verdict === '포함') {
                            subRawScore += item.points;
                        } else if (v.verdict === '부분') {
                            subRawScore += item.points * 0.5;
                        }
                    }
                });
            }
        } else if (sub.mode === 'best_n') {
            const n = sub.n || (sub.items ? sub.items.length : 1);
            let subInclusions = 0;
            let subPartials = 0;

            if (sub.items && Array.isArray(sub.items)) {
                sub.items.forEach((item: RubricItem) => {
                    const v = verdictMap.get(item.id);
                    if (v) {
                        if (v.verdict === '포함') {
                            subInclusions++;
                        } else if (v.verdict === '부분') {
                            subPartials++;
                        }
                    }
                });
            }

            const earnedN = subInclusions + 0.5 * subPartials;
            const cappedEarned = Math.min(n, earnedN);
            subRawScore = (sub.points * cappedEarned) / n;
        }

        // 2. ordered sub 감점 처리 (order_ok = false일 경우 50% 감점)
        if (sub.ordered === true) {
            const isOrderOk = flags.order_ok?.[sub.sub] !== false; // 기본값은 true (false 명시 시에만 감점)
            if (!isOrderOk) {
                subRawScore *= 0.5;
            }
        }

        totalScore += subRawScore;
    });

    // 3. 무관하거나 틀린 서술(irrelevant_severity) 감점 차감
    if (flags.irrelevant_severity === 'minor') {
        totalScore -= 1;
    } else if (flags.irrelevant_severity === 'major') {
        totalScore -= 3;
    }

    // 4. 0.5 단위 반올림 및 0~10 클램프
    let finalScore = Math.round(totalScore * 2) / 2;
    finalScore = Math.max(0, Math.min(10, finalScore));

    return finalScore;
}

/**
 * 판정 파이프라인 계약: 인용 검증(R2) → 중복 인용 차단(R3) → 산술(R4)을
 * 반드시 이 순서로 실행한다. 호출자(Slice 2의 gradeWithRubric 등)는 개별
 * 함수를 직접 조합하지 말고 이 함수만 사용해, 단계 누락(특히 dedupe 생략으로
 * 인한 동일 구절 이중 득점)을 구조적으로 방지한다.
 */
export function judgeAndScore(
    userAnswer: string,
    rubric: RubricSub[],
    verdicts: ItemVerdict[],
    flags: VerdictFlags
): { finalVerdicts: ItemVerdict[]; score: number } {
    const verified = verifyVerdicts(userAnswer, verdicts);
    const deduped = deduplicateQuotes(rubric, verified);
    const score = scoreFromVerdicts(rubric, deduped, flags);
    return { finalVerdicts: deduped, score };
}

/**
 * [R3] 균형 중괄호 스캔을 통한 첫 번째 완결 JSON 객체 추출기
 * gradeBatch의 gradeItem 내부에 있는 로직을 그대로 복제하여 신규 export합니다.
 */
export function extractFirstJson(str: string): any {
    try {
        return JSON.parse(str); // 전체 파싱 우선 시도
    } catch (e) {
        const startIdx = str.indexOf('{');
        if (startIdx === -1) throw e;

        let braceCount = 0;
        let inString = false;
        let escape = false;

        for (let i = startIdx; i < str.length; i++) {
            const char = str[i];
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (!inString) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        const candidate = str.substring(startIdx, i + 1);
                        return JSON.parse(candidate);
                    }
                }
            }
        }
        throw e;
    }
}

/**
 * [R2] 판정 API 원시 응답 파싱용 순수 함수
 * API 응답을 파싱하여 verdicts와 flags로 구조화합니다.
 * 루브릭에 정의되었으나 응답에서 누락된 item id는 '누락' verdict로 기본치를 채워 넣습니다.
 */
export function parseJudgmentResponse(
    text: string,
    rubric: RubricSub[]
): { verdicts: ItemVerdict[]; flags: VerdictFlags } {
    const parsed = extractFirstJson(text);

    // 1. verdicts 파싱 및 누락된 item id 보정
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.verdicts)) {
        throw new Error('verdicts is not an array or missing');
    }
    const verdictsFromResponse = parsed.verdicts;
    const verdictMap = new Map<string, ItemVerdict>();
    for (const v of verdictsFromResponse) {
        if (v && typeof v === 'object' && typeof v.id === 'string') {
            const verdictVal = v.verdict;
            verdictMap.set(v.id, {
                id: v.id,
                verdict: (verdictVal === '포함' || verdictVal === '부분' || verdictVal === '누락') ? verdictVal : '누락',
                quote: typeof v.quote === 'string' ? v.quote : undefined
            });
        }
    }

    const finalVerdicts: ItemVerdict[] = [];
    for (const sub of rubric) {
        if (sub.items && Array.isArray(sub.items)) {
            for (const item of sub.items) {
                const existing = verdictMap.get(item.id);
                if (existing) {
                    finalVerdicts.push(existing);
                } else {
                    finalVerdicts.push({ id: item.id, verdict: '누락' });
                }
            }
        }
    }

    // 2. flags 처리 및 order_ok 문자열 키 대응
    let orderOkFlags: { [sub: number]: boolean } | undefined = undefined;
    if (parsed.order_ok && typeof parsed.order_ok === 'object' && !Array.isArray(parsed.order_ok)) {
        orderOkFlags = {};
        for (const [key, value] of Object.entries(parsed.order_ok)) {
            const subNum = parseInt(key, 10);
            if (!isNaN(subNum)) {
                orderOkFlags[subNum] = value === true;
            }
        }
    }

    const flags: VerdictFlags = {
        injection_detected: parsed.injection_detected === true,
        salad_detected: parsed.salad_detected === true,
        irrelevant_severity: (parsed.irrelevant_severity === 'minor' || parsed.irrelevant_severity === 'major') ? parsed.irrelevant_severity : 'none',
        order_ok: orderOkFlags
    };

    return { verdicts: finalVerdicts, flags };
}

/**
 * [R8] 물음별 피드백 생성용 순수 함수
 * sub별 충족 상태 및 감점 여부 등을 마크다운 형태로 요약합니다.
 */
export function buildJudgmentFeedback(
    rubric: RubricSub[],
    finalVerdicts: ItemVerdict[],
    flags: VerdictFlags
): string {
    // 1. 프롬프트 주입 및 키워드 샐러드 보안 예외 감지 시 최우선 명시
    if (flags.injection_detected) {
        return `⚠️ 부족한 점: 프롬프트 주입 및 점수 조작 시도 감지\n👍 잘한 점: 없음`;
    }
    if (flags.salad_detected) {
        return `⚠️ 부족한 점: 키워드 샐러드로 논리 구조 없음\n👍 잘한 점: 없음`;
    }

    const verdictMap = new Map<string, ItemVerdict>();
    for (const v of finalVerdicts) {
        verdictMap.set(v.id, v);
    }

    const deficientSubFeedbacks: string[] = [];
    const wellSubNumbers: string[] = [];

    for (const sub of rubric) {
        if (!sub.items || !Array.isArray(sub.items) || sub.items.length === 0) {
            continue;
        }

        let allInclusion = true;
        let allMissing = true;

        for (const item of sub.items) {
            const v = verdictMap.get(item.id);
            if (!v || v.verdict !== '포함') {
                allInclusion = false;
            }
            if (v && v.verdict !== '누락') {
                allMissing = false;
            }
        }

        let subStatus: '✓' | '△' | '✗' = '△';
        if (allInclusion) {
            subStatus = '✓';
        } else if (allMissing) {
            subStatus = '✗';
        }

        if (subStatus === '✓') {
            wellSubNumbers.push(`물음 ${sub.sub}`);
        } else {
            // 미흡한 item에 대한 원인 및 요약 나열
            const itemTexts = sub.items
                .map(item => {
                    const v = verdictMap.get(item.id);
                    const isMissing = !v || v.verdict === '누락';
                    const isPartial = v && v.verdict === '부분';
                    if (isMissing || isPartial) {
                        const typeLabel = isMissing ? '누락' : '부분';
                        const desc = item.item.length > 20 ? item.item.slice(0, 20) + '...' : item.item;
                        return `${typeLabel} — ${desc}`;
                    }
                    return null;
                })
                .filter(Boolean);

            deficientSubFeedbacks.push(`물음 ${sub.sub}(${subStatus}): ${itemTexts.join(', ')}`);
        }
    }

    const parts: string[] = [];
    const badText = deficientSubFeedbacks.length > 0 ? deficientSubFeedbacks.join(', ') : '없음';
    parts.push(`⚠️ 부족한 점: ${badText}`);

    const goodText = wellSubNumbers.length > 0 ? wellSubNumbers.join(', ') : '없음';
    parts.push(`👍 잘한 점: ${goodText}`);

    // 2. 무관도 감점 처리 명시
    if (flags.irrelevant_severity === 'minor') {
        parts.push('무관하거나 불필요한 서술 감점(-1점)');
    } else if (flags.irrelevant_severity === 'major') {
        parts.push('무관하거나 불필요한 서술 감점(-3점)');
    }

    return parts.join('\n');
}

