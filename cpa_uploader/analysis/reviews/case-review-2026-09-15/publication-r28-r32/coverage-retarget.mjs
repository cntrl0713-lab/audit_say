// 퇴역하는 원 11세트를 가리키던 은행 대상 coverage 관계 8건을 대체 문항으로 다시 연결한다(정본 설치 뒤 한 번 실행). publication-r20-r27/coverage-retarget.mjs를 옮겼다.
// 이번 회차에서는 사례형에서 사라진 요구를 정면으로 다루는 기준서형이 은행에 없어 신규 관계(additions)를 만들지 않고 unresolved_findings에 후속 제작 후보로 남겼다.
// 초안 대상(target.scope=draft) 관계 5건은 보존된 초안 파일을 가리키므로 바꾸지 않는다. 반영 전 links.json 사본은 커밋하지 않는 tmp/에 두고 해시만 기록한다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r28-r32/coverage-retarget.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { questionHash, sourceUnitHash } from '../../../coverage/build-coverage.mjs';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { assertRelationship, checkCoverageBeforeWrite } from '../../case-trio-next-2026-09-14/helpers/coverage-contract.mjs';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r28-r32', T = 'tmp/case-review-publication-r28-r32', file = 'cpa_uploader/analysis/coverage/links.json';
const read = (f) => JSON.parse(fs.readFileSync(f)), hash = (x) => createHash('sha256').update(x).digest('hex'), ref = (f) => ({ file: f, sha256: hash(fs.readFileSync(f)) });
const write = (f, v) => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(f); };
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated');
const plan = read(P + '/plan.json'), retired = plan.rounds.flatMap((r) => r.retires);
const decisions = [
    { id: 'frequency-gap-2026-09-10-E-1', set_id: 'pilot-16-008-standards-20260921', subquestion_id: 'sub2', criterion_ids: ['crit1', 'crit2'], relationship: 'adjacent',
        source_unit_ids: ['src-ed7c6456c934480292', 'src-94a783e0ea88044e34'],
        reason: '원 대상 pilot-16-008/sub1은 r31 병합으로 퇴역했다. 요소 “전임감사인의 전기 의견변형 때문에 계속감사의 당기 감사의견이 변형되는 경우 제시”(고급연습 24년 제1회 GS 모의고사 문제5 물음4, 모의 1회)의 원발문 모범답안은 감사기준서 510 문단 13(전임감사인의 전기 의견변형이 당기재무제표에도 계속 관련성이 있고 중요하면 당기재무제표에 대한 감사의견을 변형함)을 근거로 한다. 원 관계는 pilot-16-008 sub1이 같은 “당기 의견 변형”이라는 결론을 KGA 710 문단 11(a)의 대응수치 방식으로 다룬다는 이유로 adjacent였고 검토 대기 상태였다. r31 lineage.json의 dropped_requirements에 따르면 사례형 sub1(문단 11(a), crit1·crit2·crit2.p2 3점)과 sub4(문단 11(b), crit3·crit4 2점)는 비교재무제표 방식으로 고정한 대체 사례형에 넣으면 같은 기준에서 결론이 갈리는 두 경우가 되므로 승계하지 않았고, 분리 보존된 기준서형 세트 pilot-16-008-standards-20260921은 문단 12와 문단 13만 담는다. 은행 전수 조회에서 KGA 710 문단 11을 인용하는 세트를 더 찾지 못했다. 그래서 같은 대응수치 절에서 “당기재무제표에 대한 감사의견의 변형”이라는 축을 계속 다루는 sub2(문단 12)로 대상을 옮긴다. sub2의 crit1(한정의견)과 crit2(부적정의견)은 전기 왜곡표시가 대응수치에서 해결되지 않은 경우 당기재무제표에 표명할 변형의견을 각각 1점의 독립 득점 요건으로 요구한다. 다만 변형의 계기가 전임감사인의 전기 의견변형이 아니라 대응수치의 미재작성·미공시이고, 요소가 요구하는 “어떠한 경우에 변형되는가”라는 조건(KGA 510 문단 13의 계속 관련성·중요성)은 득점 요건이 아니므로 adjacent를 유지한다. 원자료 단위는 퇴역한 문단 11에서 대체 criterion의 근거 문단인 KGA 710 문단 12로 바꾸고, 기존 관계와 같이 공식 전사본 한 단위와 학습자료 한 단위를 둔다. 공식 단위는 대상 세트의 인용 p12와 같은 파일(point-review-710-appendix-2026-09-11.txt)에서 골랐다. 문단 11(a)·(b)와 KGA 510 문단 13을 정면으로 묻는 문항은 은행에 없어 unresolved_findings에 후속 제작 후보로 남긴다.' },
    { id: 'frequency-gap-2026-09-10-E-1-case-quality-split', set_id: 'pilot-16-008-standards-20260921', subquestion_id: 'sub3', criterion_ids: ['crit4', 'crit5'], relationship: 'adjacent',
        source_unit_ids: ['src-ca3c21ef8a5c940946', 'src-8f7c9b047ee23db2a0'],
        reason: '원 대상 pilot-16-008/sub4는 r31 병합으로 퇴역했다. 이 관계는 2026-09-13 물음 분리로 상황 나의 두 기준이 sub4로 옮겨 가면서 frequency-gap-2026-09-10-E-1에서 갈라져 나온 것이고 같은 요소에 대한 adjacent·검토 대기 상태였다. r31 lineage.json에 따라 사례형 sub4(KGA 710 문단 11(b))도 승계되지 않았고 대체 기준서형 세트는 문단 12·13만 담는다. 갈라진 다른 관계가 “당기 의견 변형”의 축을 문단 12로 이어 두므로, 이 관계는 요소의 다른 축인 “전임감사인의 전기 의견변형”을 계속 다루는 sub3(문단 13)으로 옮긴다. sub3의 crit4는 전임감사인이 표명한 의견의 유형을, crit5는 그 의견이 변형되었으면 변형 이유를 기타사항문단에 기재한다는 것을 각각 1점의 독립 득점 요건으로 요구하여 전임감사인의 전기 의견변형 자체를 정면으로 다룬다. 그러나 그 귀결은 기타사항문단의 기재이지 당기 감사의견의 변형이 아니고, 요소가 요구하는 변형의 성립 조건도 여기에서 득점 요건이 아니므로 adjacent를 유지한다. 같은 물음의 crit3(전기재무제표를 전임감사인이 감사하였다는 사실)과 crit6(전임감사인의 감사보고서일)은 전기 의견변형과 무관한 기재사항이어서 대상에 넣지 않는다. 원자료 단위는 퇴역한 문단 11에서 대체 criterion의 근거 문단인 KGA 710 문단 13으로 바꾸고 공식 전사본과 학습자료 각 한 단위를 둔다. 공식 단위는 대상 세트의 인용 p13과 같은 파일에서 골랐다.' },
    { id: 'case-additional-20260914-09-required-positive-response', set_id: 'case-09-confirmation-20260921', subquestion_id: 'sub2', criterion_ids: ['crit8'], relationship: 'partial',
        reason: '원 대상 case-09-confirmation-skepticism-20260918/sub1은 r28 병합으로 퇴역했다. 요소 “적극적 조회의 회신이 반드시 필요한 상황 제시”(고급연습 23년 제3회 GS 모의고사 문제2 물음4, 모의 1회)는 KGA 505 문단 A20의 두 상황을 모두 서술하게 하는데, 원 sub1.c4는 두 사정 중 하나만 들어도 인정하여 partial이었다. r28 lineage.json의 mapping에 따르면 sub1.c4는 항목 번호만 ④에서 ⑨로 바뀌어 sub2의 crit8로 1점 그대로 승계되었고 claim의 인정·불인정 기준과 근거(KGA 505 문단 13·A20)도 같다. 인정 범위가 바뀌지 않았으므로 partial을 유지한다. 식별 crit5는 ⑥·⑦·⑨를 함께 요구하므로 대상에 넣지 않는다. r28이 득점 요건에서 빼고 옳은 항목 ⑤로 돌린 KGA 505 문단 A23 후단과, 문단 13과 결론이 갈려 인용·항목에서 제외한 문단 12는 이 관계의 요구가 아니다. 원자료 단위 KGA 505 A20은 대체 criterion의 근거 문단과 같아 그대로 두었다.' },
    { id: 'case-followup-20260914-16-kam-eom-partial', set_id: 'case-16-kam-emphasis-20260921', subquestion_id: 'sub3', criterion_ids: ['crit12'], relationship: 'partial',
        reason: '원 대상 case-16-kam-emphasis-20260919/sub3은 r29 병합으로 퇴역했다. 요소 “핵심감사사항과 강조사항·기타사항문단의 관계”(고급연습 25년 제2회 GS 모의고사 문제8 물음2, 모의 1회) 가운데 강조사항문단과의 관계에 원 sub3.c4가 대응하고 기타사항문단과의 관계는 요구하지 않아 partial이었다. r29 lineage.json의 mapping에 따르면 sub3.c4는 항목 번호만 ⑬에서 ⑮로 바뀌어 sub3의 crit12로 1점 그대로 승계되었고, claim(강조사항문단은 핵심감사사항으로 결정되지 않은 사항에만 포함하며 개별 핵심감사사항의 기술을 대체하지 않음)과 근거(KGA 706 문단 8(b)·A1·A2)도 같다. r29가 물음 수 상한을 2~3으로 잘못 안내받아 뺀 요구는 원 sub3.c2(문단 9(b), 재무제표에 표시·공시된 정보만 언급)와 sub3.c3(문단 9(c), 강조된 사항과 관련하여 감사의견이 변형되지 않는다는 표시)이고 이 관계의 대상이 아니었으며, 그 요구는 기준서형 pilot-16-004 sub2(문단 9에 따라 준수할 사항을 모두 제시)가 계속 다룬다. 따라서 이 관계는 등급을 낮추지 않는다. 기타사항문단과 핵심감사사항의 관계는 대체 세트에서도 득점 요건이 아니므로 partial을 유지한다. 식별 crit8은 ⑩·⑪·⑬·⑮를 함께 요구하므로 대상에 넣지 않는다. 원자료 단위 KGA 706 문단 8·A1은 대체 criterion의 근거 문단과 같아 그대로 두었다.' },
    { id: 'case-followup-20260914-14-additional-procedures-performer', set_id: 'case-14-group-procedures-20260921', subquestion_id: 'sub3', criterion_ids: ['crit8'], relationship: 'partial',
        reason: '원 대상 case-14-group-procedures-20260915/sub2는 r30 병합으로 퇴역했다. 요소 “부문감사 업무가 불충분할 때 의견변형 결정 전 그룹업무팀의 추가절차”(2017년 기출 문제7 물음4(1), 1회)는 추가 절차의 결정과 그 수행자의 결정이라는 두 요구이고, 원 sub2.c1은 그 절차를 옳은 항목 ⑤로 알아보는지만 식별 기준으로 평가하고 절차를 서술하게 하지 않아 partial이었다. r30 lineage.json에 따르면 sub2.c1·c2·c3은 항목 번호만 ⑤~⑨에서 ⑩~⑭로 바꾸어 sub3의 crit8(식별)·crit9·crit10으로 승계되었고 deleted_requirements는 비어 있다. 옳은 항목 ⑩(업무가 불충분했던 을에게 추가 감사절차를 수행하게 함)의 근거도 KGA 600 문단 43으로 같고, crit8은 ⑩을 옳지 않다고 지적하면 점수를 주지 않으므로 원 구조가 그대로 유지된다. 그래서 partial을 유지하고 대상도 crit8 하나로 둔다. crit9·crit10은 미수정왜곡표시의 그룹 수준 합산 평가와 증거 미입수 상황의 구별을 요구하는 다른 요구여서 대상에 넣지 않는다. 원자료 단위 KGA 600 문단 43은 대체 criterion의 근거 문단과 같아 그대로 두었다.' },
    { id: 'case-applied-20260914-16-comparative-change-direct', set_id: 'case-16-comparative-restatement-20260921', subquestion_id: 'sub2', criterion_ids: ['crit7'], relationship: 'direct',
        reason: '원 대상 case-16-comparative-restatement-20260919/sub2는 r31 병합으로 퇴역했다. 요소 “계속감사 비교재무제표의 전기 의견이 과거 의견과 달라지는 중요한 사유를 기타사항에 포함한다는 설명의 적절성 판단”(2023년 기출 문제10 물음4, 1회)에 원 sub2.c3이 direct로 대응했다. r31 lineage.json의 dropped_requirements는 대상 갱신본에서 삭제한 요구가 없고 항목 ①~⑨·criterion 7개·배점 7점·모범답안·인용 15개를 모두 승계했다고 적고 있으며, id_map은 sub2.c3을 sub2의 crit7로 옮겼다. crit7은 항목 ⑧(전기 재무제표에 대한 의견이 달라진 사유를 강조사항문단에 기재)에 대하여 그 중요한 사유를 강조사항문단이 아니라 기타사항문단에 공시해야 한다는 이유나 절차를 1점의 독립 득점 요건으로 요구하고 근거도 KGA 710 문단 16으로 같으므로 direct를 유지한다. 식별 crit5는 ⑦(중요하지만 전반적이지 않은 왜곡표시의 한정의견)까지 함께 묶으므로 대상에 넣지 않는다. r31이 사례형을 비교재무제표 방식으로 고정한 것은 대상 갱신본 fact1의 전제를 그대로 둔 것이고 이 요소도 계속감사의 비교재무제표를 전제로 하므로 방식 고정이 대응 범위를 바꾸지 않는다. 원자료 단위 KGA 710 문단 16은 대체 criterion의 근거 문단과 같아 그대로 두었다.' },
    { id: 'coverage-deepening-20260914-01', set_id: 'case-04-audit-documentation-20260921', subquestion_id: 'sub1', criterion_ids: ['crit2', 'crit3'], relationship: 'partial',
        reason: '원 대상 case-04-documentation-trace-20260914/sub1은 r32 병합으로 퇴역했다. 요소 “수행한 감사절차의 성격·시기·범위를 문서화할 때 필수적으로 기록할 사항 제시”(고급연습 23년 제2회 GS 모의고사 문제4 물음4, 모의 1회)는 KGA 230 문단 9의 세 사항을 요구하는데, 원 관계는 문단 9(a)의 테스트 대상 식별에만 대응하고 작성·검토자와 날짜는 요구하지 않아 partial이었다. r32 lineage.json의 mapping에 따르면 원 sub1.c1은 sub1의 ①과 crit2(1점)로, 원 sub1.c2는 sub1의 ②와 crit3(1점)으로 각각 승계되었고 인정 기준(개별 송장의 발행일·고유번호 또는 사본 목록 연결, 모집단과 절차 범위의 식별)과 근거(KGA 230 문단 9·A12)도 같다. 두 criterion이 문단 9(a)의 같은 요구를 서로 다른 검사 대상에 적용한 독립 득점 요건이므로 둘 다 대상으로 두고, 문단 9(b)·(c)가 여전히 득점 요건이 아니므로 partial을 유지한다. 검토자·검토일·검토범위는 옳은 항목 ③의 함정으로만 등장한다. 식별 crit1은 ①·②·③을 함께 요구하므로 대상에 넣지 않는다. r32가 계약 충돌로 삭제한 요구는 문단 9(a)·A12의 셋째 예시(체계적 추출), A22의 두 예시, A4·A15, 그리고 원 세트 sub3의 문단 11 적용 2점이고 모두 이 관계의 대상이 아니었다. 삭제분 가운데 문단 9의 요구 자체는 기준서형 draft-standard-additional-20260913-s03 sub1이 계속 다루므로 이 관계의 등급을 낮출 사유가 없고, 기준서형이 없는 A4·A15는 unresolved_findings에 남긴다. 원자료 단위 KGA 230 문단 9·A12는 대체 criterion의 근거 문단과 같아 그대로 두었다.' },
    { id: 'coverage-trio-20260914-c', set_id: 'case-09-confirmation-20260921', subquestion_id: 'sub1', criterion_ids: ['crit2'], relationship: 'partial',
        reason: '원 대상 case-09-negative-confirmation-conditions-20260914/sub1은 r28 병합으로 퇴역했다. 요소 “소극적 조회로 실증감사절차를 수행할 수 있는 필요조건 제시(예시 제외)”(고급연습 23년 제3회 GS 모의고사 문제2 물음2, 모의 1회)는 KGA 505 문단 15의 네 조건 가운데 원발문이 <예시>로 명시적으로 제외한 15(b)(모집단이 다수의 동질적이며 소액인 계정잔액이나 거래 또는 조건들로 구성)를 뺀 세 조건을 요구하고, 원 sub1.c2는 그 가운데 15(a)만 개인예금 상황에 적용하여 partial이었다. r28 lineage.json의 mapping에 따르면 sub1.c2는 sub1의 ①과 crit2로 1점 그대로 승계되었고, 사례가 개인예금에서 소매점 매출채권으로 바뀌었으나 인정 기준(통제의 운영효과성에 관한 증거가 없다는 점을 다루면 인정하고 조건의 전부 열거는 요구하지 않음)과 근거(KGA 505 문단 15·15(a))는 같다. 같은 물음의 crit3은 원 세트 sub2.c2가 승계된 15(b)의 요구인데 이는 원발문이 예시로 제외한 조건이므로 대상에 넣으면 대응 범위를 부풀리게 되어 제외한다. 15(c)·15(d)는 대체 세트가 두 모집단에 공통으로 충족시켜 쟁점에서 뺐으므로 득점 요건이 아니다. 요구한 세 조건 가운데 하나만 득점 요건이므로 partial을 유지한다. 식별 crit1은 ①·②·④를 함께 요구하므로 제외한다. 요소 전체는 기준서형 pilot-09-008 sub2의 네 조건에 대한 direct 관계(frequency-gap-2026-09-10-H-1)가 계속 받는다. r28이 득점 요건에서 뺀 KGA 505 A23 후단은 원 세트 sub3.c2의 요구였고 이 관계의 대상이 아니었다. 원자료 단위 KGA 505 문단 15는 대체 criterion의 근거 문단과 같아 그대로 두었다.' },
];
// 퇴역이 만든 결손을 같은 회차에서 정리하는 신규 관계다. 기존 관계의 재연결이 아니므로 decisions와 구분해 둔다.
// 이번 회차에서 사례형의 득점 요건에서 사라진 요구(KGA 710 문단 11(a)·(b))를 정면으로 다루는 기준서형이 은행에 없어 신규 관계를 만들지 않았다. unresolved_findings 참조.
const additions = [];
const bytes = fs.readFileSync(file), data = JSON.parse(bytes), bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const elements = read('cpa_uploader/analysis/question-elements/question-elements.json').elements, units = buildSourceCatalog().units;
const bankTargets = data.links.filter((l) => l.target && l.target.scope !== 'draft' && retired.includes(l.target.set_id));
assert.equal(bankTargets.length, 8, 'r28~r32는 은행 대상 관계 8건을 재연결한다');
assert.deepEqual(bankTargets.map((l) => l.id).sort(), decisions.map((d) => d.id).sort(), 'Every bank relationship to a retired set must be decided');
for (const id of retired) assert(!bank.some((s) => s.id === id), 'Retired set still in canonical bank: ' + id);
const review = write(P + '/coverage-retarget-review.json', { version: 1, method: 'agent_relationship_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (publication author agent; not an independent peer review)', reviewed_at: new Date().toISOString(),
    basis: '퇴역·대체 이력(plan.json)과 각 회차 초안의 lineage.json, 대체 문항의 발문·항목·criterion, 원 관계의 요소·원출제·답안 비교·원자료 단위를 대조했다. 원자료 단위는 대체 criterion의 근거 문단과 같으면 그대로 두고, 근거 문단이 바뀐 두 건(frequency-gap-2026-09-10-E-1*)만 대체 criterion의 근거 문단으로 옮겼다. 신규 관계는 요소의 요구가 병합에서 사례형의 득점 요건에서 사라지고 기준서형이 그 요구를 계속 다루는 경우에 한정하며, 이번 회차에는 해당하는 기준서형이 없어 만들지 않았다.',
    plan: ref(P + '/plan.json'), links: decisions.map((d) => ({ ...d, decision: 'retarget_to_replacement' })),
    new_links: additions.map((a) => ({ ...a, decision: 'new_relationship_to_standards_set_retaining_the_requirement' })),
    resolved_findings: [],
    unresolved_findings: [
        'frequency-gap-2026-09-10-E-1 / -case-quality-split: r31이 승계하지 않은 KGA 710 문단 11(a)·(b)(전기 변형의 미해결에 따른 당기 의견변형과 변형근거문단의 기재)를 다루는 문항이 은행에 없다. 은행 전수 조회에서 문단 11을 인용하는 세트를 찾지 못했고 r31 lineage.json의 disposition도 후속 회차의 기준서형 물음 후보로 적고 있다. 기준서형이 없으므로 새 관계를 만들지 않고 후속 제작 후보로 남긴다.',
        'element-ff4c17f0c219489c: 원발문 모범답안의 근거인 KGA 510 문단 13(전임감사인의 전기 의견변형이 당기에도 계속 관련성이 있고 중요하면 당기 감사의견을 변형)을 득점 요건으로 묻는 문항이 은행에 없다. case-09-initial-audit-20260915 sub4의 식별 기준 sub4.c1이 문단 13·A9를 근거로 두지만 옳은 항목 ⑩(전임감사인의 변형 사유가 당기에 해결되어 관련성이 없음)으로만 평가하여 독립 득점 요건이 아니고 방향도 원발문의 “변형되는 경우”와 반대다. 후속 제작 후보로 남기고 이 회차에서 새 관계를 만들지 않는다.',
        'r29가 뺀 KGA 706 문단 9(b)·9(c)(강조사항문단에 재무제표에 표시·공시된 정보만 언급, 강조된 사항과 관련하여 감사의견이 변형되지 않는다는 표시)를 가리키는 관계는 이 8건에 없다. 그 요구는 기준서형 pilot-16-004 sub2가 계속 다루며 이번 범위가 아니므로 새 관계를 만들지 않는다.',
        'r32가 삭제한 KGA 230 문단 A4(교체 전 초안·예비적 기록 등은 감사문서에 포함할 필요가 없음)와 A15(불일치 처리의 문서화가 부정확·교체 문서의 보존을 뜻하지 않음)를 직접 묻는 기준서형이 은행에 없다. 이 8건 가운데 그 요구를 가리키는 관계도 없으므로 후속 제작 후보로 남긴다.',
        'r32가 삭제한 사례형 요구(KGA 230 문단 11의 상반정보 처리 기록 2점)와 A22의 두 예시, r28이 득점 요건에서 뺀 KGA 505 문단 A23 후단·인용에서 제외한 문단 12를 가리키는 관계는 이 8건에 없다. 각각 draft-standard-additional-20260913-s03 sub2, pilot-04-006-standards-20260913 sub2, std-points-20260914-f5d37b0c8b8a가 인접 요구를 다루나 이번 범위가 아니므로 새 관계를 만들지 않는다.',
    ],
    unchanged_draft_links: data.links.filter((l) => l.target?.scope === 'draft' && retired.includes(l.target.set_id)).map((l) => l.id) });
const candidate = structuredClone(data);
for (const d of decisions) {
    const link = candidate.links.find((l) => l.id === d.id), previous = structuredClone(link);
    const set = bank.find((s) => s.id === d.set_id), q = set?.subquestions.find((x) => x.id === d.subquestion_id);
    assert(q && set.status === 'published', d.id); assert(d.criterion_ids.every((id) => q.criteria.some((c) => c.id === id)));
    const element = elements.find((e) => e.id === link.element_id); assert(element, link.element_id);
    const sourceIds = d.source_unit_ids ?? link.source_unit_ids;
    const sources = sourceIds.map((id) => { const u = units.find((x) => x.id === id); assert(u, id); return u; });
    Object.assign(link, { source_unit_ids: sourceIds, target: { set_id: set.id, subquestion_id: q.id, criterion_ids: d.criterion_ids }, relationship: d.relationship, review_status: 'reviewed', reason: d.reason,
        snapshot: { element_sha256: hash(JSON.stringify(element)), question_sha256: questionHash(set, q), source_hashes: Object.fromEntries(sources.map((u) => [u.id, u.contentHash])), source_metadata_hashes: Object.fromEntries(sources.map((u) => [u.id, sourceUnitHash(u)])) },
        provenance: { ...previous.provenance, retargeted: { reason: 'retired_and_replaced', previous_target: previous.target, previous_relationship: previous.relationship, previous_reason: previous.reason,
            previous_source_unit_ids: previous.source_unit_ids, previous_snapshot: previous.snapshot, review, publication: ref(P + '/install-completion.json'), human_review_performed: false } } });
    assertRelationship(link);
}
for (const a of additions) {
    assert(!candidate.links.some((l) => l.id === a.id), 'Relationship id already exists: ' + a.id);
    const set = bank.find((s) => s.id === a.set_id), q = set?.subquestions.find((x) => x.id === a.subquestion_id);
    assert(q && set.status === 'published', a.id); assert(a.criterion_ids.every((id) => q.criteria.some((c) => c.id === id)));
    const element = elements.find((e) => e.id === a.element_id); assert(element, a.element_id);
    const sources = a.source_unit_ids.map((id) => { const u = units.find((x) => x.id === id); assert(u, id); return u; });
    const origin = data.links.find((l) => l.id === a.origin_link_id); assert(origin, a.origin_link_id);
    const link = { id: a.id, element_id: a.element_id, source_unit_ids: a.source_unit_ids,
        target: { set_id: set.id, subquestion_id: q.id, criterion_ids: a.criterion_ids }, relationship: a.relationship, review_status: 'reviewed', reason: a.reason,
        snapshot: { element_sha256: hash(JSON.stringify(element)), question_sha256: questionHash(set, q), source_hashes: Object.fromEntries(sources.map((u) => [u.id, u.contentHash])), source_metadata_hashes: Object.fromEntries(sources.map((u) => [u.id, sourceUnitHash(u)])) },
        provenance: { created: { reason: 'requirement_dropped_from_retired_case_and_retained_by_standards_set', origin_link_id: origin.id, origin_previous_target: origin.target,
            review, publication: ref(P + '/install-completion.json'), human_review_performed: false } } };
    assertRelationship(link);
    candidate.links.push(link);
}
assert.equal(candidate.links.length, data.links.length + additions.length);
for (const [i, l] of data.links.entries()) if (!decisions.some((d) => d.id === l.id)) assert.deepEqual(candidate.links[i], l, 'Unrelated relationship changed: ' + l.id);
assert.deepEqual(candidate.links.slice(data.links.length).map((l) => l.id), additions.map((a) => a.id), 'Only the reviewed new relationships may be appended');
assert.equal(hash(fs.readFileSync(file)), hash(bytes), 'Concurrent coverage edit');
const assembled = checkCoverageBeforeWrite({ overlay: candidate, dataset: read('cpa_uploader/analysis/question-elements/question-elements.json'), bank, catalog: buildSourceCatalog(), addedIds: [...decisions, ...additions].map((x) => x.id) });
assert.equal(hash(fs.readFileSync(file)), hash(bytes), 'Concurrent coverage edit after assemble validation');
fs.mkdirSync(T, { recursive: true }); fs.writeFileSync(T + '/coverage-links-before.json', bytes, { flag: 'wx' });
fs.writeFileSync(file, JSON.stringify(candidate, null, 2) + '\n');
write(P + '/coverage-update.json', { created_at: new Date().toISOString(), before: ref(T + '/coverage-links-before.json'), before_copy_committed: false, after: ref(file), retargeted_link_ids: decisions.map((d) => d.id), added_link_ids: additions.map((a) => a.id), review,
    assembled_before_write: assembled, other_links_preserved: true, frequency_inputs_changed: false, human_review_performed: false });
console.log({ retargeted: decisions.length, added: additions.length, total_links: candidate.links.length, assembled });
