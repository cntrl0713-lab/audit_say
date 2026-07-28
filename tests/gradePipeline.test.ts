import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { runGradePipeline, type GradePipelineDeps } from '../lib/gradePipeline.ts';
import type { GradeRequestItem, GradeResult } from '../lib/serverUtils.ts';
import { MAX_ANSWER_LENGTH } from '../lib/utils.ts';

// 이 파일이 고정하는 것은 개별 계산이 아니라 **관문의 순서와 존재**다.
// 검증 전에 Gemini를 부르거나, 레이트 리밋을 건너뛰거나, 클라이언트 값으로 EXP를
// 적립하는 회귀가 생기면 여기서 잡힌다.

const validRubric = [{
    sub: 1, label: '물음 1', points: 10, mode: 'all',
    items: [{ id: '1-1', item: 'A', points: 10, variants: ['감사증거'] }],
}];

const question = (id: number) => ({
    id,
    question_title: `문항 ${id}`,
    question_description: '지문',
    model_answer: '모범답안',
    rubric: validRubric,
});

const req = (id: number, qid: number, a = '유효한 답안'): GradeRequestItem => ({ id, qid, a });

/** 호출 순서를 기록하는 스파이 deps. 개별 동작은 overrides로 갈아끼운다. */
function makeDeps(overrides: Partial<GradePipelineDeps> = {}) {
    const calls: string[] = [];
    const deps: GradePipelineDeps = {
        getUserRole: async () => {
            calls.push('getUserRole');
            return { role: 'PRO', known: true };
        },
        consumeQuota: async () => {
            calls.push('consumeQuota');
            return true;
        },
        fetchQuestions: async (qids) => {
            calls.push('fetchQuestions');
            return qids.map(question);
        },
        gradeBatch: async (items) => {
            calls.push('gradeBatch');
            const out: { [id: number]: GradeResult } = {};
            for (const item of items) out[item.id] = { score: 8, evaluation: 'ok' };
            return out;
        },
        incrementProgress: async () => {
            calls.push('incrementProgress');
            return true;
        },
        ...overrides,
    };
    return { deps, calls };
}

describe('runGradePipeline — 관문 순서', () => {
    test('정상 경로는 등급조회 → 리밋 → 조회 → 채점 → 적립 순으로 진행한다', async () => {
        const { deps, calls } = makeDeps();
        const res = await runGradePipeline('u1', [req(0, 1), req(1, 2)], 10, deps);

        assert.deepEqual(calls, [
            'getUserRole', 'consumeQuota', 'fetchQuestions', 'gradeBatch', 'incrementProgress',
        ]);
        assert.ok(res.ok);
        assert.equal(res.results[0].score, 8);
        assert.equal(res.results[1].score, 8);
        assert.equal(res.awardedExp, 16); // 8 + 8, 서버 점수로 계산
    });

    test('페이로드 검증에 걸리면 레이트 리밋도 Gemini도 건드리지 않는다', async () => {
        const { deps, calls } = makeDeps();
        // PRO 상한은 5문항
        const tooMany = Array.from({ length: 6 }, (_, i) => req(i, i + 1));

        const res = await runGradePipeline('u1', tooMany, 10, deps);
        assert.equal(res.ok, false);
        assert.match(res.ok === false ? res.error : '', /최대 5개/);
        assert.deepEqual(calls, ['getUserRole']);
    });

    test('답안 길이 초과도 Gemini 호출 전에 막힌다', async () => {
        const { deps, calls } = makeDeps();
        const tooLong = [req(0, 1, 'ㄱ'.repeat(MAX_ANSWER_LENGTH + 1))];

        const res = await runGradePipeline('u1', tooLong, 10, deps);
        assert.equal(res.ok, false);
        assert.ok(!calls.includes('gradeBatch'));
        assert.ok(!calls.includes('consumeQuota'));
    });

    test('레이트 리밋에 걸리면 Gemini를 부르지 않는다', async () => {
        const { deps, calls } = makeDeps({ consumeQuota: async () => false });

        const res = await runGradePipeline('u1', [req(0, 1)], 10, deps);
        assert.equal(res.ok, false);
        assert.match(res.ok === false ? res.error : '', /분당 10회/);
        assert.ok(!calls.includes('gradeBatch'));
        assert.ok(!calls.includes('incrementProgress'));
    });
});

describe('runGradePipeline — 경험치 적립', () => {
    test('확인된 게스트에게는 적립하지 않는다', async () => {
        const { deps, calls } = makeDeps({
            getUserRole: async () => ({ role: 'GUEST', known: true }),
        });

        const res = await runGradePipeline('guest', [req(0, 1)], 10, deps);
        assert.ok(res.ok);
        assert.equal(res.awardedExp, 0);
        assert.ok(!calls.includes('incrementProgress'));
        assert.equal(res.results[0].score, 8); // 채점 자체는 정상
    });

    test('등급 조회 실패(known:false)에도 적립을 시도한다 — 조용한 학습기록 손실 방지', async () => {
        const { deps, calls } = makeDeps({
            getUserRole: async () => ({ role: 'GUEST', known: false }),
        });

        const res = await runGradePipeline('u1', [req(0, 1)], 10, deps);
        assert.ok(calls.includes('incrementProgress'));
        assert.ok(res.ok);
        assert.equal(res.awardedExp, 8);
    });

    test('적립 저장이 실패하면 awardedExp는 0이지만 채점 결과는 살아 있다', async () => {
        const { deps } = makeDeps({ incrementProgress: async () => false });

        const res = await runGradePipeline('u1', [req(0, 1)], 10, deps);
        assert.ok(res.ok);
        assert.equal(res.awardedExp, 0);
        assert.equal(res.results[0].score, 8);
    });

    test('채점 불가(-1)는 경험치 합계에서 제외한다', async () => {
        const { deps } = makeDeps({
            gradeBatch: async (items) => {
                const out: { [id: number]: GradeResult } = {};
                items.forEach((item, i) => {
                    out[item.id] = i === 0
                        ? { score: -1, evaluation: 'API 오류' }
                        : { score: 6, evaluation: 'ok' };
                });
                return out;
            },
        });

        const res = await runGradePipeline('u1', [req(0, 1), req(1, 2)], 10, deps);
        assert.ok(res.ok);
        assert.equal(res.awardedExp, 6); // -1이 합계를 깎지 않는다
    });

    test('1회 적립 상한(50)을 넘지 않는다', async () => {
        const { deps } = makeDeps({
            gradeBatch: async (items) => {
                const out: { [id: number]: GradeResult } = {};
                for (const item of items) out[item.id] = { score: 10, evaluation: 'ok' };
                return out;
            },
        });

        const five = Array.from({ length: 5 }, (_, i) => req(i, i + 1));
        const res = await runGradePipeline('u1', five, 10, deps);
        assert.ok(res.ok);
        assert.equal(res.awardedExp, 50);
    });
});

describe('runGradePipeline — DB 수화', () => {
    test('프롬프트에 들어가는 질문/모범답안은 DB 행에서만 온다', async () => {
        let seen: { q: string; m: string } | null = null;
        const { deps } = makeDeps({
            gradeBatch: async (items) => {
                seen = { q: items[0].q, m: items[0].m };
                return { 0: { score: 5, evaluation: 'ok' } };
            },
        });

        await runGradePipeline('u1', [req(0, 42)], 10, deps);
        assert.deepEqual(seen, { q: '문항 42 - 지문', m: '모범답안' });
    });

    test('DB에 없는 문항은 채점 불가로 처리하고 Gemini에 넘기지 않는다', async () => {
        let gradedCount = -1;
        const { deps } = makeDeps({
            fetchQuestions: async () => [],           // 아무것도 못 찾음
            gradeBatch: async (items) => {
                gradedCount = items.length;
                return {};
            },
        });

        const res = await runGradePipeline('u1', [req(0, 999)], 10, deps);
        assert.ok(res.ok);
        assert.equal(res.results[0].score, -1);
        assert.ok(res.results[0].evaluation.includes('채점 불가'));
        assert.equal(gradedCount, -1); // gradeBatch 자체가 호출되지 않았다
        assert.equal(res.awardedExp, 0);
    });

    test('루브릭 검증에 실패한 문항도 채점 불가로 처리한다', async () => {
        const { deps } = makeDeps({
            fetchQuestions: async () => [{
                id: 1,
                question_title: 'T', question_description: 'D', model_answer: 'M',
                rubric: [{ sub: 1, label: 'x', points: 8, mode: 'all', items: [{ id: '1-1', item: 'A', points: 10, variants: ['v'] }] }],
            }],
        });

        const res = await runGradePipeline('u1', [req(0, 1)], 10, deps);
        assert.ok(res.ok);
        assert.equal(res.results[0].score, -1);
        assert.ok(res.results[0].evaluation.includes('루브릭 검증 실패'));
    });

    test('모범 답안은 결과에 실려 검토 화면으로 돌아간다', async () => {
        const { deps } = makeDeps();
        const res = await runGradePipeline('u1', [req(0, 1)], 10, deps);
        assert.ok(res.ok);
        assert.equal(res.results[0].model_answer, '모범답안');
    });
});
