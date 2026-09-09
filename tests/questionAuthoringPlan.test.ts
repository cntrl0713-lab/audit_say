import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuestionAuthoringPlan, validateQuestionAuthoringPlan, authoringPlanHash } from '../cpa_uploader/questionAuthoringPlan.ts';

test('a plan template cannot authorize generation by changing only its status', () => {
    const plan = createQuestionAuthoringPlan('13', ['source-unit']);
    assert.ok(validateQuestionAuthoringPlan(plan).length);
    plan.status = 'ready';
    plan.unresolved_items = [];
    const errors = validateQuestionAuthoringPlan(plan);
    assert.ok(errors.some(error => error.includes('objective')));
    assert.ok(errors.some(error => error.includes('required_answers')));
    assert.ok(errors.some(error => error.includes('edition_assumption')));
});

test('a bounded source task requires conditions, exclusions, provenance and an explicit difference', () => {
    const plan = createQuestionAuthoringPlan('13', ['source-unit']);
    Object.assign(plan, {
        status: 'ready', objective: '선택한 서비스조직 이해 요구사항의 주체와 대상을 설명한다.',
        existing_question_difference: '기존 내부감사·전문가 활용 문제와 구분하여 서비스조직 이해를 다룬다.',
        edition_assumption: '제공 원문의 판본 기록을 따르는 검토용 초안, 최종 시험 판본 확정 아님.',
        unresolved_items: [],
        scope: {
            actors: ['이용자기업 감사인'], timing: ['서비스조직의 영향을 이해하는 단계'],
            conditions: ['선택한 원문 단위에 명시된 업무 범위'], exceptions: ['선택한 구간의 예외를 별도 근거로 확인'],
            required_answers: ['선택한 구간에서 명시한 이해 대상'], exclusions: ['추가감사절차 자체는 묻지 않음'],
        },
    });
    assert.deepEqual(validateQuestionAuthoringPlan(plan), []);
    assert.ok(validateQuestionAuthoringPlan({ ...plan, mode: ['new_from_standard'] }).some(error => error.includes('mode')));
    assert.equal(authoringPlanHash({ ...plan, set_id: 'sidecar-id' } as typeof plan), authoringPlanHash(plan));
    const originalHash = authoringPlanHash(plan);
    plan.scope.exclusions = [];
    assert.ok(validateQuestionAuthoringPlan(plan).some(error => error.includes('exclusions')));
    assert.notEqual(authoringPlanHash(plan), originalHash);
    plan.unresolved_items.push('요구사항의 예외 문단이 아직 없음');
    assert.ok(validateQuestionAuthoringPlan(plan).some(error => error.includes('unresolved_items')));
});
