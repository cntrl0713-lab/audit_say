from pathlib import Path
import hashlib,json,difflib
B=Path(__file__).resolve().parent;O=B/'sources';D=json.loads((O/'official-investigation.json').read_text(encoding='utf-8'))
sha=lambda b:hashlib.sha256(b).hexdigest()
names={'540':'회계추정치와 관련 공시에 대한 감사','550':'특수관계자','620':'감사인측 전문가가 수행한 업무의 활용'}
proposals=[]
for ed in ['2025','2026']:
 parts=[f'확인일: 2026-09-11. 회계감사기준 {ed} 개정 전문의 직접 발췌. 적용판본은 총괄 정책과 문단별 시행일을 별도로 확인한다.',f'공식 URL: {D["official_urls"][ed]}',f'PDF SHA-256: {next(x["sha256"] for x in D["original_pdfs"] if x["edition"]==ed)}','원본 PDF를 pypdf로 새로 추출했다. 반복 페이지 머리말·꼬리말만 제외했고, 문단 중간 및 문단 말 각주는 보존했다. 문단 뒤 소제목이 포함될 수 있다. # 제목과 ## PDF PAGE는 작성자 색인이다.','2027 CPA 목표; 2026-01-01 개시 기본사례. 620 품질관리 관련 2026 정합 개정 시행은 별도 정책 확인 대상이다.']
 for st,blocks in D['blocks'].items():
  parts.extend(['',f'# KGA {st}: {names[st]}'])
  for p,block in blocks[ed].items():
   parts.extend(['',f'## PDF PAGE {block["pdf_start_page"]}',f'[{st}.{p}, {ed} 전문 물리쪽 시작]',block['quote']])
 f=O/f'official-excerpts-{ed}.txt';f.write_text('\n\n'.join(parts)+'\n',encoding='utf-8',newline='\n')
 proposals.append({'edition':ed,'candidate_file':str(f).replace('\\','/'),'sha256':sha(f.read_bytes()),'paragraphs':sum(len(v[ed]) for v in D['blocks'].values()),'proposed_registration':'cpa_uploader/data/official/delegated-n04-kga-'+ed+'.txt','registration_needed':ed=='2025','note':'2026 발췌는 판본 비교 증거다. 620 시행정책 확정 전 실제 답안용 등록필요 여부를 확정하지 않는다.' if ed=='2026' else '540.22/27/29,550.13/15/23,620.8/9의 신규 직접 공식 문단과 관련 문맥.'})
diff=[]
for row in D['comparisons']:
 if row['whitespace_normalized_equal']:continue
 st,p=row['standard'],row['paragraph'];a=D['blocks'][st]['2025'][p]['quote'];b=D['blocks'][st]['2026'][p]['quote'];diff.append({'standard':st,'paragraph':p,'diff':'\n'.join(difflib.unified_diff(a.splitlines(),b.splitlines(),fromfile='2025',tofile='2026',n=2))})
(O/'edition-differences.json').write_text(json.dumps(diff,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
(B/'source-registration-proposal.json').write_text(json.dumps({'package':'N04','owner_policy':'Root only writes data/official and shared catalogs; this script only prepares N04 files.','proposals':proposals,'original_pdfs':D['original_pdfs'],'comparison':'sources/official-investigation.json','differences':'sources/edition-differences.json','open_policy_issue':'2026 revised KGA220 conforming changes to620.8(e)/A11-A13 and related effective scope','existing_original_files_preserved':['cpa_uploader/data/official/kga540-550-2025-review11.txt','cpa_uploader/data/official/kga610-620-2025-review13.txt']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(proposals,ensure_ascii=False))
