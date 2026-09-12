from pathlib import Path
import json,hashlib,re,difflib
B=Path(__file__).resolve().parent;D=json.loads((B/'sources/official-investigation.json').read_text(encoding='utf8'));S=json.loads((B/'sources/selected-paragraphs.json').read_text(encoding='utf8'));sha=lambda b:hashlib.sha256(b).hexdigest();norm=lambda s:re.sub(r'\s+','',s)
files=[];comparisons=[];diffs=[]
for ed in ['2025','2026']:
 lines=[f'# S03 KGA {ed} 공식 전문 직접 발췌',f'원문 URL: {D["urls"][ed]}',f'원 PDF SHA-256: {next(x["sha256"] for x in D["original_pdfs"] if x["edition"]==ed)}','발췌일: 2026-09-11','PDF에서 pypdf로 직접 추출. 반복 머리말·페이지분모만 제거하며 공식 문구·각주는 교정하지 않음.','2027 CPA 대비 사례설계용. 250.10의202X를 미확정으로 보존하며 임의 시행연도로 대체하지 않음.','']
 for st,ps in S.items():
  lines.append(f'# KGA {st}: '+{'250':'재무제표감사에서 법률과 규정의 고려','501':'감사증거-특정 항목에 대한 구체적인 고려사항','510':'초도감사-기초잔액','610':'내부감사인이 수행한 업무의 활용','402':'서비스조직을 이용하는 기업에 관한 감사 고려사항'}[st]);last=None
  for p in ps:
   b=D['blocks'][st][ed][p]
   if not b['pdf_start_page']:raise ValueError(st+'.'+p+' page missing')
   if last!=b['pdf_start_page']:lines.append(f'## PDF PAGE {b["pdf_start_page"]}');last=b['pdf_start_page']
   lines += [b['quote'],'']
 text='\n'.join(lines).rstrip()+'\n';f=B/f'official-excerpts-{ed}.txt';f.write_text(text,encoding='utf8',newline='\n');files.append({'edition':ed,'file':str(f.relative_to(B)),'sha256':sha(f.read_bytes()),'paragraphs':sum(map(len,S.values()))})
for st,ps in S.items():
 for p in ps:
  a=D['blocks'][st]['2025'][p];z=D['blocks'][st]['2026'][p];equal=norm(a['quote'])==norm(z['quote']);comparisons.append({'standard':st,'paragraph':p,'equal_ignoring_whitespace':equal,'2025':{k:a[k] for k in ['pdf_start_page','quote_sha256']},'2026':{k:z[k] for k in ['pdf_start_page','quote_sha256']}})
  if not equal:diffs.append({'standard':st,'paragraph':p,'diff':'\n'.join(difflib.unified_diff(a['quote'].splitlines(),z['quote'].splitlines(),fromfile='2025',tofile='2026',lineterm=''))})
(B/'sources/edition-comparison.json').write_text(json.dumps({'comparisons':comparisons,'different':diffs},ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
(B/'source-registration-proposal.json').write_text(json.dumps({'artifact_type':'official_source_registration_proposal','package':'S03','source_candidate':files[0],'comparison_only':files[1],'requested_target':'cpa_uploader/data/official/delegated-s03-kga-2025.txt','authority':'official_transcription','original_evidence':'sources/official-investigation.json','edition_note':'250.10 retains202X; no effective-year inference. Other basic2026period criteria follow parent edition-policy.','registration_owner':'root','standards':list(S),'paragraphs':S,'units':98,'unchanged_whitespace':sum(c['equal_ignoring_whitespace'] for c in comparisons),'different':len(diffs)},ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps({'files':files,'equal':sum(c['equal_ignoring_whitespace'] for c in comparisons),'diff':len(diffs)},ensure_ascii=False))
