"""Extract original PDFs into N04 only; propose a new registered official excerpt."""
from pathlib import Path
from pypdf import PdfReader
from datetime import datetime,timezone
import hashlib,json,re
B=Path(__file__).resolve().parent;R=B.parents[3];O=B/'sources';O.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest();norm=lambda s:re.sub(r'\s+','',s)
pdfs={'2025':R/'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf','2026':R/'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf'}
configs={
 '540':{'pages':(446,508),'paras':['9','10','11','18','22','23','24','25','26','27','28','29','30','A94']+[f'A{i}' for i in range(109,126)]},
 '550':{'pages':(510,534),'paras':['8','13','14','15','16','21','22','23']+[f'A{i}' for i in range(11,15)]+[f'A{i}' for i in range(22,28)]+[f'A{i}' for i in range(38,42)]},
 '620':{'pages':(655,673),'paras':['1','2','3','4','5','6','8','9','10','11','12','13']+[f'A{i}' for i in range(10,23)]+[f'A{i}' for i in range(32,40)]}
}
readers={ed:PdfReader(p) for ed,p in pdfs.items()};edblocks={};output=[];comparisons=[]
def clean(text):
 return '\n'.join(line for line in text.splitlines() if not re.match(r'^\s*감사기준서 \d+ [‘\u0027]',line) and not re.match(r'^\s*\d+ / \d+\s*$',line))
for standard,cfg in configs.items():
 edblocks[standard]={}
 for ed,reader in readers.items():
  start,end=cfg['pages'];shift=0 if ed=='2025' else 26
  pages={p:reader.pages[p-1].extract_text() for p in range(start+shift,end+shift+1)}
  (O/f'kga{standard}-{ed}-fresh-pages.txt').write_text('\n\n'.join(f'## PDF PAGE {p}\n{t}' for p,t in pages.items()),encoding='utf-8',newline='\n')
  joined='\n'.join(clean(t) for t in pages.values())
  matches=list(re.finditer(r'^(A?\d+)\.\s',joined,re.M)); blocks={}
  for i,m in enumerate(matches):
   p=m.group(1)
   if p not in cfg['paras'] or p in blocks:continue
   text=joined[m.start():matches[i+1].start() if i+1<len(matches) else len(joined)].strip()
   # Page footnotes remain visible in the fresh extraction. Isolate paragraph before unrelated next heading later.
   prefix=norm(text)[:36]
   startpage=next((p for p,t in pages.items() if prefix in norm(t)),None)
   blocks[p]={'standard':standard,'paragraph':p,'quote':text,'pdf_start_page':startpage,'quote_sha256':sha(text.encode())}
  missing=[p for p in cfg['paras'] if p not in blocks]
  if missing:raise ValueError((ed,standard,missing))
  edblocks[standard][ed]=blocks
 for p in cfg['paras']:
  a=edblocks[standard]['2025'][p];z=edblocks[standard]['2026'][p]
  output.append(a)
  comparisons.append({'standard':standard,'paragraph':p,'2025':{'pdf_start_page':a['pdf_start_page'],'quote_sha256':a['quote_sha256']},'2026':{'pdf_start_page':z['pdf_start_page'],'quote_sha256':z['quote_sha256']},'whitespace_normalized_equal':norm(a['quote'])==norm(z['quote'])})
result={'checked_at':datetime.now(timezone.utc).isoformat(),'official_urls':{'2025':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06','2026':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06'},'original_pdfs':[{'edition':ed,'file':str(p.relative_to(R)).replace('\\','/'),'sha256':sha(p.read_bytes())} for ed,p in pdfs.items()],'download_revalidation':'../n05/sources/official-comparison.json; same agent same session official re-download hashes confirmed; original PDFs reused read-only','extractor':'pypdf fresh original-PDF extraction','comparisons':comparisons,'blocks':edblocks}
(O/'official-investigation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
(O/'blocks-2025.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'blocks':len(output),'different':[r['standard']+'.'+r['paragraph'] for r in comparisons if not r['whitespace_normalized_equal']]},ensure_ascii=False))
