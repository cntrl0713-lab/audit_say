"""Author expectations prepared before any model call; package-local QA only."""
from pathlib import Path
import json, hashlib
from importlib.util import spec_from_file_location, module_from_spec
BASE=Path(__file__).resolve().parent
spec=spec_from_file_location('content',BASE/'content-proposal.py');mod=module_from_spec(spec);spec.loader.exec_module(mod)

# One paraphrase per scoreable proposition, in the same order as criteria.
PARA={
'T02-A':[
 ['당연하다고 받아들이지 않고 의문을 품는 자세이다.','오류나 부정 탓에 왜곡될 가능성을 알리는 정황을 경계하는 자세이다.','증거를 그대로 수용하지 않고 비판적으로 검토하는 자세이다.'],
 ['① 계약이 살아 있다는 회사 문서와 취소됐다는 고객 확인이 서로 맞지 않아 증거 간 충돌에 주의한다.','② 명의자의 서명 부인은 그 납품확인서를 믿을 수 있는지 의문을 일으킨다.','③ 근거 없이 개인에게 승인한도 아래로 나눠 지급한 것은 부정 가능성을 보여 주는 징후이다.','④ 당초 계획에 없던 해외 보관재고의 존재 증거가 없으므로 절차를 추가할 필요가 있음을 보여 준다.'],
 ['회사 서류에만 만족해서는 안 되며, 납품확인서의 신뢰성 문제를 추가 조사하여 절차를 바꾸거나 더 할 필요를 판단해야 한다.','예전의 정직한 태도를 고려할 수는 있어도 그것이 의구심을 줄이거나 덜 설득력 있는 증거로 만족할 이유는 되지 않는다.']
],
'T01-A':[
 ['주식 지급과 계속 보유를 전제로 하는 수임은 할 수 없다.','법인 자신이 피감사회사 지분을 직접 가지므로 직접적 재무 이해관계가 생기며, 이를 남겨 둔 채 별도 검토 등의 안전장치로 해결할 수 없고 그 관계를 없애야 한다.'],
 ['자기 법인 매출 비중만을 보고 수임을 허용하는 처리는 옳지 않다.','예외는 양쪽에게 재무 이해관계가 중요하지 않으면서 관계도 명백히 경미할 때인데 고객 쪽에 중요하므로 충족되지 않는다.'],
 ['할인 자체가 윤리 위반은 아니다. 그러나 그 금액으로 필요한 전문 기준을 지키기 어렵다면 적격성과 정당한 주의에 대한 이기적 위협이다.','업무에 충분한 시간을 배정하고 자격·능력을 갖춘 스탭을 투입한다.','고객에게 보수의 계산 근거와 그 금액으로 할 구체적 서비스 등 계약조건을 알려 준다.']
],
'T03-A':[
 ['재무제표 작성과 관련해 경영진이 아는 모든 정보에 접근하도록 한다.','감사목적에서 감사인이 경영진에게 더 요구하는 정보도 제공한다.','증거를 얻기 위해 감사인이 필요하다고 보는 회사 내부 인원에게 제약 없이 접근할 수 있게 한다.'],
 ['재무제표 감사의 목적 및 대상 범위를 적는다.','감사인에게 있는 책임을 적는다.','경영진에게 있는 책임을 적는다.','어느 재무보고체계로 재무제표를 작성하는지 식별한다.','발행 예정 보고서가 어떤 형식과 내용일지 언급한다.','상황에 따라 보고서의 실제 형식·내용이 예상과 달라질 수 있음을 명시한다.'],
 ['동의가 충분하다는 주장은 받아들일 수 없다.','추가 정보나 필요한 내부인 면담을 CFO 허가에 종속시키면 감사인이 필요하다고 본 자료와 접근권이 보장되지 않기 때문이다.']
],
'T04-B':[
 ['처음 기록을 취합 마감까지 일괄 유예하는 것은 옳지 않다.','수행 중 적시에 기록해야 하며 보고서 후 파일 취합은 행정적 정리이지 최초 작성의 유예기간이 아니다.'],
 ['취합하는 도중 새 문서로 바뀐 종전 문서를 없애는 작업이다.','조서를 정렬해 묶고 서로 찾아볼 수 있도록 참조 표시를 하는 것이다.','취합이 모두 끝났음을 점검하는 체크리스트의 서명을 확인하는 것이다.','보고서일 전에 획득하고 관련 팀원과 이미 논의해 합의한 증거를 기록으로 남기는 것이다.'],
 ['왜 고치거나 추가했는지 구체적 사유를 남긴다.','누가 언제 고치거나 더했는지를 남긴다.','그 변경을 검토한 이가 누구이고 언제 검토했는지를 남긴다.']
]}

# Explicitly false opposite statements. They are not condition-boundary substitutes.
OPPOSITE={
'T02-A':[
 ['의문을 갖지 않고 경영진의 설명을 당연한 사실로 받아들이는 태도이다.','오류나 부정 가능성을 시사하는 정황에는 주의를 기울일 필요가 없다.','감사증거를 비판적으로 평가하는 것은 의구심에 포함되지 않는다.'],
 ['① 두 자료가 서로 다르더라도 상반되는 감사증거에는 주의할 필요가 없다.','② 서명자가 서명을 부인한 정보는 납품확인서의 신뢰성을 의심할 사유가 아니다.','③ 근거 없는 개인계좌 반복송금은 부정 가능성을 전혀 나타낼 수 없다.','④ 중요한 해외 보관재고의 증거가 없어도 추가절차 필요성은 전혀 없다.'],
 ['②에 관해 더 조사하거나 절차의 변경·추가 필요성을 판단하지 않고 회사 서류에 만족하는 것이 적절하다.','경영진을 과거부터 신뢰했으므로 의구심을 낮추고 설득력이 낮은 증거에도 만족할 수 있다.']
],
'T01-A':[
 ['주식보수와 보유 조건을 그대로 둔 채 수임할 수 있다.','회계법인 자신의 감사의뢰인 주식 직접 보유는 금액이 작으면 별도 검토자 투입으로 해소할 수 있다.'],
 ['회계법인 매출 비중만으로 사업관계를 유지한 수임을 허용한 판단은 적절하다.','의뢰인에게 중요한 사업관계라도 회계법인 측에서만 중요하지 않으면 예외를 충족한다.'],
 ['어떤 경우든 보수를 낮추는 것 자체가 비윤리적이며 금지된다.','낮은 보수에 대응하려면 업무에 필요한 시간과 적격한 스탭 투입을 줄여야 한다.','낮은 보수의 산정 근거와 수행할 서비스의 구체적 내용을 의뢰인에게 알리면 안 된다.']
],
'T03-A':[
 ['경영진이 알고 있는 재무제표 작성 관련 정보라도 장부 외에는 접근을 허용할 필요가 없다.','감사인이 감사목적으로 요청한 추가정보는 경영진이 필요하다고 승인한 것만 제공하면 된다.','기업 내부 관계자에 대한 접근은 감사인이 필요하다고 판단해도 항상 CFO가 재량으로 제한해도 된다.'],
 ['감사의 목적과 범위는 계약서에 기재할 사항이 아니다.','감사인의 책임은 계약서에 넣으면 안 된다.','경영진의 책임은 계약서에 기재할 사항이 아니다.','해당 재무보고체계를 식별할 필요가 없다.','보고서의 예상 형태와 내용은 계약서에 넣을 사항이 아니다.','실제 보고서가 예상과 다를 가능성은 없다고 무조건 보장해야 한다.'],
 ['경영진의 동의는 충분하므로 그 주장은 적절하다.','추가자료와 내부인 면담의 필요성은 감사인 대신 CFO가 재량으로 정해도 되므로 필요한 접근권이 보장된다.']
],
'T04-B':[
 ['문서의 최초 작성을 최종 취합 때까지 모두 미루는 것은 적절하다.','최종 취합은 실질적인 최초 감사절차를 수행하는 단계이므로 그때까지 수행 결과의 최초 기록을 미루어도 된다.'],
 ['취합 완료 후에도 보존기간 안에 교체된 문서는 자유롭게 삭제할 수 있다.','감사조서의 분류·병합·상호 참조는 행정적 취합에서 해서는 안 되는 작업이다.','취합 완결 점검표의 서명 확인은 행정적 취합에 포함될 수 없다.','보고서일 후 처음 입수한 증거를 다루는 새 감사절차가 행정적 취합의 예이다.'],
 ['취합 완료 후 수정·추가한 구체적 이유는 문서화하지 않아도 된다.','누가 언제 수정·추가했는지는 기록하면 안 된다.','누가 언제 검토했는지는 기록할 필요가 없다.']
]}

# Condition cases deliberately change one essential component or use a valid boundary.
# answer, expected target verdict, why this is the applicable condition boundary.
BOUNDARY={
'T02-A':[
 [('경영진이 언제나 거짓말한다고 먼저 단정하는 자세이다.','not_met','의문을 가지는 태도와 항상 허위라고 단정하는 것을 구별한다.'),('오류나 부정이 확정되어야만 그 상황에 주의를 기울인다.','contradicted','확정이 아니라 왜곡표시 가능성을 시사하는 상황부터 주의한다.'),('감사증거의 양이 많다는 이유만으로 비판적 평가를 생략한다.','contradicted','증거량은 비판적 평가를 대체하지 않는다.')],
 [('①은 상반되는 증거이다.','not_met','범주 이름만으로 사례의 사실→이유 연결을 충족하지 않는다.'),('② 명의자가 서명을 부인했으므로 문서의 신뢰성을 더 살펴야 한다. 부정으로 단정할 단계는 아니다.','met','부정 확정 없이도 문서 신뢰성의 의문을 인식할 수 있다.'),('③ 근거 없는 개인 송금은 부정 가능성의 징후이지만 부정을 확정하는 증거라고 단정할 수는 없다.','met','가능성의 경계와 확정의 구별을 보존한다.'),('④ 기존 절차에서 빠진 해외 보관재고의 증거를 얻는 절차가 더 필요하다. 위조 여부는 이 상황에서 판단할 수 없다.','met','부정 징후가 없어도 추가절차 필요성은 발생한다.')],
 [('위조 문서인지 외부 감정인에게 언제나 감정을 맡긴다.','not_met','추가조사와 절차 변경·추가의 필요성 판단을 일률적 감정의무로 바꾸지 않는다.'),('과거 경영진의 정직성을 고려할 수는 있어도, 증거의 설득력 요구와 의구심 수준은 낮출 수 없다.','met','과거 경험을 무시할 필요가 없다는 허용 경계를 보존한다.')]
],
'T01-A':[
 [('주식보수 조건을 철회하고 관련 재무적 이해관계를 해소해야 수임을 검토할 수 있다.','met','관계 유지가 불가하다는 결론이 조치에 함축되어 있다.'),('감사보수 주식 수가 1주에 불과하므로 직접 보유해도 안전장치로 해결할 수 있다.','contradicted','직접 이해관계에 금액 경미 예외를 붙일 수 없다.')],
 [('을회사에 중요한 그 공동사업관계를 그대로 두어서는 수임을 허용할 수 없다.','met','관계 해소·유지 불가로 부적절 판단을 표현할 수 있다.'),('의뢰인과 회계법인 모두에게 중요하지 않으면 관계가 명백히 경미하지 않아도 허용된다.','contradicted','양측 중요성 외에 명백히 경미한 관계라는 조건도 필요하다.')],
 [('낮은 보수여도 필요한 기준을 준수할 수 있다면 낮다는 사실만으로 비윤리적이라고 할 수 없다.','not_met','허용 경계는 옳지만 위협이 발생하는 조건·위협 종류 설명이 없어 결합 criterion 전체는 미충족이다.'),('적절한 시간을 배정하지만 담당자의 적격성은 고려하지 않는다.','contradicted','시간만으로 적격한 인력 요건을 대체하지 않는다.'),('고객에게 낮은 보수 총액만 알리고 그 산정기준과 수행할 구체적 업무는 알리지 않는다.','contradicted','보수 총액 통보와 산정기준·구체적 서비스 인지를 구별한다.')]
],
'T03-A':[
 [('경영진이 알고 있는 재무제표 작성 관련 모든 정보에 접근한다. 재무제표와 무관한 개인정보 전부를 뜻하지는 않는다.','met','관련성이라는 경계를 보존한다.'),('경영진은 감사목적으로 요청한 추가정보도 제공하되 그중 CFO가 좋다고 본 것에 한정한다.','contradicted','감사인의 필요성 판단을 CFO 재량으로 바꾼다.'),('감사인은 기업 외의 모든 사람에게도 강제로 출석을 명령할 수 있다.','not_met','기업 내부의 제한 없는 접근과 기업 외 강제조사권은 별개이다.')],
 [('감사의 목적만 적는다.','not_met','목적·범위 결합 항목 중 범위 누락.'),('감사인의 책임을 계약서에서 밝힌다. 모든 책임의 세부 목록까지 여기서 적지는 않겠다.','met','필수 기록사항의 범주를 묻는 발문이므로 범주명으로 충분하다.'),('경영진의 책임을 포함한다. 책임의 모든 세부 내용은 이 답안에서 반복하지 않는다.','met','범주 제시 요구를 상세 열거로 확대하지 않는다.'),('어느 재무보고체계에 따라 작성하는지 식별한다.','met','기준서 번호나 체계 이름의 실제 선택까지 묻지 않았다.'),('보고서가 예상되는 형식만 적는다.','not_met','예상 형태와 내용 중 내용 누락.'),('보고서의 예상 형태와 내용을 적는다.','not_met','예상 명시는 변경 가능성의 별도 기술을 함축하지 않는다.')],
 [('CFO가 추가정보와 필요한 내부인 접근을 제한하는 조건을 먼저 해소해야 동의를 충분히 받았다고 할 수 있다.','met','필요한 조치에 부적절 판단이 함축된다.'),('감사인은 회사 밖의 누구라도 강제로 조사할 수 있는데 CFO가 이를 막기 때문이다.','not_met','기준이 인정하지 않는 기업 외 강제권을 이유로 삼았다.')]
],
'T04-B':[
 [('취합 완료일까지 최초 작성을 미뤄서는 안 되고 적시에 기록해야 한다.','met','조치가 제안의 부적절성을 분명히 함축한다.'),('보고서일 이후에는 행정적 파일 취합도 절대로 할 수 없다.','contradicted','최초 작성 지연 금지와 보고서 후 행정적 취합 허용을 구별한다.')],
 [('아직 최종 취합 중이라면 교체된 문서의 삭제는 가능하다.','met','완료 전·교체된 문서라는 두 경계를 보존한다.'),('감사조서를 종류별로 정렬해 하나로 묶고 관련 문서끼리 찾아볼 수 있도록 연결표시한다.','met','분류·병합·상호참조의 자연스러운 동의 표현이다.'),('감사보고서 자체의 서명을 확인한다.','not_met','대상은 취합 완결 점검표의 서명이다.'),('보고서일 전에 입수했으나 관련 업무팀원과 아직 토의·합의하지 않은 증거를 새로 평가해 결론을 낸다.','contradicted','이미 입수·토의·합의한 증거의 문서화와 새 결론 도출을 구별한다.')],
 [('사소한 오기 수정이라도 구체적 수정 사유를 기록한다.','met','변경 성격이 경미해도 이유 기록 요구가 남는다.'),('수정·추가한 사람의 이름만 기록하고 시기는 기록하지 않는다.','contradicted','수정자와 수정시기 결합요건이다.'),('검토일만 기록하고 검토자는 기록하지 않는다.','contradicted','검토자와 검토시기 결합요건이다.')]
]}

def run():
 for item in mod.SETS:
  plan=item['plan_id'];setid=item['id'];draft=BASE/f'draft-{setid}.json'
  sets=json.loads(draft.read_text(encoding='utf-8')) if draft.exists() else None
  cases=[];counter=0
  for qi,q in enumerate(item['questions']):
   n=len(q['criteria']);ids=[f'crit{counter+i+1}' for i in range(n)];counter+=n;sub=f'sub{qi+1}'
   def add(cid,kind,answer,verdicts,note='',target=None):
    cases.append({'id':f'{sub}/{cid}','subquestion_id':sub,'kind':kind,'answer':answer,'expected_points':sum(v=='met' for v in verdicts),'expected_verdicts':[{'criterion_id':ci,'verdict':v,'reason':('공식 근거와 해당 criterion의 발문 범위·조건에 따른 작성자 기대값. '+note).strip()} for ci,v in zip(ids,verdicts)],'note':note,**({'target_criterion_id':target} if target else {})})
   full=q['model_answer'];para=PARA[plan][qi]
   add('model','model','\n'.join(full),['met']*n,'저장 모범답안 전체. 모든 독립 명제를 충족한다.')
   add('equivalent','equivalent','\n'.join(para),['met']*n,'자연스러운 동의 표현 전체. 원문의 의미·조건을 유지한다.')
   add('reverse-order','reverse-order','\n'.join(reversed(full)),['met']*n,'순서는 채점요건이 아니다.')
   add('single-paragraph','single-paragraph',' '.join(full),['met']*n,'하나의 문단·인용으로 여러 독립 명제를 충족할 수 있다.')
   add('single-sentence','single-sentence','; '.join(s.replace('. ','; ').rstrip('. ') for s in para)+'.',['met']*n,'세미콜론으로 연결한 한 문장으로 여러 독립 명제를 충족한다.')
   add('irrelevant-prefix','irrelevant-prefix','이 답안은 파란 펜으로 작성하였다.\n'+'\n'.join(full),['met']*n,'무관한 첫 문장 때문에 뒤의 정답을 자르지 않는다.')
   add('empty','empty','',['not_met']*n,'전체 빈 답안은 0점이며 실제 경로에서 모델 없이 처리되어야 한다.')
   for ci in range(n):
    omit='\n'.join(full[:ci]+full[ci+1:]);vs=['met']*n;vs[ci]='not_met';note='대상 독립 명제를 제거한 나머지 답안이다.'
    if ci==0 and (plan=='T01-A' and qi in [0,1] or plan=='T03-A' and qi==2 or plan=='T04-B' and qi==0):
     # The reason independently implies the judgment, so deleting the judgment sentence is not an omission.
     add(f'implicit-{ids[ci]}','implicit-judgment',omit,['met']*n,'명확한 이유·관계 해소 요구가 판단을 함축하므로 결론 문장만 지운 답은 여전히 만점이다.',ids[ci])
     omit='제시된 사항에 관한 세부 정보가 더 필요하다.';vs=['not_met']*n;note='판단을 함축하는 이유까지 제거하여 실제 판단 누락을 만들었다. 이유 점수도 함께 없어지며 독립적인 판단만의 누락이라고 주장하지 않는다.'
    add(f'omission-{ids[ci]}','omission',omit,vs,note,ids[ci])
    opposite=OPPOSITE[plan][qi][ci];ovs=['not_met']*n;ovs[ci]='contradicted'
    # Opposite reason can also explicitly negate a judgment criterion.
    if ci==1 and plan=='T01-A' and qi in [0,1]:ovs[0]='contradicted'
    if ci==1 and plan=='T03-A' and qi==2:ovs[0]='contradicted'
    if ci==1 and plan=='T04-B' and qi==0:ovs[0]='contradicted'
    add(f'opposite-{ids[ci]}','opposite',opposite,ovs,'대상 명제의 의미를 명시적으로 뒤집은 답안. 쓰지 않은 다른 명제는 원칙적으로 미충족이다.',ids[ci])
    answer,v,why=BOUNDARY[plan][qi][ci];bvs=['not_met']*n;bvs[ci]=v
    # These valid boundary answers imply another named judgment; preserve that inference.
    if plan=='T01-A' and qi==0 and ci==1:bvs[0]='contradicted'
    if plan=='T03-A' and qi==2 and ci==0:bvs[1]='met'
    if plan=='T03-A' and qi==1 and ci==5:bvs[4]='met'
    add(f'boundary-{ids[ci]}','condition_boundary',answer,bvs,why,ids[ci])
   if q['type']=='judgment':
    right=q.get('decision',{}).get('correct');wrong=next(v for v in q['decision']['options'] if v!=right)
    ans=wrong+'.\n'+'\n'.join(full[1:]);vs=['met']*n;vs[0]='contradicted'
    # T02-A sub3 combines judgment with action; opposite conclusion defeats that combined criterion.
    add('explicit-conflict','explicit-conflict',ans,vs,'명시적 반대 결론은 판단 criterion을 충족하지 못한다. 별도로 맞게 적은 이유는 해당 계약에 따라 유지한다.')
  payload={'version':1,'artifact_type':'author_expected_judgments','set_id':setid,'draft_sha256':hashlib.sha256(draft.read_bytes()).hexdigest() if draft.exists() else None,'live_model_grading':'not_run','human_approval':False,'interpretation':'공식 원문·확정된 발문 범위에 따라 실제 모델 호출 전에 정한 작성자 기대값이다. 의미검수 receipt나 실측 결과가 아니다.','cases':cases}
  (BASE/f'qa-cases-{plan.lower()}.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  print(plan,len(cases))
if __name__=='__main__':run()
