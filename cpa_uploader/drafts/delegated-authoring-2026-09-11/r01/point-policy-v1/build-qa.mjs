import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {entries,read} from './inspect.mjs';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/';
const handoff=read(base+'r01/point-policy-v1/handoff.in-progress.json');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const verdict={M:'met',N:'not_met',C:'contradicted'};
// Every row below was read with the whole preserved answer. These are explicit
// author judgments; no old zero or failed model output is propagated to children.
const tables={
 'T09-B':{
  q1:{ids:['q1.c1','q1.c4','q1.c3','q1.c5'],rows:{model:'MMMM',equivalent:'MMMM','reverse-order':'MMMM','single-paragraph':'MMMM',empty:'NNNN','omit-1':'NMMM','omit-2':'MMMM','omit-3':'MMNN',opposite:'CCCC','condition-boundary':'MMCN','irrelevant-prefix':'MMMM','root-single-sentence':'MMMM'}},
  q2:{ids:['q2.c2','q2.c3'],rows:{model:'MM',equivalent:'MM','reverse-order':'MM','single-paragraph':'MM',empty:'NN','omit-1':'MM','omit-2':'NN',opposite:'CC','condition-boundary':'NC','irrelevant-prefix':'MM','clear-omission':'MM','clear-opposite':'NN','procedure-with-explicit-limitation':'MM','root-single-sentence':'MM'}}
 },
 'T12-A':{q2:{ids:['q2.c3','q2.c6'],rows:{model:'MM',equivalent:'MM','reverse-order':'MM','single-paragraph':'MM',empty:'NN','omit-1':'MM','omit-2':'MM','omit-3':'NN','omit-4':'MM','omit-5':'MM',opposite:'CC','condition-boundary':'NN','irrelevant-prefix':'MM','true-omission-date-method':'MM','date-only':'NN','dual-date-one-sentence':'NN','root-single-sentence':'MM'}}},
 'T12-B':{q2:{ids:['q2.c1','q2.c4'],rows:{model:'MM',equivalent:'MM','reverse-order':'MM','single-paragraph':'MM',empty:'NN','omit-1':'MM','omit-2':'MM','omit-3':'MM',opposite:'CC','condition-boundary':'CC','irrelevant-prefix':'MM','true-omission-opinion-types':'NN','root-single-sentence':'MM'}}},
 'T13-A':{sub2:{ids:['sub2.crit4','sub2.crit5'],rows:{'model-answer':'MM',equivalent:'MM',reverse:'MM','single-sentence':'MM','irrelevant-prefix':'MM',empty:'NN','omit-1':'MM','opposite-1':'MM','boundary-1':'NN','omit-2':'MM','opposite-2':'MM','boundary-2':'NN','omit-3':'MM','opposite-3':'MM','boundary-3':'NN','omit-4':'NN','opposite-4':'CC','boundary-4':'NN'}}},
 'T09-C':{sub2:{ids:['sub2.crit1','sub2.crit2','sub2.crit7'],rows:{'model-answer':'MMM',equivalent:'MMM',reverse:'MMM','single-sentence':'MMM','irrelevant-prefix':'MMM',empty:'NNN','omit-1':'NMN','opposite-1':'MMC','boundary-1':'NNN','omit-2':'MNN','opposite-2':'MMC','boundary-2':'NNN','omit-3':'MMM','opposite-3':'MMM','boundary-3':'NNN','omit-4':'MMM','opposite-4':'MMM','boundary-4':'NNN','omit-5':'MMM','opposite-5':'MMM','boundary-5':'NNN','omit-6':'MMM','opposite-6':'MMM','boundary-6':'NNN','and-trigger':'MMC'}}},
 'T09-D':{sub3:{ids:['sub3.crit1','sub3.crit3','sub3.crit2','sub3.crit4'],rows:{'model-answer':'MMMM',equivalent:'MMMM',reverse:'MMMM','single-sentence':'MMMM','irrelevant-prefix':'MMMM',empty:'NNNN','omit-1':'NNMM','opposite-1':'CCMM','boundary-1':'NNNN','omit-2':'MMNN','opposite-2':'MMCC','boundary-2':'NNNN'}}},
 'T13-B':{sub1:{ids:['sub1.crit2','sub1.crit5','sub1.crit3','sub1.crit6'],rows:{'model-answer':'MMMM',equivalent:'MMMM',reverse:'MMMM','single-sentence':'MMMM','irrelevant-prefix':'MMMM',empty:'NNNN','omit-1':'MMMM','opposite-1':'MMMM','boundary-1':'NNNN','omit-2':'NNMM','opposite-2':'CCMM','boundary-2':'NNNN','omit-3':'MMNN','opposite-3':'MMCC','boundary-3':'NNNN','omit-4':'MMMM','opposite-4':'MMMM','boundary-4':'NNNN','significant-risk-limited-judgment':'NNMM'}}}
};
const specialReasons={
 'T09-B/q1/omit-1':'조회처가 정보를 직접 제공한다는 방식은 남아 새 c4를 충족한다. 감사인의 공란 처리는 답에 없으므로 c1은 미충족이다. 회신율 저하와 추가 노력은 모두 명시되어 있다.',
 'T09-B/q1/condition-boundary':'공란형에서 상대방이 직접 적는다는 방식은 c1/c4를 충족한다. 회신율 항상 상승은 c3 반대이다. 추가 노력이라는 이유는 제시하지 않았으므로 옛 복합 c3의 반대를 새 이유 c5에 전파하지 않는다.',
 'T09-B/q2/condition-boundary':'언제나 의견거절이라는 주장은 의견영향 판단 c3의 반대이다. 감사 수행에 대한 시사점 자체는 쓰지 않았으므로 c2는 반대가 아닌 누락이다.',
 'T12-A/q2/omit-1':'원래 추가일자 설명은 두 일자의 병존을 함축한다는 활성 c1 계약을 유지한다. 과거4/4/4 실측 실패를 기대값 변경으로 숨기지 않으며 새 c3/c6은 각각 명시되어 있다.',
 'T12-B/q2/omit-1':'한정의견근거와 부적정의견근거라는 두 이름이 각각의 가능한 의견을 명확히 함축하므로 두 의견명 요소 모두 충족한다.',
 'T13-A/sub2/omit-3':'외부전문가의 객관성 위협을 평가하는 이해 및 관계 질문이 명칭만 묻는 객관성 평가를 함축한다는 기존 계약을 유지한다. 두 질문대상도 모두 존재한다.',
 'T09-C/sub2/and-trigger':'두 조건 내용은 모두 정확하여 새 c1/c2 각각 충족한다. 반드시 동시에 필요하다는 한 관계 오류는 c7에서만 반대로 평가한다. 네 방법·대안 요소는 그대로 충족한다.',
 'T09-C/sub2/opposite-1':'식별된 소송의 중요왜곡표시위험이라는 첫 조건을 식별했지만 그것만으로 충분하지 않다고 잘못 한정했다. 새 조건식별 c1은 충족, 별도 관계 c7은 반대이다.',
 'T09-C/sub2/opposite-2':'그 밖의 중요한 소송 가능성이라는 둘째 조건을 식별했지만 첫 조건도 요구하는 AND 한정을 했다. 새 c2는 충족, c7은 반대이다.',
 'T09-C/sub2/omit-3':'원답안에 경영진이 작성한 질의서를 감사인이 발송한다는 문장이 그대로 남아 경영진 작성 사실을 명시한다. 옛 c3 not_met는 진짜 누락이 아니므로 같은 답으로 met으로 정정하고 이전 기대값은 lineage에 보존한다.',
 'T09-C/sub2/boundary-1':'선택된 QA-only 후속의 직접 회신 c5 met를 보존한다. 소문만이라는 잘못된 별도 발동조건은 새 c1/c2 또는 OR의 충족 근거가 아니며 c5에 감점을 전파하지 않는다.',
 'T13-B/sub1/significant-risk-limited-judgment':'지문에서 정한 경영진주장 수준 유의적 위험 문맥에 대한 내부활용 축소·직접업무 확대·제한된 판단 활용이 모두 맞다. 위험 수준 명칭을 다시 반복하도록 강제하지 않는다.'
};
const newCases=[];
// Explicit answer-level vectors use current criterion order. Unmentioned criteria
// are not_met, unless a real implication is explicitly listed below.
function add(plan,q,target,kind,answer,marks={},reason=''){
 newCases.push({plan,q,target,kind,answer,marks,reason});
}
function five(plan,q,target,rows){for(const [kind,answer,marks,reason] of rows)add(plan,q,target,kind,answer,marks,reason);}
five('T09-B','q1','q1.c1',[
 ['full','조회서의 금액이나 기타 정보란은 공란으로 보내야 한다.',{'q1.c1':'M'}],
 ['paraphrase','감사인은 잔액 등 확인받을 정보를 먼저 채우지 않는다.',{'q1.c1':'M'}],
 ['omission','조회처가 자신의 금액이나 정보를 직접 작성하여 회신하도록 요청한다.',{'q1.c4':'M'},'직접 작성 요청만 남겼고 감사인의 사전기재 여부는 제시하지 않았다.'],
 ['opposite','감사인이 금액과 기타 정보를 모두 미리 기재한다.',{'q1.c1':'C'}],
 ['condition_boundary','공란형이 아닌 일반 금액 기재형 조회서의 준비에서는 감사인이 확인받을 금액을 먼저 기재한다.',{},'다른 조회형식의 절차만 기술하여 공란형 작성 요구는 미제시다.']
]);
five('T09-B','q1','q1.c4',[
 ['full','조회처에게 자신의 금액이나 기타 정보를 직접 작성하여 회신하도록 요청한다.',{'q1.c4':'M'}],
 ['paraphrase','상대방이 자기 자료의 수치나 정보를 직접 적어 답하도록 요구한다.',{'q1.c4':'M'}],
 ['omission','감사인은 조회서에 금액이나 기타 정보를 미리 적지 않는다.',{'q1.c1':'M'},'공란 처리만으로 조회처의 정보제공 요청을 자동 보충하지 않는다.'],
 ['opposite','조회처에게 자신의 금액이나 기타 정보를 직접 제공하도록 요청할 필요는 없다.',{'q1.c4':'C'}],
 ['condition_boundary','조회처가 아니라 회사의 영업직원에게 다음 달 매출예측을 작성하도록 요청한다.',{},'주체·정보·요청의 목적이 달라 공란형 회신 방식이 아니다.']
]);
five('T09-B','q1','q1.c2',[
 ['full','공란형은 정확성을 검증하지 않고 회신하는 위험을 줄일 수 있다.',{'q1.c2':'M'},'위험 감소 효과만으로 충족하며 작성·회신 방식의 반복을 요구하지 않는다.'],
 ['paraphrase','정보가 맞는지 확인 없이 답하는 위험을 완화할 수 있다.',{'q1.c2':'M'}],
 ['omission','조회처가 자신의 금액이나 정보를 직접 작성하여 회신하도록 요청한다.',{'q1.c4':'M'},'작성 요청만 남아 있고 위험감소 효과는 미제시다.'],
 ['opposite','공란형은 정확성 확인 없이 회신할 위험을 줄이는 데 도움이 되지 않는다.',{'q1.c2':'C'}],
 ['condition_boundary','조회처의 회신 검증과는 별개로 감사인의 전산자료 전송 누락 위험을 낮출 수 있다고만 설명한다.',{},'위험의 종류와 주체가 달라 이번 효과 명제를 충족하지 않는다.']
]);
five('T09-B','q1','q1.c3',[
 ['full','공란형은 일반적인 금액 기재형보다 회신율이 더 낮을 수 있다.',{'q1.c3':'M'}],
 ['paraphrase','이미 금액이 적힌 조회에 비해 공란형 조회에 응답하는 비율은 떨어질 가능성이 있다.',{'q1.c3':'M'}],
 ['omission','조회처에는 추가적인 작성 노력이 필요하기 때문이다.',{'q1.c5':'M'},'추가 부담이라는 이유는 적었으나 회신율 방향은 쓰지 않았다.'],
 ['opposite','공란형의 회신율은 일반 금액 기재형보다 항상 더 높다.',{'q1.c3':'C'}],
 ['condition_boundary','금액 기재형 적극적 조회와 소극적 조회 사이의 회신율 차이만 비교한다.',{},'비교대상에서 공란형이 빠져 이번 요구의 회신율 한계가 아니다.']
]);
five('T09-B','q1','q1.c5',[
 ['full','공란형은 조회처의 추가적인 작성 노력을 요구하기 때문이다.',{'q1.c5':'M'}],
 ['paraphrase','이유는 응답자가 들여야 하는 작성 수고와 부담이 더 크다는 것이다.',{'q1.c5':'M'}],
 ['omission','공란형의 회신율은 일반 금액 기재형보다 낮을 수 있다.',{'q1.c3':'M'},'회신율 저하만 쓰고 추가 노력 이유를 쓰지 않았다.'],
 ['opposite','공란형에서는 조회처의 작성 노력이 줄어들기 때문이다.',{'q1.c5':'C'}],
 ['condition_boundary','공란형 회신율의 이유로 감사인의 발송 업무가 번거로워진다는 점만 제시한다.',{},'감사인의 발송 부담은 조회처의 추가 작성 노력이라는 대상과 다르다.']
]);
five('T09-B','q2','q2.c2',[
 ['full','필수 회신을 얻지 못한 것이 해당 감사의 수행에 미치는 시사점을 결정한다.',{'q2.c2':'M'}],
 ['paraphrase','이 비회신이 감사 업무 진행에 어떤 영향을 주는지 판단해야 한다.',{'q2.c2':'M'}],
 ['omission','회신 미입수가 감사의견에 미칠 영향을 판단한다.',{'q2.c3':'M'},'의견영향은 남아 있으나 감사 수행 영향은 미제시다.'],
 ['opposite','필수 회신을 못 받아도 감사의 수행에 대한 시사점은 결정하지 않는다.',{'q2.c2':'C'}],
 ['condition_boundary','회신 자체가 필수라는 판단이 없는 일반 미회신에 대체절차를 수행할지 검토한다.',{},'505.13의 필수 회신 사례에 관한 수행 영향 결정이 아니다.']
]);
five('T09-B','q2','q2.c3',[
 ['full','필수 회신의 미입수가 감사의견에 미칠 영향을 판단한다.',{'q2.c3':'M'}],
 ['paraphrase','그 미회신 때문에 의견을 어떻게 표명해야 하는지 의견변형 기준에 맞추어 결정한다.',{'q2.c3':'M'}],
 ['omission','필수 회신을 얻지 못한 것이 해당 감사의 수행에 미치는 시사점을 결정한다.',{'q2.c2':'M'}],
 ['opposite','필수 회신 미입수라도 감사의견에 미치는 영향은 검토하지 않는다.',{'q2.c3':'C'}],
 ['condition_boundary','필수 회신을 이미 적절하게 입수한 별도 상황에서 감사의견을 결정한다.',{},'회신 미입수에 대한 의견 시사점은 제시하지 않았다.']
]);
five('T12-A','q2','q2.c3',[
 ['full','둘째 방법에서는 새로운 감사보고서 또는 수정된 감사보고서를 제출한다.',{'q2.c3':'M'}],
 ['paraphrase','다른 대안은 감사보고서를 새로 내거나 수정본으로 제출하는 것이다.',{'q2.c3':'M'}],
 ['omission','둘째 방법의 보고서에 강조사항문단 또는 기타사항문단을 포함한다.',{'q2.c6':'M'}],
 ['opposite','둘째 방법에서는 새 보고서나 수정 보고서를 제출하지 않고 구두로만 보고한다.',{'q2.c3':'C'}],
 ['condition_boundary','후속 수정이 전혀 없는 감사에서 최초 감사보고서를 처음 제출하는 상황만 설명한다.',{},'후속 수정에 관한 둘째 보고방법의 형태를 제시한 것이 아니다.']
]);
five('T12-A','q2','q2.c6',[
 ['full','둘째 방법의 보고서에는 강조사항문단 또는 기타사항문단을 포함한다.',{'q2.c6':'M'}],
 ['paraphrase','다른 대안의 설명은 강조사항이나 기타사항 중 적합한 문단에 둔다.',{'q2.c6':'M'}],
 ['omission','둘째 방법에서는 새 감사보고서나 수정된 감사보고서를 제출한다.',{'q2.c3':'M'}],
 ['opposite','둘째 방법에서 강조사항·기타사항문단을 사용하지 않고 감사의견단락만 사용한다.',{'q2.c6':'C'}],
 ['condition_boundary','둘째 보고방법에 대해서는 쓰지 않고 첫째 추가일자 방식에서 강조사항문단을 넣겠다고만 설명한다.',{},'보고방법의 적용 대상이 달라 둘째 방법의 문단 요구는 미제시다.']
]);
five('T12-B','q2','q2.c1',[
 ['full','한정의견.',{'q2.c1':'M'},'발문은 의견명 열거이므로 정의나 이유 없이 해당 이름으로 충분하다.'],
 ['paraphrase','한정의견근거 단락을 사용한다.',{'q2.c1':'M'},'근거단락의 이름은 의견명을 명확히 함축하나 그 단락의 두 기재내용까지 채우지는 않는다.'],
 ['omission','부적정의견.',{'q2.c4':'M'}],
 ['opposite','이 경우 한정의견은 가능한 의견 유형에서 제외된다.',{'q2.c1':'C'}],
 ['condition_boundary','불확실성이 적절하게 공시된 별도 상황의 의견을 설명하며 한정의견이라고 썼다.',{},'적절 공시라는 다른 조건의 의견만 제시하여 현재 부적절 공시 사례에 답하지 않았다.']
]);
five('T12-B','q2','q2.c4',[
 ['full','부적정의견.',{'q2.c4':'M'}],
 ['paraphrase','부적정의견근거 단락을 사용한다.',{'q2.c4':'M'}],
 ['omission','한정의견.',{'q2.c1':'M'}],
 ['opposite','이 경우 부적정의견은 가능한 의견 유형에서 제외된다.',{'q2.c4':'C'}],
 ['condition_boundary','계속기업전제 자체가 부적합한 별도 상황에서의 부적정의견만 제시한다.',{},'원문23의 공시 부적절 조건 대신21의 전제 부적합 조건에 대한 의견만 제시했다.']
]);
const expertPrefix='감사목적상 전문가의 적격성, 역량, 객관성을 평가한다. ';
const expertMarks={'sub2.crit1':'M','sub2.crit2':'M','sub2.crit3':'M'};
five('T13-A','sub2','sub2.crit4',[
 ['full',expertPrefix+'외부전문가의 객관성을 위협할 수 있는 이해에 대하여 질문한다.',{...expertMarks,'sub2.crit4':'M'}],
 ['paraphrase',expertPrefix+'외부전문가에게 판단의 객관성을 해칠 재무적 이해가 있는지 묻는다.',{...expertMarks,'sub2.crit4':'M'}],
 ['omission',expertPrefix+'외부전문가에게 객관성을 위협하는 사업상·인적 관계가 있는지 질문한다.',{...expertMarks,'sub2.crit5':'M'}],
 ['opposite',expertPrefix+'외부전문가의 객관성을 위협하는 이해에 대해서는 질문할 필요가 없다.',{...expertMarks,'sub2.crit4':'C'}],
 ['condition_boundary',expertPrefix+'별도로 다른 감사의 내부전문가에게 재무적 이해가 있는지 질문한다.',{...expertMarks},'현재 외부전문가의 질문의무를 명시 부정하지 않고 다른 대상의 질문만 추가했다. 현재 대상의 이해 질문은 미제시다.']
]);
five('T13-A','sub2','sub2.crit5',[
 ['full',expertPrefix+'외부전문가의 객관성을 위협할 수 있는 관계에 대하여 질문한다.',{...expertMarks,'sub2.crit5':'M'}],
 ['paraphrase',expertPrefix+'외부전문가에게 판단의 객관성을 해칠 사업상 또는 인적 연결이 있는지 묻는다.',{...expertMarks,'sub2.crit5':'M'}],
 ['omission',expertPrefix+'외부전문가에게 객관성을 해칠 재무적 이해가 있는지 질문한다.',{...expertMarks,'sub2.crit4':'M'}],
 ['opposite',expertPrefix+'외부전문가의 객관성을 위협하는 관계는 질문하지 않아도 된다.',{...expertMarks,'sub2.crit5':'C'}],
 ['condition_boundary',expertPrefix+'별도로 다른 감사의 내부전문가에게 기업과의 사업상 관계를 질문한다.',{...expertMarks},'현재 외부전문가의 질문의무를 명시 부정하지 않고 다른 대상의 질문만 추가했다. 현재 대상의 관계 질문은 미제시다.']
]);
five('T09-C','sub2','sub2.crit1',[
 ['full','첫 조건은 식별된 소송이나 배상청구에 중요왜곡표시위험이 있다고 평가한 경우이다.',{'sub2.crit1':'M'}],
 ['paraphrase','이미 파악한 소송·청구에 중요한 왜곡위험이 있다고 평가한 때가 첫 발동조건이다.',{'sub2.crit1':'M'}],
 ['omission','둘째 조건은 감사절차 결과 다른 중요한 소송이나 배상청구가 존재할 가능성이 나타난 경우이다.',{'sub2.crit2':'M'}],
 ['opposite','첫 조건은 식별된 소송이나 배상청구에 중요왜곡표시위험이 없다고 평가한 경우이다.',{'sub2.crit1':'C'}],
 ['condition_boundary','기업 주가의 일일 변동위험을 평가한 경우라는 조건만 제시한다.',{},'소송의 중요왜곡표시위험이라는 대상과 위험 종류를 충족하지 않는다.']
]);
five('T09-C','sub2','sub2.crit2',[
 ['full','둘째 조건은 감사절차 결과 그 밖의 중요한 소송이나 배상청구가 존재할 가능성이 나타난 경우이다.',{'sub2.crit2':'M'}],
 ['paraphrase','감사 중 얻은 결과로 아직 파악하지 못한 중요 소송·청구의 존재 가능성이 드러난 때이다.',{'sub2.crit2':'M'}],
 ['omission','첫 조건은 식별된 소송이나 배상청구에 중요왜곡표시위험이 있다고 평가한 경우이다.',{'sub2.crit1':'M'}],
 ['opposite','둘째 조건은 다른 중요한 소송이나 청구의 존재 가능성이 나타나지 않은 경우이다.',{'sub2.crit2':'C'}],
 ['condition_boundary','감사절차 결과 법률고문 사무실의 이전 가능성이 드러난 경우만 제시한다.',{},'가능성의 대상이 중요한 소송·배상청구가 아니다.']
]);
five('T09-C','sub2','sub2.crit7',[
 ['full','두 발동조건은 또는 관계이므로 어느 하나가 충족되면 직접 커뮤니케이션을 모색한다.',{'sub2.crit7':'M'}],
 ['paraphrase','두 요건을 동시에 갖출 필요 없이 하나만 충족해도 외부 법률고문과 직접 소통을 모색한다.',{'sub2.crit7':'M'}],
 ['omission','두 조건의 내용은 ① 식별된 소송·청구의 중요왜곡표시위험 평가 ② 감사절차 결과 그 밖의 중요한 소송·청구 존재 가능성의 발견이다.',{'sub2.crit1':'M','sub2.crit2':'M'},'정확한 두 조건을 나열했지만 조치의 발동관계나 각 조건의 충분성을 쓰지 않았다.'],
 ['opposite','식별된 소송의 중요왜곡표시위험 평가와 다른 중요한 소송 가능성의 발견이 반드시 동시에 있어야 직접 커뮤니케이션을 모색한다.',{'sub2.crit1':'M','sub2.crit2':'M','sub2.crit7':'C'},'정확한 두 조건 식별점수는 보존하고 AND 관계만 반대로 평가한다.'],
 ['condition_boundary','법규가 모든 직접 커뮤니케이션을 금지하는 경우에는 대체적인 감사절차를 수행한다.',{'sub2.crit6':'M'},'금지 예외에서의 대안만 답했으므로 두 일반 발동조건의 OR 관계는 미제시다.']
]);
const opinions=[
 ['sub3.crit1','상황A','한정의견','sub3.crit3','의견거절','상황B에서 한정의견을 제시한다.',{'sub3.crit2':'M'}],
 ['sub3.crit3','상황A','의견거절','sub3.crit1','한정의견','기초잔액과 무관한 전반적인 감사범위제한 상황에서의 의견거절만 제시한다.',{}],
 ['sub3.crit2','상황B','한정의견','sub3.crit4','부적정의견','상황A에서 한정의견을 제시한다.',{'sub3.crit1':'M'}],
 ['sub3.crit4','상황B','부적정의견','sub3.crit2','한정의견','기초잔액과 무관한 계속기업전제 부적합 상황의 부적정의견만 제시한다.',{}]
];
for(const [id,situation,name,other,otherName,boundary,boundaryMarks] of opinions)five('T09-D','sub3',id,[
 ['full',situation+': '+name+'.',{[id]:'M'},'의견명을 요구하므로 해당 상황과 명칭으로 충분하다.'],
 ['paraphrase',situation+'에서 사용할 수 있는 의견의 하나는 '+name+'이다.',{[id]:'M'}],
 ['omission',situation+': '+otherName+'.',{[other]:'M'},'같은 상황의 다른 정답 의견 하나만 남겨 독립 부분점수를 확인한다.'],
 ['opposite',situation+'에서 '+name+'은 가능한 의견 유형에서 제외된다.',{[id]:'C'}],
 ['condition_boundary',boundary,boundaryMarks,'상황 또는 원인이 달라 해당 상황의 의견명을 답하지 않았다.']
]);
const directions=[
 ['sub1.crit2','판단','내부감사업무 활용','줄인다','sub1.crit5','외부감사인의 직접 수행업무를 늘린다','늘린다'],
 ['sub1.crit5','판단','외부감사인의 직접 수행업무','늘린다','sub1.crit2','내부감사업무 활용을 줄인다','줄인다'],
 ['sub1.crit3','위험','내부감사업무 활용','줄인다','sub1.crit6','외부감사인의 직접 수행업무를 늘린다','늘린다'],
 ['sub1.crit6','위험','외부감사인의 직접 수행업무','늘린다','sub1.crit3','내부감사업무 활용을 줄인다','줄인다']
];
for(const [id,trigger,object,direction,other,otherText,wrong] of directions){
 const condition=trigger==='판단'?'감사절차의 계획·수행과 증거 평가에 많은 판단이 수반될수록 ':'경영진주장 수준의 평가된 중요왜곡표시위험이 높아질수록 ';
 const suffix=trigger==='위험'?' 유의적 위험에는 특별히 고려한다.':'';
 const particle=object.endsWith('업무')?'를 ':'을 ';
 five('T13-B','sub1',id,[
  ['full',condition+object+particle+direction+'.'+suffix,{[id]:'M'}],
  ['paraphrase',condition+(object.startsWith('내부')?'이미 수행된 내부감사업무를 '+(direction==='줄인다'?'덜 활용한다.':'더 활용한다.'):'감사인 자신이 수행하는 업무량을 더 크게 한다.')+suffix,{[id]:'M'}],
  ['omission',condition+otherText+'.'+suffix,{[other]:'M'},'정확한 반대쪽 업무배분 방향을 남겼지만 이번 대상방향은 직접 표현하거나 필연적으로 함축하지 않는다.'],
  ['opposite',condition+object+particle+wrong+'.'+suffix,{[id]:'C'}],
  ['condition_boundary',(trigger==='판단'?'판단의 정도와 무관하게 단순 반복 입력 건수만 많아지면 ':'중요왜곡표시위험을 평가하지 않고 시장의 일일 주가변동만 커지면 ')+object+particle+direction+'.',{},'이번 발문이 묻는 판단 또는 평가된 중요왜곡표시위험의 증가조건이 아니다.']
 ]);
}
add('T12-B','q2','q2.c4','historical-single-opinion','이 경우에는 한정의견을 표명한다.',{'q2.c1':'M'},'원 bank-v3 생성사례의 실제 답안을 그대로 보존한다. 옛 두의견 묶음 기대0/실측1·1·1은 당시 불일치이며 새 분리계약에서는 한정1·부적정0인 1점이다. 원시근거: r01/phase-two-v5/t12-b/generated-bank-v3-refill02-01/failure-evidence.json. 이번 새모델실측은 하지 않았다.');
add('T09-C','sub2','sub2.crit7','and-with-one-condition-correct','식별된 소송의 중요왜곡표시위험이 있다고 평가하고, 법률고문 사무실 이전 가능성이 드러나는 두 조건을 반드시 함께 충족해야 직접 커뮤니케이션을 모색한다.',{'sub2.crit1':'M','sub2.crit7':'C'},'첫 조건은 정확하다. 둘째는 다른 중요한 소송 가능성이 아니어서 미충족이고, 둘 다 필요하다는 AND 관계는 독립적으로 반대이다.');
add('T09-C','sub2','sub2.crit7','or-with-one-condition-correct','첫 조건은 식별된 소송의 중요왜곡표시위험이 있다고 평가한 경우이고 둘째 조건은 법률고문 사무실 이전 가능성이 드러난 경우이다. 두 조건은 또는 관계여서 어느 하나만 충족하면 직접 커뮤니케이션을 모색한다.',{'sub2.crit1':'M','sub2.crit7':'M'},'둘째 조건 내용의 오류는 그 요소에서 미충족이다. 분리된 OR 관계 자체는 정확히 제시했으므로 관계점을 보존한다.');
const qaChanges=[];
for(const h of handoff.entries.filter(e=>e.changed)){
 const e=entries.find(e=>e.plan_id===h.plan_id),oldQa=read(e.qa_file),s=read(h.question_file),qa=structuredClone(oldQa),lineage=read(h.lineage_file);
 const beforeAfter=[];
 qa.cases=qa.cases.map(c=>{
  const previous=structuredClone(c),q=s.subquestions.find(q=>q.id===c.subquestion_id),table=tables[h.plan_id]?.[c.subquestion_id];
  if(table){
   const key=c.id.slice(c.subquestion_id.length+1),row=table.rows[key];if(!row)throw new Error('Unreviewed old case '+h.plan_id+'/'+c.id);
   const marks=Object.fromEntries(table.ids.map((id,i)=>[id,verdict[row[i]]]));
   const reason=specialReasons[h.plan_id+'/'+c.id]??'원답안 전체에서 분리한 각 요구의 명칭·행위·조건을 독립 대조한 작성자 기대값이다. 상세 전후 벡터와 인용근거는 이 행 및 물음별 대응표로 확인한다.';
   if(h.plan_id==='T09-C'&&c.id==='sub2/omit-3')marks['sub2.crit3']='met';
   c.expected_verdicts=q.criteria.map(crit=>({criterion_id:crit.id,verdict:marks[crit.id]??previous.expected_verdicts.find(v=>v.criterion_id===crit.id)?.verdict??(()=>{throw new Error('Missing verdict');})(),reason:marks[crit.id]?reason:previous.expected_verdicts.find(v=>v.criterion_id===crit.id)?.reason??'변경 없는 독립 명제 기대 유지'}));
   c.expected_points=c.expected_verdicts.reduce((n,v)=>n+(v.verdict==='met'?1:0),0);
   c.point_policy_review={original_case_id:c.id,answer_preserved:true,method:'AI_author_source_and_whole_answer_review_no_API',reason};
  }
  beforeAfter.push({id:c.id,subquestion_id:c.subquestion_id,answer_sha256:crypto.createHash('sha256').update(c.answer).digest('hex'),answer_preserved:c.answer===previous.answer,old_points:previous.expected_points,new_points:c.expected_points,old_verdicts:previous.expected_verdicts,new_verdicts:c.expected_verdicts,reason:c.point_policy_review?.reason??'이 물음의 criterion과 요구범위는 변경하지 않아 선택된 기존 기대값을 유지한다.'});
  return c;
 });
 for(const nc of newCases.filter(c=>c.plan===h.plan_id)){
  const q=s.subquestions.find(q=>q.id===nc.q);
  const id=nc.q+'/point-policy/'+nc.target+'/'+nc.kind;
  const c={id,subquestion_id:nc.q,target_criterion_id:nc.target,kind:nc.kind,answer:nc.answer,expected_points:0,note:nc.reason||'해당 독립 요소를 원문·발문과 대조한 새 회귀 사례. 원 QA 답안은 교체하지 않는다.',source_ref_ids:q.criteria.find(c=>c.id===nc.target).source_ref_ids,expected_verdicts:q.criteria.map(c=>({criterion_id:c.id,verdict:verdict[nc.marks[c.id]??'N'],reason:nc.reason||(nc.marks[c.id]==='M'?'이 답안은 해당 독립 명제를 명시한다.':nc.marks[c.id]==='C'?'해당 주체·대상·조건의 명제를 명시적으로 부정하거나 반대로 제시한다.':'이 답안에는 해당 독립 요구의 충족 내용이 없다. 다른 요소의 누락·반대를 전파한 값이 아니다.')}))};
  c.expected_points=c.expected_verdicts.filter(v=>v.verdict==='met').length;qa.cases.push(c);
 }
 for(const [qid] of Object.entries(tables[h.plan_id])){
  const q=s.subquestions.find(q=>q.id===qid);
  for(const [kind,answer] of [['stored-model-answer',q.model_answer.join('\n')],['single-paragraph',q.model_answer.join(' ')],['reverse-order',[...q.model_answer].reverse().join('\n')]])qa.cases.push({id:qid+'/point-policy/'+kind,subquestion_id:qid,kind,answer,expected_points:q.criteria.length,note:'후속 저장 모범답안의 전체 독립 요소를 확인한다. 원래 저장답안 QA는 원 ID·문자열로 별도 보존한다.',expected_verdicts:q.criteria.map(c=>({criterion_id:c.id,verdict:'met',reason:'저장 모범답안은 조건과 허용 대안을 보존하여 이 독립 명제를 명시한다.'}))});
 }
 qa.version=1;qa.artifact_type='author_expected_judgments';qa.set_id=s.id;qa.draft_sha256=sha(h.question_file);qa.live_model_grading='not_run_user_paused';qa.human_approval=false;
 qa.interpretation='승인된 독립 내용별1점 정책의 새 작성자 기대값. 원 선택 QA의 모든ID·subquestion_id·answer를 보존하고 각 분리 명제를 전체답안에서 다시 대조했다. 과거 실측은 새 계약의 검증 완료가 아니며 이번 API호출은0회다.';
 write(h.qa_file,qa);
 lineage.qa_status='author_expected_judgments_prepared_API_not_run';lineage.original_qa_cases=oldQa.cases.length;lineage.new_qa_cases=qa.cases.length;lineage.original_answers_all_preserved=oldQa.cases.every(c=>qa.cases.some(a=>a.id===c.id&&a.answer===c.answer&&a.subquestion_id===c.subquestion_id));lineage.old_answer_expectation_comparison=beforeAfter;lineage.new_case_ids=qa.cases.filter(c=>!oldQa.cases.some(a=>a.id===c.id)).map(c=>c.id);lineage.new_question_sha256=sha(h.question_file);lineage.new_plan_sha256=sha(h.plan_file);lineage.new_qa_sha256=sha(h.qa_file);write(h.lineage_file,lineage);
 qaChanges.push({plan_id:h.plan_id,original:oldQa.cases.length,new:qa.cases.length,original_answer_preserved:lineage.original_answers_all_preserved});
}
write(base+'r01/point-policy-v1/qa-preparation-summary.json',{api_calls:0,entries:qaChanges});
console.log(JSON.stringify(qaChanges));
