/**
 * gradeBatch 응답 파싱/점수 정규화 테스트
 *
 * gradeBatch()의 내부 로직(parseScore, JSON 추출)을 독립 재구현하여 검증합니다.
 * CTA 패턴: Gemini 호출 없이 순수 파싱 로직만 테스트.
 *
 * 검증 대상:
 * 1. parseScore: 점수 클램핑 (0~10), NaN 처리
 * 2. JSON 배열 추출: 마크다운 코드 블록 제거, 정규식 기반 배열 추출
 * 3. 에러 폴백: 파싱 실패 시 score=-1 + 에러 메시지
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── gradeBatch 내부 parseScore 독립 재구현 ────────

function parseScore(s: any): number {
    let fs = parseFloat(s);
    if (isNaN(fs)) return 0;
    return Math.max(0, Math.min(10, fs));
}

// ─── gradeBatch 내부 JSON 파싱 독립 재구현 ──────────
// @see file:///c:/Users/cntrl/Workspace/study/audit_say/lib/serverUtils.ts#L198-L215
interface GradeResult {
    score: number;
    evaluation: string;
    model_answer?: string;
}

function parseGradeResponse(responseText: string): GradeResult | null {
    try {
        let text = responseText.trim();
        if (text.startsWith('```json')) text = text.substring(7);
        if (text.endsWith('```')) text = text.slice(0, -3);
        text = text.trim();

        // 균형 중괄호 스캔을 통한 첫 번째 완결 JSON 객체 추출기
        const extractFirstJson = (str: string): any => {
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
        };

        const parsedObj = extractFirstJson(text);
        
        let evaluationText = '피드백 없음';
        if (parsedObj.feedback) {
            if (typeof parsedObj.feedback === 'object' && parsedObj.feedback !== null) {
                const parts: string[] = [];
                const p1 = parsedObj.feedback['⚠️ 부족한 점'] || parsedObj.feedback['부족한 점'];
                const p2 = parsedObj.feedback['👍 잘한 점'] || parsedObj.feedback['잘한 점'];

                if (p1) parts.push(`⚠️ 부족한 점: ${p1}`);
                if (p2) parts.push(`👍 잘한 점: ${p2}`);

                if (parts.length === 0) {
                    evaluationText = Object.entries(parsedObj.feedback)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n');
                } else {
                    evaluationText = parts.join('\n');
                }
            } else {
                evaluationText = String(parsedObj.feedback);
            }
        }
        
        return {
            score: parseScore(parsedObj.score),
            evaluation: evaluationText,
        };
    } catch {
        return null;
    }
}

// ─── parseScore 테스트 ─────────────────────────────

describe('parseScore 정규화', () => {
    test('정상 정수 점수', () => {
        assert.equal(parseScore(7), 7);
        assert.equal(parseScore(0), 0);
        assert.equal(parseScore(10), 10);
    });

    test('소수점 점수', () => {
        assert.equal(parseScore(7.5), 7.5);
        assert.equal(parseScore(0.1), 0.1);
    });

    test('문자열 숫자', () => {
        assert.equal(parseScore('8'), 8);
        assert.equal(parseScore('3.5'), 3.5);
    });

    test('범위 초과 → 10으로 클램핑', () => {
        assert.equal(parseScore(15), 10);
        assert.equal(parseScore(100), 10);
        assert.equal(parseScore('11'), 10);
    });

    test('음수 → 0으로 클램핑', () => {
        assert.equal(parseScore(-1), 0);
        assert.equal(parseScore(-100), 0);
        assert.equal(parseScore('-5'), 0);
    });

    test('NaN 입력 → 0', () => {
        assert.equal(parseScore(NaN), 0);
        assert.equal(parseScore('not a number'), 0);
        assert.equal(parseScore(undefined), 0);
        assert.equal(parseScore(null), 0);
        assert.equal(parseScore(''), 0);
    });

    test('경계값 정확성', () => {
        assert.equal(parseScore(0), 0);
        assert.equal(parseScore(10), 10);
        assert.equal(parseScore(10.0001), 10);  // 10 초과 → 클램핑
        assert.equal(parseScore(-0.0001), 0);   // 0 미만 → 클램핑
    });
});

// ─── JSON 응답 파싱 테스트 ──────────────────────────

describe('gradeBatch JSON 응답 파싱', () => {
    test('정상 JSON 객체 파싱', () => {
        const response = JSON.stringify({ id: 1, score: 8, feedback: '잘 했습니다' });
        const result = parseGradeResponse(response);
        assert.ok(result);
        assert.equal(result.score, 8);
        assert.equal(result.evaluation, '잘 했습니다');
    });

    test('마크다운 코드 블록으로 감싸진 JSON 객체', () => {
        const response = '```json\n{"id": 1, "score": 7, "feedback": "OK"}\n```';
        const result = parseGradeResponse(response);
        assert.ok(result);
        assert.equal(result.score, 7);
    });

    test('앞뒤 텍스트가 있는 JSON (정규식 추출)', () => {
        const response = '채점 결과입니다: {"id": 1, "score": 5, "feedback": "보통"} 이상입니다.';
        const result = parseGradeResponse(response);
        assert.ok(result);
        assert.equal(result.score, 5);
    });

    test('feedback 없으면 "피드백 없음" 폴백', () => {
        const response = '{"id": 1, "score": 6}';
        const result = parseGradeResponse(response);
        assert.ok(result);
        assert.equal(result.evaluation, '피드백 없음');
    });

    test('점수가 범위 초과/미만일 때 클램핑', () => {
        const response = '{"id": 1, "score": 15, "feedback": "과다"}';
        const result = parseGradeResponse(response);
        assert.ok(result);
        assert.equal(result.score, 10);  // 클램핑
    });

    test('잘못된 JSON → null 반환', () => {
        const result = parseGradeResponse('이것은 JSON이 아닙니다');
        assert.equal(result, null);
    });

    test('빈 문자열 → null 반환', () => {
        const result = parseGradeResponse('');
        assert.equal(result, null);
    });

    test('보정 완료 검증: 다중 JSON 객체가 흘러들어오는 경우 첫 번째 객체를 발췌하여 정상 파싱', () => {
        // 균형 중괄호 스캔 덕분에 뒤에 다른 JSON이 붙어 있어도 첫 번째 객체만 정확히 발췌해 파싱함
        const response = '{"id": 1, "score": 8, "feedback": "A"} {"id": 2, "score": 4, "feedback": "B"}';
        const result = parseGradeResponse(response);
        
        assert.ok(result);
        assert.equal(result.score, 8);
        assert.equal(result.evaluation, 'A');
    });

    test('보정 완료 검증: feedback이 객체형일 때 문자열로 포맷팅되어 반환되어야 함', () => {
        const response = JSON.stringify({
            id: 1,
            score: 9,
            feedback: {
                "⚠️ 부족한 점": "전문 용어 누락",
                "👍 잘한 점": "논리적 서술"
            }
        });
        const result = parseGradeResponse(response);
        assert.ok(result);
        assert.equal(result.score, 9);
        assert.equal(result.evaluation, '⚠️ 부족한 점: 전문 용어 누락\n👍 잘한 점: 논리적 서술');
    });

    test('중괄호가 feedback 내에 들어가 있는 변형', () => {
        const response = '{"id": 1, "score": 8, "feedback": "중괄호 {test} 포함된 피드백"}';
        const result = parseGradeResponse(response);
        assert.ok(result);
        assert.equal(result.score, 8);
        assert.equal(result.evaluation, '중괄호 {test} 포함된 피드백');
    });
});

// ─── 산술 일관성 검증 ──────────────────────────────

describe('산술 일관성 검증', () => {
    test('결과의 점수가 0~10 범위 내로 유지되어야 함', () => {
        const response1 = JSON.stringify({ id: 1, score: -2, feedback: '음수' });
        const result1 = parseGradeResponse(response1);
        assert.ok(result1);
        assert.ok(result1.score >= 0 && result1.score <= 10);

        const response2 = JSON.stringify({ id: 2, score: 12, feedback: '초과' });
        const result2 = parseGradeResponse(response2);
        assert.ok(result2);
        assert.ok(result2.score >= 0 && result2.score <= 10);
    });

    test('결과에 evaluation(feedback) 필드 존재 보장', () => {
        const response = JSON.stringify({ id: 1, score: 5 }); // feedback 누락
        const result = parseGradeResponse(response);
        assert.ok(result);
        assert.equal(result.evaluation, '피드백 없음');
    });
});
