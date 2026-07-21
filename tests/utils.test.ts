import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { AuditQuestion } from '../lib/db.ts';
import {
    getChapterSortKey,
    getStandardSortKey,
    compareChapters,
    compareStandards,
    calculateMatchedCount,
    getCounts,
    getQuizSet,
} from '../lib/utils.ts';

// ─── 헬퍼 ─────────────────────────────────────────

const q = (
    id: number,
    part: string,
    chapter = 'C',
    standard = 'S',
    keywords: string[] = [],
): AuditQuestion => ({
    id,
    part,
    chapter,
    standard,
    question_title: `문제${id}`,
    question_description: '',
    model_answer: '',
    explanation: '',
    keywords,
});

// ─── getChapterSortKey ────────────────────────────

describe('getChapterSortKey', () => {
    test('"전체"는 [-1]을 반환', () => {
        assert.deepEqual(getChapterSortKey('전체'), [-1]);
    });

    test('단일 숫자 챕터 (ch1) → [1]', () => {
        assert.deepEqual(getChapterSortKey('ch1 공인회계사 윤리기준과 법규'), [1]);
    });

    test('복합 숫자 챕터 (ch3-5) → [3, 5]', () => {
        assert.deepEqual(getChapterSortKey('ch3-5 혼합'), [3, 5]);
    });

    test('숫자 없는 문자열 → [999]', () => {
        assert.deepEqual(getChapterSortKey('기타'), [999]);
    });

    test('빈 문자열 → [999]', () => {
        assert.deepEqual(getChapterSortKey(''), [999]);
    });

    test('여러 숫자 포함 (ch10 감사기준 200) → [10, 200]', () => {
        assert.deepEqual(getChapterSortKey('ch10 감사기준 200'), [10, 200]);
    });
});

// ─── getStandardSortKey ───────────────────────────

describe('getStandardSortKey', () => {
    test('"전체"는 -1', () => {
        assert.equal(getStandardSortKey('전체'), -1);
    });

    test('"Ethics" (대소문자 무관) → 100', () => {
        assert.equal(getStandardSortKey('Ethics'), 100);
        assert.equal(getStandardSortKey('ETHICS'), 100);
        assert.equal(getStandardSortKey('ethics'), 100);
    });

    test('"law" (대소문자 무관) → 110', () => {
        assert.equal(getStandardSortKey('law'), 110);
        assert.equal(getStandardSortKey('Law'), 110);
        assert.equal(getStandardSortKey('LAW'), 110);
    });

    test('숫자 코드 "200" → 200', () => {
        assert.equal(getStandardSortKey('200'), 200);
    });

    test('숫자 코드 "1200" → 1200', () => {
        assert.equal(getStandardSortKey('1200'), 1200);
    });

    test('파싱 불가 문자열 → 9999', () => {
        assert.equal(getStandardSortKey('unknown'), 9999);
        assert.equal(getStandardSortKey('procedure'), 9999);
        assert.equal(getStandardSortKey('control'), 9999);
    });
});

// ─── compareChapters ──────────────────────────────

describe('compareChapters', () => {
    test('"전체"가 항상 가장 앞에 정렬', () => {
        assert.ok(compareChapters('전체', 'ch1 무엇') < 0);
    });

    test('ch1 < ch2 순서 정렬', () => {
        assert.ok(compareChapters('ch1 A', 'ch2 B') < 0);
    });

    test('ch10 > ch2 (문자열이 아닌 숫자 비교)', () => {
        assert.ok(compareChapters('ch10 X', 'ch2 Y') > 0);
    });

    test('동일 챕터는 0 반환', () => {
        assert.equal(compareChapters('ch5 실증절차', 'ch5 실증절차'), 0);
    });

    test('복합 키 비교: ch3-5 vs ch3-7 → 첫 숫자 같고, 두번째 숫자 비교', () => {
        assert.ok(compareChapters('ch3-5', 'ch3-7') < 0);
    });

    test('배열로 정렬했을 때 올바른 순서', () => {
        const chapters = ['ch10 마무리', '전체', 'ch2 기초', 'ch1 윤리'];
        const sorted = [...chapters].sort(compareChapters);
        assert.deepEqual(sorted, ['전체', 'ch1 윤리', 'ch2 기초', 'ch10 마무리']);
    });
});

// ─── compareStandards ─────────────────────────────

describe('compareStandards', () => {
    test('"전체"가 가장 앞에', () => {
        assert.ok(compareStandards('전체', '200') < 0);
    });

    test('Ethics(100) < law(110) < 200', () => {
        assert.ok(compareStandards('Ethics', 'law') < 0);
        assert.ok(compareStandards('law', '200') < 0);
    });

    test('숫자 코드 정렬: 200 < 315 < 1200', () => {
        assert.ok(compareStandards('200', '315') < 0);
        assert.ok(compareStandards('315', '1200') < 0);
    });

    test('파싱 불가 코드는 맨 뒤로', () => {
        assert.ok(compareStandards('1200', 'procedure') < 0);
    });

    test('배열로 정렬했을 때 올바른 순서', () => {
        const standards = ['300', '전체', 'law', 'Ethics', '1200', 'procedure'];
        const sorted = [...standards].sort(compareStandards);
        assert.deepEqual(sorted, ['전체', 'Ethics', 'law', '300', '1200', 'procedure']);
    });
});

// ─── calculateMatchedCount ────────────────────────

describe('calculateMatchedCount', () => {
    test('정확히 일치하는 키워드 카운트', () => {
        const count = calculateMatchedCount(
            '감사인의 독립성을 유지해야 한다',
            ['독립성', '감사인'],
        );
        assert.equal(count, 2);
    });

    test('공백이 포함된 키워드도 정규화 후 매칭', () => {
        // "내부 통제"를 키워드로 지정 → 답안에 "내부통제"로 붙여쓰기해도 매칭
        const count = calculateMatchedCount(
            '내부통제시스템을 평가한다',
            ['내부 통제'],
        );
        assert.equal(count, 1);
    });

    test('대소문자 무시 (영문 키워드)', () => {
        const count = calculateMatchedCount(
            'The auditor must maintain INDEPENDENCE',
            ['independence', 'Auditor'],
        );
        assert.equal(count, 2);
    });

    test('빈 답안 → 0', () => {
        assert.equal(calculateMatchedCount('', ['키워드']), 0);
    });

    test('빈 키워드 배열 → 0', () => {
        assert.equal(calculateMatchedCount('무슨 답안', []), 0);
    });

    test('null/undefined 답안 → 0', () => {
        assert.equal(calculateMatchedCount(null as any, ['키워드']), 0);
        assert.equal(calculateMatchedCount(undefined as any, ['키워드']), 0);
    });

    test('null/undefined 키워드 → 0', () => {
        assert.equal(calculateMatchedCount('답안', null as any), 0);
        assert.equal(calculateMatchedCount('답안', undefined as any), 0);
    });

    test('키워드가 답안에 없으면 0', () => {
        assert.equal(
            calculateMatchedCount('독립성을 유지한다', ['내부통제', '위험평가']),
            0,
        );
    });

    test('동일 키워드 중복 매칭 (키워드 배열에 같은 게 있으면 각각 카운트)', () => {
        assert.equal(
            calculateMatchedCount('독립성', ['독립성', '독립성']),
            2,
        );
    });
});

// ─── getCounts ────────────────────────────────────

describe('getCounts', () => {
    test('파트/챕터/스탠다드별 카운트 정확성', () => {
        const data = [
            q(1, 'PART1', 'ch1', '200'),
            q(2, 'PART1', 'ch1', '210'),
            q(3, 'PART1', 'ch2', '200'),
            q(4, 'PART2', 'ch3', '300'),
        ];
        const counts = getCounts(data);
        assert.deepEqual(counts.parts, { PART1: 3, PART2: 1 });
        assert.deepEqual(counts.chapters, { ch1: 2, ch2: 1, ch3: 1 });
        assert.deepEqual(counts.standards, { '200': 2, '210': 1, '300': 1 });
    });

    test('빈 배열 → 모든 카운트 빈 객체', () => {
        const counts = getCounts([]);
        assert.deepEqual(counts.parts, {});
        assert.deepEqual(counts.chapters, {});
        assert.deepEqual(counts.standards, {});
    });

    test('빈 문자열 필드는 카운트하지 않음', () => {
        const data = [q(1, '', '', '')];
        const counts = getCounts(data);
        assert.deepEqual(counts.parts, {});
        assert.deepEqual(counts.chapters, {});
        assert.deepEqual(counts.standards, {});
    });
});

// ─── getQuizSet (기존 테스트 보완) ─────────────────

describe('getQuizSet 추가 엣지 케이스', () => {
    test('챕터 필터링: 특정 챕터만 반환', () => {
        const data = [
            q(1, 'PART1', 'ch1', '200'),
            q(2, 'PART1', 'ch2', '300'),
            q(3, 'PART1', 'ch1', '210'),
        ];
        const set = getQuizSet(data, 'PART1', 'ch1', '전체', 10, []);
        assert.deepEqual(
            set.map((x) => x.id).sort(),
            [1, 3],
        );
    });

    test('스탠다드 필터링: 특정 스탠다드만 반환', () => {
        const data = [
            q(1, 'PART1', 'ch1', '200'),
            q(2, 'PART1', 'ch1', '210'),
            q(3, 'PART1', 'ch1', '200'),
        ];
        const set = getQuizSet(data, 'PART1', 'ch1', '200', 10, []);
        assert.deepEqual(
            set.map((x) => x.id).sort(),
            [1, 3],
        );
    });

    test('후보가 0개이면 빈 배열 반환', () => {
        const data = [q(1, 'PART1', 'ch1', '200')];
        const set = getQuizSet(data, 'PART2', '전체', '전체', 5, []);
        assert.equal(set.length, 0);
    });

    test('모든 문제가 제외되면 빈 배열 반환', () => {
        const data = [q(1, 'PART1'), q(2, 'PART1')];
        const set = getQuizSet(data, 'PART1', '전체', '전체', 10, ['1', '2']);
        assert.equal(set.length, 0);
    });

    test('N이 0이면 빈 배열 반환', () => {
        const data = [q(1, 'PART1'), q(2, 'PART1')];
        const set = getQuizSet(data, 'PART1', '전체', '전체', 0, []);
        // 0개 요청 → candidates.length(2) > 0이므로 slice(0,0) = []
        assert.equal(set.length, 0);
    });

    test('빈 데이터 배열 → 빈 배열', () => {
        const set = getQuizSet([], 'PART1', '전체', '전체', 5, []);
        assert.equal(set.length, 0);
    });

    test('챕터=전체, 스탠다드=전체일 때 파트 내 모든 문제 대상', () => {
        const data = [
            q(1, 'PART1', 'ch1', '200'),
            q(2, 'PART1', 'ch2', '300'),
            q(3, 'PART2', 'ch3', '400'),
        ];
        const set = getQuizSet(data, 'PART1', '전체', '전체', 10, []);
        assert.deepEqual(
            set.map((x) => x.id).sort(),
            [1, 2],
        );
    });
});
