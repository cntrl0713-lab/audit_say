/**
 * Slice 3 — 유사도 계산 유틸리티 단위 테스트
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBigramJaccard } from '../lib/utils.ts';

describe('calculateBigramJaccard 유사도 계산 검증', () => {
    test('완전 일치 단어는 유사도 1.0', () => {
        const s1 = '감사 보고서';
        const s2 = '감사보고서'; // 공백 제거 처리
        assert.equal(calculateBigramJaccard(s1, s2), 1.0);
    });

    test('완전 무관한 단어는 유사도 0.0', () => {
        const s1 = '독립성';
        const s2 = '보존기간';
        assert.equal(calculateBigramJaccard(s1, s2), 0.0);
    });

    test('부분 일치 및 동의어 치환 유사도 범위 확인', () => {
        // Q5 모범답안 변형 (동의어 치환)
        const model = '감사보고서일로부터 최소 8년간 보존하며, 소유권은 감사인(회계법인)에게 귀속된다.';
        const userSynonym = '감사보고서 날짜로부터 최하 8년 동안 보관해야 되며 소유는 감사회사(감사수행팀) 측에 귀속됩니다.';
        
        const score = calculateBigramJaccard(model, userSynonym);
        console.log(`      Q5 동의어 치환 자카드 유사도 실측값: ${score.toFixed(4)}`);
        
        // 동의어 치환 시 유사도가 최소 임계값인 0.15 이상이어야 함
        assert.ok(score >= 0.15);
    });

    test('완전 무관한 질문/답안의 유사도 범위 확인', () => {
        const modelQ1 = '재무제표가 중요한 왜곡표시 없이 작성되었는지 합리적인 확신을 얻고, 의견을 표명하는 감사보고서를 발행하는 것이다.';
        const userQ2 = '기업과 기업환경에 대한 이해를 수행하고, 재무제표 및 경영진주장 수준에서 중요한 왜곡표시 위험을 식별 및 평가하기 위해 질문, 관찰, 분석적 절차 등의 위험평가절차를 수행합니다.';
        
        const score = calculateBigramJaccard(modelQ1, userQ2);
        console.log(`      무관 질문/답안 자카드 유사도 실측값: ${score.toFixed(4)}`);
        
        // 무관한 답안은 임계값 0.15 미만이어야 룰 필터에서 오답 필터링됨
        assert.ok(score < 0.15);
    });
});
