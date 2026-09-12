from pathlib import Path
import re,json,hashlib
b=Path(__file__).resolve().parent
norm=lambda x:re.sub(r'\s+','',x)
pages={}
for ed in ['2025','2026']:
 p=re.split(r'## PDF page (\d+)\n',(b/f'sources/pdf-{ed}-selected-pages.txt').read_text(encoding='utf-8'))
 pages[ed]={int(p[i]):norm(p[i+1]) for i in range(1,len(p),2)}
refs={r['id']:r for f in ['pilot-14-006.json','pilot-14-007.json'] for r in json.loads((b/f).read_text(encoding='utf-8'))['source_refs']}
rows=[]
for id,r in refs.items():
 q=norm(r['source_quote']);result={}
 for ed,ps in pages.items():
  # First and last text establish the narrow physical-page range. Full-text fidelity is independently checked.
  locator_q=q.replace('검토업무기준21','검토업무기준22') if ed=='2026' and id=='std-A52' else q
  start=[p for p,t in ps.items() if locator_q[:38] in t]
  end=[p for p,t in ps.items() if locator_q[-38:] in t]
  start=min(start) if start else None
  end=min([p for p in end if start is None or p>=start],default=None)
  result[ed]=list(range(start,end+1)) if start and end else []
 rows.append({'source_ref_id':id,'paragraph':id.removeprefix('std-'),'quote_sha256':hashlib.sha256(r['source_quote'].encode()).hexdigest(),'pdf_pages':result})
(b/'sources/quote-locators.json').write_text(json.dumps({'method':'Leading/trailing exact text locators in fresh pypdf extracts, separate from full-text comparison','rows':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps([r for r in rows if not all(r['pdf_pages'].values())],ensure_ascii=False))
