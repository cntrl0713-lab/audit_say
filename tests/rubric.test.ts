import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRubric, validateCpaQuestionV2, buildOrderedNotice } from '../lib/rubric.ts';
import type { RubricSub } from '../lib/rubric.ts';

// ─────────────────────────────────────────────
// 1. validateRubric 테스트
// ─────────────────────────────────────────────

test('validateRubric - 유효한 케이스 1: all 모드 전용 루브릭', () => {
    const validRubric: RubricSub[] = [
        {
            sub: 1,
            label: '위협받는 윤리강령',
            points: 2,
            mode: 'all',
            items: [
                {
                    id: '1-1',
                    item: '성공보수로 인해 위협받는 윤리강령은 공정성이다.',
                    points: 2,
                    variants: ['공정', '공정성', '정직성과 공정성']
                }
            ]
        },
        {
            sub: 2,
            label: '인증업무의 대처',
            points: 4,
            mode: 'all',
            items: [
                {
                    id: '2-1',
                    item: '인증업무에서는 명백하게 경미한 경우가 아니면 해당 위협을 제거하거나 감소시킬 안전장치가 없다.',
                    points: 2,
                    variants: ['명백하게 경미한 경우', '수용가능한 수준 이하', '제거하거나 감소', '안전장치']
                },
                {
                    id: '2-2',
                    item: '따라서 인증업무의 성공보수 수임은 불가하므로 거절해야 한다.',
                    points: 2,
                    variants: ['수임 불가', '거절', '업무 수임 거절', '받을 수 없다']
                }
            ]
        },
        {
            sub: 3,
            label: '비인증업무의 대처',
            points: 4,
            mode: 'all',
            items: [
                {
                    id: '3-1',
                    item: '비인증업무는 성공보수 수임이 가능하다.',
                    points: 4,
                    variants: ['비인증업무', '비인증 업무']
                }
            ]
        }
    ];

    const errors = validateRubric(validRubric);
    assert.deepEqual(errors, [], '올바른 all 모드 루브릭은 에러가 없어야 합니다.');
});

test('validateRubric - 유효한 케이스 2: best_n 모드 전용 루브릭', () => {
    const validRubric: RubricSub[] = [
        {
            sub: 1,
            label: '설명하기',
            points: 10,
            mode: 'best_n',
            n: 2,
            items: [
                {
                    id: '1-1',
                    item: '첫 번째 예시',
                    points: 5,
                    variants: ['첫 번째', '예시 1']
                },
                {
                    id: '1-2',
                    item: '두 번째 예시',
                    points: 5,
                    variants: ['두 번째', '예시 2']
                },
                {
                    id: '1-3',
                    item: '세 번째 예시',
                    points: 5,
                    variants: ['세 번째', '예시 3']
                }
            ]
        }
    ];

    const errors = validateRubric(validRubric);
    assert.deepEqual(errors, [], '올바른 best_n 모드 루브릭은 에러가 없어야 합니다.');
});

test('validateRubric - 유효한 케이스 3: 혼합 모드 루브릭', () => {
    const validRubric: RubricSub[] = [
        {
            sub: 1,
            label: '개요',
            points: 4,
            mode: 'all',
            items: [
                {
                    id: '1-1',
                    item: '개요 서술',
                    points: 4,
                    variants: ['개요 서술', '설명']
                }
            ]
        },
        {
            sub: 2,
            label: '선택사항',
            points: 6,
            mode: 'best_n',
            n: 3,
            items: [
                { id: '2-1', item: '옵션 A', points: 2, variants: ['옵션 A'] },
                { id: '2-2', item: '옵션 B', points: 2, variants: ['옵션 B'] },
                { id: '2-3', item: '옵션 C', points: 2, variants: ['옵션 C'] },
                { id: '2-4', item: '옵션 D', points: 2, variants: ['옵션 D'] }
            ]
        }
    ];

    const errors = validateRubric(validRubric);
    assert.deepEqual(errors, [], '올바른 혼합 모드 루브릭은 에러가 없어야 합니다.');
});

test('validateRubric - 무효한 케이스 1: 총 배점 합계 오류 (10점이 아님)', () => {
    const invalidRubric: RubricSub[] = [
        {
            sub: 1,
            label: '위협받는 윤리강령',
            points: 3, // 합이 9점이 됨
            mode: 'all',
            items: [
                { id: '1-1', item: '공정성', points: 3, variants: ['공정성'] }
            ]
        },
        {
            sub: 2,
            label: '인증업무의 대처',
            points: 6,
            mode: 'all',
            items: [
                { id: '2-1', item: '내용', points: 6, variants: ['내용'] }
            ]
        }
    ];

    const errors = validateRubric(invalidRubric);
    assert.ok(errors.length > 0, '총 배점이 10점이 아니면 에러가 발생해야 합니다.');
    assert.ok(errors.some(err => err.includes('루브릭 총 배점의 합이 10점이어야 합니다')));
});

test('validateRubric - 무효한 케이스 2: best_n 모드 규칙 위반 (n * item.points != sub.points)', () => {
    const invalidRubric: RubricSub[] = [
        {
            sub: 1,
            label: 'best_n 오류',
            points: 10,
            mode: 'best_n',
            n: 2,
            items: [
                { id: '1-1', item: 'A', points: 4, variants: ['옵션 A'] }, // n * 4 = 8 != 10
                { id: '1-2', item: 'B', points: 4, variants: ['옵션 B'] },
                { id: '1-3', item: 'C', points: 4, variants: ['옵션 C'] }
            ]
        }
    ];

    const errors = validateRubric(invalidRubric);
    assert.ok(errors.length > 0);
    assert.ok(errors.some(err => err.includes('일치해야 합니다')));
});

test('validateRubric - 무효한 케이스 3: ID 형식 및 중복 오류', () => {
    const invalidRubric: RubricSub[] = [
        {
            sub: 1,
            label: 'ID 오류',
            points: 10,
            mode: 'all',
            items: [
                { id: '2-1', item: 'ID 물음번호 불일치', points: 5, variants: ['불일치'] }, // sub가 1인데 2-1임
                { id: '1-2', item: '중복 아이디 대상', points: 5, variants: ['중복 대상'] },
                { id: '1-2', item: '중복 아이디', points: 0, variants: ['중복 아이디'] } // 중복 id
            ]
        }
    ];

    const errors = validateRubric(invalidRubric);
    assert.ok(errors.length > 0);
    assert.ok(errors.some(err => err.includes("항목 ID '2-1'는 '물음번호-순번'")));
    assert.ok(errors.some(err => err.includes("중복된 항목 ID '1-2'가 존재합니다.")));
});

test('validateRubric - 무효한 케이스 4: variants 제약 위반 (비어있거나 너무 짧음)', () => {
    const invalidRubric: RubricSub[] = [
        {
            sub: 1,
            label: 'variants 오류',
            points: 10,
            mode: 'all',
            items: [
                { id: '1-1', item: '짧은 답안', points: 5, variants: ['A'] }, // 2글자 미만
                { id: '1-2', item: '빈 답안', points: 5, variants: [] } // 비어있음
            ]
        }
    ];

    const errors = validateRubric(invalidRubric);
    assert.ok(errors.length > 0);
    assert.ok(errors.some(err => err.includes("유사 답안 'A'은 2글자 이상이어야 합니다")));
    assert.ok(errors.some(err => err.includes("variants(유사 답안) 배열이 비어있을 수 없습니다")));
});


// ─────────────────────────────────────────────
// 2. validateCpaQuestionV2 테스트
// ─────────────────────────────────────────────

const createValidQuestion = () => ({
    id: 110,
    part: 1,
    chapter: 1,
    standard: 'Ethics',
    question_title: '성공보수와 윤리적 위협',
    question_description: '성공보수 설명...',
    model_answer: ['1. 공정', '2. 거절'],
    explanation: '성공보수는...',
    rubric: [
        {
            sub: 1,
            label: '위협받는 윤리강령',
            points: 10,
            mode: 'all',
            items: [
                { id: '1-1', item: '공정성', points: 10, variants: ['공정성'] }
            ]
        }
    ]
});

test('validateCpaQuestionV2 - 유효한 문제 데이터', () => {
    const q = createValidQuestion();
    const errors = validateCpaQuestionV2(q);
    assert.deepEqual(errors, [], '올바른 V2 문제 데이터는 에러가 없어야 합니다.');
});

test('validateCpaQuestionV2 - 필수 필드 누락', () => {
    const q = createValidQuestion() as any;
    delete q.question_title;
    delete q.rubric;

    const errors = validateCpaQuestionV2(q);
    assert.ok(errors.length >= 2);
    assert.ok(errors.some(err => err.includes("필수 필드가 누락되었습니다: 'question_title'")));
    assert.ok(errors.some(err => err.includes("필수 필드가 누락되었습니다: 'rubric'")));
});

test('validateCpaQuestionV2 - 타입 위반', () => {
    const q = createValidQuestion() as any;
    q.id = '110'; // string 타입 (정수여야 함)
    q.model_answer = '단일 문자열 답안'; // 배열이어야 함

    const errors = validateCpaQuestionV2(q);
    assert.ok(errors.length >= 2);
    assert.ok(errors.some(err => err.includes("'id' 필드는 number 타입이어야 합니다")));
    assert.ok(errors.some(err => err.includes("'model_answer' 필드는 배열이어야 합니다")));
});

test('validateRubric - ordered 필드 유효성 검증', () => {
    const validRubric: RubricSub[] = [
        {
            sub: 1,
            label: '순서 중요',
            points: 10,
            mode: 'all',
            ordered: true,
            items: [
                { id: '1-1', item: '내용', points: 10, variants: ['내용'] }
            ]
        }
    ];
    const errors = validateRubric(validRubric);
    assert.deepEqual(errors, [], 'ordered: true가 포함된 유효한 루브릭은 에러가 없어야 합니다.');
});

test('validateRubric - ordered 필드 무효 타입 오류', () => {
    const invalidRubric: RubricSub[] = [
        {
            sub: 1,
            label: '순서 오류',
            points: 10,
            mode: 'all',
            ordered: 'yes' as any, // boolean이 아님
            items: [
                { id: '1-1', item: '내용', points: 10, variants: ['내용'] }
            ]
        }
    ];
    const errors = validateRubric(invalidRubric);
    assert.ok(errors.length > 0);
    assert.ok(errors.some(err => err.includes('ordered는 boolean이어야 합니다')));
});

test('buildOrderedNotice - 플래그 없을 경우 null 반환', () => {
    const rubric: RubricSub[] = [
        {
            sub: 1,
            label: '일반 문항',
            points: 10,
            mode: 'all',
            items: [
                { id: '1-1', item: '내용', points: 10, variants: ['내용'] }
            ]
        }
    ];
    const notice = buildOrderedNotice(rubric);
    assert.equal(notice, null, 'ordered 플래그가 없으면 notice가 null이어야 합니다.');
});

test('buildOrderedNotice - 전체 ordered 또는 단일 sub일 경우 문구', () => {
    const rubric: RubricSub[] = [
        {
            sub: 1,
            label: '순서 문항',
            points: 10,
            mode: 'all',
            ordered: true,
            items: [
                { id: '1-1', item: '내용', points: 10, variants: ['내용'] }
            ]
        }
    ];
    const notice = buildOrderedNotice(rubric);
    assert.ok(notice);
    assert.ok(notice.includes('[추가 채점 지시 — 이 문항 전용]'));
    assert.ok(notice.includes('이 문제의 모범 답안은 각 단계가 선후관계로 연결된 순차적 절차입니다'));
});

test('buildOrderedNotice - 일부 sub만 ordered일 경우 문구', () => {
    const rubric: RubricSub[] = [
        {
            sub: 1,
            label: '순서 무관',
            points: 5,
            mode: 'all',
            items: [
                { id: '1-1', item: '내용1', points: 5, variants: ['내용1'] }
            ]
        },
        {
            sub: 2,
            label: '순서 중요',
            points: 5,
            mode: 'all',
            ordered: true,
            items: [
                { id: '2-1', item: '내용2', points: 5, variants: ['내용2'] }
            ]
        }
    ];
    const notice = buildOrderedNotice(rubric);
    assert.ok(notice);
    assert.ok(notice.includes('[추가 채점 지시 — 이 문항 전용]'));
    assert.ok(notice.includes('물음 2의 모범 답안은 각 단계가 선후관계로 연결된 순차적 절차입니다'));
});
