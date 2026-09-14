"""잔존 기준서형 10물음의 새 수동 검수·대표답안. 은행 및 문제 원문은 변경하지 않는다."""
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

B = Path(__file__).resolve().parent
ROOT = B.parents[3]
sets = {s['id']:s for s in json.loads((B/'bank.snapshot.json').read_text(encoding='utf-8-sig'))}
required = json.loads((B/'subset-regrade-required.json').read_text(encoding='utf-8-sig'))['sets']
catalog = json.loads((B/'catalog.snapshot.json').read_text(encoding='utf-8-sig'))['classifications']
classifications = {c['source_set_id']+'/'+c['subquestion_id']:c for c in catalog}
pdf_path = 'cpa_uploader/raw/materials/verification/59020bf1eba001c1/kga-2026-full.pdf'
pdf_hash = hashlib.sha256((ROOT/pdf_path).read_bytes()).hexdigest()
assert pdf_hash == '59020bf1eba001c1fd0612f3af1098dbef4ca11dc22777b7266c80d39a615f84'
pdf = PdfReader(ROOT/pdf_path)
norm = lambda s: re.sub(r'\s+','',s)
R = []

def add(sid,qid,full,partial,met,wrong,paragraphs,pages,anchors,note):
    s=sets[sid]
    q=next(q for q in s['subquestions'] if q['id']==qid)
    cl=classifications[sid+'/'+qid]
    assert cl['question_style']=='standard' and cl['case_fact_ids']==[] and cl['standalone_prompt']==q['prompt']
    assert 0<len(met)<len(q['criteria']) and len(met)==len(set(met))
    assert all(0<=i<len(q['criteria']) for i in met)
    source_ids={i for c in q['criteria'] for i in c['source_ref_ids']}|{r['source_ref_id'] for r in q['requirements']}
    refs=[r for r in s['source_refs'] if r['id'] in source_ids]
    ref_checks=[]
    for r in refs:
        source_file=ROOT/r['file']
        source_text=source_file.read_text(encoding='utf-8-sig')
        quote=r['source_quote'].replace('\r\n','\n')
        assert quote in source_text.replace('\r\n','\n'),(sid,r['id'])
        ref_checks.append(f"{r['id']} {r['file']} (파일 SHA-256 {hashlib.sha256(source_file.read_bytes()).hexdigest()}, 인용 SHA-256 {hashlib.sha256(r['source_quote'].encode()).hexdigest()}, 줄바꿈 정규화 후 원문 일치)")
    for page,quote in anchors:
        assert norm(quote) in norm(pdf.pages[page-1].extract_text()),(sid,page,quote)
    source_review=(f'2026-09-14 담당 agent가 현 발문·저장 모범답안·전체 {len(q["criteria"])}개 criterion와 critical_facts 및 모든 연결 requirement/source_ref를 직접 읽고 대조하였다. '
       f'한국공인회계사회 2026 개정 전문 {paragraphs}, 원본 PDF {pages}쪽 본문·조건·주변 문단을 직접 확인하였다. 원본 {pdf_path}, SHA-256 {pdf_hash}. '
       'raw/collections/2026-09-11-initial/manifest.json의 원본 계보·공식 다운로드 URL 및 2026-09-14 보존 공식 목록의 2026 전문 게시번호 11786004332051과 연결된 원본이다. '
       '등록 출처의 인용과 원본의 해당 의미가 일치하며 원래 발문·답안·배점은 변경하지 않는다. 저장된 원 model_answer 배열을 모든 criterion와 실제 대조하여 만점에 충분함을 확인했고 실제 채점에는 원 배열을 그대로 제공한다. 연결 출처 확인: '+'; '.join(ref_checks)+'. '
       f'새 대표답안의 만점은 {len(q["criteria"])}점, 부분정답은 원 criterion 순서의 {met}만 충족하여 {len(met)}점, 오답은 모든 기준에 0점이다. '+note+
       ' 이는 이번의 새 agent 의미검수 및 기대값이며 실제 Luna 채점이나 과거 검수 계승을 뜻하지 않는다.')
    # full은 담당자가 원모범의 의미를 다시 풀어 쓴 수동 검토 기록이다.
    # 실측용 출력은 검토로 충분성을 확인한 원저장 배열을 바이트 내용 그대로 사용한다.
    assert full and all(isinstance(t,str) and t for t in full)
    R.append(dict(set_id=sid,subquestion_id=qid,model_answer=q['model_answer'],partial_answer=partial,partial_met=met,wrong_answer=wrong,source_review=source_review))

add('pilot-02-002','sub2',
 ['개별 감사기준서의 목적을 달성할 수 없으면 전반적인 목적 미달성으로 감사의견을 변형해야 하는지, 관련 법규상 가능한 경우 감사업무를 해지해야 하는지 평가한다. 목적 미달성은 감사기준서 230에 따라 문서화해야 하는 유의적 사항이다.'],
 '개별 감사기준서의 목적을 달성하지 못한 것은 감사기준서 230에 따라 문서화해야 하는 유의적 사항이다.',[2],
 '개별 기준서의 목적 미달성은 사소한 사항이므로 감사의견이나 업무 유지에 미칠 영향을 평가하지 않고 문서화도 하지 않는다.',
 'KGA 200.24 및 230.8(c) 참조','12',[(12,'관련 법규상 가능한 경우'),(12,'문서화가 요구되는 유의적 사항')],
 '법규상 가능한 경우의 해지 여부를 평가하는 것이며 자동 해지로 바꾸지 않았다. 문서화만 답한 부분답에는 의견·해지 평가가 함축되지 않는다.')

add('pilot-06-004','sub1',
 ['평가된 중요왜곡표시위험 중 유의적 위험이 있는지 결정한다. 경영진주장 수준의 중요왜곡표시위험 중 실증절차만으로 충분하고 적합한 감사증거를 제공할 수 없는 위험이 있는지도 결정한다.'],
 '경영진주장 수준의 중요왜곡표시위험 중 실증절차만으로 충분하고 적합한 감사증거를 제공할 수 없는 위험이 있는지 결정한다.',[1],
 '위험을 영업위험과 감사보수 회수위험으로만 나누며 유의적 위험 여부와 실증절차만으로 증거를 얻을 수 없는 위험은 판단하지 않는다.',
 'KGA 315.32~33','229',[(229,'평가된 중요왜곡표시위험 중에서 유의적 위험이 있는지 결정하여야 한다.'),(229,'실증절차만으로는 충분하고 적합한 감사증거를 제공할 수 없는 위험이 있는지 결정하여야 한다.')],
 '두 범주는 동일한 위험집단이 아니다. 실증절차만으로 증거가 부족한 위험을 서술한 것으로 유의적 위험 존재 결정까지 자동 충족시키지 않는다.')

add('pilot-09-001','subq1',
 ['당기 말 재고자산 잔액에 대한 감사절차는 보고기간 개시일에 보유한 재고자산에 관해서는 거의 증거를 제공하지 않으므로 기초재고에 대한 추가 절차가 필요할 수 있다. 추가 절차로도 기초잔액에 관한 충분하고 적합한 감사증거를 입수할 수 없다면 감사기준서 705에 따라 상황에 적합하게 한정의견을 표명하거나 의견을 거절한다.'],
 '당기 말 재고자산 잔액에 대한 감사절차는 기초에 보유하던 재고자산에 관하여 거의 증거를 제공하지 않는다.',[0],
 '당기 말 재고실사 결과는 기초재고에 대해서도 언제나 완전한 증거가 되며, 기초잔액 증거를 입수하지 못하더라도 무조건 적정의견을 표명한다.',
 'KGA 510.A6·10 및 A8','439·441',[(441,'기초에 보유 중인 재고자산에 대하여는 거의 증거를 제공하지 아니한다.'),(439,'적합하게 한정의견을 표명하거나 재무제표에 대한 의견을 거절하여야 한다.')],
 '기초잔액의 증거 미입수(문단10)와 기초잔액 왜곡표시 발견(문단11)을 구분했다. 보고조치의 구체 대안 열거가 없는 첫 한계 설명만의 부분답은1점이다.')

add('pilot-10-001','subq1',
 ['이탈 또는 왜곡표시를 구성하는 것이 무엇인지 정의하고 표본감사에 사용할 모집단을 정의한다. 표본이 도출된 모집단이 완전하다는 증거를 입수하기 위한 감사절차를 수행한다.'],
 '표본이 도출된 모집단이 완전하다는 증거를 입수하기 위한 감사절차를 수행한다.',[2],
 '표본설계에서는 허용이탈률만 정하면 되고 이탈·왜곡표시와 이용할 모집단의 정의 및 모집단 완전성 검증은 하지 않는다.',
 'KGA 530.A5','460',[(460,'이탈 또는 왜곡표시를 구성하는 것이 무엇이며 표본감사를 위해 어떤 모집단을 이용할 것인지 정의'),(460,'표본이 도출된 모집단이 완전하다는 증거를 입수하기 위한 감사절차를 수행한다.')],
 '이탈·왜곡표시의 정의와 모집단 정의는 별도 행위이고, 완전성 증거를 얻는다는 말만으로 모집단 정의를 완료했다는 점수를 주지 않는다.')

add('pilot-10-005','sub2',
 ['추가 절차를 통해 변이로 밝혀진 왜곡표시는 모집단에 투영할 때 제외한다. 다만 그 변이왜곡표시가 수정되지 않았다면 변이가 아닌 왜곡표시의 투영값에 해당 변이왜곡표시를 가산하여 그 효과를 고려한다.'],
 '변이로 밝혀진 왜곡표시는 모집단에 투영할 때 제외한다.',[0],
 '변이로 밝혀진 왜곡표시도 다른 왜곡표시와 똑같이 모집단으로 확대 투영하고, 수정되지 않은 변이의 실제 금액은 효과 평가에서 무시한다.',
 'KGA 530.A19 및 13의 변이 확인 조건','459·462',[(462,'왜곡표시를 모집단으로 투영할 때 이 왜곡표시는 제외될 것이다.'),(462,'변이가 아닌 왜곡표시의 투영값에 가산하여 그 왜곡표시의 효과를 고려할 필요가 있을 것이다.'),(459,'추가적인 감사절차를 수행함으로써')],
 '변이로 밝혀졌다는 조건은 이미 발문에 있다. 투영 제외는 미수정 변이의 효과까지 무시하라는 의미가 아니며 두 처리를 구별한다.')

add('pilot-11-002','sub2',
 ['경영진 판단과 결정이 개별적으로 합리적이어도 편의가능성 징후의 평가를 생략할 수 없다. 개별 계정에서는 드러나지 않던 편의가 추정치의 집합이나 전체 또는 여러 회계기간을 관찰할 때 한 방향으로 나타날 수 있으므로, 개별적인 합리성만으로 중립성이 확보되었다고 볼 수 없다.'],
 '개별적으로 합리적인 판단과 결정이라도 경영진 편의가능성 징후의 평가를 생략할 수 없다.',[0],
 '각 추정치가 개별적으로 합리적이면 전체 추정치나 여러 회계기간에서도 편의가 존재할 수 없으므로 편의가능성 평가는 생략한다.',
 'KGA 540.32·A133·A134 후반','481·521–522',[(481,'개별적으로는 합리적일지라도, 경영진의 편의가능성을 나타내는 징후인지를 평가하여야 한다.'),(521,'회계추정치의 집합이나 모든 회계추정치 전체를 고려할 때 또는 다수의 회계기간에 걸쳐 관찰할 때'),(522,'편의가능성 징후 자체가 개별 회계추정치의 합리성에 대한 결론을 도출하기 위한 목적상 왜곡표시에 해당되지는 않는다.')],
 '집합·다기간 관찰의 올바른 근거는 판단까지 함축할 수 있으므로 그 근거만의 답안을1점으로 설정하지 않았다. 선택한 부분답은 판단만 제시하고 구체 근거는 생략하여1점이다. 징후 자체를 확정 왜곡표시로 바꾸지 않았다.')

add('pilot-13-001','sub1',
 ['내부감사기능의 업무를 활용하더라도 외부감사인의 표명된 감사의견에 대한 전적인 책임은 경감되지 않는다. 감사인측 전문가의 업무를 활용하는 경우에도 그 전적인 책임은 경감되지 않는다.'],
 '내부감사기능의 업무를 활용해도 표명된 감사의견에 대한 외부감사인의 전적인 책임은 경감되지 않는다.',[0],
 '내부감사기능을 활용한 부분의 감사의견 책임은 내부감사인에게, 감사인측 전문가를 활용한 부분의 책임은 전문가에게 이전되어 외부감사인의 책임이 줄어든다.',
 'KGA 610.11·620.3','661·681',[(661,'그러한 책임은 내부감사기능'),(681,'그러한 책임은 감사인측 전문가의 업무를 활용하였다고 하더라도 경감되지 아니한다.')],
 '각 활용대상을 별도 기준으로 확인했다. 부분답은 내부감사기능만 명시하여 전문가 활용에 대한 일반적 함축을 피했다. 국내 직접적 보조 허용 여부는 이번 발문의 요구가 아니다.')

add('pilot-16-002','sub1',
 ['중요왜곡표시위험이 더 높게 평가되거나 유의적 위험으로 식별된 분야를 고려한다. 높은 추정불확실성을 가진 회계추정치를 포함하여 유의적 경영진 판단이 수반된 재무제표 분야와 관련된 유의적 감사인 판단을 고려한다. 보고기간 중 발생한 유의적 사건이나 거래가 감사에 미치는 영향도 고려한다.'],
 '높은 추정불확실성을 가진 회계추정치를 포함하여 유의적 경영진 판단이 수반된 재무제표 분야와 관련된 유의적 감사인 판단을 고려한다.',[1],
 '유의적 감사인 주의는 감사보수, 감사팀 인원수와 보고서 인쇄비만 고려하여 결정한다.',
 'KGA 701.9(a)~(c)','749–750',[(749,'중요왜곡표시위험이 더 높게 평가되거나 유의적 위험으로 식별된 분야'),(750,'유의적 경영진판단이 수반된 재무제표 분야와 관련되는 유의적감사인판단'),(750,'보고기간 중 발생한 유의적인 사건이나 거래가 감사에 미치는 영향')],
 '경영진의 판단 자체와 그 분야에 관련된 감사인의 유의적 판단을 구별했다. 높은 추정불확실성은 해당 판단 분야의 내용이며 위험이 더 높게 평가되었다는 별도 판정까지 함축하지 않는다.')

add('pilot-17-003','sub2',
 ['설계효과성은 제시된 전제 아래 통제가 기업의 통제목적을 충족할 수 있는지, 재무제표의 중요한 왜곡표시를 초래할 수 있는 부정이나 오류로 인한 왜곡표시를 효과적으로 예방하거나 발견·수정할 수 있는지 결정한다. 운영효과성은 통제가 설계된 대로 실제 운영되는지, 수행자가 효과적 수행에 필요한 권한을 갖추었는지, 필요한 적격성을 갖추었는지 각각 결정한다.'],
 '운영효과성 테스트에서는 통제가 설계된 대로 실제 운영되는지와 통제 수행자가 효과적으로 수행하는 데 필요한 권한을 갖추었는지 결정한다.',[2,3],
 '설계효과성은 통제 문서의 페이지 수로, 운영효과성은 수행자의 근속연수만으로 결정하며 통제목적·왜곡표시 대응능력·설계대로의 운영·권한·적격성은 판단하지 않는다.',
 'KGA 1100.37~38','889',[(889,'해당 통제가 기업의 통제목적을 충족하고'),(889,'효과적으로 예방하거나 발견∙수정할 수 있는지 여부'),(889,'통제가 설계된 대로 운영되는지 여부와 통제를 수행하는 사람이 통제를 효과적으로 수행하는데 필요한 권한과 적격성을 갖추었는지 여부')],
 '설계의 권한·적격성 전제는 발문에 이미 있어 다시 써야 할 추가점수로 삼지 않았다. 운영효과성에서 실제 권한과 적격성을 검증하는 두 요건은 별개이며 부분답에는 적격성이 없다.')

add('pilot-18-001','subq1',
 ['KGA 1200에서 정한 소규모기업에 해당하지 않으면 KGA 1200을 적용할 수 없다. 그 기업의 일반목적 재무제표 감사에는 KGA 200부터 KGA 720까지의 일반 감사기준서를 적용한다.'],
 'KGA 1200을 적용할 수 없다.',[0],
 '소규모기업에 해당하지 않더라도 KGA 1200을 적용할 수 있고 일반 감사기준서는 적용하지 않는다.',
 'KGA 1200.3','936',[(936,'소규모기업에 해당하지 않는 기업의 재무제표 감사에 적용할 수 없다.'),(936,'일반 감사기준서')],
 '적용 불가의 판단과 적용할 대체 기준을 별개로 확인했다. 일반 감사기준서라는 명칭이 명확하면 번호 열거는 추가 필수요건이 아니다. 부분답은 대체 기준을 제시하지 않는다.')

expected={(x['set_id'],q) for x in required for q in x['retained_subquestion_ids']}
assert {(x['set_id'],x['subquestion_id']) for x in R}==expected and len(R)==10
assert sum(len(next(q for q in sets[r['set_id']]['subquestions'] if q['id']==r['subquestion_id'])['criteria']) for r in R)==26
for row in R:
    original=next(q for q in sets[row['set_id']]['subquestions'] if q['id']==row['subquestion_id'])
    assert row['model_answer']==original['model_answer']
result={'version':1,'reviewed_at':'2026-09-14','reviewer':'Codex agent /root/review_11_14',
        'bank_snapshot_sha256':hashlib.sha256((B/'bank.snapshot.json').read_bytes()).hexdigest(),
        'scope':'잔존10물음의 원모범답안·26기준 전수 의미대조 및 새 부분정답·0점답안 작성. 역사적 검수 계승이 아닌 새 agent 검수.',
        'original_model_answer_arrays_preserved':True,'original_model_answers_sufficient_for_all_criteria':True,
        'connected_source_quotes_checked':15,'actual_model_calls_performed_here':False,'remaining_content_issues':[],
        'questions':R}
(B/'subset-regrade-representatives.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('10 retained questions / 26 criteria / 30 natural-language grading answers; all connected source quotes and official PDF anchors checked.')
