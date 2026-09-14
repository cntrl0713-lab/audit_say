import json, hashlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[4]
D=ROOT/'cpa_uploader/drafts/case-applied-2026-09-14'
OUT=D/'a'
cat=json.loads((D/'source-catalog-final.json').read_text(encoding='utf-8-sig'))
units={u['id']:u for u in cat['units']}
bank=json.loads((D/'bank-before.json').read_text(encoding='utf-8-sig'))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def jsha(x): return hashlib.sha256(json.dumps(x,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
def write(name,obj): (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Each entry is authored here; assembly below only supplies repeated schema fields.
S=[
dict(id='case-09-unrecorded-liabilities-20260914',topic='09',title='후속지급 검사와 누락된 매입채무의 탐색',tags=['부외부채','조회대상','기간귀속'],
facts=[
'감사팀은 산업용 부품을 제조하는 다온의 2026년 12월 31일 재무제표를 감사한다. 회사의 매입대금은 거래처에 따라 납품 후 30일 또는 60일에 결제된다. 감사팀은 기말 매입채무가 누락될 위험에 대응하고 있으며, 2027년 1월 20일에 현장업무를 마치고 3월 10일에 감사보고서를 발행할 계획이다. 현장 철수 후에도 회사의 지급기록과 매입증빙에 접근할 수 있고, 중요한 12월 매입분 중 일부는 2월에 지급될 예정이다.',
'담당자는 1월 1일부터 1월 20일까지의 주거래통장 출금내역을 매입채무원장과 대조하였다. 발견한 차이가 없자, 현장업무가 종료되므로 후속지급 검사의 대상기간도 1월 20일에 끝내자고 제안하였다. 감사팀이 그 이후의 지급이나 미지급 거래에 관하여 별도로 증거를 입수한 사실은 없다. 여기서는 후속지급 검사의 대상기간을 검토하며, 최종 감사의견이나 표본 수를 결정하지 않는다.',
'감사팀은 추가로 매입채무 조회를 실시하기로 하였다. 조회 담당자는 12월 31일 매입채무원장에서 일정금액 이상인 거래처만 선정하였다. 연간 매입내역에서는 청솔이 주요 공급업체로 나타나지만, 청솔의 기말 장부잔액은 0이다. 청솔과의 거래가 중단되거나 전액 결제되었다는 별도 근거는 아직 확인하지 않았다. 담당자는 잔액이 없으므로 청솔은 조회대상이 될 수 없다고 설명하였다.',
'기간귀속 검토에서는 1월 10일 한빛에 지급한 외상대금이 발견되었다. 회사의 기말 매입채무원장에 한빛 잔액은 없지만, 한빛에서는 12월과 1월 모두 물품을 납품하였다. 지급전표의 적요에는 외상대금이라고만 쓰여 있고 대응하는 세금계산서와 검수기록은 아직 대조하지 않았다. 담당자는 이 지급이 있었다는 사실만으로 2026년 말 매입채무 누락을 확정하려 한다. 다른 담당자의 앞선 제안과 독립적으로 이 판단을 검토한다.'
],
sources=['src-1518221249f4db39b5','src-d17a554e2fd22ebefe','src-1d25333369649078ec','src-52dfce196f620f4099','src-a05d2d3b78915d6028'],
learning=['src-ca392542d5d3425f18','src-52dfce196f620f4099','src-c0b95238138ab57e7a','src-a05d2d3b78915d6028'],
compare=['pilot-08-001','pilot-08-007','case-08-selection-coverage-20260914'],
difference='08-001/sub2는 과소계상 검증의 방향에 관한 기준서형 일반론이고 08-007은 매출의 발생·완전성 방향이다. 최근 selection-coverage 사례는 고액 매출채권 검사의 투영 한계다. 신규는 매입 결제주기에 따른 지급검토 종료일, 0잔액 주요 공급업체의 조회선정, 차기 지급의 귀속 확인을 별도 목표로 다룬다.',
ranges=[(16931,16938,'KGA500.6~7 PDF396'),(17245,17259,'KGA500.A31~A32 PDF404'),(18226,18238,'KGA505.7 PDF428')],
qs=[
dict(topics=['07','08'],facts=['fact1','fact2'],prompt='후속지급 검사의 대상기간을 현장 철수일에 끝내려는 계획을 어떻게 보완해야 하는지 설명하시오. 회사의 결제주기와 아직 검사하지 않은 지급내역을 이유에 연결하시오.',
answers=['후속지급 검사의 대상기간을 1월 20일에 끝내지 말고 감사보고서일에 근접한 시점까지 확대하여 지급내역을 검토한다.','12월 매입분 중 2월에 지급되는 거래가 있으므로, 현장 철수일까지의 검사만으로는 그 뒤 지급되는 누락부채를 발견하지 못할 수 있기 때문이다.'],
claims=['1월 20일의 종료일을 감사보고서일에 근접한 시점까지 확대하여 후속지급 내역을 검토한다. 현장 재방문 자체는 요구하지 않는다.','30일·60일 결제주기로 12월 매입분의 일부가 2월에 지급된다는 사실을 검사기간 밖의 누락부채 미발견 위험에 연결한다.'],
refs=[['src-52dfce196f620f4099','src-1518221249f4db39b5','src-d17a554e2fd22ebefe'],['src-d17a554e2fd22ebefe','src-52dfce196f620f4099']],
partial='감사보고서일에 근접한 시점까지 후속지급 내역의 검토기간을 확대한다.',met=[1],wrong='현장 철수 후의 지급은 다음 감사의 대상이므로 1월 20일까지만 검사하면 된다.',
rationale='기간 보완이라는 조치와 이 회사의 지연지급이 만드는 증거 공백이라는 이유를 각 1점으로 구별한다. 단순 부적절 판단에는 별도 점수를 더하지 않는다.'),
dict(topics=['09','08'],facts=['fact3'],prompt='청솔을 조회대상에서 제외한 판단을 평가하고, 이 회사의 누락 매입채무를 찾는 목적에 맞게 조회대상 선정방식을 보완하시오. 기말 장부잔액과 연간 매입내역이 서로 다른 정보를 제공한다는 점을 이유에 포함하시오.',
answers=['기말 장부잔액이 0이라는 이유만으로 청솔을 조회대상에서 제외할 수 없다.','청솔처럼 당기 중 주요 거래처인 공급업체는 기말 잔액이 없거나 작아도 고려하여 조회대상을 선정한다.','부채가 통째로 누락된 거래처는 기말 매입채무원장에 나타나지 않을 수 있다. 연간 매입내역에는 청솔의 활발한 거래가 나타나므로 기말 장부잔액만으로 조회대상을 한정하면 누락 위험을 놓칠 수 있다.'],
claims=['청솔의 기말 잔액 0만으로 조회대상에서 제외한 판단을 부적절하다고 판단한다. 청솔을 포함하여 선정해야 한다는 명확한 조치가 이 결론을 함축하면 인정한다.','당기 주요 공급업체라는 청솔의 거래사실을 이용하여, 잔액이 없거나 작은 거래처도 포함하도록 조회대상을 선정한다.','기말 잔액만으로 정한 모집단에는 부채가 누락된 거래처가 빠질 수 있고, 연간 매입내역은 청솔처럼 그 위험을 조사할 주요 거래처를 포착할 수 있음을 설명한다.'],
refs=[['src-52dfce196f620f4099','src-1d25333369649078ec'],['src-52dfce196f620f4099','src-1d25333369649078ec'],['src-d17a554e2fd22ebefe','src-52dfce196f620f4099']],
judgments=[1],partial='청솔을 잔액이 없다는 이유만으로 제외한 것은 부적절하다.',met=[1],wrong='조회는 기말 매입채무원장에 금액이 있는 업체에만 할 수 있으므로 청솔은 제외한다. 연간 거래규모는 관련이 없다.',
rationale='제외 판단 1점·주요거래처를 반영한 선정 1점·누락된 모집단의 의미 1점이다. 청솔을 포함하는 조치는 판단을 함축하지만 그 자체로 모집단의 논리까지 자동 인정하지 않는다.'),
dict(topics=['07','08'],facts=['fact4'],prompt='한빛에 대한 1월 10일 지급만으로 전기말 매입채무 누락을 확정하려는 판단을 평가하시오. 필요한 기간귀속 확인절차와, 그 확인이 필요한 이유를 설명하시오.',
answers=['1월 10일에 지급했다는 사실만으로 2026년 말 매입채무 누락을 확정할 수 없다.','지급액에 대응하는 세금계산서·납품 및 검수기록 등 매입증빙을 대조하여 관련 매입과 채무가 어느 회계기간에 발생했는지 확인한다.','한빛은 12월과 1월 모두 납품하였으므로, 그 지급은 2027년 1월 매입분의 결제일 수도 있다. 차기 지급일과 전기말 채무의 존재는 동일한 사실이 아니다.'],
claims=['차기 지급만으로 전기말 누락부채를 확정하는 판단을 부적절하다고 판단한다. 귀속을 확인한 후 결정해야 한다는 조치가 명백히 함축하면 인정한다.','한빛 지급에 대응하는 매입·납품·검수 증빙을 대조하여 거래와 채무가 발생한 회계기간을 확인하는 절차를 제시한다.','12월과 1월 모두 납품했다는 상황 때문에 1월 지급이 당해 1월 매입의 결제일 수도 있어 전기말 부채를 곧바로 입증하지 못함을 설명한다.'],
refs=[['src-a05d2d3b78915d6028','src-1518221249f4db39b5'],['src-a05d2d3b78915d6028','src-d17a554e2fd22ebefe'],['src-a05d2d3b78915d6028']],
judgments=[1],partial='아직 전기말 부채 누락이라고 확정할 수 없다.',met=[1],wrong='1월에 외상대금을 지급했고 기말 잔액이 없으므로 전기말 매입채무 누락이 확정된다. 납품이나 검수 시기는 확인할 필요가 없다.',
rationale='판단·귀속 검증절차·두 납품기간에 따른 대안 설명은 각 1점이다. 거래증빙 확인만으로 두 기간의 대안까지 서술했다고 보지 않는다.')]),
dict(id='case-09-legal-inquiry-20260914',topic='09',title='소송 질의서의 보완과 법률고문과의 회합',tags=['소송','세부질문서','의견 불일치'],
facts=[
'감사팀은 건설업체 누리의 2026년 12월 31일 재무제표를 감사한다. 누리는 분양계약 해제에 따른 손해배상 청구와 하자보수 배상청구에 연루되어 있으며, 외부 법률고문이 두 사건을 모두 담당한다. 감사팀은 소송과 관련된 중요왜곡표시위험을 식별하여 외부 법률고문과 직접 커뮤니케이션할 필요가 있다고 판단하였다. 이 문제는 법률고문 질의의 설계와 후속 논의만 다룬다.',
'법률고문이 소속된 전문직 단체의 규칙은 일반질문서에 대한 답변을 제한하지만, 특정 사건 목록과 경영진의 평가를 전제로 한 세부질문서에 대한 답변은 허용한다. 법률고문도 그 범위에서 감사인에게 직접 답변할 수 있다고 알렸다. 담당자는 일반질문서에 회신할 수 없다는 설명을 듣고 모든 직접 교신이 막힌 것과 같으므로 법률고문과의 질의를 포기하자고 제안하였다.',
'경영진은 질의서 초안을 작성하였다. 그 본문은 “분양계약 해제 손해배상 청구 및 하자보수 배상청구가 현재 진행 중인지 확인하여 감사인에게 회신해 주시기 바랍니다.”라는 문구가 전부이다. 회사는 이와 별도로 사건별 예상 결과와 소송비용을 포함한 금전적 영향의 추정치를 담은 내부 검토표를 보관하고 있다. 질의서는 감사인이 발송하며 법률고문이 감사인에게 직접 회신하도록 주소와 회신 경로를 정하였다.',
'별도의 후속 검토에서 경영진은 분양계약 해제 사건의 배상 가능성이 낮다고 보는 반면, 법률고문은 계약상 조건의 해석에 따라 결과가 크게 달라질 수 있다는 의견을 제시하였다. 여러 계약조항이 서로 영향을 미치고 당사자의 책임 범위에 관한 설명도 일치하지 않는다. 담당자는 질의서에 회신만 받았으면 추가로 만날 필요를 검토할 수 없다고 하였다. 경영진은 회합이 필요하다면 동의하고 대리인을 참석시킬 수 있으며 법률고문도 논의에 응할 수 있다.'
],
sources=['src-8ab9800d73372dc280','src-44f467e33f86e29fb5','src-290ef959185110bc59','src-9e945b070c73519995'],
learning=['src-8395284d7f416232f1','src-3514bebaf4f2357ca6','src-37cb802544da7cd77b','src-a8f6a9d3321c6c246b'],
compare=['pilot-09-009','case-09-confirmation-barrier-20260914'],
difference='09-009/sub2는 직접 커뮤니케이션의 발동조건·작성발송자·직접 교신 금지 대안을 묻는 기준서형이다. A23 경계는 기존 보조설명에도 있어 sub1은 의도한 사례 심화다. 사건별 평가를 빠뜨린 세부질문서의 실제 수정과 회신 후 의견 불일치에 따른 회합 판단은 새 요구다. confirmation-barrier는 매출조회 발송 거부와 적극적 회신 필수 상황으로 법률고문 질의가 아니다.',
ranges=[(18013,18044,'KGA501.A21~A24 PDF423')],
qs=[
dict(topics=['09'],facts=['fact1','fact2'],prompt='모든 직접 질의를 포기하자는 제안을 평가하고, 이 사례에서 선택할 수 있는 질의서의 형태와 그 근거를 설명하시오. 질의서의 세부 포함내용은 다음 물음에서 다룬다.',
answers=['모든 직접 질의를 포기할 필요가 없으므로 담당자의 제안은 부적절하다.','일반질문서에 대한 답변만 제한되고 사건별 질의와 직접 회신은 가능하므로, 세부질문서를 통해 법률고문과 직접 커뮤니케이션을 모색할 수 있다.'],
claims=['일반질문서 회신 제한만으로 모든 직접 질의를 포기하는 제안을 부적절하다고 판단한다. 세부질문서로 직접 질의를 계속한다는 조치가 결론을 명백히 함축하면 인정한다.','일반질문서 답변과 사건별 직접 회신의 허용범위가 다르다는 사실을 근거로 세부질문서 방식을 선택한다.'],
refs=[['src-290ef959185110bc59','src-8ab9800d73372dc280'],['src-290ef959185110bc59']],judgments=[1],
partial='모든 직접 질의를 포기하자는 제안은 부적절하다.',met=[1],wrong='일반질문서에 답변할 수 없으므로 세부질문서도 보내서는 안 된다. 법률고문과의 모든 직접 교신을 중단해야 한다.',
rationale='포기 판단 1점과 제한 범위에 맞는 세부질문서 선택 1점이다. 형태 명칭만으로는 후자에 필요한 사례 적용이 충분하지 않다.'),
dict(topics=['09'],facts=['fact3'],prompt='이미 기재된 사건 목록과 적절한 발송·회신 경로는 유지한다. 질의서 초안에서 사건의 진행 여부를 확인하는 데 그친 요청을 어떻게 보완해야 하는지 설명하시오. 회사에 있는 검토표의 내용과 법률고문에게 요청할 확인·보충정보를 연결하시오.',
answers=['내부 검토표에 있는 각 소송의 예상 결과에 대한 경영진의 평가를 질의서에 포함한다.','각 사건에 관한 소송비용 등 재무적 영향의 경영진 추정치를 질의서에 포함한다.','법률고문에게 경영진의 평가가 타당한지 확인해 달라고 요청한다.','법률고문이 사건 목록이 불완전하거나 부정확하다고 판단하면 감사인에게 추가정보를 제공해 달라고 요청한다.'],
claims=['이미 작성된 내부 검토표에서 각 소송의 결과에 대한 경영진 평가를 질의서에 포함한다.','내부 검토표의 사건별 재무적 영향 추정치에 소송비용 등 관련 비용을 포함하여 질의서에 기재한다.','진행 여부의 확인에 더하여 경영진 평가의 타당성에 관한 법률고문의 확인을 요청한다.','누락 또는 부정확한 사건 목록이 있으면 법률고문이 감사인에게 추가정보를 주도록 요청한다.'],
refs=[['src-290ef959185110bc59']]*4,
partial='진행 여부만 묻지 말고 내부 검토표에 있는 사건별 경영진의 예상 결과 평가를 질의서에 넣는다.',met=[1],wrong='사건명이 모두 적혀 있으므로 진행 중인지 여부만 확인하면 된다. 내부 추정치나 평가의 타당성, 목록의 오류에 관한 질문은 법률고문에게 해서는 안 된다.',
rationale='각 사건의 결과평가, 금전영향, 법률고문의 타당성 확인, 불완전목록 보충 요청은 독립된 정보목적이므로 각 1점이다. 이미 있는 사건목록과 작성발송자는 다시 배점하지 않는다.'),
dict(topics=['09'],facts=['fact4'],prompt='서면 회신을 받았으므로 회합의 필요성을 더 검토할 수 없다는 주장을 평가하시오. 이 사건에서 회합을 고려할 근거와 그 논의 목적을 설명하시오. 회합의 참석자나 동의 절차 목록은 요구하지 않는다.',
answers=['서면 회신을 받았다는 이유만으로 추가 회합의 필요성 검토를 배제할 수 없으며, 이 사건에서는 법률고문과 만날 필요가 있다고 판단할 수 있다.','계약조항과 책임 범위가 복잡하고 경영진과 법률고문의 결과 전망이 다르므로, 소송의 예상 결과를 직접 논의하여 차이를 이해하고 평가할 필요성을 고려한다.','이러한 사실은 회합을 고려할 근거이지만, 해당하는 모든 사건에서 대면이 일률적으로 필수라는 의미는 아니다.'],
claims=['서면 회신만으로 회합 필요성 검토를 배제하지 않고 이 사건에서 추가 회합을 고려할 수 있다고 판단한다. 회합 목적을 가진 조치가 이 판단을 명백히 함축하면 인정한다. 회합은 일률적인 의무라고 요구하지 않는다.','복잡한 계약·책임 범위 또는 경영진과 법률고문의 상이한 전망 중 이 사건에 해당하는 근거를 소송 예상 결과의 논의 목적에 연결한다. 복잡성과 의견 불일치를 모두 필수로 요구하지 않는다. 단순 사실 반복이나 회합이라는 명칭만으로는 충족하지 않는다.'],
refs=[['src-9e945b070c73519995']]*2,judgments=[1],
partial='서면 회신이 있어도 회합을 고려할 수 있다.',met=[1],wrong='질의서에 회신했으면 설명이 상충하더라도 추가 회합의 필요성을 검토할 수 없다. 따라서 회신 이후에 만나는 것은 언제나 금지된다.',
rationale='회합 검토를 배제한 판단 1점·복잡성과 의견 불일치를 결과 논의에 연결한 이유 1점으로 조정한다. 회합이 언제나 의무는 아니라는 설명은 판단의 허용조건이며 같은 판단에 별도 1점을 중복 배점하지 않는다.')]),
dict(id='case-12-going-concern-evidence-20260914',topic='12',title='자금지원 계획의 증거와 계속기업 관련 공시·의견',tags=['계속기업','자금지원','공시 누락','증거 부족'],
facts=[
'감사팀은 12월 결산업체 해든의 2026년 재무제표를 2027년에 감사한다. 해든은 영업현금 유출이 계속되고 6월에 큰 차입금 만기가 도래한다. 경영진의 현금흐름예측은 모회사 새봄이 필요한 때 자금을 제공한다는 가정에 크게 의존하며, 그 지원을 제외하면 기존 영업만으로 만기 채무를 상환할 수 없다. 경영진의 평가기간과 예측의 다른 기초자료에 관한 검토는 적절히 수행되었다.',
'해든의 재무책임자는 새봄 담당자의 이메일을 전달하였다. 이메일에는 지원을 긍정적으로 검토한다는 표현만 있고 지원기간·조건은 특정되어 있지 않다. 감사인은 약정서나 새봄의 재무자료를 아직 확보하지 못했다. 새봄이 최근 다른 계열사의 채무도 부담하게 되었다는 정보가 있지만 추가 자금제공능력은 확인하지 않았다. 재무책임자는 계열사 지원 의사가 이메일에 있으므로 예측에 반영된 자금지원 가정을 더 검토할 필요가 없다고 한다.',
'공시 검토는 그 뒤 필요한 증거를 확보한 상황 가를 전제로 한다. 감사인은 경영진의 계속기업전제 사용은 적합하지만 자금사정과 지원계획의 불확실성 때문에 중요한 불확실성이 존재한다고 결론 내렸다. 감사인이 확인한 실제 지원계획의 조건은 아직 확정되지 않았다. 현재 주석의 관련 문구는 다음이 전부이다. “당사는 영업현금 유출이 계속되고 있으며 2027년 6월 차입금 만기가 도래한다. 당사는 모회사로부터 자금지원을 받는 방안을 추진하고 있으며 향후 정상적인 영업을 예상한다.”',
'보고 검토의 상황 가에서는 경영진이 그 주석을 끝내 보완하지 않았다. 회사의 자산 회수와 만기채무 상환을 이해하려면 지원의 미확정 상태를 아는 것이 필수이며, 이용자는 현재 주석으로는 그 위험을 파악할 수 없다. 이와 독립된 상황 나에서는 여러 대체절차까지 수행했으나 모회사의 지원 약정과 제공능력에 관한 충분하고 적합한 증거를 끝내 확보하지 못했다. 그 가정은 자산 대부분의 회수와 주요 부채의 상환에 영향을 줄 수 있다. 상황 나에 상황 가의 증거확보 결론이나 공시 누락 사실을 승계하지 않으며, 계속기업전제 사용의 부적합이나 파산이 확정된 것은 아니다. 두 상황 모두 다른 의견변형 사유는 없다.'
],
sources=['src-53140ed862dddf7d9b','src-43f2f13c6e8997734d','src-3d8845cddb0c2ba942','src-2e1fde91ebfe6b875d','src-9d4ff7ee740ed7e523','src-fc35744e458b64dae9','src-9a64e7a75e5ee051b4','src-56c706b48bbd5c9e4e'],
learning=['src-6f49af9b641f466372','src-db67536f9703564453'],compare=['pilot-12-001','draft-12-570-freq01','pilot-15-002'],
difference='12-001은 10개월 평가기간과 현금예측의 데이터·가정·향후계획에 관한 일반 평가를 적용한다. 신규 sub1은 제3자 지원약정의 조건·효력·제공능력 증거에 한정한다. draft-12-570의 물음은 모두 기준서형으로 적절한 공시/불충분 공시라는 결론을 전제로 가능한 의견계열을 묻는다. 신규는 실제 주석의 누락을 찾고, 이용자 이해에 근본적인 공시누락과 재무제표 상당부분에 영향을 줄 수 있는 증거부족을 비교하여 의견을 확정한다.',
ranges=[(24328,24362,'KGA570.16 PDF576~577'),(24379,24391,'KGA570.19 PDF577'),(24411,24429,'KGA570.22~23 PDF578'),(24659,24706,'KGA570.A16~A19 PDF584~585'),(32138,32191,'KGA705.5~9 PDF770~771')],
qs=[
dict(topics=['12'],facts=['fact1','fact2'],prompt='이메일만으로 자금지원 가정을 더 검토하지 않으려는 처리에서 보완할 감사절차를 설명하시오. 새봄의 지원약정과 자금제공능력에 관한 증거를 구별하여 사례에 적용하시오. 현금흐름예측표의 계산과 최종 의견은 요구하지 않는다.',
answers=['새봄에 직접 확인하거나 약정서를 입수하는 등으로 자금지원 약정의 존재와 기간·금액 등 지원조건을 확인한다. 긍정적 검토라는 이메일만으로 필요한 시기의 지원이 확약되었다고 보지 않는다.','지원약정의 적법성과 강제성을 확인하여 해든이 그 지원을 실제로 요구할 수 있는지 평가한다.','새봄의 재무자료와 다른 계열사 채무부담 등을 확인하여, 해든이 필요로 하는 자금을 제공할 재무능력이 있는지 평가한다.'],
claims=['이메일의 검토 의향을 확약으로 대신하지 않고, 새봄에 대한 확인 또는 약정서 등 적합한 증거로 지원약정의 존재·조건을 확인한다. 서면조회는 적합한 방법이지만 다른 신뢰성 있는 증거경로를 일률 배제하지 않는다.','해든의 지원계획과 관련된 약정의 적법성·강제성을 확인하여 지원을 실제 요구할 수 있는지 평가한다.','추가 계열사 채무를 부담한 새봄의 재무자료 등을 입수하여 필요한 자금을 제공할 재무능력을 평가한다. 단순 지원 의사 확인으로 대체하지 않는다.'],
refs=[['src-43f2f13c6e8997734d','src-3d8845cddb0c2ba942','src-53140ed862dddf7d9b'],['src-43f2f13c6e8997734d'],['src-43f2f13c6e8997734d','src-3d8845cddb0c2ba942','src-53140ed862dddf7d9b']],
partial='다른 계열사 채무도 부담하게 된 새봄의 재무자료를 입수하여 해든에 필요한 자금을 제공할 재무능력을 평가한다.',met=[3],wrong='같은 그룹이면 자금지원은 언제나 집행할 수 있으므로 긍정적으로 검토한다는 이메일만으로 약정과 자금능력이 입증된다.',
rationale='약정 존재·조건, 법적 효력, 재무능력은 독립된 증거대상이므로 각 1점이다. 단순 부적절 판단은 별도로 점수를 주지 않는다. 일반적인 미래계획 평가가 아니라 실제 제3자 지원의 증거를 요구한다.'),
dict(topics=['12'],facts=['fact3'],prompt='상황 가의 현재 주석에서 보완해야 할 내용을 설명하시오. 이미 기재된 현금유출·차입금 만기와 지원 추진 사실을 반복하지 말고, 지원계획의 상태 및 계속기업 관련 위험이 어떻게 드러나야 하는지 제시하시오. 감사의견의 종류는 다음 물음에서 다룬다.',
answers=['모회사의 지원조건이 아직 확정되지 않았다는 지원계획의 상태를 설명하여 경영진 계획이 적절히 공시되도록 보완한다.','해당 사건과 상황에 관하여 계속기업 존속능력에 유의적 의문을 초래할 수 있는 중요한 불확실성이 존재한다는 점을 명확히 공시한다.','따라서 정상적인 사업과정에서 자산을 회수하고 부채를 상환하지 못할 수 있다는 사실을 명확히 공시한다.'],
claims=['지원 추진이라는 기술에 그치지 않고 조건이 미확정이라는 계획의 상태를 적절히 공시하도록 보완한다.','주석에 계속기업 존속능력에 유의적 의문을 초래할 수 있는 중요한 불확실성의 존재를 명확히 공시하도록 한다.','그 불확실성으로 정상적인 사업과정에서 자산을 회수하고 부채를 상환하지 못할 수 있다는 재무적 의미를 주석에 명확히 공시하도록 한다.'],
refs=[['src-2e1fde91ebfe6b875d']]*3,
partial='지원조건이 아직 확정되지 않았다는 점을 주석에 보완한다.',met=[1],wrong='지원 추진계획을 적었으므로 주석은 충분하다. 미확정 상태나 계속기업 관련 불확실성은 주석에 적지 않아도 된다.',
rationale='계획 상태·중요한 불확실성·자산회수와 부채상환에 미칠 의미는 570.19의 독립 공시명제다. 이미 있는 현금유출과 만기 사실의 반복은 배점하지 않는다.'),
dict(topics=['12','15'],facts=['fact3','fact4'],prompt='보고 검토의 상황 가와 상황 나에서 각각 표명할 감사의견을 제시하고 그 이유를 설명하시오. 공시 누락과 감사증거 부족의 차이, 그리고 각 상황이 재무제표에 미치는 영향의 범위를 비교하여 답하시오. 감사보고서의 전체 문구나 별도 통지 절차는 작성하지 않는다.',
answers=['상황 가에서는 부적정의견을 표명한다.','충분한 증거로 확인한 중요한 불확실성의 공시가 누락되었고, 지원 미확정과 관련된 정보는 자산 회수·부채 상환을 이해하는 데 근본적이므로 중요한 동시에 전반적인 왜곡표시에 해당한다.','상황 나에서는 의견을 거절한다.','충분하고 적합한 자금지원 증거를 얻지 못한 문제이며, 발견되지 않은 왜곡표시가 있다면 그 영향이 자산 대부분과 주요 부채에 미쳐 중요하고 전반적일 수 있다. 실제 파산이나 계속기업전제의 부적합이 확정되었다는 이유로 부적정의견을 표명하는 상황과 다르다.'],
claims=['상황 가의 감사의견으로 부적정의견을 제시한다. 다른 의견을 명시하지 않고 중요하고 전반적인 공시왜곡 때문에 부적정의견을 표명한다는 결론이 명백히 함축되어도 인정한다.','상황 가는 충분한 증거로 확인한 불확실성의 공시 누락이며, 자산 회수·부채 상환 이해에 근본적인 누락이라 중요하고 전반적인 왜곡표시라는 이유를 설명한다.','상황 나의 감사의견으로 의견거절을 제시한다.','상황 나는 자금지원 증거를 끝내 확보하지 못하였고, 그 미발견왜곡표시의 가능한 영향이 자산 대부분·주요 부채에 걸쳐 중요하고 전반적일 수 있다는 이유를 설명한다. 부적합·파산 확정으로 바꾸지 않는다.'],
refs=[['src-9a64e7a75e5ee051b4','src-9d4ff7ee740ed7e523'],['src-fc35744e458b64dae9','src-9d4ff7ee740ed7e523'],['src-56c706b48bbd5c9e4e'],['src-56c706b48bbd5c9e4e','src-fc35744e458b64dae9']],
judgments=[1,3],partial='상황 가는 부적정의견, 상황 나는 의견거절이다.',met=[1,3],wrong='두 상황 모두 적정의견을 표명하고, 계속기업 문제는 감사의견에 영향을 주지 않는다고 설명하면 된다.',
rationale='서로 독립된 두 상황의 의견변형 원인을 구별한다는 하나의 비교목표에서 상황별 의견과 이유를 각 1점, 합계 4점으로 구별한다. 동일 사실에 여러 감사절차·의견·보고문구를 연쇄 요구하지 않고 각 상황을 두 문장으로 완성하므로 분리보다 비교구조를 유지한다. 가는 알려진 공시왜곡의 전반성, 나는 증거부족의 가능한 전반성이므로 반대 의견이 있어도 독립적으로 맞는 이유는 인정한다.')])
]

def selected_quote(uid):
 q=units[uid]['quote']
 if uid=='src-43f2f13c6e8997734d': return q.split('PDF PAGE 585')[0].rstrip()
 if uid=='src-52dfce196f620f4099': return q[q.index('(1) 기말감사업무'):q.index('• 답안근거')].rstrip()
 if uid=='src-a05d2d3b78915d6028': return q[q.index('(주)P 에게'):q.index('( 물음 2)')].rstrip()
 return q

def ref(uid):
 u=units[uid]
 return dict(id=uid,file=u['file'],title=f"{u.get('standard') or u['title']} {(u.get('paragraph')+(' 등록 원문 PDF '+str(u.get('page'))+'쪽' if u.get('page') is not None else ' 기존 등록 전사')) if u.get('paragraph') else ('원문 '+str(u.get('page'))+'쪽')}; L{u['startLine']}~L{u['endLine']}",page=u.get('standard') or f"원문 {u.get('page')}쪽",source_quote=selected_quote(uid),role='standard' if u.get('standard') else 'answer',content_hash=hashlib.sha256(selected_quote(uid).encode()).hexdigest())

sets=[];qa=[];reviews=[];designs=[]
for s in S:
 qs=[]
 for n,q in enumerate(s['qs'],1):
  qid=f'sub{n}'; reqs=[];criteria=[]
  for k,(claim,refs) in enumerate(zip(q['claims'],q['refs']),1):
   rid=f'{qid}.r{k}'; u=units[refs[0]]
   reqs.append(dict(id=rid,source_ref_id=refs[0],source_quote=selected_quote(refs[0]),source_span=f"{u['file']} L{u['startLine']}~L{u['endLine']}; 보충출처는 criterion.source_ref_ids와 design.json 참조"))
   isj=k in q.get('judgments',[])
   critical='근거나 조치가 결론을 명백히 함축하면 정해진 결론 문구 없이 판단을 인정한다. 명시적 반대 결론은 이 판단 점수를 주지 않는다. 다른 독립적으로 맞는 근거는 해당 criterion에서 인정한다.' if isj else '사례 사실을 답안의 행위·이유와 연결한다. 단순 명칭이나 사실 반복에는 점수를 주지 않으며 독립적으로 맞는 의미의 정수 점수는 유지한다.'
   criteria.append(dict(id=f'{qid}.c{k}',requirement_id=rid,claim=claim+' '+critical if isj else claim,critical_facts=[dict(id='application',type='condition',expected=claim.split('. ')[0])],max_points=1,scores=dict(met=1,not_met=0,contradicted=0),source_ref_ids=refs))
  qs.append(dict(id=qid,type='descriptive',question_style='case',topic_ids=q['topics'],prompt=q['prompt'],constraints=dict(ordered=False,max_entries=None,overflow_policy='none'),selection=dict(type='all',n=None),decision=None,model_answer=q['answers'],requirements=reqs,criteria=criteria))
  for kind in ['partial','wrong']:
   met=[f'{qid}.c{k}' for k in q['met']] if kind=='partial' else []
   qa.append(dict(set_id=s['id'],subquestion_id=qid,kind=kind,answer=q[kind],expected_points=len(met),met_criterion_ids=met,reason=('충족 criterion은 '+', '.join(met)+'이며 나머지 독립 명제는 없다.') if met else '모든 요구 명제에 반대하거나 요구한 증거·공시·의견을 대체하므로 0점이다.'))
  reviews.append(dict(set_id=s['id'],subquestion_id=qid,reviewer_id='agent:/root/next_cases_early',method='agent_content_review',human_review_performed=False,actual_model_grading='not_run',rationale=q['rationale'],point_decision=f"유지: 독립 의미단위 {len(criteria)}개에 각 1점. 부분정답 {len(q['met'])}점과 오답 0점을 출처·criterion에 대조.",max_points=len(criteria),fact_ids=q['facts'],question_style='case',topic_ids=q['topics'],minimal_sufficient_answer=q['answers'],checks={x:'pass' for x in ['fact_dependency','topic_alignment','prompt_answer_alignment','criterion_source_alignment','source_edition','integer_partial_credit','point_validity','representative_expectations']},unresolved_content_findings=[]))
 obj=dict(schema_version='3.0',id=s['id'],type='linked_question_set',status='needs_review',title=s['title'],classification=dict(topic_id=s['topic'],part='PART3',chapter=s['title'],domain='audit',standards=sorted({units[x].get('standard') for x in s['sources'] if units[x].get('standard')}),tags=s['tags']),source_refs=[ref(x) for x in s['sources']],shared_context=dict(facts=[dict(id=f'fact{i}',text=f,scoreable=False) for i,f in enumerate(s['facts'],1)]),learning_order=[q['id'] for q in qs],subquestions=qs,verification=dict(source_fidelity='reconstructed',review_status='needs_human_review',calculation_required=False,notes=['새로운 사례 사실을 재구성하였다. 공식 원문과 기존 문항 대조는 design.json을 따른다.','작성 agent의 내용 검토와 실제 Luna 채점·독립 검토·게시를 구별한다. 실제 채점은 상위 배치에서 진행한다.']))
 sets.append(obj)
 comparisons=[]
 for sid in s['compare']:
  existing=next(z for z in bank if z['id']==sid)
  comparisons.append(dict(set_id=sid,title=existing['title'],content_sha256=jsha(existing),questions=[dict(id=q['id'],prompt=q['prompt'],model_answer=q['model_answer'],points=sum(c['max_points'] for c in q['criteria']),criterion_ids=[c['id'] for c in q['criteria']]) for q in existing['subquestions']]))
 plan=dict(version=1,topic_id=s['topic'],mode='adapt_existing_question' if s['learning'] else 'new_from_standard',objective=s['title'],scope=dict(actors=['감사팀','사례에 명시한 경영진·거래처·법률고문 또는 자금지원자'],timing=['2026년 1월 1일 개시 재무제표에 대한 감사, 후속 확인과 보고는 2027년'],conditions=s['facts'],exceptions=['독립된 후속 상황은 이전 결론을 자동 승계하지 않는다. 고려 가능한 감사절차를 무조건 동시 수행의무로 바꾸지 않는다.'],required_answers=[f"{q['id']}: {q['prompt']}" for q in qs],exclusions=['금액 계산·표본 수 산정·발문이 제외한 후속 보고 또는 다른 절차는 요구하지 않는다.']),question_types=['descriptive'],source_unit_ids=list(dict.fromkeys(s['sources']+s['learning'])),existing_question_difference=s['difference'],edition_assumption='2026년 개시 보고기간에 대한 한국회계감사기준을 적용한다. 공식 2026 전문의 해당 본문·목록·예외를 등록 인용과 직접 대조하였다. 미래 시험판본을 확정하는 의미는 아니다.',unresolved_items=[],status='ready')
 ds=dict(set_id=s['id'],plan=plan,bank_sha256=sha(D/'bank-before.json'),source_catalog_sha256=sha(D/'source-catalog-final.json'),facts_chars=len('\n'.join(s['facts'])),compared_existing_sets=comparisons,fact_question_map=[dict(subquestion_id=f'sub{i}',fact_ids=q['facts']) for i,q in enumerate(s['qs'],1)],learning_source_comparison=[dict(source_unit_id=x,file=units[x]['file'],file_sha256=sha(ROOT/units[x]['file']),quote_sha256=units[x]['contentHash'],locator=units[x]['locator'],comparison='원발문·사례·해설을 실제 대조하였다. 세부 관계와 추가 목표는 existing_question_difference 및 coverage-proposals.json에 구별한다.',frequency_treatment='기출·모의·연습을 합산하지 않고 재수록은 추가 출제로 세지 않는다.') for x in s['learning']],official_edition_comparison=dict(file='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',file_sha256=sha(ROOT/'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt'),official_url='https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06',checked_at='2026-09-14',method='작성 agent가 해당 본문과 적용자료를 읽고 등록 인용의 요구·조건·예외를 직접 대조',ranges=[dict(start_line=a,end_line=b,locator=l,conclusion='사용한 정답 명제의 요구·조건·예외 동일. 각주 호출번호 차이는 정답 차이가 아니다.') for a,b,l in s['ranges']]),new_case_points=[dict(subquestion_id=f'sub{i}',points=len(q['claims']),decision='유지: 독립 의미단위마다 1점',rationale=q['rationale'],minimal_sufficient_answer=q['answers'],reasoning_burden='주어진 '+', '.join(q['facts'])+'의 정보를 적용하여 '+str(len(q['claims']))+'개 의미단위를 2~4문장으로 제시; 계산 없음.',similar_comparison=s['difference']) for i,q in enumerate(s['qs'],1)],source_evidence=[dict(source_unit_id=x,file=units[x]['file'],file_sha256=sha(ROOT/units[x]['file']),catalog_quote_sha256=units[x]['contentHash'],quote_sha256=hashlib.sha256(selected_quote(x).encode()).hexdigest(),selection_note='A16 본문만 선택하여 다음 A19의 PDF PAGE 585 색인을 제외함' if x=='src-43f2f13c6e8997734d' else ('물음에 관련된 해설 문단만 원문 부분문자열로 선택; 다른 물음의 계산표·배점 제외' if x in ['src-52dfce196f620f4099','src-a05d2d3b78915d6028'] else '카탈로그 단위 전체 인용'),authority=units[x]['authority'],start_line=units[x]['startLine'],end_line=units[x]['endLine'],standard=units[x].get('standard'),paragraph=units[x].get('paragraph'),quote_exact=True,current_official_comparison='공식 근거는 위 2026 대조 범위 참조. 학습 발문·해설은 적용 사례의 근거이며 공식 기준을 대체하지 않음.') for x in s['sources']])
 designs.append(ds)

write('sets.json',sets);write('qa.json',qa);write('review.json',reviews);write('design.json',designs)
files={u['file'] for s in S for x in s['sources']+s['learning'] for u in [units[x]]}
files.update(['cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt','cpa_uploader/drafts/case-applied-2026-09-14/bank-before.json','cpa_uploader/drafts/case-applied-2026-09-14/source-catalog-final.json','cpa_uploader/drafts/case-applied-2026-09-14/catalog-before.json','cpa_uploader/drafts/case-applied-2026-09-14/classification-before.json','cpa_uploader/analysis/question-elements/question-elements.json'])
write('source-files.json',[dict(file=f,sha256=sha(ROOT/f),role='comparison_snapshot' if 'before.json' in f else ('source_catalog_snapshot' if 'source-catalog-final.json' in f else ('analysis_discovery_index' if 'question-elements' in f else 'source_text')),read_method='직접 내용 대조 또는 카탈로그·은행 구조 읽기') for f in sorted(files)])
print([(s['id'],sum(len(f['text']) for f in s['shared_context']['facts']),sum(len(q['criteria']) for q in s['subquestions'])) for s in sets])
