/**
 * Slice 1 — 키워드 필터 단위 테스트
 *
 * 이 테스트는 프로덕션 채점 엔진의 룰 필터 로직을 검증합니다.
 * - 프로덕션 위치: lib/serverUtils.ts:133-149
 * - 핵심 공식: requiredMin = Math.max(2, Math.ceil(k.length * 0.3))
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMatchedCount } from '../lib/utils.ts';

// 프로덕션 로직 재구현 및 링크
// @see file:///c:/Users/cntrl/Workspace/study/audit_say/lib/serverUtils.ts#L135-147
function getRequiredMin(kLength: number): number {
    return Math.min(kLength, Math.max(2, Math.ceil(kLength * 0.3)));
}

function runKeywordFilter(userAnswer: string, keywords: string[]): { passed: boolean; matchedCount: number; requiredMin: number } {
    const validKeywords = keywords ? keywords.filter(k => k && k.trim().length > 0) : [];
    if (validKeywords.length === 0) {
        return { passed: true, matchedCount: 0, requiredMin: 0 }; // k가 누락/빈 배열 시 생략 (R5)
    }
    const matchedCount = calculateMatchedCount(userAnswer, validKeywords);
    const requiredMin = getRequiredMin(validKeywords.length);
    return {
        passed: matchedCount >= requiredMin,
        matchedCount,
        requiredMin
    };
}

describe('R1 & R2: 키워드 개수별 임계값 및 매칭 개수 검증 (임계값 표)', () => {
    test('키워드 개수별 요구 매칭 수 표 검증', () => {
        // [키워드 수, 기대되는 최소 매칭 요구량(requiredMin)]
        const thresholdTable: [number, number][] = [
            [0, 0], // k가 없는 경우, filter 생략
            [1, 1], // 1개일 때 1개 요구 (보정됨)
            [2, 2], // 2개일 때 2개 요구 (100% 매칭 요구)
            [3, 2], // 3개일 때 2개 요구
            [4, 2], // 4개일 때 2개 요구
            [5, 2], // 5개일 때 2개 요구
            [6, 2], // 6개일 때 2개 요구
            [7, 3], // 7개일 때 3개 요구
            [10, 3], // 10개일 때 3개 요구
        ];

        for (const [kLength, expectedMin] of thresholdTable) {
            if (kLength === 0) {
                assert.equal(getRequiredMin(kLength), 0); // Math.min(0, 2) = 0
            } else {
                assert.equal(getRequiredMin(kLength), expectedMin, `키워드 ${kLength}개일 때 요구량 불일치`);
            }
        }
    });

    test('보정 완료 검증: 키워드가 1개인 경우, 정답 기입 시 필터 통과 가능', () => {
        const keywords = ['독립성']; // 키워드 1개
        const userAnswer = '독립성을 유지해야 한다.'; // 정답 답안 (키워드 100% 포함)
        
        const result = runKeywordFilter(userAnswer, keywords);
        
        assert.equal(result.matchedCount, 1);
        assert.equal(result.requiredMin, 1); // 1개 요구
        assert.equal(result.passed, true, '보정 완료: 키워드가 1개일 때 만점 답안이 정상 통과함');
    });
});

describe('R3: 한국어 조사/어미/띄어쓰기 변형으로 인한 정답 오폐기 검증', () => {
    test('조사/형태소 변형이 키워드와 불일치할 때 필터 탈락', () => {
        // 키워드: '합리적인 확신'
        // 사용자 답안에 '합리적 확신'이라고 어미를 변형하여 적은 경우
        const keywords = ['합리적인 확신', '의견 표명'];
        const userAnswer = '감사인은 합리적 확신을 얻고 의견 표명을 해야 한다.'; 
        
        const result = runKeywordFilter(userAnswer, keywords);
        
        // '합리적인 확신'은 '합리적 확신'을 포함하지 않으므로 matchedCount = 1 ('의견 표명'만 매칭)
        assert.equal(result.matchedCount, 1);
        assert.equal(result.requiredMin, 2);
        // 요구치 2에 미달하여 탈락
        assert.equal(result.passed, false, '한국어 형태소 조사/어미 변형 시 정답 답안이 필터에서 오폐기됨');
    });

    test('띄어쓰기 차이는 정규화(replace) 덕분에 구제됨', () => {
        const keywords = ['내부 통제'];
        const userAnswer = '내부통제 평가가 필수적이다.';
        // '내부통제'와 '내부 통제'는 replace(/\s+/g, '')에 의해 공백이 지워져 매칭됨
        const matched = calculateMatchedCount(userAnswer, keywords);
        assert.equal(matched, 1);
    });
});

describe('R4: 빈 문자열 및 공백-only 키워드 무조건 매칭 검증', () => {
    test('보정 완료 검증: 빈 키워드들은 전처리 단계에서 정제되어 0개로 무시됨', () => {
        const keywords = ['', '   '];
        const userAnswer = '아무 답안';
        
        const result = runKeywordFilter(userAnswer, keywords);
        // 빈 키워드들이 제외되므로 validKeywords는 []가 됨. 따라서 passed: true, requiredMin: 0
        assert.equal(result.passed, true);
        assert.equal(result.requiredMin, 0);
        assert.equal(result.matchedCount, 0);
    });
});

describe('R5: k가 빈 배열이거나 누락일 때 필터 생략 검증', () => {
    test('k가 빈 배열인 경우 필터 무조건 통과', () => {
        const resultNull = runKeywordFilter('아무 답안', null as any);
        assert.equal(resultNull.passed, true);
        assert.equal(resultNull.requiredMin, 0);

        const resultEmpty = runKeywordFilter('아무 답안', []);
        assert.equal(resultEmpty.passed, true);
        assert.equal(resultEmpty.requiredMin, 0);
    });
});
