"""Manual decisions after reading every one of the 189 affected non-met answers.

m=met, n=not_met, c=contradicted. Only the named original group is replaced.
Unlisted groups in the reviewed audit contain no proposition about those targets;
their explicit omission decisions are materialized with the full original answer.
These are author judgments, not a model run or a reproduction of old zero scores.
"""
OVERRIDES = {}
def setv(pid, case, cid, codes, reason):
 OVERRIDES[(pid,case,cid)]=(codes,reason)
def many(pid, cases, cid, codes, reason):
 for case in cases.split('|'):setv(pid,case,cid,codes,reason)
many('T02-A','sub3/omission-crit8|sub3/boundary-crit9','crit8','mn','과거 신뢰로 낮은 증거에 만족할 수 없다는 규칙은 팀장 제안을 배척하는 판단을 함축하지만 조사·절차변경 결정의 조치는 쓰지 않았다.')
setv('T02-A','sub3/opposite-crit8','crit8','nc','변경·추가 필요를 결정하는 감사인 의무를 명시적으로 부정했다. 제안 전체의 적절성 결론은 별도로 단정하지 않았다.')
setv('T02-A','sub3/explicit-conflict','crit8','cn','명시적 적절 결론은 판단에 반대이며 나머지 문장은 과거 신뢰 원칙만 설명하여 대응조치는 누락되었다.')
setv('T01-A','sub3/opposite-crit5','crit5','cnn','보수 자체를 금지한다고 하여 허용 의미를 부정한다. 위협이 발생하는 조건과 종류는 쓰지 않았다.')
setv('T01-A','sub3/boundary-crit5','crit5','mnn','기준을 준수할 수 있는 낮은 보수는 비윤리적이지 않다는 허용 의미를 썼다. 준수 곤란 시 위협 조건/종류는 별도로 쓰지 않았다.')
setv('T01-A','sub3/opposite-crit6','crit6','cc','필요 시간과 적격 인력을 줄여야 한다고 두 안전장치 모두를 부정했다.')
setv('T01-A','sub3/boundary-crit6','crit6','mc','적절한 시간 배정은 충족하지만 인력 적격성 고려를 명시적으로 부정했다. 옛 복합 0점을 시간 명제에 전파하지 않는다.')
many('T01-A','sub3/opposite-crit7|sub3/boundary-crit7','crit7','cc','의뢰인에게 보수기준과 구체 업무내용을 알리지 않는다고 각각 명시했다. 총액만 알리는 것은 두 요구를 대신하지 않는다.')
setv('T03-A','sub2/opposite-crit4','crit4','cc','목적과 범위 모두 계약 기록사항이 아니라고 부정한다.')
setv('T03-A','sub2/boundary-crit4','crit4','mn','목적은 기록한다고 답했으나 범위는 쓰지 않았다. 답안에 목적만 작성했다는 표현을 범위 기록의무에 대한 명시 부정으로 확대하지 않는다.')
setv('T03-A','sub2/opposite-crit8','crit8','cc','예상 보고서 형태와 내용을 모두 기록하지 않는다고 부정한다.')
setv('T03-A','sub2/boundary-crit8','crit8','mn','예상 형식 기록은 충족하지만 내용은 누락했다. 본인의 답안 작성 범위만 한정한 것을 의무 부정으로 확대하지 않는다.')
setv('T04-B','sub1/opposite-crit1','crit2','cn','최초 작성을 늦추어도 된다는 것은 적시작성의 반대이다. 취합의 행정적 성격은 설명하지 않았다.')
setv('T04-B','sub1/boundary-crit1','crit2','mn','최초 기록의 적시 의무를 명시했고 최종 취합의 행정적 성격은 누락했다.')
setv('T04-B','sub1/opposite-crit2','crit2','cc','최초 작성을 늦추고 최종 취합을 실질 절차로 본다고 두 규칙을 모두 반대로 썼다.')
setv('T04-B','sub1/boundary-crit2','crit2','nc','보고서일 후의 행정적 취합까지 금지하여 취합 성격/허용 범위를 반대로 썼다. 최초 작성의 시기는 쓰지 않았다.')
setv('T04-B','sub2/opposite-crit4','crit4','ccc','분류·병합·상호참조 각각을 하면 안 된다고 명시적으로 부정했다.')
setv('T04-B','sub3/opposite-crit8','crit8','cc','수정·추가자와 그 시기 모두 기록하면 안 된다고 부정했다.')
setv('T04-B','sub3/boundary-crit8','crit8','mc','수정·추가자는 기록한다고 했고 시기는 기록하지 않는다고 했다.')
setv('T04-B','sub3/opposite-crit9','crit9','cc','검토자와 검토시기의 기록 의무를 모두 부정했다.')
setv('T04-B','sub3/boundary-crit9','crit9','cm','검토자는 기록하지 않지만 검토일은 기록한다고 했으므로 시기 점수는 보존한다.')
setv('T16-A','sub3/omission-crit5','crit5','mn','아직 수정 감사의 전제를 갖추지 못한 현재 상황에서 충분하고 적합한 증거를 먼저 입수해야 한다는 조치는 즉시 문구 사용 불가 판단을 함축한다. 계약 범위 조건은 누락되었다.')
setv('T16-A','sub3/opposite-crit5','crit5','cc','현재 계약만으로 문구 사용을 허용하며 수정 감사의 계약 범위 필요를 명시적으로 부정한다.')
setv('T16-A','sub3/opposite-crit6','crit5','cn','현재 상황에서 충분한 증거 없이 문구를 사용할 수 있다는 주장은 즉시 사용 불가 판단과 반대이다. 계약 범위는 언급하지 않았다.')
setv('T16-A','sub3/explicit-conflict','crit5','cm','적절하다는 결론과 부적절하다는 결론이 충돌하므로 판단은 0점이다. 전기 수정감사 포함 계약의 체결/변경 의무는 독립적으로 정확하다.')
many('T17-A','sub1/opposite-crit1|sub1/boundary-crit1','crit1','cc','갑의 의견을 적정/무변형으로 바꾸고 경영진의 보고가 취약점의 의견효과를 없앤다고 하므로 판단과 이유 모두 반대이다.')
setv('T17-A','sub1/opposite-crit2','crit2','cc','유의적 미비점만으로 부적정이라는 판단과 이유는 모두 반대이다.')
setv('T17-A','sub3/opposite-crit6','crit6','cc','범위 부족과 실질적 사유의 기술을 모두 금지했다.')
setv('T17-A','sub3/boundary-crit6','crit6','nm','보고서 내용을 묻는 문맥에서 서면진술을 받지 못했다고 쓴다는 지시는 사유 기술이다. 감사범위가 의견에 불충분하다는 내용은 누락했다.')
setv('T17-A','sub3/opposite-crit7','crit7','cc','수행절차와 일반적인 감사특성을 모두 넣으라고 반대로 썼다.')
setv('T17-A','sub3/boundary-crit7','crit7','mc','수행절차 식별은 쓰지 않지만 일반적 특성은 반드시 넣으라고 하여 독립 점수가 갈린다.')
setv('T17-A','sub3/opposite-crit8','crit8','cc','양 수신인에 대한 서면 커뮤니케이션 의무를 모두 부정했다.')
setv('T17-A','sub3/boundary-crit8','crit8','cm','경영진은 구두로만 알리므로 서면요건에 반대이고 지배기구에는 서면으로 알리므로 충족한다.')
setv('T02-B','sub2/opposite-crit4','crit5','cn','예산 부족만으로 필요한 검사를 생략해도 된다고 절차 의무를 부정했다. 증거의 설득력 기준은 쓰지 않았다.')
setv('T02-B','sub2/boundary-crit4','crit5','mn','사례에서 대체절차 없고 예산만 문제인 필요한 절차의 생략을 거절하므로 절차 원칙은 적용했다. 낮은 설득력 증거 수용에 관한 기준은 누락했다.')
setv('T02-B','sub2/opposite-crit5','crit5','cc','대체절차 없는 검사 생략과 약한 증거 만족을 모두 정당하다고 부정했다.')
setv('T01-B','sub2/omission-crit5','crit5','nm','보고서 초안의 적합성을 고려하려는 독립 문장은 보고서 검토를 함축하지만 재무제표 검토는 설명하지 않는다.')
setv('T01-B','sub2/opposite-crit5','crit5','cc','재무제표와 보고서 초안을 둘 다 검토대상에서 제외했다.')
setv('T01-B','sub2/boundary-crit5','crit5','nm','보고서 초안 검토만 썼다. 재무제표 검토는 누락되었다.')
setv('T01-B','sub2/opposite-crit7','crit7','cc','도달한 결론과 보고서 적합성 두 평가를 모두 부정했다.')
setv('T01-B','sub2/boundary-crit7','crit5','nm','초안을 읽어본다는 답은 초안 검토에 해당하지만 재무제표 검토나 보고서의 적합성 평가까지 보충하지 않는다.')
setv('T03-B','sub1/opposite-crit1','crit1','cc','확인된 오해가 근거가 될 수 없다는 주장은 갑의 정당성과 오해라는 근거를 모두 부정한다.')
setv('T03-B','sub1/opposite-crit2','crit2','cc','변형의견 회피를 합리적 정당성으로 보아 판단과 이유를 모두 반대로 썼다.')
setv('T03-B','sub1/explicit-conflict','crit1','cm','갑의 정당성을 명시 부정하여 판단은 0점이나 실제 오해가 변경의 정당화 근거가 된다는 설명은 독립적으로 맞는다.')
setv('T03-B','sub3/opposite-crit5','crit5','cc','수행업무와 보고서 모두 변경 전 감사형식을 그대로 따라야 한다고 부정한다.')
setv('T03-B','sub3/boundary-crit5','crit5','mc','수행업무는 변경업무에 맞추었고 보고서는 감사보고서를 그대로 쓴다고 하여 둘의 점수가 다르다.')
setv('T04-C','sub2/opposite-crit4','crit4','cc','고정비율만으로 정해야 한다는 주장은 제안 판단과 전문가적 판단의 필요를 모두 부정한다.')
setv('T04-C','sub2/explicit-conflict','crit4','cm','적절/부적절 결론이 충돌하므로 판단은 0점이다. 전문가적 판단이 필요하다는 독립 명제는 그대로 인정한다.')
many('T15-B','sub2/opposite-3|sub2/boundary-3','sub2.crit3','cc','지배기구에게 생략 의도와 위협 평가를 모두 알리거나 논의하지 않는다고 명시했다.')
setv('T16-C','sub1/opposite-2','sub1.crit2','cc','요청만으로 생략하며 감사인 자신의 예외 평가가 불필요하다는 답은 두 명제 모두 반대이다.')
setv('T16-C','sub1/boundary-2','sub1.crit2','nc','공익적 효익과 비슷해도 생략한다는 것은 훨씬 초과 요건에 반대이다. 요청만으로 생략할 수 있는지는 이 답안이 명시하지 않았다.')
many('T16-C','sub2/opposite-2|sub2/boundary-2','sub2.crit2','nc','각 사항의 해당/비해당 결정을 빠짐없이 기록하는 요구는 확인되지 않는다. 결정 근거 미기록 또는 비선정 사항 근거 제외는 논리적 근거 기록의 명시적 반대이다.')
many('T14-C','sub3/opposite-2|sub3/boundary-2','sub3.crit2','nc','일정 비율 배분의 필요 여부는 쓰지 않았다. 합계 초과 불가 또는 개별부문이 전체를 초과해야 한다는 잘못된 전제는 합계 관계를 왜곡한다.')
setv('T17-B','sub1/opposite-crit1','crit1','ccc','A를 옳다고 판단하고 실증검사 무왜곡으로 효과성을 인정하며 선정 통제 테스트도 면제하여 세 명제를 모두 부정한다.')
setv('T17-B','sub1/opposite-crit2','crit2','cn','개별 통제 의견을 위한 증거 책임을 명시했다. 그 잘못된 목적의 주장을 관련주장별 선정 통제 증거책임 명제로 확대하지 않는다.')
setv('T17-B','sub1/boundary-crit2','crit2','mc','개별 통제의견용 증거 책임 부재는 맞지만 그로부터 선정 통제 증거까지 불필요하다고 부정한 부분은 별도로 0점이다.')
setv('T17-B','sub2/opposite-crit3','crit4','nc','연말 근접성만으로 충분한 기간의 평가를 생략해도 된다는 답은 충분한 시행기간 평가의무에 반대이다. 2027년 자동합산 판단은 쓰지 않았다.')
setv('T17-B','sub2/opposite-crit4','crit4','cc','2027년의 새 운영이 과거 평가기준일까지의 기간을 늘린다고 명시하여 자동합산 불가와 평가기준일 현재 시점 관계를 모두 부정한다.')
setv('T17-B','sub2/postdate-prohibition','crit4','nc','다음 해에 얻은 당기 운영의 증거까지 전부 버리라는 것은 평가대상 시점과 증거입수 시점을 혼동한다. 2027년 새 거래의 자동합산 여부는 언급하지 않았다.')
setv('T18-A','sub2/opposite-crit8','crit8','mc','직전 회계연도 말이라는 시점은 맞고 200억원 이하라는 금액 경계는 반대이다.')
setv('T18-A','sub2/opposite-crit9','crit9','mc','직전 회계연도라는 기간은 맞고 100억원 이하라는 경계는 반대이다.')
setv('T18-A','sub2/boundary-crit9','crit9','cm','당기 예상매출이라는 기간은 반대이나 100억원 미만이라는 금액 경계는 정확하여 따로 인정한다.')
for cid in ['11','12','13','14']:
 setv('T18-A','sub3/opposite-crit'+cid,'crit'+cid,'cc','해당/비해당 결론이 반대이고 그 이유도 OR/미만/질적 제외 원칙을 반대로 적용했다.')
setv('T18-A','sub3/boundary-crit11','crit11','mn','A의 적용 판단만 제시했다. 매출 미만 조건의 적용 이유는 누락했다.')
setv('T19-A','sub3/opposite-crit4','crit5','nc','정보/이용자라는 판단근거는 쓰지 않았고 낮은 확신을 완화근거로 삼아 구별 명제는 명시적으로 반대이다.')
many('T19-A','sub3/boundary-crit4|sub3/omission-crit5','crit5','nn','완화 불가 결론은 기존 판단 criterion에 해당한다. 보고정보/이용자라는 판단근거와 낮은 확신이 미발견위험에 관한 차이라는 별도 설명은 모두 누락했다.')
setv('T19-A','sub3/opposite-crit5','crit5','cc','정보/이용자 요구와 무관하게 정하고 낮은 확신을 완화근거로 삼아 두 명제를 모두 반대로 썼다.')

# Deliberate cross-criterion entailments for newly isolated positive propositions.
# (subquestion, antecedent) -> consequences in that question. These are semantic
# mappings reviewed from the current claims, not numerical weighting shortcuts.
IMPLICATIONS = {
'T02-A': {'sub3': {'crit10':['crit8'], 'crit9':['crit8']}},
'T16-A': {'sub3': {'crit7':['crit5'], 'crit6':['crit5']}},
'T17-A': {'sub1': {'crit9':['crit1'], 'crit10':['crit2']}},
'T02-B': {'sub2': {'crit5':['crit4'], 'crit10':['crit4']}},
'T01-B': {'sub2': {'crit12':['crit11']}},
'T03-B': {'sub1': {'crit8':['crit1'], 'crit9':['crit2']}},
'T04-C': {'sub2': {'crit10':['crit4']}},
'T16-C': {'sub1': {'crit5':['sub1.crit2']}, 'sub2': {'crit6':['sub2.crit2']}},
'T14-C': {'sub3': {'sub3.crit2':['sub3.crit1'], 'crit4':['sub3.crit1']}},
'T17-B': {'sub1': {'crit7':['crit1'], 'crit8':['crit1']}, 'sub2': {'crit10':['crit4']}},
'T18-A': {'sub3': {'crit17':['crit11'], 'crit18':['crit12'], 'crit19':['crit13'], 'crit20':['crit14']}},
'T19-A': {'sub3': {'crit6':['crit4']}},
}
