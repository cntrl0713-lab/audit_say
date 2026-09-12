"""Preserve the direct official edition comparison; no API or shared mutation."""
import copy
import datetime
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

D = Path('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11')
E = D / 'efficient-verification-2026-09-12/a'
O = E / 'edition-250-followup-v1'
read = lambda p: json.loads(Path(p).read_text('utf8'))
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
rel = lambda p: str(p).replace('\\', '/')
def write(p, x):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(x, ensure_ascii=False, indent=2)+'\n', 'utf8')

historical = Path('cpa_uploader/drafts/delegated-authoring-2026-09-11/s03/sources/official-investigation.json')
inv = read(historical)
old_pdf = O/'kga-2023-full.pdf'
old_page = PdfReader(old_pdf).pages[106].extract_text()
norm = lambda s: re.sub(r'\s+', '', s)
comparison = []
for item in inv['original_pdfs']:
    assert sha(item['file']) == item['sha256']
    reader = PdfReader(item['file'])
    for n in ['14','15','16']:
        b = inv['blocks']['250'][item['edition']][n]
        page = reader.pages[b['pdf_start_page']-1].extract_text()
        body = re.sub(r'^'+n+r'\.\s*', '', b['quote'])
        assert norm(body) in norm(old_page)
        assert norm(b['quote']) in norm(page)
        comparison.append({'edition':item['edition'],'paragraph':n,'file':item['file'],'file_sha256':item['sha256'],'pdf_page':b['pdf_start_page'],'quote':b['quote'],'quote_sha256':b['quote_sha256'],'same_as_2023_body_except_whitespace_and_paragraph_number_punctuation':True})
overview = O/'kicpa-2022-overview.pdf'
overview_text = PdfReader(overview).pages[13].extract_text()
assert '2023년 1월 1일' in overview_text
dec = {'version':1,'reviewer':'agent','reviewer_agent':'plan_foundations','reviewed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'pass','set_id':'pilot-05-010','scope':'2027년 CPA 대비 중 명시한 2026-01-01 개시 보고기간에 적용하는 250.6/14~16. 시험 당국의 모든 판본 확정을 주장하지 않는다.','effective_date_evidence':{'official_notice_url':'https://www.kicpa.or.kr/board/read.brd?boardId=acc0102&bltnNo=11651558158726','posted_date':'2022-05-03','fsc_approval_date':'2022-04-27','overview_file':rel(overview),'overview_sha256':sha(overview),'paragraph':38,'pdf_page':14,'quote':'개정 회계감사기준은 2023년 1월 1일 이후 개시되는 보고기간의 재무제표에 대한 감사부터 시행된다.','visual_confirmation_file':rel(O/'overview-page14.png'),'visual_confirmation_sha256':sha(O/'overview-page14.png'),'250_amendment_scope':'같은 개요 문단26~28은 개정 ISA250 기반의 법규 고려 개정임을 명시한다. 문단28은 법규구분·유형별 고려·식별시 대응의 주요 요구사항이 변하지 않음을 설명한다.'},'2023_comparison':{'file':rel(old_pdf),'sha256':sha(old_pdf),'pdf_page':107,'placeholder_observation':'2023 전문106쪽 250.10에도 202X 표기가 남는다. 그 문구를 고치거나 X를 시행연도로 추측하지 않으며 별도 공식 개정 안내의 확정 시행일을 적용한다.'},'paragraph_comparisons':comparison,'meaning_review':'14의 직접영향 조항 준수증거,15의 중요한 기타법규 위반 식별 목적·경영진/적절시지배기구 질의·존재시 왕복문서 검사,16의 다른절차 중 의심을 포함한 주의가 세 판본에서 동일하다. 문항의 두 책임2점·절차와주의4점 및 예외를 유지할 수 있다.','raw_registration':'official-notice-acquisition.json/acquisition.json에 원 URL·해시를 보존했다. 소유권에 따라 총괄이 raw에 보존 사본과 매핑을 추가한다.','source_quote_or_official_file_mutation':False,'api_calls':0}
write(O/'decision.json',dec)
sources=[{'file':rel(p),'sha256':sha(p),'role':'official_download' if p.suffix in ['.pdf','.html'] else 'derived_extraction_or_page'}for p in sorted(O.iterdir())if p.is_file() and p.suffix in ['.pdf','.html','.txt','.png']]
write(O/'raw-registration-request.json',{'version':1,'files':sources,'acquisition_records':[rel(O/'acquisition.json'),rel(O/'official-notice-acquisition.json')],'preserve_original_paths':True,'api_calls':0})
m=read(D/'a/execution-all-v9/manifest.json');j=next(x for x in m['jobs']if x['set_id']=='pilot-05-010')
p=read(j['plan_file']);s=read(j['file']);before=copy.deepcopy(s)
addition='2026-09-12 후속 확인: KICPA 2022-05-03 개정 안내(게시물11651558158726), FSC 2022-04-27 승인, 개정 개요 문단26~28 및38/PDF14쪽에서 250 관련 개정과 2023-01-01 이후 개시 보고기간 시행을 확인했다. 공식2023 전문107쪽과 2025/2026의250.14~16은 번호 마침표·공백 외 본문이 동일하다. 따라서 이번2026-01-01 개시 가정에 해당 책임과 절차를 적용한다. 250.10의202X 원문은 그대로 보존하며 그 X를 추정해 시행일을 만드는 것이 아니다. 근거: '+rel(O/'decision.json')+' SHA256 '+sha(O/'decision.json')+'. 공식 PDF/URL/페이지/해시는 해당 근거에서 연결한다. 2027 시험공고 자체가 개별 판본을 지정했다는 뜻은 아니다.'
old_note=next(x for x in s['verification']['notes']if x.startswith('250.10'))
s['verification']['notes']=[addition if x==old_note else x for x in s['verification']['notes']]
plan_old=next(x for x in p['scope']['exceptions']if x.startswith('250.10'))
p['scope']['exceptions']=[addition if x==plan_old else x for x in p['scope']['exceptions']]
p['edition_assumption']=p['edition_assumption'].replace(plan_old,addition)
assert p['edition_assumption']!=read(j['plan_file'])['edition_assumption']
out=E/'content-followups-v1/pilot-05-010'
write(out/'question.json',s);write(out/'authoring-plan.json',p)
restore=copy.deepcopy(s);restore['verification']['notes']=before['verification']['notes'];assert restore==before
write(out/'remediation.json',{'version':1,'set_id':s['id'],'kind':'edition_evidence_metadata_only','before_file':j['file'],'before_sha256':j['sha256'],'after_file':rel(out/'question.json'),'after_sha256':sha(out/'question.json'),'before_plan_file':j['plan_file'],'before_plan_sha256':j['plan_sha256'],'after_plan_file':rel(out/'authoring-plan.json'),'after_plan_sha256':sha(out/'authoring-plan.json'),'old_note_preserved':old_note,'new_note':addition,'evidence':{'file':rel(O/'decision.json'),'sha256':sha(O/'decision.json')},'student_prompt_model_answer_criteria_points_shared_facts_source_refs_qa_unchanged':True,'qa_file_unchanged':j['qa_file'],'qa_sha256':j['qa_sha256'],'reason':'과거 미확인 상태를 후속 공식 확인으로 갱신한다. 원본과 과거 receipt는 보존하며 근거 없는 일반원칙 한정으로 판본 의문을 덮지 않는다.'})
notes=read(E/'reviewer-notes.json')
notes['pilot-05-010/sub1']='250.14·15의 직접영향 준수증거와 기타법규 중요위반 식별도움 절차의 목적2점이다. 유형정의는 발문에서 제공되어 미득점. 공식2022 개정 개요38의2023-01-01 시행과2023/2025/2026의14~16 본문 동일성을 별도 확인했으므로 이번2026 개시 가정에 적용한다. 250.10의202X 원문을 추정 교정하지 않는다.'
notes['pilot-05-010/sub2']+=' 2022 공식 개정 안내의 시행근거와2023·2025·2026 문단15~16의 조건·주체·본문 동일성을 대조했다.'
write(E/'reviewer-notes.json',notes)
print(json.dumps({'paragraph_comparisons':len(comparison),'decision_sha256':sha(O/'decision.json'),'question_sha256':sha(out/'question.json'),'plan_sha256':sha(out/'authoring-plan.json'),'raw_source_files':len(sources)},ensure_ascii=False))
