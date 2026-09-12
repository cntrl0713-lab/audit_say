// These vectors were authored after reading each affected original answer in full.
// m = met, n = not_met, c = contradicted. Indices follow split-spec claim order.
// Complete old clauses and faithful paraphrases retain their component meanings;
// the cases below explicitly override partial/negative scopes instead of copying old zero.
export const vectors={
'T08-B':{
 'sub1-crit1-opposite':{crit1:'cc',crit2:'cn'},
 'sub1-crit2-opposite':{crit2:'cc'},
 'sub2-crit3-opposite':{crit3:'cnn'},
 'sub2-crit3-surface-omission-implicit':{crit3:'mmn'},
 'sub2-crit4-paraphrase':{crit3:'mmn'},
 'sub2-crit4-opposite':{crit3:'cnn'},
 'sub3-crit6-paraphrase':{crit8:'mn'},
 'sub3-crit6-opposite':{crit8:'cn'},
 'sub3-crit7-paraphrase':{crit8:'mn'},
 'sub3-crit7-opposite':{crit8:'cn'},
 'sub3-crit8-opposite':{crit8:'cn'},
 'sub3-crit8-condition-boundary':{crit8:'cn'},
 'sub3-crit8-omission':{crit8:'mn'}},
'T06-B':{},
'T07-A':{'sub1-crit1-condition-boundary':{crit1:'mmc'}},
'T05-B':{'sub1-crit2-condition-boundary':{crit2:'cc'},'sub3-crit6-condition-boundary':{crit6:'mc'}},
'T08-C':{
 'sub1-crit1-condition-boundary':{crit1:'mc'},
 'sub2-assumptions-only-missing-data':{crit5:'mmmmccccc'},
 'sub2-data-only-missing-assumptions':{crit5:'ccccmmmmm'},
 'sub2-crit4-opposite':{crit4:'nncc'},
 'sub2-crit4-condition-boundary':{crit3:'nnnn',crit4:'cccc'},
 'sub2-crit5-condition-boundary':{crit5:'ccccnnncc'}},
'T06-C':{'sub2-crit6-opposite':{crit6:'nc'}},
'T07-C':{'sub3-crit8-condition-boundary':{crit8:'cc'}},
'T10-B':{
 'sub2-crit4-condition-boundary':{crit4:'nc'},
 'sub3-management-adjustment-only':{crit5:'nm'},
 'sub3-two-paths-compulsory':{crit5:'cc'},
 'sub3-crit5-opposite':{crit5:'cm'},
 'sub3-crit5-condition-boundary':{crit5:'nm'}},
'T10-C':{
 'sub1-crit3-condition-boundary':{crit3:'mn'},
 'sub2-partial-reliability-list':{crit5:'mccc'},
 'sub2-crit5-condition-boundary':{crit5:'mccc'}},
'T12-C':{'sub3-crit6-opposite':{crit6:'ccc'},'sub3-crit6-condition-boundary':{crit6:'ccc'}},
'T12-D':{'sub2-core-information-without-transactions':{crit5:'mc'},'sub2-crit5-condition-boundary':{crit5:'cc'}}
};
export const vectorReasons={
'T08-B':{
 'sub1-crit1-opposite':'완전성만 검증된다는 배타적 주장은 발생·과대계상 방향과 완전성 한계에 반대한다. 다만 미기록 거래가 실제 표본에 선택되는 구조에 대한 설명은 없다.',
 'sub2-crit3-opposite':'원장에 기록된 거래만으로 충분하다고 하여 적합 모집단을 부정하지만 관련성·신뢰성 확인 행위 자체를 개별적으로 부정하지는 않는다.',
 'sub2-crit3-surface-omission-implicit':'남아 있는 기초자료→원장 추적은 적합 출발자료의 선택을 함축하고, 그 거래가 빠짐없이 반영됐는지 확인한다는 완전성 목적과의 연결은 관련성 판단도 표현한다. 신뢰성 확인은 미언급이다. 총괄이 원답안별 목적 연결의 인정에 동의하였다.',
 'sub2-crit4-paraphrase':'출고·인수목록을 출발 자료로 특정하고 원장으로 따라가 누락을 확인한다는 목적 연결을 설명하여 모집단과 관련성은 충족한다. 자료 신뢰성 확인은 미언급이다. 이름만 나열한 별도 대조답에는 관련성을 자동 보충하지 않는다.',
 'sub2-crit4-opposite':'기록 모집단만 쓰겠다는 것이 문제이며 자료 관련성·신뢰성 검토를 직접 반대한 것으로 넓혀 보지 않는다.',
 'sub3-crit6-paraphrase':'신규 국외 거래에 충분하지 않아 범위를 다시 정한다는 구체 조치가 대상기간 조정에 해당한다. 증빙 대조는 없다.',
 'sub3-crit6-opposite':'기존 7일을 항상 충분하다고 고정하므로 기간 조정은 부정하지만 인수증빙·기록기간 대조 자체는 언급하지 않았다.',
 'sub3-crit7-paraphrase':'종전 짧은 구간 밖 거래를 놓친다는 구체 이유는 기간 조정 필요성을 함축한다. 증빙 대조의 구체 수행은 미언급이다.',
 'sub3-crit7-opposite':'길어진 운송이 검사에 아무 영향이 없다는 주장은 기간 조정을 부정한다. 증빙 대조 행위 자체까지 자동 부정하지 않는다.',
 'sub3-crit8-opposite':'기간 고정은 반대이며, 인수 증빙을 종전대로 둔다는 문장은 인식시점과 기록기간을 대조한다는 행위를 제시하지 않는다.',
 'sub3-crit8-condition-boundary':'실제 운송·인수기간을 근거로 조정한다는 조건을 명시적으로 무시한 하루 연장은 기간 명제 미충족이다. 증빙 대조는 없다.',
 'sub3-crit8-omission':'남은 원 이유가 변경 기간을 검사 범위 결정에 반영하라고 명시하여 새 기간 조정 부분은 충족한다. 옛 복합 기준의 0점을 새 부분에 복사하지 않는다.'},
'T07-A':{'sub1-crit1-condition-boundary':'계속적인 관련성과 신뢰성을 확인한다는 목적 두 가지는 표현했다. 질문만으로 충분하다는 잘못된 방법은 결합 절차 명제에 한하여 반대다.'},
'T05-B':{'sub1-crit2-condition-boundary':'중요성과 관계없이 모든 오류를 절대 보증한다는 것은 확신의 대상 범위와 수준을 각각 훼손한다.','sub3-crit6-condition-boundary':'예측하기 어렵다는 성격은 명시하였으나 유의적 위험에서 제외한다는 분류는 반대다.'},
'T08-C':{
 'sub1-crit1-condition-boundary':'관련 전문지식 확인은 적격성 부분을 충족한다. 실제 발휘 자원·능력을 제외한 부분만 역량 기준의 반대다.',
 'sub2-assumptions-only-missing-data':'가정·방법의 관련성·합리성 네 특성은 맞고 자료 검토의 면제는 자료 다섯 특성에 반대다.',
 'sub2-data-only-missing-assumptions':'회사·외부 자료 다섯 특성은 맞고 가정·방법 검토 면제는 앞 네 특성에 반대다.',
 'sub2-crit4-opposite':'다른 증거와 모순/재무제표 잘못 반영에도 적합하다고 보라는 두 명시적 반대만 귀속한다. 관련성·합리성은 직접 다루지 않았다.',
 'sub2-crit4-condition-boundary':'업무 이해 사실만으로 적합성 평가를 자동 면제하므로 네 평가 특성의 확인에 반대다. 업무 이해 네 세부내용은 별도로 설명하지 않았다.',
 'sub2-crit5-condition-boundary':'가정·방법과 외부 시장자료를 검토 없이 신뢰한다는 명시적 면제는 그 여섯 특성에 반대다. 회사 데이터의 합계 일치는 자료 세 특성의 검토를 대체하지 않지만 그 특성을 개별 부정한 것도 아니다.'},
'T06-C':{'sub2-crit6-opposite':'발생가능성만 언급한 답에는 기술 변화/불확실성이 실제 오류 가능성에 미치는 영향 설명이 없다. 규모를 제외한다는 부분은 규모 평가의 명시적 반대다.'},
'T07-C':{'sub3-crit8-condition-boundary':'관련 통제테스트라는 허용 경로를 배제하므로 정확성과 완전성 각각의 허용 조건을 훼손한다.'},
'T10-B':{
 'sub2-crit4-condition-boundary':'추가 확인업무 영향을 고려하지 않는다는 명시적 반대는 그 경로에 귀속한다. 효율성 영향 자체는 말하지 않았다.',
 'sub3-management-adjustment-only':'경영진 조사 요구는 없지만 필요한 분개 수정 요구는 독립적으로 맞다. 조사 없음 때문에 수정의 점수를 취소하지 않는다.',
 'sub3-two-paths-compulsory':'대안적 경로를 언제나 공동 필수로 바꾼 조건의 오류가 각 경로의 진술에 적용된다.',
 'sub3-crit5-opposite':'잠재적 왜곡표시 조사 제외는 조사 명제에 반대다. 발견한 왜곡표시를 경영진에게 수정하도록 요구한 부분은 독립 충족한다.',
 'sub3-crit5-condition-boundary':'감사인의 조사로 경영진 조사 요구를 대신하지는 못한다. 다만 경영진에게 수정하도록 요청한 부분 자체는 독립 충족한다.'},
'T10-C':{'sub1-crit3-condition-boundary':'실증분석 선택 가능이라는 판단은 옳다. 이를 모든 실증절차 면제로 확장한 부가 오류는 사용 적합성 기준을 충족하지 못하나 옳은 선택성 판단까지 취소하지 않는다.','sub2-partial-reliability-list':'정보 원천이 외부임을 신뢰성 근거로 사용한 한 부분은 맞다. 다른 세 고려요소의 검토를 명시적으로 면제한 부분에만 반대 판정을 준다.','sub2-crit5-condition-boundary':'외부 원천이라는 한 특성은 고려하였으나 그 사실만으로 다른 특성을 모두 확인했다고 간주하여 나머지 세 검토를 대신할 수 없다.'},
'T12-C':{'sub3-crit6-opposite':'합계 하나로만 정하여 개별/공시 수준을 명시적으로 배제하므로 규모 기준의 범위도 훼손하고 성격·상황도 각각 부정한다.','sub3-crit6-condition-boundary':'어떤 상황에서도 중요할 수 없다는 절대화는 규모만의 기계적 판단과 성격·상황의 일률 배제로 각 명제의 조건을 훼손한다.'},
'T12-D':{'sub2-core-information-without-transactions':'모든 관련 정보 제공·접근 진술은 충족한다. 거래 기록·재무제표 반영 확인을 면제한 부분만 반대다.','sub2-crit5-condition-boundary':'접근 허용과 거래 기록·반영을 모두 불필요하다고 하여 각각의 필수 범위를 부정한다.'}
};
export const approvedQAOnly={
'T12-C':{'sub1-crit2-opposite':{crit1:['contradicted','총괄 독립 원문 대조 승인: 수정분개 입력 재확인만으로 관련 거래유형의 잔존왜곡표시 감사절차를 면제하므로 추가절차 생략 부적절 판단에도 명시적으로 반대한다.']}},
'T12-D':{
 'sub1-crit2-opposite':{crit1:['contradicted','총괄 독립 대조 승인: 미제공 진술의 핵심책임/기타 범위 구별 필요성을 직접 부정한다.']},
 'sub1-crit3-paraphrase':{crit1:['not_met','총괄 독립 대조 승인: 580.20(a)의 성실성 불신 결론 확인만 충족하며 20(b)의 미제공 범위에 따른 일반화 판단은 함축하지 않는다.']}}
};
