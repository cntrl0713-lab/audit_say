from pathlib import Path
import re,json
base=Path('cpa_uploader/drafts/frequency-gap-2026-09-10/sources')
for file in base.glob('*pymupdf-pages.txt'):
    chunks=re.split(r'(?im)^## PDF page (\d+)\s*$',file.read_text(encoding='utf8'))
    pages={int(chunks[i]):chunks[i+1] for i in range(1,len(chunks),2)}
    result={s:[n for n,text in pages.items() if re.search(r'감사기준서\s+'+s+r'\s+[‘\x27]',text[:170])] for s in ['450','520','530','580']}
    print(json.dumps({'file':file.name,'pages':result}))
