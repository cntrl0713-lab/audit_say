"""Fresh read-only extraction of original official PDFs; output S03 only."""
from pathlib import Path
from pypdf import PdfReader
import re,json,hashlib
from datetime import datetime,timezone
B=Path(__file__).resolve().parent;R=B.parents[3];O=B/'sources';O.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
norm=lambda s:re.sub(r'\s+','',s)
paths={'2025':R/'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf','2026':R/'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf'}
ranges={'250':{'2025':(125,141),'2026':(150,166)},'501':{'2025':(389,398),'2026':(415,424)},'510':{'2025':(410,421),'2026':(436,447)},'610':{'2025':(633,653),'2026':(659,679)},'402':{'2025':(335,355),'2026':(361,381)}}
readers={ed:PdfReader(p) for ed,p in paths.items()};out={}
def clean(t):return '\n'.join(l for l in t.splitlines() if not re.match(r'^\s*감사기준서 \d+ [‘\u0027]',l) and not re.match(r'^\s*\d+ / \d+\s*$',l))
for st,ers in ranges.items():
 out[st]={}
 for ed,(a,z) in ers.items():
  pages={p:readers[ed].pages[p-1].extract_text() for p in range(a,z+1)}
  (O/f'kga{st}-{ed}-fresh-pages.txt').write_text('\n\n'.join(f'## PDF PAGE {p}\n{t}' for p,t in pages.items()),encoding='utf8',newline='\n')
  text='\n'.join(clean(t) for t in pages.values());ms=list(re.finditer(r'^(A?\d+)\.\s',text,re.M));blocks={}
  for i,m in enumerate(ms):
   p=m.group(1)
   if p in blocks:continue
   q=text[m.start():ms[i+1].start() if i+1<len(ms) else len(text)].strip()
   blocks[p]={'standard':st,'paragraph':p,'edition':ed,'quote':q,'quote_sha256':sha(q.encode()),'pdf_start_page':next((p for p,t in pages.items() if norm(q)[:35] in norm(t)),None)}
  out[st][ed]=blocks
result={'checked_at':datetime.now(timezone.utc).isoformat(),'method':'pypdf direct read; no PDF or shared file mutation','original_pdfs':[{'edition':ed,'file':str(p.relative_to(R)).replace('\\','/'),'sha256':sha(p.read_bytes())} for ed,p in paths.items()],'urls':{'2025':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06','2026':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06'},'download_revalidation':'Same agent N05 same-session official redownload hashes confirmed; S03 reuses originals read-only, not a separate new download.','blocks':out}
(O/'official-investigation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps({st:{ed:len(bs) for ed,bs in es.items()} for st,es in out.items()}))
