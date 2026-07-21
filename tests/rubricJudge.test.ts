import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
    normalizeText,
    verifyVerdicts,
    deduplicateQuotes,
    scoreFromVerdicts,
    judgeAndScore,
    extractFirstJson,
    parseJudgmentResponse,
    buildJudgmentFeedback
} from '../lib/rubricJudge.ts';
import type { ItemVerdict, VerdictFlags } from '../lib/rubricJudge.ts';

const CPA_DATA_PATH = path.resolve(process.cwd(), 'cpa_uploader/data/cpa_problems_v2.json');
// cpa_uploader/는 모범답안·루브릭 원본(채점 근거) 유출 방지를 위해 .gitignore 처리되어 있어
// 실데이터 없이 클론된 환경(CI 등)에서는 아래 4개 실데이터 검산 테스트를 건너뛴다.
const CPA_DATA_SKIP_REASON = fs.existsSync(CPA_DATA_PATH)
    ? false
    : 'cpa_uploader/data/cpa_problems_v2.json 없음 (.gitignore 처리된 비공개 데이터 — 실데이터 보유 환경에서만 검증)';

function getCpaProblem(qid: number): any {
    const problems = JSON.parse(fs.readFileSync(CPA_DATA_PATH, 'utf-8'));
    const problem = problems.find((p: any) => p.id === qid);
    if (!problem) throw new Error(`ID ${qid} 문제를 JSON에서 찾을 수 없습니다.`);
    return problem;
}

function allIncludedVerdicts(rubric: any[]): ItemVerdict[] {
    return rubric.flatMap((sub: any) =>
        sub.items.map((item: any) => ({ id: item.id, verdict: '포함' as const }))
    );
}

// ─────────────────────────────────────────────
// 1. normalizeText 단위 테스트
// ─────────────────────────────────────────────
test('normalizeText - 공백 제거 및 소문자 정규화', () => {
    assert.equal(normalizeText('  Hello   World  '), 'helloworld');
    assert.equal(normalizeText('감사 절차 \n 및 결과'), '감사절차및결과');
});

// ─────────────────────────────────────────────
// 2. verifyVerdicts (인용 검증) 단위 테스트
// ─────────────────────────────────────────────
test('verifyVerdicts - quote 검증 및 강등 처리', () => {
    const userAnswer = '독립감사인의 전반적 목적은 합리적인 확신을 얻는 것이다.';

    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함', quote: '합리적인 확신' }, // 정상 매칭
        { id: '1-2', verdict: '부분', quote: '전반적 목적' },  // 정상 매칭 (대소문자/공백 차이 없음)
        { id: '1-3', verdict: '포함', quote: '부당한 확신' },  // 오매칭 -> 누락 강등
        { id: '1-4', verdict: '부분' },                      // quote 없음 -> 누락 강등
        { id: '1-5', verdict: '누락', quote: '합리적인 확신' }  // 원래 누락 -> 누락 유지
    ];

    const verified = verifyVerdicts(userAnswer, verdicts);

    assert.equal(verified[0].verdict, '포함');
    assert.equal(verified[1].verdict, '부분');
    assert.equal(verified[2].verdict, '누락');
    assert.equal(verified[3].verdict, '누락');
    assert.equal(verified[4].verdict, '누락');
});

// ─────────────────────────────────────────────
// 3. deduplicateQuotes (중복 인용 차단) 단위 테스트
// ─────────────────────────────────────────────
test('deduplicateQuotes - 동일 quote 중복 득점 방지 및 배점별 강등', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            items: [
                { id: '1-1', points: 3.0, item: '항목 1' },
                { id: '1-2', points: 2.0, item: '항목 2' },
                { id: '1-3', points: 2.0, item: '항목 3' }
            ]
        }
    ];

    // Case A: 배점이 다른 두 항목이 동일한 quote를 가지는 경우 (배점 높은 쪽 유지)
    const verdictsA: ItemVerdict[] = [
        { id: '1-1', verdict: '포함', quote: '중복구절' }, // 배점 3.0 (유지)
        { id: '1-2', verdict: '포함', quote: '중복구절' }  // 배점 2.0 (강등)
    ];
    const resultA = deduplicateQuotes(rubric, verdictsA);
    assert.equal(resultA.find(v => v.id === '1-1')?.verdict, '포함');
    assert.equal(resultA.find(v => v.id === '1-2')?.verdict, '누락');

    // Case B: 배점이 같을 때 ID 알파벳순 정렬에 의해 일관성 있게 강등 (1-2 유지, 1-3 강등)
    const verdictsB: ItemVerdict[] = [
        { id: '1-3', verdict: '포함', quote: '중복구절' }, // 배점 2.0 (강등)
        { id: '1-2', verdict: '포함', quote: '중복구절' }  // 배점 2.0 (유지)
    ];
    const resultB = deduplicateQuotes(rubric, verdictsB);
    assert.equal(resultB.find(v => v.id === '1-2')?.verdict, '포함');
    assert.equal(resultB.find(v => v.id === '1-3')?.verdict, '누락');

    // Case C: 부분적으로 겹치는 구절은 중복 제거되지 않음
    const verdictsC: ItemVerdict[] = [
        { id: '1-1', verdict: '포함', quote: '중복구절' },
        { id: '1-2', verdict: '포함', quote: '중복구절의 일부' }
    ];
    const resultC = deduplicateQuotes(rubric, verdictsC);
    assert.equal(resultC.find(v => v.id === '1-1')?.verdict, '포함');
    assert.equal(resultC.find(v => v.id === '1-2')?.verdict, '포함');
});

// ─────────────────────────────────────────────
// 4. scoreFromVerdicts (산술 로직) 단위 테스트
// ─────────────────────────────────────────────
test('scoreFromVerdicts - all 모드 배점 산술', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            points: 10,
            items: [
                { id: '1-1', points: 4.0 },
                { id: '1-2', points: 3.0 },
                { id: '1-3', points: 3.0 }
            ]
        }
    ];

    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' }, // 4.0점
        { id: '1-2', verdict: '부분' }, // 1.5점 (3.0 * 0.5)
        { id: '1-3', verdict: '누락' }  // 0점
    ];

    // 합계: 5.5점
    const score = scoreFromVerdicts(rubric, verdicts, {});
    assert.equal(score, 5.5);
});

test('scoreFromVerdicts - best_n 모드 배점 산술', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'best_n',
            n: 2,
            points: 6,
            items: [
                { id: '1-1', points: 3.0 },
                { id: '1-2', points: 3.0 },
                { id: '1-3', points: 3.0 }
            ]
        }
    ];

    // Case A: 2개 포함 작성 (만점 6점 획득)
    const verdictsA: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '1-2', verdict: '포함' },
        { id: '1-3', verdict: '누락' }
    ];
    assert.equal(scoreFromVerdicts(rubric, verdictsA, {}), 6.0);

    // Case B: 3개 초과 포함 작성 (최대 6점으로 캡핑)
    const verdictsB: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '1-2', verdict: '포함' },
        { id: '1-3', verdict: '포함' }
    ];
    assert.equal(scoreFromVerdicts(rubric, verdictsB, {}), 6.0);

    // Case C: 1개 포함 + 1개 부분 작성 (총 1.5개 요건 충족 -> 6.0 * 1.5 / 2 = 4.5점)
    const verdictsC: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '1-2', verdict: '부분' },
        { id: '1-3', verdict: '누락' }
    ];
    assert.equal(scoreFromVerdicts(rubric, verdictsC, {}), 4.5);
});

test('scoreFromVerdicts - ordered 감점 적용', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            ordered: true,
            points: 10,
            items: [
                { id: '1-1', points: 5.0 },
                { id: '1-2', points: 5.0 }
            ]
        }
    ];

    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '1-2', verdict: '포함' }
    ];

    // Case A: order_ok가 true인 경우 (10점 만점)
    assert.equal(scoreFromVerdicts(rubric, verdicts, { order_ok: { 1: true } }), 10.0);

    // Case B: order_ok가 false인 경우 (50% 감점 -> 5점)
    assert.equal(scoreFromVerdicts(rubric, verdicts, { order_ok: { 1: false } }), 5.0);
});

test('scoreFromVerdicts - 보안 위협 탐지 시 무조건 0점', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            points: 10,
            items: [{ id: '1-1', points: 10.0 }]
        }
    ];
    const verdicts: ItemVerdict[] = [{ id: '1-1', verdict: '포함' }];

    assert.equal(scoreFromVerdicts(rubric, verdicts, { injection_detected: true }), 0.0);
    assert.equal(scoreFromVerdicts(rubric, verdicts, { salad_detected: true }), 0.0);
});

test('scoreFromVerdicts - irrelevant_severity 감점 차감', () => {
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
        { id: '1-1', verdict: '포함' },
        { id: '1-2', verdict: '포함' }
    ];

    // minor 감점 (-1점 -> 9점)
    assert.equal(scoreFromVerdicts(rubric, verdicts, { irrelevant_severity: 'minor' }), 9.0);

    // major 감점 (-3점 -> 7점)
    assert.equal(scoreFromVerdicts(rubric, verdicts, { irrelevant_severity: 'major' }), 7.0);

    // 감점 누적으로 음수가 될 때 0점 클램핑
    const poorVerdicts: ItemVerdict[] = [{ id: '1-1', verdict: '누락' }]; // 기본점수 0
    assert.equal(scoreFromVerdicts(rubric, poorVerdicts, { irrelevant_severity: 'major' }), 0.0);
});

test('scoreFromVerdicts - 0.5 단위 반올림 및 클램핑', () => {
    const complexRubric: any = [
        {
            sub: 1,
            mode: 'all',
            points: 10.0,
            items: [
                { id: '1-1', points: 3.33 },
                { id: '1-2', points: 3.33 },
                { id: '1-3', points: 3.34 }
            ]
        }
    ];
    const verdictsB: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' }, // 3.33
        { id: '1-2', verdict: '부분' }, // 1.665
        { id: '1-3', verdict: '누락' }  // 0
    ];
    // 합계: 3.33 + 1.665 = 4.995점 -> 반올림하여 5.0점
    assert.equal(scoreFromVerdicts(complexRubric, verdictsB, {}), 5.0);
});

// ─────────────────────────────────────────────
// 5. 실제 데이터 루브릭 피스처 검산 (JSON에서 직접 로드 — 루브릭 개정 시 자동 재검증)
// ─────────────────────────────────────────────
test('scoreFromVerdicts - 307번(ordered, all 단일) 실데이터 만점 검산', { skip: CPA_DATA_SKIP_REASON }, () => {
    const p307 = getCpaProblem(307);
    const score = scoreFromVerdicts(p307.rubric, allIncludedVerdicts(p307.rubric), { order_ok: { 1: true } });
    assert.equal(score, 10.0);
});

test('scoreFromVerdicts - 117번(all+best_n 혼합, 3개 sub) 실데이터 만점 검산', { skip: CPA_DATA_SKIP_REASON }, () => {
    const p117 = getCpaProblem(117);
    // sub1(all,2pt) + sub2(all,2pt) + sub3(best_n n=3,6pt,5items) 혼합 문항 — 이 엔진의 핵심 합산 케이스
    assert.equal(p117.rubric.length, 3);
    assert.equal(p117.rubric[2].mode, 'best_n');
    const score = scoreFromVerdicts(p117.rubric, allIncludedVerdicts(p117.rubric), {});
    assert.equal(score, 10.0);
});

test('scoreFromVerdicts - 117번 best_n sub만 초과 충족 시에도 만점 (sub1·sub2는 부분 누락)', { skip: CPA_DATA_SKIP_REASON }, () => {
    const p117 = getCpaProblem(117);
    // sub3(best_n n=3, 5items)만 전부 포함, sub1·sub2는 누락 -> sub3 단독 6점 상한
    const verdicts: ItemVerdict[] = p117.rubric[2].items.map((item: any) => ({ id: item.id, verdict: '포함' as const }));
    const score = scoreFromVerdicts(p117.rubric, verdicts, {});
    assert.equal(score, 6.0);
});

test('scoreFromVerdicts - 134번(all 2개 sub, 비균등 배점) 실데이터 만점 검산', { skip: CPA_DATA_SKIP_REASON }, () => {
    const p134 = getCpaProblem(134);
    const score = scoreFromVerdicts(p134.rubric, allIncludedVerdicts(p134.rubric), {});
    assert.equal(score, 10.0);
});

// ─────────────────────────────────────────────
// 6. 미지 id verdict 무시
// ─────────────────────────────────────────────
test('scoreFromVerdicts - 루브릭에 없는 id의 verdict는 산술에 영향 없음', () => {
    const rubric: any = [
        { sub: 1, mode: 'all', points: 10, items: [{ id: '1-1', points: 10.0 }] }
    ];
    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '9-9', verdict: '포함' } // 존재하지 않는 항목 id
    ];
    assert.equal(scoreFromVerdicts(rubric, verdicts, {}), 10.0);
});

// ─────────────────────────────────────────────
// 7. 반올림·클램프 경계값
// ─────────────────────────────────────────────
test('scoreFromVerdicts - 0.25 경계값은 가장 가까운 0.5 단위로 반올림', () => {
    const rubric: any = [
        { sub: 1, mode: 'all', points: 10, items: [{ id: '1-1', points: 4.5 }, { id: '1-2', points: 5.5 }] }
    ];
    // 4.5(포함) + 5.5*0.5(부분)=2.75 => 합계 7.25 => 반올림 7.5
    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '1-2', verdict: '부분' }
    ];
    assert.equal(scoreFromVerdicts(rubric, verdicts, {}), 7.5);
});

test('scoreFromVerdicts - 만점 초과 시 10점 클램프, irrelevant 감점으로 음수 시 0점 클램프', () => {
    const overRubric: any = [
        { sub: 1, mode: 'all', points: 10, items: [{ id: '1-1', points: 10.0 }] }
    ];
    // ordered 미지정 sub에 order_ok를 줘도 영향 없음 - 상한 10 확인용 기본 케이스
    assert.equal(scoreFromVerdicts(overRubric, [{ id: '1-1', verdict: '포함' }], {}), 10.0);

    const lowRubric: any = [
        { sub: 1, mode: 'all', points: 2, items: [{ id: '1-1', points: 2.0 }] }
    ];
    // 2점 만점에 major 감점(-3) -> 음수 -1 => 0점 클램프
    assert.equal(scoreFromVerdicts(lowRubric, [{ id: '1-1', verdict: '포함' }], { irrelevant_severity: 'major' }), 0.0);
});

// ─────────────────────────────────────────────
// 8. 파이프라인 통합 (judgeAndScore) — verify -> dedupe -> score 순서 계약 검증
// ─────────────────────────────────────────────
test('judgeAndScore - 조작된 quote가 인용 검증에서 걸러져 점수가 낮아짐', () => {
    const rubric: any = [
        {
            sub: 1, mode: 'all', points: 10,
            items: [{ id: '1-1', points: 5.0 }, { id: '1-2', points: 5.0 }]
        }
    ];
    const userAnswer = '충분성은 감사증거의 수량적 측면을 의미한다.';
    // 1-2는 답안에 실제로 없는 quote를 LLM이 지어낸 상황(환각) -> verify 단계에서 누락 강등되어야 함
    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함', quote: '수량적 측면' },
        { id: '1-2', verdict: '포함', quote: '답안에 존재하지 않는 조작된 인용문' }
    ];
    const result = judgeAndScore(userAnswer, rubric, verdicts, {});
    assert.equal(result.finalVerdicts.find(v => v.id === '1-2')?.verdict, '누락');
    assert.equal(result.score, 5.0);
});

test('judgeAndScore - 동일 구절을 두 항목에 인용해도 이중 득점되지 않음', () => {
    const rubric: any = [
        {
            sub: 1, mode: 'all', points: 10,
            items: [{ id: '1-1', points: 6.0 }, { id: '1-2', points: 4.0 }]
        }
    ];
    const userAnswer = '핵심 개념은 신뢰성과 관련성이다.';
    // 두 항목이 동일 구절을 인용 -> dedupe 단계가 배점 낮은 1-2를 누락으로 강등해야 함
    const verdicts: ItemVerdict[] = [
        { id: '1-1', verdict: '포함', quote: '신뢰성과 관련성' },
        { id: '1-2', verdict: '포함', quote: '신뢰성과 관련성' }
    ];
    const result = judgeAndScore(userAnswer, rubric, verdicts, {});
    assert.equal(result.finalVerdicts.find(v => v.id === '1-1')?.verdict, '포함');
    assert.equal(result.finalVerdicts.find(v => v.id === '1-2')?.verdict, '누락');
    assert.equal(result.score, 6.0); // dedupe를 빠뜨렸다면 10.0이 나왔을 것
});

// ─────────────────────────────────────────────
// 9. extractFirstJson 단위 테스트
// ─────────────────────────────────────────────
test('extractFirstJson - 다양한 형태의 응답에서 JSON 추출', () => {
    // 1) 순수 JSON
    const res1 = extractFirstJson('{"score": 10}');
    assert.equal(res1.score, 10);

    // 2) 마크다운 펜스
    const res2 = extractFirstJson('```json\n{"score": 5, "feedback": "good"}\n```');
    assert.equal(res2.score, 5);
    assert.equal(res2.feedback, 'good');

    // 3) 앞뒤 노이즈 텍스트 포함
    const res3 = extractFirstJson('임의의 분석 텍스트... {"score": 8, "ok": true} 뒤쪽 텍스트...');
    assert.equal(res3.score, 8);
    assert.equal(res3.ok, true);

    // 4) 객체가 없을 경우 예외 발생
    assert.throws(() => {
        extractFirstJson('no json here');
    });
});

// ─────────────────────────────────────────────
// 10. parseJudgmentResponse 단위 테스트
// ─────────────────────────────────────────────
test('parseJudgmentResponse - 정상 응답 및 예외 상황 검증', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            items: [
                { id: '1-1', points: 5.0, item: '항목 1' },
                { id: '1-2', points: 5.0, item: '항목 2' }
            ]
        }
    ];

    // Case A: 정상 구조 파싱
    const textA = JSON.stringify({
        verdicts: [
            { id: '1-1', verdict: '포함', quote: '원문1' },
            { id: '1-2', verdict: '부분', quote: '원문2' }
        ],
        injection_detected: false,
        salad_detected: false,
        irrelevant_severity: 'minor',
        order_ok: { '1': true }
    });

    const parsedA = parseJudgmentResponse(textA, rubric);
    assert.equal(parsedA.verdicts.length, 2);
    assert.equal(parsedA.verdicts[0].verdict, '포함');
    assert.equal(parsedA.verdicts[1].verdict, '부분');
    assert.equal(parsedA.flags.injection_detected, false);
    assert.equal(parsedA.flags.irrelevant_severity, 'minor');
    assert.equal(parsedA.flags.order_ok?.[1], true);

    // Case B: 응답에서 일부 item id 누락 시 '누락'으로 보정
    const textB = JSON.stringify({
        verdicts: [
            { id: '1-1', verdict: '포함', quote: '원문1' }
            // 1-2 누락
        ],
        injection_detected: false,
        salad_detected: false,
        irrelevant_severity: 'none'
    });

    const parsedB = parseJudgmentResponse(textB, rubric);
    assert.equal(parsedB.verdicts.length, 2);
    assert.equal(parsedB.verdicts[0].id, '1-1');
    assert.equal(parsedB.verdicts[0].verdict, '포함');
    assert.equal(parsedB.verdicts[1].id, '1-2');
    assert.equal(parsedB.verdicts[1].verdict, '누락'); // 보정됨

    // Case C: order_ok가 문자열 키로 들어오는 경우 및 scoreFromVerdicts 연동 회귀 방지
    const textC = JSON.stringify({
        verdicts: [
            { id: '1-1', verdict: '포함', quote: '원문1' },
            { id: '1-2', verdict: '포함', quote: '원문2' }
        ],
        order_ok: { '1': false } // 문자열 키 "1"
    });

    const parsedC = parseJudgmentResponse(textC, rubric);
    // JS 객체 특성상 order_ok[1]과 order_ok["1"]은 동일하므로 파싱 및 매핑 결과 확인
    assert.equal(parsedC.flags.order_ok?.[1], false);

    // R6에 따라 scoreFromVerdicts에서 숫자 키로 조회 시 올바르게 반영되는지 확인
    const scoreC = scoreFromVerdicts(
        [
            {
                sub: 1,
                label: '테스트',
                points: 10,
                mode: 'all',
                ordered: true,
                items: [
                    { id: '1-1', points: 5.0, item: '항목 1', variants: ['항목 1'] },
                    { id: '1-2', points: 5.0, item: '항목 2', variants: ['항목 2'] }
                ]
            }
        ],
        parsedC.verdicts,
        parsedC.flags
    );
    // order_ok 가 false이므로 50% 감점 적용되어 5점이 나와야 함
    assert.equal(scoreC, 5.0);

    // Case D: 스키마가 깨진 문자열일 때 예외 전파
    assert.throws(() => {
        parseJudgmentResponse('{"verdicts": "invalid_string_not_array"}', rubric);
    });
});

// ─────────────────────────────────────────────
// 11. buildJudgmentFeedback 단위 테스트
// ─────────────────────────────────────────────
test('buildJudgmentFeedback - 피드백 템플릿 검증', () => {
    const rubric: any = [
        {
            sub: 1,
            mode: 'all',
            items: [
                { id: '1-1', points: 5.0, item: '대손충당금의 손금산입 기준 설명' }
            ]
        },
        {
            sub: 2,
            mode: 'all',
            items: [
                { id: '2-1', points: 5.0, item: '접대비 한도 초과액 계산' }
            ]
        }
    ];

    // Case A: 전부 포함 (✓)
    const verdictsA: ItemVerdict[] = [
        { id: '1-1', verdict: '포함' },
        { id: '2-1', verdict: '포함' }
    ];
    const fbA = buildJudgmentFeedback(rubric, verdictsA, {});
    assert.equal(fbA.includes('⚠️ 부족한 점: 없음'), true);
    assert.equal(fbA.includes('👍 잘한 점: 물음 1, 물음 2'), true);

    // Case B: 혼재 (물음 1 ✗, 물음 2 △)
    const verdictsB: ItemVerdict[] = [
        { id: '1-1', verdict: '누락' },
        { id: '2-1', verdict: '부분' }
    ];
    const fbB = buildJudgmentFeedback(rubric, verdictsB, {});
    assert.equal(fbB.includes('⚠️ 부족한 점: 물음 1(✗): 누락 — 대손충당금의 손금산입 기준 설명, 물음 2(△): 부분 — 접대비 한도 초과액 계산'), true);
    assert.equal(fbB.includes('👍 잘한 점: 없음'), true);

    // Case C: 보안 감지 (injection_detected가 true인 경우 최우선 명시)
    const fbC = buildJudgmentFeedback(rubric, verdictsA, { injection_detected: true });
    assert.equal(fbC, `⚠️ 부족한 점: 프롬프트 주입 및 점수 조작 시도 감지\n👍 잘한 점: 없음`);

    // Case D: 무관도 감점 처리 명시
    const fbD = buildJudgmentFeedback(rubric, verdictsA, { irrelevant_severity: 'minor' });
    assert.equal(fbD.includes('무관하거나 불필요한 서술 감점(-1점)'), true);

    const fbE = buildJudgmentFeedback(rubric, verdictsA, { irrelevant_severity: 'major' });
    assert.equal(fbE.includes('무관하거나 불필요한 서술 감점(-3점)'), true);
});

