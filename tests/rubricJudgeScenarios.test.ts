import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFromVerdicts, judgeAndScore } from '../lib/rubricJudge.ts';
import type { ItemVerdict } from '../lib/rubricJudge.ts';

// ─────────────────────────────────────────────
// 루브릭 판정 엔진(변경된 채점 모델) 시나리오 테스트
// 실데이터(cpa_uploader/, gitignore 처리됨) 없이도 재현 가능한
// 합성 루브릭으로 scoreFromVerdicts / judgeAndScore 조합 케이스를 검증한다.
// ─────────────────────────────────────────────

test('scoreFromVerdicts - all + best_n 혼합 물음에서 ordered 감점이 해당 sub에만 적용됨', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            ordered: true,
            points: 4,
            items: [
                { id: '1-1', points: 2.0 },
                { id: '1-2', points: 2.0 }
            ]
        },
        {
            sub: 2,
            mode: 'best_n',
            n: 2,
            points: 6,
            items: [
                { id: '2-1', points: 3.0 },
                { id: '2-2', points: 3.0 },
                { id: '2-3', points: 3.0 }
            ]
        }
    ];

    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '1-2', verdict: '포함' },
        { id: '2-1', verdict: '포함' },
        { id: '2-2', verdict: '포함' },
        { id: '2-3', verdict: '누락' }
    ];

    // sub1(4점 만점)이 order_ok=false로 절반 감점(2점) + sub2(6점 만점, 그대로) = 8점
    const score = scoreFromVerdicts(rubric, verdicts, { order_ok: { 1: false } });
    assert.equal(score, 8.0);
});

test('scoreFromVerdicts - order_ok 플래그 자체가 없어도(undefined) 기본값은 감점 없음', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            ordered: true,
            points: 10,
            items: [{ id: '1-1', points: 10.0 }]
        }
    ];
    const verdicts: ItemVerdict[] = [{ id: '1-1', verdict: '포함' }];

    // flags 자체가 빈 객체 -> order_ok가 undefined -> 감점 없이 만점
    assert.equal(scoreFromVerdicts(rubric, verdicts, {}), 10.0);
});

test('scoreFromVerdicts - best_n에서 n이 items.length와 같으면 all 모드와 동일하게 동작', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'best_n',
            n: 3,
            points: 9,
            items: [
                { id: '1-1', points: 3.0 },
                { id: '1-2', points: 3.0 },
                { id: '1-3', points: 3.0 }
            ]
        }
    ];

    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '1-2', verdict: '부분' },
        { id: '1-3', verdict: '누락' }
    ];

    // earnedN = 1 + 0.5 = 1.5, cappedEarned = min(3, 1.5) = 1.5 -> 9 * 1.5 / 3 = 4.5
    assert.equal(scoreFromVerdicts(rubric, verdicts, {}), 4.5);
});

test('scoreFromVerdicts - 빈 루브릭 배열은 0점 (예외 없이 안전 처리)', () => {
    assert.equal(scoreFromVerdicts([], [], {}), 0.0);
});

test('scoreFromVerdicts - 전 항목 누락 + irrelevant_severity major가 겹쳐도 음수 없이 0점 클램프', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            points: 10,
            items: [
                { id: '1-1', points: 5.0 },
                { id: '1-2', points: 5.0 }
            ]
        }
    ];
    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '누락' },
        { id: '1-2', verdict: '누락' }
    ];
    assert.equal(scoreFromVerdicts(rubric, verdicts, { irrelevant_severity: 'major' }), 0.0);
});

test('scoreFromVerdicts - injection_detected가 만점 verdicts보다 항상 우선하여 0점', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            points: 10,
            items: [{ id: '1-1', points: 10.0 }]
        }
    ];
    const verdicts: ItemVerdict[] = [{ id: '1-1', verdict: '포함' }];

    assert.equal(
        scoreFromVerdicts(rubric, verdicts, {
            injection_detected: true,
            irrelevant_severity: 'minor',
            order_ok: { 1: true }
        }),
        0.0
    );
});

test('scoreFromVerdicts - 여러 sub(all/best_n 혼합, ordered 다수)의 총점 정확 누산', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            ordered: true,
            points: 3,
            items: [
                { id: '1-1', points: 1.5 },
                { id: '1-2', points: 1.5 }
            ]
        },
        {
            sub: 2,
            mode: 'best_n',
            n: 1,
            ordered: true,
            points: 3,
            items: [
                { id: '2-1', points: 3.0 },
                { id: '2-2', points: 3.0 }
            ]
        },
        {
            sub: 3,
            mode: 'all',
            points: 4,
            items: [{ id: '3-1', points: 4.0 }]
        }
    ];

    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '1-2', verdict: '포함' }, // sub1 raw 3점, order_ok=false -> 1.5점
        { id: '2-1', verdict: '포함' }, // sub2 raw 3점, order_ok=true(명시 안 함, 기본 true) -> 3점
        { id: '3-1', verdict: '포함' }  // sub3 4점 (ordered 아님)
    ];

    // 1.5 + 3 + 4 = 8.5
    const score = scoreFromVerdicts(rubric, verdicts, { order_ok: { 1: false } });
    assert.equal(score, 8.5);
});

test('judgeAndScore - 조작된 quote로 인한 강등이 best_n 캡핑 산술에도 정확히 반영됨', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'best_n',
            n: 2,
            points: 6,
            items: [
                { id: '1-1', item: '위험평가 절차 수행', points: 3.0, variants: ['위험평가'] },
                { id: '1-2', item: '내부통제 이해', points: 3.0, variants: ['내부통제'] },
                { id: '1-3', item: '분석적 절차 적용', points: 3.0, variants: ['분석적절차'] }
            ]
        }
    ];

    const userAnswer = '위험평가 절차를 수행하고 내부통제를 이해하였다.';

    // 1-3은 답안에 실제로 없는 인용을 주장(조작) -> R2 검증에서 '누락'으로 강등되어야 함
    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함', quote: '위험평가' },
        { id: '1-2', verdict: '포함', quote: '내부통제' },
        { id: '1-3', verdict: '포함', quote: '분석적 절차를 적용하였다' }
    ];

    const { finalVerdicts, score } = judgeAndScore(userAnswer, rubric, verdicts, {});

    assert.equal(finalVerdicts.find(v => v.id === '1-3')!.verdict, '누락');
    // 2개만 유효 포함 -> earnedN=2, cap(n=2)=2 -> 6점 만점
    assert.equal(score, 6.0);
});

test('judgeAndScore - 동일 quote 중복 인용이 best_n 상한을 초과 득점시키지 않음', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'best_n',
            n: 1,
            points: 3,
            items: [
                { id: '1-1', item: '항목A', points: 3.0, variants: ['핵심키워드'] },
                { id: '1-2', item: '항목B', points: 3.0, variants: ['핵심키워드동의어'] }
            ]
        }
    ];

    const userAnswer = '핵심키워드에 대해 서술하였다.';

    // 두 항목이 동일 quote를 인용 주장 -> dedupe로 배점 동일 시 id 알파벳순 1개만 인정
    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함', quote: '핵심키워드' },
        { id: '1-2', verdict: '포함', quote: '핵심키워드' }
    ];

    const { finalVerdicts, score } = judgeAndScore(userAnswer, rubric, verdicts, {});

    assert.equal(finalVerdicts.find(v => v.id === '1-1')!.verdict, '포함');
    assert.equal(finalVerdicts.find(v => v.id === '1-2')!.verdict, '누락');
    // best_n(n=1)이므로 어차피 1개만 인정되어도 만점(3점)에는 변화 없음 — 상한 캡핑 확인
    assert.equal(score, 3.0);
});
