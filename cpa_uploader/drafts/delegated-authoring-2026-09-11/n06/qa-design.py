"""Author expectations before live review/grading. All outputs remain in N06."""
from pathlib import Path
import json,hashlib,importlib.util
B=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('n06content',B/'content-proposal.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
PARA={
'T16-A':[
 ['선임 감사인이 의견을 낸 것은 고치기 전의 2025년 재무제표이다.','당년의 감사만 담당한 후임은 전년도 재무제표 전체에 감사의견이나 다른 수준의 보증을 제공하지 않는다.'],
 ['후임은 2026년의 재무제표만 보고한다.','선임의 새 보고서를 해당 비교재무제표와 같이 재발행하면 그 선임 관련 사항을 기타사항에 기재하라는 요구가 적용되지 않지만 같이 재발행하지 않으면 그 정보를 써야 한다.'],
 ['현재 계약만으로는 부족하므로 수정 조정사항을 감사하는 별도 계약부터 맺어야 한다.','그 수정이 적절하다고 만족할 수 있을 정도로 충분하고 적합한 증거를 확보해야 한다.']
],
'T16-B':[
 ['보고서에 어떤 영향이 있는지 검토하되 이 상황의 기타정보 수정거부가 재무제표의 감사의견 거절을 자동으로 요구하지는 않는다.','기타정보 단락에 중요한 미수정 오류의 내용을 설명한다.','그 중요한 오류를 감사보고서에서 처리할 계획을 지배기구에 알린다.'],
 ['을-1은 실제로 고쳐졌는지 확인하는 등 상황에 필요한 절차를 한다.','을-2는 감사인에게 법적으로 어떤 권한과 의무가 있는지 고려한다.','을-2는 보고서를 이용하는 사람들이 중요한 미수정 오류를 알도록 적절한 수단을 취한다.']
],
'T17-A':[
 ['갑은 부적정이다. 중요한 취약점이 평가일에 존재하므로 경영진이 제대로 공시했다고 해서 그 의견이 사라지지 않는다.','을은 적정이다. 중요한 취약점에 이르지 않는 미비점만 있고 제시된 조건에서 중요한 측면의 효과적 운영을 뒷받침하므로 부적정으로 하지 않는다.'],
 ['법적으로 계약을 끝낼 수 없으니 내부회계 의견을 거절한다.','재무제표감사 때 받은 것을 포함하여 다른 경영진 진술을 믿고 의지할 수 있는 정도에 어떤 영향이 있는지 평가한다.','재무제표감사에 대한 영향은 따로 고려하며 내부회계와 무조건 같은 의견거절을 내리는 것은 아니다.'],
 ['범위가 의견을 내릴 정도에 못 미쳤다고 밝히고 그 실질적 이유가 효과성 서면진술의 거부임을 보고한다.','실제로 한 절차의 나열과 내부회계감사의 일반적인 특성 설명을 모두 넣지 않는다.','감사를 만족스럽게 마칠 수 없다는 점을 경영진과 지배기구 양쪽에 서면으로 전달한다.']
]}
OPPOSITE={
'T16-A':[
 ['전임감사인의 기존 의견은 오류를 수정한 뒤의 전기 재무제표에 대한 것이다.','당기감사를 수행했으므로 전기 재무제표 전체에도 감사의견을 표명한다.'],
 ['전임감사인이 새 보고서를 발행해도 당기감사인이 당기와 전기 전체 모두에 보고해야 한다.','전임감사인의 새 보고서가 비교재무제표와 함께 제시되지 않아도 그 보고서가 존재하기만 하면 기타사항의 전임감사인 정보 기재는 필요 없다.'],
 ['수정사항의 감사계약은 필요하지 않으며 현재 당기계약만으로 그 문구를 사용할 수 있다.','수정의 적절성에 대한 충분하고 적합한 감사증거는 없어도 그 감사표현을 사용할 수 있다.']
],
'T16-B':[
 ['이 기타정보 수정거부만으로 재무제표감사의견을 반드시 거절해야 한다.','기타정보가 중요하게 잘못되었어도 기타정보 단락에는 보고할 내용이 없다고 써야 한다.','중요한 왜곡표시를 보고서에서 어떻게 다룰지는 지배기구에게 알리면 안 된다.'],
 ['을-1은 경영진이 동의했다고 하였으므로 실제 수정 여부는 확인할 필요가 없다.','을-2는 감사인의 법적 권리나 의무는 고려하지 않고 조치를 결정한다.','을-2는 보고서 이용자에게 중요한 미수정왜곡표시를 알릴 필요가 없다.']
],
'T17-A':[
 ['갑은 경영진이 중요한 취약점을 공정하게 보고했으므로 적정의견이다.','을은 유의적 미비점이 하나라도 있으므로 반드시 부적정의견이다.'],
 ['운영실태보고서는 제공되었으므로 효과성 서면진술을 거부했어도 내부회계 의견은 적정이다.','해당 서면진술 거부는 다른 경영진 진술에 대한 의존능력에 영향을 주지 않으므로 평가할 필요가 없다.','내부회계 의견을 거절하면 재무제표에 대한 감사의견도 이유를 따져 볼 필요 없이 반드시 거절해야 한다.'],
 ['의견거절 보고서에 감사범위가 부족했다는 내용이나 실질적인 거절사유를 기술해서는 안 된다.','의견거절 보고서에는 수행한 절차를 나열하고 정상적인 내부회계감사 특성도 기술해야 한다.','감사완료가 불가능하다는 점을 경영진과 지배기구에 서면으로 알릴 필요는 없다.']
]}
# Each case either preserves a valid boundary or changes a material condition.
BOUNDARY={
'T16-A':[
 [('전임감사인은 전기 재무제표를 감사하였다.','not_met','수정 전이라는 의견 대상을 구별하지 않았다.'),('전기 전체에 감사의견은 없지만 제한적 확신은 제공한다.','contradicted','별도 전기 확신계약이 없는데 다른 확신을 표명한다고 바꾼다.')],
 [('전임의 수정 보고서가 발행되었으므로 당기만 보고한다.','met','새 보고서 발행 상황의 올바른 보고기간이다.'),('전임의 새 보고서가 함께 재발행되면 그 정보 기재 요구가 적용되지 않는다.','not_met','발문이 두 경우 모두를 물었으므로 함께 제시되지 않는 경우가 빠졌다.')],
 [('현재 계약만으로는 부족하므로 기존 계약의 업무 범위를 전기 수정사항의 감사까지 포함하도록 적절히 변경해야 한다.','met','A12는 수정사항 감사의 계약을 요구하며 물리적으로 별도 계약서 형식까지 요구하지 않는다.'),('수정 관련 자료의 양은 많이 확보하되 그 자료의 신뢰성과 적합성은 고려할 필요 없다.','contradicted','양만으로 적합성을 대체한다.')]
],
'T16-B':[
 [('법적으로 해지할 수 없어도 보고서에 미칠 영향을 고려해야 하며 이 거부만으로 재무제표 의견을 자동 거절하지는 않는다.','met','해지 불가가 보고상 영향 고려를 면제하지 않는다.'),('이 사유를 기타정보에 대한 부적정 감사의견 단락으로 작성한다.','contradicted','기타정보 단락의 오류 기술을 별도 감사의견으로 바꾼다.'),('지배기구에 기타정보를 수정해 달라고 다시 요구한다.','not_met','이미 진행한 수정요구이고 보고계획 전달이 없다.')],
 [('경영진이 새 문서를 보냈으므로 실제로 오류가 수정됐는지는 확인하지 않는다.','contradicted','문서 수령은 실제 수정 확인을 대신하지 않는다.'),('감사인의 법적 권리와 의무에 따라 선택할 수 있는 조치가 달라지는 점을 고려한다.','met','법규의 조건을 보존하며 특정 수단을 일률적으로 강제하지 않는다.'),('감사인의 법적 권리와 의무를 고려하여 법규가 허용하는 상황에서 수정된 보고서를 이용자에게 제공하도록 요청하여 그 오류를 알릴 수 있다.','met','조건을 보존한 A50의 적절한 예시는 이용자 주의 환기 조치를 충족한다.')]
],
'T17-A':[
 [('갑은 범위제한은 없지만 취약점을 이미 보고했으므로 의견변형은 필요 없다.','contradicted','보고 여부와 중요한 취약점 존재를 혼동한다.'),('을은 유의적 미비점이 있어도 중요한 취약점은 없고 나머지 조건에서 효과적 운영이 뒷받침되므로 적정이다.','met','유의적 미비점과 중요한 취약점을 구별한다.')],
 [('경영진이 제공한 운영실태보고서가 있으니 별도 효과성 서면진술 거부는 의견에 영향이 없다.','contradicted','서로 다른 문서를 대체 가능한 것으로 취급한다.'),('다른 경영진 진술의 신뢰성은 평가하되 재무제표감사에서 받은 진술은 제외한다.','contradicted','79가 명시한 다른 진술의 범위를 제한한다.'),('내부회계 의견거절만으로 재무제표 의견도 정하지 말고 그 감사에 미치는 영향을 따로 판단한다.','met','통합감사라도 두 의견의 자동 동일성을 부정한다.')],
 [('효과성에 관한 경영진 서면진술을 받지 못했다고 쓴다.','not_met','실질적 사유만 쓰고 의견표명에 불충분한 범위의 설명을 누락했다.'),('수행절차의 이름은 쓰지 않되 일반적인 내부회계감사의 특성 설명은 반드시 넣는다.','contradicted','절차와 감사특성 문구의 두 배제 대상을 구별하지 못했다.'),('지배기구에는 서면으로, 경영진에는 구두로만 감사완료 불가를 알린다.','contradicted','양측 모두에 대한 서면 방식의 조건을 바꾼다.')]
]}

def run():
 for item in m.SETS:
  plan=item['plan_id'];setid=item['id'];cases=[];num=0
  for qi,q in enumerate(item['questions']):
   n=len(q['criteria']);ids=[f'crit{num+i+1}' for i in range(n)];num+=n;sub=f'sub{qi+1}'
   def add(cid,kind,answer,vs,note,target=None):
    cases.append({'id':sub+'/'+cid,'subquestion_id':sub,'kind':kind,'answer':answer,'expected_points':sum(v=='met' for v in vs),'expected_verdicts':[{'criterion_id':cid,'verdict':v,'reason':note} for cid,v in zip(ids,vs)],'note':note,**({'target_criterion_id':target} if target else {})})
   full=q['model_answer'];para=PARA[plan][qi];met=['met']*n
   add('model','model','\n'.join(full),met,'저장 모범답안이 모든 독립 명제·조건을 충족한다.')
   add('equivalent','equivalent','\n'.join(para),met,'원문 의미와 사례 조건을 유지한 자연스러운 동의 표현이다.')
   add('reverse','reverse-order','\n'.join(reversed(full)),met,'답안의 순서는 채점요건이 아니다.')
   add('paragraph','single-paragraph',' '.join(full),met,'하나의 문단에서 복수 명제를 각각 충족한다.')
   add('sentence','single-sentence','; '.join(s.replace('. ','; ').rstrip('. ') for s in para)+'.',met,'한 문장으로 복수 명제를 충족하며 같은 인용을 사용할 수 있다.')
   add('prefix','irrelevant-prefix','오늘은 파란 펜을 사용하였다.\n'+'\n'.join(full),met,'무관한 첫 문장 뒤의 정답도 모두 평가한다.')
   add('empty','empty','',['not_met']*n,'빈 답안은 모든 criterion 미충족이고 0점이다.')
   for ci,cid in enumerate(ids):
    vs=['met']*n;vs[ci]='not_met'
    add('omission-'+cid,'omission','\n'.join(full[:ci]+full[ci+1:]),vs,'대상 독립 명제 전체를 생략했으며 나머지 명제는 유지하였다.',cid)
    vs=['not_met']*n;vs[ci]='contradicted'
    add('opposite-'+cid,'opposite',OPPOSITE[plan][qi][ci],vs,'대상 명제를 명시적으로 뒤집었다. 쓰지 않은 다른 독립 명제는 미충족이다.',cid)
    ans,v,why=BOUNDARY[plan][qi][ci];vs=['not_met']*n;vs[ci]=v
    # The conditional reporting example also explicitly considers legal permission.
    if plan=='T16-B' and qi==1 and ci==2:vs[1]='met'
    add('boundary-'+cid,'condition_boundary',ans,vs,why,cid)
   if q['type']=='judgment':
    add('implicit','implicit-judgment','수정사항의 감사를 위한 별도 계약부터 체결하고 그 수정의 적절성을 뒷받침할 충분하고 적합한 증거도 먼저 확보해야 한다.',met,'필요한 계약과 증거를 먼저 갖추라는 조치가 현재 제안의 부적절성을 함축한다.')
    add('explicit-conflict','explicit-conflict','현재 제안은 적절하다.\n'+'\n'.join(full),['contradicted']+['met']*(n-1),'명시적인 반대 결론은 판단을 결합한 criterion과 충돌한다. 독립된 증거 요건의 올바른 설명은 남는다.')
  file=B/f'draft-{setid}.json'
  payload={'version':1,'artifact_type':'author_expected_judgments','set_id':setid,'draft_sha256':hashlib.sha256(file.read_bytes()).hexdigest() if file.exists() else None,'live_model_grading':'not_run','human_approval':False,'cases':cases}
  (B/f'qa-cases-{plan.lower()}.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(plan,len(cases))
if __name__=='__main__':run()
