export interface RubricItem {
    id: string; // 예: "1-1", "2-1"
    item: string;
    points: number;
    variants: string[];
}

export interface RubricSub {
    sub: number;
    label: string;
    points: number;
    mode: 'all' | 'best_n';
    items: RubricItem[];
    n?: number;
    ordered?: boolean;
}

export interface CpaQuestionV2 {
    id: number;
    part: number;
    chapter: number;
    standard: string;
    question_title: string;
    question_description: string;
    model_answer: string[];
    explanation: string;
    rubric: RubricSub[];
}

/**
 * 루브릭 데이터 구조 및 비즈니스 룰 검증
 * @param rubric RubricSub 배열
 * @returns 발생한 오류 메시지 배열 (오류가 없으면 빈 배열)
 */
export function validateRubric(rubric: RubricSub[]): string[] {
    const errors: string[] = [];

    if (!Array.isArray(rubric)) {
        errors.push('루브릭은 배열이어야 합니다.');
        return errors;
    }

    if (rubric.length === 0) {
        errors.push('루브릭 항목이 비어있습니다.');
        return errors;
    }

    // 1. 물음(sub) points 합계가 10이어야 함 (부동소수점 오차 감안)
    const totalPoints = rubric.reduce((sum, s) => sum + (s.points || 0), 0);
    if (Math.abs(totalPoints - 10) > 1e-9) {
        errors.push(`루브릭 총 배점의 합이 10점이어야 합니다. 현재 합계: ${totalPoints}점`);
    }

    const itemIds = new Set<string>();

    rubric.forEach((sub, subIdx) => {
        const subLabel = `물음 ${sub.sub || subIdx + 1} (${sub.label || '라벨 없음'})`;

        if (typeof sub.sub !== 'number' || sub.sub <= 0) {
            errors.push(`${subLabel}: sub 번호는 1 이상의 정수여야 합니다.`);
        }

        if (typeof sub.points !== 'number' || sub.points <= 0) {
            errors.push(`${subLabel}: 배점(points)은 0보다 큰 숫자여야 합니다.`);
        }

        if (sub.mode !== 'all' && sub.mode !== 'best_n') {
            errors.push(`${subLabel}: mode는 'all' 또는 'best_n'이어야 합니다.`);
        }

        if (sub.ordered !== undefined && typeof sub.ordered !== 'boolean') {
            errors.push(`${subLabel}: ordered는 boolean이어야 합니다.`);
        }

        if (!Array.isArray(sub.items) || sub.items.length === 0) {
            errors.push(`${subLabel}: 세부 항목(items) 배열이 비어있을 수 없습니다.`);
            return; // 세부 항목이 없으면 하위 검증 건너뜀
        }

        // Mode별 추가 검증
        if (sub.mode === 'best_n') {
            if (typeof sub.n !== 'number' || sub.n <= 0) {
                errors.push(`${subLabel}: best_n 모드에서는 n(선택 개수)이 1 이상의 정수여야 합니다.`);
            } else {
                if (sub.n > sub.items.length) {
                    errors.push(`${subLabel}: n값(${sub.n})은 세부 항목 개수(${sub.items.length})보다 클 수 없습니다.`);
                }

                // 모든 item의 points가 동일하고, n * item.points = sub.points인지 확인
                const firstItemPoints = sub.items[0].points;
                const allSamePoints = sub.items.every(item => item.points === firstItemPoints);
                if (!allSamePoints) {
                    errors.push(`${subLabel}: best_n 모드에서는 모든 세부 항목의 배점이 동일해야 합니다.`);
                } else {
                    const expectedSubPoints = sub.n * firstItemPoints;
                    if (Math.abs(expectedSubPoints - sub.points) > 1e-9) {
                        errors.push(
                            `${subLabel}: n * 세부 항목 배점(${sub.n} * ${firstItemPoints} = ${expectedSubPoints})이 물음 배점(${sub.points})과 일치해야 합니다.`
                        );
                    }
                }
            }
        } else if (sub.mode === 'all') {
            // all 모드: items 배점 합 = sub.points
            const itemsSum = sub.items.reduce((sum, item) => sum + (item.points || 0), 0);
            if (Math.abs(itemsSum - sub.points) > 1e-9) {
                errors.push(
                    `${subLabel}: 세부 항목 배점의 합(${itemsSum}점)이 물음 배점(${sub.points}점)과 일치해야 합니다.`
                );
            }
        }

        // 세부 항목(item) 검증
        sub.items.forEach((item, itemIdx) => {
            const itemLabel = `${subLabel} - 항목 ${item.id || itemIdx + 1}`;

            if (!item.id || typeof item.id !== 'string') {
                errors.push(`${itemLabel}: 항목 ID가 누락되었거나 문자열이 아닙니다.`);
            } else {
                // item.id가 <sub>-<순번> 형식인지 검증
                const idParts = item.id.split('-');
                if (idParts.length !== 2 || idParts[0] !== String(sub.sub) || isNaN(Number(idParts[1]))) {
                    errors.push(`${itemLabel}: 항목 ID '${item.id}'는 '물음번호-순번' (예: ${sub.sub}-1) 형식이어야 합니다.`);
                }

                // 전체 유일성 검증
                if (itemIds.has(item.id)) {
                    errors.push(`${itemLabel}: 중복된 항목 ID '${item.id}'가 존재합니다.`);
                } else {
                    itemIds.add(item.id);
                }
            }

            if (!item.item || typeof item.item !== 'string' || item.item.trim() === '') {
                errors.push(`${itemLabel}: 채점 항목 내용(item)이 비어있습니다.`);
            }

            if (typeof item.points !== 'number' || item.points < 0) {
                errors.push(`${itemLabel}: 항목 배점(points)은 0 이상의 숫자여야 합니다.`);
            }

            if (!Array.isArray(item.variants) || item.variants.length === 0) {
                errors.push(`${itemLabel}: variants(유사 답안) 배열이 비어있을 수 없습니다.`);
            } else {
                item.variants.forEach((v, vIdx) => {
                    if (typeof v !== 'string') {
                        errors.push(`${itemLabel} - variants[${vIdx}]: 문자열이 아닙니다.`);
                    } else if (v.trim().length < 2) {
                        errors.push(`${itemLabel} - variants[${vIdx}]: 유사 답안 '${v}'은 2글자 이상이어야 합니다.`);
                    }
                });
            }
        });
    });

    return errors;
}

/**
 * CPA 문제 데이터 V2 전체 행의 타입 및 구조 검증
 * @param question 검증할 문제 객체
 * @returns 발생한 오류 메시지 배열 (오류가 없으면 빈 배열)
 */
export function validateCpaQuestionV2(question: any): string[] {
    const errors: string[] = [];
    const qid = question?.id ?? '?';

    if (!question || typeof question !== 'object') {
        errors.push(`[문제 ${qid}] 올바른 객체 형식이 아닙니다.`);
        return errors;
    }

    // 필수 필드 및 타입 검증
    const requiredFields = [
        { name: 'id', type: 'number' },
        { name: 'part', type: 'number' },
        { name: 'chapter', type: 'number' },
        { name: 'standard', type: 'string' },
        { name: 'question_title', type: 'string' },
        { name: 'question_description', type: 'string' },
        { name: 'model_answer', type: 'array' },
        { name: 'explanation', type: 'string' },
        { name: 'rubric', type: 'array' }
    ];

    requiredFields.forEach(f => {
        const val = question[f.name];
        if (val === undefined || val === null) {
            errors.push(`[문제 ${qid}] 필수 필드가 누락되었습니다: '${f.name}'`);
            return;
        }

        if (f.type === 'array') {
            if (!Array.isArray(val)) {
                errors.push(`[문제 ${qid}] '${f.name}' 필드는 배열이어야 합니다.`);
            }
        } else {
            if (typeof val !== f.type) {
                errors.push(`[문제 ${qid}] '${f.name}' 필드는 ${f.type} 타입이어야 합니다. 현재 타입: ${typeof val}`);
            }
        }
    });

    if (errors.length > 0) {
        return errors;
    }

    // 정수 검증
    if (!Number.isInteger(question.id)) {
        errors.push(`[문제 ${qid}] 'id'는 정수여야 합니다.`);
    }
    if (!Number.isInteger(question.part)) {
        errors.push(`[문제 ${qid}] 'part'는 정수여야 합니다.`);
    }
    if (!Number.isInteger(question.chapter)) {
        errors.push(`[문제 ${qid}] 'chapter'는 정수여야 합니다.`);
    }

    // 빈 문자열 검증
    if (typeof question.standard === 'string' && question.standard.trim() === '') {
        errors.push(`[문제 ${qid}] 'standard'가 비어있습니다.`);
    }
    if (typeof question.question_title === 'string' && question.question_title.trim() === '') {
        errors.push(`[문제 ${qid}] 'question_title'이 비어있습니다.`);
    }
    if (typeof question.question_description === 'string' && question.question_description.trim() === '') {
        errors.push(`[문제 ${qid}] 'question_description'이 비어있습니다.`);
    }
    if (typeof question.explanation === 'string' && question.explanation.trim() === '') {
        errors.push(`[문제 ${qid}] 'explanation'이 비어있습니다.`);
    }

    // model_answer 검증
    if (Array.isArray(question.model_answer)) {
        if (question.model_answer.length === 0) {
            errors.push(`[문제 ${qid}] 'model_answer'는 비어있지 않은 배열이어야 합니다.`);
        } else {
            question.model_answer.forEach((ans: any, idx: number) => {
                if (typeof ans !== 'string' || ans.trim() === '') {
                    errors.push(`[문제 ${qid}] 'model_answer'의 ${idx}번째 요소는 비어있지 않은 문자열이어야 합니다.`);
                }
            });
        }
    }

    // rubric 검증
    if (Array.isArray(question.rubric)) {
        const rubricErrors = validateRubric(question.rubric);
        rubricErrors.forEach(err => {
            errors.push(`[문제 ${qid}] 루브릭 오류: ${err}`);
        });
    }

    return errors;
}

/**
 * 루브릭의 모든 세부 항목에 있는 variants를 중복 제거하여 평탄화된 키워드 배열로 반환합니다.
 * @param rubric RubricSub 배열
 * @returns 평탄화된 variants 문자열 배열
 */
export function flattenRubricVariants(rubric: RubricSub[]): string[] {
    if (!rubric || !Array.isArray(rubric)) return [];
    const variants = new Set<string>();
    rubric.forEach(sub => {
        if (sub.items && Array.isArray(sub.items)) {
            sub.items.forEach(item => {
                if (item.variants && Array.isArray(item.variants)) {
                    item.variants.forEach(v => {
                        if (v && typeof v === 'string') {
                            variants.add(v);
                        }
                    });
                }
            });
        }
    });
    return Array.from(variants);
}

export interface RubricCoverageResult {
    bestSubCoverage: number; // 0.0 ~ 1.0
    bestSub: number; // sub.sub (물음 번호)
    matchedItemIds: string[];
}

/**
 * 답안과 루브릭을 비교하여 sub별 커버리지를 계산하고 최적의 결과를 반환합니다.
 * @param answer 사용자 답안
 * @param rubric RubricSub 배열
 */
export function computeRubricCoverage(answer: string, rubric: RubricSub[]): RubricCoverageResult {
    if (!rubric || !Array.isArray(rubric) || rubric.length === 0) {
        return { bestSubCoverage: 0, bestSub: 0, matchedItemIds: [] };
    }

    const normalizedAnswer = (answer || '').replace(/\s+/g, '').toLowerCase();
    const matchedItemIds: string[] = [];
    const subResults: { sub: number; coverage: number }[] = [];

    rubric.forEach(sub => {
        let matchedInSub = 0;

        if (sub.items && Array.isArray(sub.items)) {
            sub.items.forEach(item => {
                const isMatched = item.variants && Array.isArray(item.variants) && item.variants.some(v => {
                    if (typeof v !== 'string') return false;
                    const normalizedVariant = v.replace(/\s+/g, '').toLowerCase();
                    if (normalizedVariant.length === 0) return false;
                    return normalizedAnswer.includes(normalizedVariant);
                });

                if (isMatched) {
                    matchedInSub++;
                    if (!matchedItemIds.includes(item.id)) {
                        matchedItemIds.push(item.id);
                    }
                }
            });
        }

        const itemsCount = sub.items ? sub.items.length : 0;
        let denominator = itemsCount;

        if (sub.mode === 'best_n') {
            const nVal = typeof sub.n === 'number' ? sub.n : itemsCount;
            denominator = Math.min(nVal, itemsCount);
        }

        const coverage = denominator > 0 ? Math.min(1.0, matchedInSub / denominator) : 0;
        subResults.push({ sub: sub.sub, coverage });
    });

    let bestSubCoverage = 0;
    let bestSub = rubric[0].sub;

    subResults.forEach(res => {
        if (res.coverage > bestSubCoverage) {
            bestSubCoverage = res.coverage;
            bestSub = res.sub;
        }
    });

    // 만약 모든 sub의 커버리지가 0인 경우, 첫 번째 sub를 반환합니다.
    if (bestSubCoverage === 0 && rubric.length > 0) {
        bestSub = rubric[0].sub;
    }

    return {
        bestSubCoverage,
        bestSub,
        matchedItemIds
    };
}

/**
 * ordered 플래그에 따라 추가 채점 지시 문구를 생성합니다.
 * @param rubric RubricSub 배열
 * @returns 추가 지시 블록 문자열 또는 null
 */
export function buildOrderedNotice(rubric: RubricSub[]): string | null {
    if (!rubric || !Array.isArray(rubric)) return null;

    const orderedSubs = rubric.filter(s => s.ordered === true);
    if (orderedSubs.length === 0) return null;

    const isAllOrdered = orderedSubs.length === rubric.length || rubric.length === 1;

    if (isAllOrdered) {
        return [
            '[추가 채점 지시 — 이 문항 전용]',
            '이 문제의 모범 답안은 각 단계가 선후관계로 연결된 순차적 절차입니다(앞 단계의 결과가 다음 단계의 전제가 됨).',
            '사용자 답안이 이 절차의 선후 순서를 뒤바꿔 서술한 경우, 절차 논리 훼손으로 보고 반드시 감점하십시오(완전 역순이면 절반 이하 점수).'
        ].join('\n');
    } else {
        const subNumbersStr = orderedSubs.map(s => `물음 ${s.sub}`).join(', ');
        return [
            '[추가 채점 지시 — 이 문항 전용]',
            `${subNumbersStr}의 모범 답안은 각 단계가 선후관계로 연결된 순차적 절차입니다(앞 단계의 결과가 다음 단계의 전제가 됨).`,
            '사용자 답안이 이 절차의 선후 순서를 뒤바꿔 서술한 경우, 절차 논리 훼손으로 보고 반드시 감점하십시오(완전 역순이면 절반 이하 점수).'
        ].join('\n');
    }
}
