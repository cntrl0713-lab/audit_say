import fs from 'node:fs';
import path from 'node:path';
import {
    compilePublicQuestionSet,
    validateQuestionSetV3,
    type CriterionV3,
    type QuestionSetV3,
    type SubquestionV3,
} from '../lib/questionV3.ts';

const ROOT = process.cwd();
const AUTHORING_PATH = path.join(ROOT, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const PUBLIC_PATH = path.join(ROOT, 'cpa_uploader/data/cpa_question_sets_v3.public.json');

type CriticalFact = CriterionV3['critical_facts'][number];


function criticalFact(id: string, type: CriticalFact['type'], expected: string): CriticalFact {
    return { id, type, expected };
}

function criterion(
    id: string,
    requirementId: string,
    sourceRefId: string,
    claim: string,
    fact: CriticalFact,
): CriterionV3 {
    return {
        id,
        requirement_id: requirementId,
        claim,
        critical_facts: [fact],
        max_points: 1,
        scores: { met: 1, not_met: 0, contradicted: 0 },
        source_ref_ids: [sourceRefId],
    };
}

function setByTopic(sets: QuestionSetV3[], topicId: string): QuestionSetV3 {
    const set = sets.find((candidate) => candidate.classification.topic_id === topicId);
    if (!set) throw new Error(`topic ${topicId} 세트가 없습니다.`);
    return set;
}

function subquestion(set: QuestionSetV3, id: string): SubquestionV3 {
    const value = set.subquestions.find((candidate) => candidate.id === id);
    if (!value) throw new Error(`${set.id}/${id} 세부 물음이 없습니다.`);
    return value;
}

function replaceSharedFacts(set: QuestionSetV3, facts: string[]): void {
    set.shared_context.facts = facts.map((text, index) => ({
        id: `fact${index + 1}`,
        text,
        scoreable: false,
    }));
}

function markReviewed(set: QuestionSetV3): void {
    const note = '2026-08-08 의미 품질 검수 지적사항을 결정적으로 보정함. 게시 전 2차 사람 검수가 필요함.';
    if (!set.verification.notes.includes(note)) set.verification.notes.push(note);
    set.status = 'needs_review';
    set.verification.review_status = 'needs_human_review';
}

function applyCorrections(sets: QuestionSetV3[]): void {
    {
        const set = setByTopic(sets, '01');
        replaceSharedFacts(set, ['회계법인은 특정 감사업무에 업무품질관리검토를 적용할 수 있다.']);
        const sub1 = subquestion(set, 'sub1');
        sub1.criteria = [
            criterion('crit1', 'req1', 'src9', '업무팀의 유의적 판단과 결론을 객관적으로 평가하도록 설계된 절차임을 설명함', criticalFact('cf1', 'action', '업무팀의 유의적 판단과 결론을 객관적으로 평가하도록 설계된 절차')),
            criterion('crit2', 'req1', 'src9', '평가가 감사보고서일 또는 그 전에 이루어져야 함을 설명함', criticalFact('cf2', 'condition', '감사보고서일 또는 그 전에 평가')),
            criterion('crit3', 'req1', 'src9', '상장기업 재무제표감사가 검토 대상임을 제시함', criticalFact('cf3', 'condition', '상장기업 재무제표감사')),
            criterion('crit4', 'req1', 'src9', '회계법인이 검토가 필요하다고 결정한 감사업무도 대상임을 제시함', criticalFact('cf4', 'condition', '회계법인이 검토가 필요하다고 결정한 감사업무')),
        ];
        const sub2 = subquestion(set, 'sub2');
        sub2.prompt = '업무품질관리검토가 수행된 경우, 감사업무 수행에 대한 업무수행이사의 책임이 경감되는지 판단하시오.';
        sub2.criteria = [criterion('crit5', 'req2', 'src11', '업무품질관리검토를 수행해도 업무수행이사의 책임은 경감되지 않는다고 판단함', criticalFact('cf5', 'negation', '업무수행이사의 책임은 경감되지 않음'))];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '02');
        const sub1 = subquestion(set, 'sub1');
        sub1.criteria = [
            criterion('crit1', 'req1', 'src4', '경영진을 신뢰해도 전문가적 의구심 유지 필요성은 경감되지 않는다고 판단함', criticalFact('cf1', 'negation', '전문가적 의구심 유지 필요성은 경감되지 않음')),
            criterion('crit2', 'req1', 'src4', '설득력이 낮은 감사증거에 만족할 수 없음을 근거로 제시함', criticalFact('cf2', 'negation', '설득력이 낮은 감사증거에 만족할 수 없음')),
        ];
        const sub2 = subquestion(set, 'sub2');
        sub2.constraints = { ordered: false, max_entries: null, overflow_policy: 'none' };
        sub2.criteria = [
            criterion('crit3', 'req2', 'src12', '정보에 근거한 의사결정을 위해 훈련·지식·경험을 적용하는 것이라는 정의를 설명함', criticalFact('cf3', 'action', '정보에 근거한 의사결정을 위해 관련 훈련·지식·경험을 적용')),
            criterion('crit4', 'req2', 'src12', '감사기준을 판단 근거로 제시함', criticalFact('cf4', 'condition', '감사기준')),
            criterion('crit5', 'req2', 'src12', '회계기준을 판단 근거로 제시함', criticalFact('cf5', 'condition', '회계기준')),
            criterion('crit6', 'req2', 'src12', '윤리기준을 판단 근거로 제시함', criticalFact('cf6', 'condition', '윤리기준')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '03');
        replaceSharedFacts(set, ['감사인과 경영진은 감사업무 수임 전에 각자의 책임과 업무조건을 확인하고 있다.']);
        const sub1 = subquestion(set, 'sub1');
        sub1.model_answer = [
            '감사인은 경영진이 재무제표 작성, 관련 내부통제, 감사에 필요한 정보의 제공 또는 확보에 대한 책임을 인정하고 이해함을 확인해야 한다.',
            '경영진이 책임을 인정하지 않거나 서면진술 제공에 동의하지 않으면, 법규상 강제 수임이 아닌 한 해당 업무를 수임하는 것은 적합하지 않다.',
        ];
        sub1.criteria = [
            criterion('crit1', 'req1', 'src6', '경영진의 재무제표 작성 책임을 확인함', criticalFact('cf1', 'actor', '경영진의 재무제표 작성 책임')),
            criterion('crit2', 'req1', 'src6', '경영진의 관련 내부통제 책임을 확인함', criticalFact('cf2', 'actor', '경영진의 관련 내부통제 책임')),
            criterion('crit3', 'req1', 'src6', '경영진이 감사에 필요한 정보를 제공하거나 확보할 책임을 확인함', criticalFact('cf3', 'actor', '경영진이 감사에 필요한 정보를 제공하거나 확보할 책임')),
            criterion('crit4', 'req2', 'src10', '책임 불인정 시 법규상 강제되지 않는 한 수임이 부적합하다고 설명함', criticalFact('cf4', 'conclusion', '법규상 강제되지 않는 한 수임 부적합')),
        ];
        const sub2 = subquestion(set, 'sub2');
        sub2.criteria = [
            criterion('crit5', 'req3', 'src13', '감사업무 조건 변경 요청의 정당성을 고려함', criticalFact('cf5', 'action', '변경 요청의 정당성 고려')),
            criterion('crit6', 'req3', 'src13', '감사업무 범위제한의 시사점을 고려함', criticalFact('cf6', 'action', '감사업무 범위제한의 시사점 고려')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '04');
        replaceSharedFacts(set, ['감사인은 감사계획 수립과 중요성 결정을 함께 검토하고 있다.']);
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '05');
        replaceSharedFacts(set, ['감사인은 경영진이 연루된 것으로 의심되는 부정과 법규상 커뮤니케이션 제한을 함께 검토하고 있다.']);
        const sub1 = subquestion(set, 'sub1');
        sub1.prompt = '지배기구의 모든 구성원이 경영에 참여하는 경우가 아니고 법규상 커뮤니케이션이 금지되지 않는 상황에서, 감사인이 경영진 연루 부정을 의심한다면 지배기구와 어떤 내용을 커뮤니케이션해야 하는가?';
        sub1.model_answer = ['경영진이 연루된 부정에 대한 의심을 지배기구에 커뮤니케이션하고, 감사를 완료하는 데 필요한 감사절차의 성격·시기·범위를 지배기구와 논의해야 한다.'];
        sub1.criteria = [
            criterion('crit1', 'req1', 'src1', '경영진 연루 부정에 대한 의심을 지배기구에 커뮤니케이션함', criticalFact('cf1', 'action', '부정 의심을 지배기구에 커뮤니케이션')),
            criterion('crit2', 'req1', 'src1', '필요한 감사절차의 성격·시기·범위를 지배기구와 논의함', criticalFact('cf2', 'action', '감사절차의 성격, 시기 및 범위를 지배기구와 논의')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '06');
        const sub1 = subquestion(set, 'sub1');
        sub1.criteria = [
            criterion('crit1', 'req1', 'src6', '재무제표 및 경영진주장 수준에서 부정이나 오류로 인한 위험을 대상으로 함을 설명함', criticalFact('cf1', 'condition', '재무제표 및 경영진주장 수준에서 부정이나 오류로 인한 위험')),
            criterion('crit2', 'req1', 'src6', '중요왜곡표시위험을 식별하고 평가하기 위해 수행하는 감사절차임을 설명함', criticalFact('cf2', 'action', '중요왜곡표시위험을 식별하고 평가하기 위한 감사절차')),
        ];
        const sub2 = subquestion(set, 'sub2');
        sub2.prompt = '통제환경의 미비점이 재무제표에 미치는 영향을 판단하고 그 근거를 설명하시오.';
        sub2.criteria = [
            criterion('crit3', 'req2', 'src7', '통제환경의 미비점이 재무제표 전반에 영향을 미친다고 판단함', criticalFact('cf3', 'conclusion', '통제환경의 미비점은 재무제표 전반에 영향')),
            criterion('crit4', 'req2', 'src7', '통제환경이 내부통제시스템의 전반적인 기초를 제공한다는 근거를 설명함', criticalFact('cf4', 'condition', '통제환경은 내부통제시스템의 전반적인 기초')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '08');
        replaceSharedFacts(set, ['감사인은 매입채무의 완전성을 검증하기 위한 감사절차를 설계하고 있다.']);
        const sub2 = subquestion(set, 'sub2');
        sub2.prompt = '매입채무의 과소계상 여부를 테스트할 때 장부에 기록된 매입채무를 테스트하는 것이 관련성 있는지 판단하고, 과소계상 검증에 관련성 있는 정보의 예를 하나 이상 제시하시오.';
        sub2.criteria = [
            criterion('crit3', 'req2', 'src1', '장부에 기록된 매입채무 테스트는 과소계상 검증에 관련성이 없다고 판단함', criticalFact('cf3', 'conclusion', '장부에 기록된 매입채무 테스트는 관련성 없음')),
            criterion('crit4', 'req2', 'src1', '후속 지급거래·미지급 송장·매입처 계산서 등 장부 밖 정보를 테스트해야 한다고 설명함', criticalFact('cf4', 'action', '후속 지급거래, 미지급 송장 또는 매입처 계산서 등 장부 밖 정보 테스트')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '09');
        const sub1 = subquestion(set, 'subq1');
        sub1.constraints.ordered = false;
        const sub2 = subquestion(set, 'subq2');
        sub2.prompt = '소극적 조회에 회신이 없는 경우와 적극적 조회에 회신을 받은 경우 중 어느 쪽이 더 설득력 있는 감사증거를 제공하는지 판단하고 그 이유를 설명하시오.';
        sub2.model_answer = ['적극적 조회에 회신을 받은 경우가 더 설득력 있는 감사증거를 제공한다. 소극적 조회에 회신이 없다는 사실은 조회 대상자가 조회서를 수령했거나 정보의 정확성을 검증했음을 명시적으로 나타내지 않기 때문이다.'];
        sub2.criteria = [
            criterion('crit3', 'req3', 'src4', '적극적 조회에 회신을 받은 경우가 소극적 조회에 회신이 없는 경우보다 설득력이 높다고 판단함', criticalFact('cf3', 'conclusion', '적극적 조회 회신이 소극적 조회 미회신보다 설득력이 높음')),
            criterion('crit4', 'req3', 'src4', '소극적 조회 미회신은 수령이나 정보 정확성 검증을 명시하지 않는다는 이유를 설명함', criticalFact('cf4', 'condition', '소극적 조회 미회신은 수령 또는 정확성 검증을 명시하지 않음')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '10');
        replaceSharedFacts(set, ['감사인은 하나의 모집단에서 표본을 추출하고, 필요한 표본규모를 줄일 방법을 검토하고 있다.']);
        const sub1 = subquestion(set, 'subq1');
        sub1.prompt = '감사인이 감사표본을 설계할 때 모집단과 관련하여 고려해야 할 세 가지 사항을 제시하시오.';
        sub1.constraints.max_entries = 3;
        sub1.model_answer = ['이탈 또는 왜곡표시를 구성하는 것이 무엇인지 정의한다.', '표본감사를 위해 이용할 모집단을 정의한다.', '표본이 도출된 모집단이 완전하다는 증거를 입수하기 위한 감사절차를 수행한다.'];
        sub1.criteria = [
            criterion('crit1', 'req1', 'src3', '이탈 또는 왜곡표시를 구성하는 것이 무엇인지 정의함', criticalFact('cf1', 'action', '이탈 또는 왜곡표시의 정의')),
            criterion('crit2', 'req1', 'src3', '표본감사를 위해 이용할 모집단을 정의함', criticalFact('cf2', 'action', '표본감사를 위한 모집단 정의')),
            criterion('crit5', 'req1', 'src3', '모집단의 완전성에 대한 증거를 입수하는 감사절차를 수행함', criticalFact('cf5', 'action', '모집단 완전성에 대한 증거 입수 절차')),
        ];
        const sub2 = subquestion(set, 'subq2');
        sub2.criteria = [
            criterion('crit3', 'req2', 'src7', '계층화가 감사 효율성을 향상시킨다고 설명함', criticalFact('cf3', 'conclusion', '감사 효율성 향상')),
            criterion('crit4', 'req2', 'src7', '계층화가 각 계층 내 항목의 변동성을 감소시킨다고 설명함', criticalFact('cf4', 'condition', '계층 내 항목의 변동성 감소')),
            criterion('crit5', 'req2', 'src7', '표본위험을 증가시키지 않고 표본규모를 줄일 수 있다고 설명함', criticalFact('cf5', 'conclusion', '표본위험 증가 없이 표본규모 감소')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '11');
        replaceSharedFacts(set, ['감사인은 회계추정치와 특수관계자 거래에 관한 중요왜곡표시위험을 각각 평가하고 있다.']);
        const sub1 = subquestion(set, 'sub1');
        sub1.criteria = [
            criterion('crit1', 'req1', 'src1', '추정불확실성을 왜곡표시 가능성에 영향을 미치는 요소로 설명함', criticalFact('cf1', 'condition', '추정불확실성')),
            criterion('crit2', 'req1', 'src1', '주관성을 왜곡표시 가능성에 영향을 미치는 요소로 설명함', criticalFact('cf2', 'condition', '주관성')),
            criterion('crit3', 'req1', 'src1', '복잡성을 왜곡표시 가능성에 영향을 미치는 요소로 설명함', criticalFact('cf3', 'condition', '복잡성')),
        ];
        const sub2 = subquestion(set, 'sub2');
        sub2.type = 'descriptive';
        sub2.prompt = '다음 두 상황을 각각 설명하시오. ① 정상적인 사업과정을 벗어난 유의적인 특수관계자 거래를 유의적 위험으로 취급하는지 ② 높은 추정불확실성·복잡성·주관성이 전문가적 의구심의 중요성에 어떤 영향을 미치는지';
        sub2.constraints = { ordered: false, max_entries: 2, overflow_policy: 'none' };
        sub2.model_answer = ['정상적인 사업과정을 벗어난 유의적인 특수관계자 거래는 유의적 위험으로 취급한다.', '회계추정치가 높은 추정불확실성·복잡성·주관성의 영향을 받을수록 전문가적 의구심의 중요성이 증가한다.'];
        sub2.criteria = [
            criterion('crit4', 'req2', 'src6', '정상적인 사업과정을 벗어난 유의적인 특수관계자 거래를 유의적 위험으로 취급함', criticalFact('cf4', 'condition', '정상적인 사업과정을 벗어난 유의적인 특수관계자 거래는 유의적 위험')),
            criterion('crit5', 'req3', 'src8', '추정불확실성·복잡성·주관성이 높을수록 전문가적 의구심의 중요성이 증가한다고 설명함', criticalFact('cf5', 'conclusion', '추정불확실성, 복잡성 또는 주관성이 높을수록 전문가적 의구심 중요성 증가')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '12');
        replaceSharedFacts(set, ['감사인은 감사종결 단계에서 미수정왜곡표시와 계속기업 평가자료를 검토하고 있다.']);
        const sub1 = subquestion(set, 'subq1');
        sub1.criteria[0] = criterion('crit1', 'req1', 'src2', '미수정왜곡표시가 개별적 또는 집합적으로 재무제표 전체에 중요하지 않다는 경영진의 믿음에 관한 서면진술을 요청함', criticalFact('cf1', 'action', '개별적 또는 집합적 미수정왜곡표시가 재무제표 전체에 중요하지 않다는 믿음에 관한 서면진술'));
        const sub2 = subquestion(set, 'subq2');
        sub2.criteria = [
            criterion('crit3', 'req2', 'src11', '10개월은 재무제표일로부터 최소 12개월에 미달한다고 판단함', criticalFact('cf3', 'number', '10개월은 12개월 미만')),
            criterion('crit4', 'req2', 'src11', '경영진에게 평가기간을 적어도 12개월로 확장하도록 요청함', criticalFact('cf4', 'action', '평가기간을 적어도 12개월로 확장하도록 요청')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '13');
        replaceSharedFacts(set, ['외부감사인은 내부감사기능과 감사인측 전문가의 업무를 활용할지 검토하고 있다.']);
        const sub1 = subquestion(set, 'sub1');
        sub1.criteria = [
            criterion('crit1', 'req1', 'src3', '내부감사기능을 활용해도 외부감사인의 감사의견 책임은 경감되지 않는다고 설명함', criticalFact('cf1', 'negation', '내부감사기능 활용 시에도 외부감사인의 책임은 경감되지 않음')),
            criterion('crit2', 'req2', 'src5', '감사인측 전문가를 활용해도 외부감사인의 감사의견 책임은 경감되지 않는다고 설명함', criticalFact('cf2', 'negation', '감사인측 전문가 활용 시에도 외부감사인의 책임은 경감되지 않음')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '14');
        replaceSharedFacts(set, ['그룹감사인은 여러 부문의 재무정보를 이용해 그룹재무제표 감사를 계획하고 있다.']);
        for (const source of set.source_refs) source.role = 'practice';
        const sub1 = subquestion(set, 'sub1');
        sub1.criteria = [criterion('crit1', 'req1', 'src1', '그룹감사인이 그룹재무제표 전체에 대한 감사의견을 책임지며 부문감사인이 업무를 수행해도 그 책임이 감소하지 않는다고 설명함', criticalFact('cf1', 'conclusion', '그룹재무제표 전체에 대한 감사의견 책임은 부문감사인 활용에도 감소하지 않음'))];
        const sub2 = subquestion(set, 'sub2');
        sub2.prompt = '그룹감사인이 부문감사인의 업무를 활용하기 전에 확인해야 할 사항을 모두 제시하시오.';
        sub2.constraints = { ordered: false, max_entries: 4, overflow_policy: 'none' };
        sub2.selection = { type: 'all', n: null };
        sub2.model_answer = ['부문감사인의 적격성을 평가한다.', '부문감사인의 역량을 평가한다.', '관련 윤리적 요구사항, 특히 독립성을 평가한다.', '그룹감사인이 부문감사인의 업무에 충분하고 적절하게 관여할 수 있는지 판단한다.'];
        sub2.criteria = [
            criterion('crit2', 'req2', 'src14', '부문감사인의 적격성을 평가함', criticalFact('cf2', 'condition', '부문감사인의 적격성')),
            criterion('crit3', 'req2', 'src14', '부문감사인의 역량을 평가함', criticalFact('cf3', 'condition', '부문감사인의 역량')),
            criterion('crit4', 'req2', 'src14', '관련 윤리적 요구사항, 특히 독립성을 평가함', criticalFact('cf4', 'condition', '관련 윤리적 요구사항, 특히 독립성')),
            criterion('crit5', 'req3', 'src6', '그룹감사인이 부문감사인의 업무에 충분하고 적절하게 관여할 수 있는지 판단함', criticalFact('cf5', 'action', '부문감사인 업무에 충분하고 적절하게 관여할 수 있는지 판단')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '15');
        replaceSharedFacts(set, ['감사인은 감사보고서의 단락 구성과 의견변형 근거를 점검하고 있다.']);
        const supplement = set.source_refs.find((source) => source.id === 'src3');
        if (supplement) supplement.role = 'practice';
        const sub1 = subquestion(set, 'subq1');
        sub1.criteria = [
            criterion('crit1', 'req1', 'src9', '감사보고서 첫 번째 단락에 감사의견을 포함함', criticalFact('cf1', 'action', '첫 번째 단락에 감사의견 포함')),
            criterion('crit2', 'req1', 'src9', '첫 번째 단락의 제목을 감사의견으로 함', criticalFact('cf2', 'action', '첫 번째 단락 제목은 감사의견')),
            criterion('crit3', 'req2', 'src8', '감사의견 단락 바로 다음에 근거 단락을 배치함', criticalFact('cf3', 'action', '감사의견 단락 바로 다음에 근거 단락 배치')),
            criterion('crit4', 'req2', 'src8', '근거 단락의 제목을 감사의견근거로 함', criticalFact('cf4', 'action', '근거 단락 제목은 감사의견근거')),
        ];
        const sub2 = subquestion(set, 'subq2');
        sub2.criteria = [criterion('crit5', 'req3', 'src3', '의견변형 원인을 한정의견 근거·부적정의견 근거·의견거절 근거 중 해당 문단에 구체적으로 설명함', criticalFact('cf5', 'action', '한정의견 근거, 부적정의견 근거 또는 의견거절 근거 문단에 구체적으로 설명'))];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '16');
        const sub1 = subquestion(set, 'sub1');
        sub1.criteria = [
            criterion('crit1', 'req1', 'src12', '대응수치가 당기재무제표의 필수적 부분이라고 설명함', criticalFact('cf1', 'conclusion', '대응수치는 당기재무제표의 필수적 부분')),
            criterion('crit2', 'req1', 'src12', '대응수치가 당기수치와 관련하여서만 이해되도록 의도된다고 설명함', criticalFact('cf2', 'condition', '대응수치는 당기수치와 관련하여서만 이해')),
            criterion('crit3', 'req2', 'src14', '비교재무제표가 당기재무제표와 비교할 목적으로 포함된다고 설명함', criticalFact('cf3', 'condition', '당기재무제표와 비교할 목적으로 포함')),
            criterion('crit4', 'req2', 'src14', '비교재무제표가 감사를 받았다면 감사의견에서 언급된다고 설명함', criticalFact('cf4', 'action', '감사를 받았다면 감사의견에서 언급')),
        ];
        const sub2 = subquestion(set, 'sub2');
        sub2.prompt = '외부감사법에 따른 감사에서 비교정보 표시 방법으로 어떤 방식을 채택해야 하는지 판단하시오.';
        sub2.model_answer = ['비교재무제표 방식을 채택해야 한다.'];
        sub2.criteria = [criterion('crit5', 'req3', 'src6', '비교재무제표 방식을 채택해야 한다고 판단함', criticalFact('cf5', 'conclusion', '비교재무제표 방식'))];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '17');
        replaceSharedFacts(set, ['회사는 재무제표 감사와 내부회계관리제도 감사를 함께 준비하고 있다.']);
        const sub2 = subquestion(set, 'subq2');
        sub2.prompt = '내부회계관리제도 감사보고서에 포함되는 요소 중 근거 자료에 열거된 요소를 모두 제시하시오.';
        sub2.constraints = { ordered: false, max_entries: null, overflow_policy: 'none' };
        sub2.selection = { type: 'all', n: null };
        sub2.model_answer = ['제목', '수신인', '의견', '근거', '책임', '정의', '한계'];
        sub2.criteria = [
            criterion('crit2', 'req2', 'src12', '제목을 제시함', criticalFact('cf2', 'conclusion', '제목')),
            criterion('crit3', 'req2', 'src12', '수신인을 제시함', criticalFact('cf3', 'conclusion', '수신인')),
            criterion('crit4', 'req2', 'src12', '의견을 제시함', criticalFact('cf4', 'conclusion', '의견')),
            criterion('crit5', 'req2', 'src12', '근거를 제시함', criticalFact('cf5', 'conclusion', '근거')),
            criterion('crit6', 'req2', 'src12', '책임을 제시함', criticalFact('cf6', 'conclusion', '책임')),
            criterion('crit7', 'req2', 'src12', '정의를 제시함', criticalFact('cf7', 'conclusion', '정의')),
            criterion('crit8', 'req2', 'src12', '한계를 제시함', criticalFact('cf8', 'conclusion', '한계')),
        ];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '18');
        const supplement = set.source_refs.find((source) => source.id === 'src6');
        if (supplement) supplement.role = 'practice';
        const sub1 = subquestion(set, 'subq1');
        sub1.criteria = [
            criterion('crit1', 'req1', 'src1', '소규모기업이 아닌 기업에는 KGA 1200을 적용할 수 없다고 판단함', criticalFact('cf1', 'negation', 'KGA 1200 적용 불가')),
            criterion('crit2', 'req1', 'src1', '그 경우 KGA 200부터 KGA 720까지의 일반 감사기준서를 적용한다고 설명함', criticalFact('cf2', 'action', 'KGA 200부터 KGA 720까지의 일반 감사기준서 적용')),
        ];
        const sub2 = subquestion(set, 'subq2');
        sub2.prompt = 'KGA 1200 보론 2의 적정의견 감사보고서 사례에서 핵심감사사항(KAM) 단락이 포함되는지 설명하시오.';
        sub2.model_answer = ['해당 적정의견 감사보고서 사례에는 핵심감사사항(KAM) 단락이 포함되지 않는다.'];
        sub2.criteria = [criterion('crit3', 'req2', 'src6', '보론 2 적정의견 감사보고서 사례에 KAM 단락이 포함되지 않는다고 설명함', criticalFact('cf3', 'negation', 'KAM 단락이 포함되지 않음'))];
        markReviewed(set);
    }

    {
        const set = setByTopic(sets, '19');
        const sub1 = subquestion(set, 'sub1');
        sub1.criteria = [
            criterion('crit1', 'req1', 'src4', '재무정보작성업무를 비인증업무 예시로 제시함', criticalFact('cf1', 'conclusion', '재무정보작성업무')),
            criterion('crit2', 'req1', 'src4', '합의된 절차 수행업무를 비인증업무 예시로 제시함', criticalFact('cf2', 'conclusion', '합의된 절차 수행업무')),
            criterion('crit3', 'req1', 'src4', '세무업무를 비인증업무 예시로 제시함', criticalFact('cf3', 'conclusion', '세무업무')),
        ];
        markReviewed(set);
    }

    markReviewed(setByTopic(sets, '07'));
}

function main(): void {
    const sets = JSON.parse(fs.readFileSync(AUTHORING_PATH, 'utf8')) as QuestionSetV3[];
    applyCorrections(sets);

    const errors = sets.flatMap((set) => validateQuestionSetV3(set, { verifySourceQuotes: true, cwd: ROOT }).errors.map((error) => `${set.id}: ${error}`));
    if (errors.length > 0) throw new Error(`검수 보정 후 검증 실패:\n${errors.join('\n')}`);

    fs.writeFileSync(AUTHORING_PATH, `${JSON.stringify(sets, null, 2)}\n`, 'utf8');
    fs.writeFileSync(PUBLIC_PATH, `${JSON.stringify(sets.map(compilePublicQuestionSet), null, 2)}\n`, 'utf8');
    console.log(`사람 검수 보정 적용 완료: ${sets.length}세트`);
}

main();
