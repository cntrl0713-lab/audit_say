import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRubricCoverage } from '../lib/rubric.ts';
import type { RubricSub } from '../lib/rubric.ts';

// 117번 문항의 축약 픽스처 정의
const mockRubric117: RubricSub[] = [
    {
        sub: 1,
        label: '물음 1',
        points: 3,
        mode: 'all',
        items: [
            {
                id: '1-1',
                item: '감사인의 지배기구 통보시기',
                points: 3,
                variants: ['적절한 시기', '지체 없이', '적시에']
            }
        ]
    },
    {
        sub: 2,
        label: '물음 2',
        points: 3,
        mode: 'all',
        items: [
            {
                id: '2-1',
                item: '유의적 사항 서면 통보',
                points: 3,
                variants: ['서면으로 통보', '서면 통보', '서면']
            }
        ]
    },
    {
        sub: 3,
        label: '물음 3 (best_n)',
        points: 4,
        mode: 'best_n',
        n: 2,
        items: [
            { id: '3-1', item: '지배기구 통보 사항 A', points: 2, variants: ['통보 사항 A', '사항 A'] },
            { id: '3-2', item: '지배기구 통보 사항 B', points: 2, variants: ['통보 사항 B', '사항 B'] },
            { id: '3-3', item: '지배기구 통보 사항 C', points: 2, variants: ['통보 사항 C', '사항 C'] }
        ]
    }
];

test('computeRubricCoverage - ① sub1만 정확히 답한 경우', () => {
    const answer = '지배기구에 적절한 시기에 통보해야 한다.';
    const result = computeRubricCoverage(answer, mockRubric117);

    assert.equal(result.bestSub, 1);
    assert.equal(result.bestSubCoverage, 1.0);
    assert.deepEqual(result.matchedItemIds, ['1-1']);
});

test('computeRubricCoverage - ② 무관한 텍스트 입력 시 전 sub 0', () => {
    const answer = '완전히 무관한 회계 원리 답변입니다.';
    const result = computeRubricCoverage(answer, mockRubric117);

    assert.equal(result.bestSub, 1); // 최고 점수가 0이면 첫 번째 sub 반환
    assert.equal(result.bestSubCoverage, 0.0);
    assert.deepEqual(result.matchedItemIds, []);
});

test('computeRubricCoverage - ③ best_n 분모 = min(n, items) 검증', () => {
    // 3개 중 1개 맞추었을 때: n=2, items.length=3 => 분모는 min(2, 3) = 2. 커버리지는 1/2 = 0.5
    const answer1 = '이것은 사항 A에 대한 설명입니다.';
    const result1 = computeRubricCoverage(answer1, mockRubric117);
    
    // sub 3의 커버리지는 1 / 2 = 0.5. 다른 sub는 0이므로 bestSub는 3
    assert.equal(result1.bestSub, 3);
    assert.equal(result1.bestSubCoverage, 0.5);
    assert.deepEqual(result1.matchedItemIds, ['3-1']);

    // 3개 중 2개 맞추었을 때: 커버리지는 2/2 = 1.0
    const answer2 = '사항 A와 사항 B를 통보한다.';
    const result2 = computeRubricCoverage(answer2, mockRubric117);
    assert.equal(result2.bestSub, 3);
    assert.equal(result2.bestSubCoverage, 1.0);
    assert.deepEqual(result2.matchedItemIds.sort(), ['3-1', '3-2'].sort());

    // 3개 중 3개 맞추었을 때: 커버리지는 3/2 = 1.5이나 1.0으로 상한 제한
    const answer3 = '사항 A, 사항 B, 사항 C 모두 통보한다.';
    const result3 = computeRubricCoverage(answer3, mockRubric117);
    assert.equal(result3.bestSub, 3);
    assert.equal(result3.bestSubCoverage, 1.0);
    assert.deepEqual(result3.matchedItemIds.sort(), ['3-1', '3-2', '3-3'].sort());
});

test('computeRubricCoverage - ④ 빈 답안 / 공백 variants 대응', () => {
    // 빈 답안
    const resultEmpty = computeRubricCoverage('', mockRubric117);
    assert.equal(resultEmpty.bestSubCoverage, 0.0);
    assert.deepEqual(resultEmpty.matchedItemIds, []);

    // 공백 variants가 포함된 비정상 루브릭이 들어온 경우 방어 처리 확인
    const badRubric: RubricSub[] = [
        {
            sub: 1,
            label: '부실 루브릭',
            points: 10,
            mode: 'all',
            items: [
                {
                    id: '1-1',
                    item: '아이템',
                    points: 10,
                    variants: [' ', ''] // 빈 문자열이나 공백
                }
            ]
        }
    ];
    const resultBad = computeRubricCoverage('일반적인 답변', badRubric);
    assert.equal(resultBad.bestSubCoverage, 0.0);
});

test('computeRubricCoverage - ⑤ 조사 및 공백 변형 매칭 (R2 정규화)', () => {
    // 공백 제거 및 소문자 변환이 정상 작동하는지 확인
    // variants: '서면으로 통보', '서면 통보', '서면'
    // 답안: '서 면 으 로   통 보' (공백 다수 포함)
    const answer = '서 면 으 로   통 보';
    const result = computeRubricCoverage(answer, mockRubric117);

    assert.equal(result.bestSub, 2);
    assert.equal(result.bestSubCoverage, 1.0);
    assert.deepEqual(result.matchedItemIds, ['2-1']);
});
