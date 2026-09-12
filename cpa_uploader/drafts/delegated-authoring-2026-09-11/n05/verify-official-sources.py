"""Read original official PDFs; write only N05 source investigation evidence."""
from pathlib import Path
from pypdf import PdfReader
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib, io, json, re, urllib.request, zipfile
BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[3]
OUT=BASE/'sources'
sha=lambda b:hashlib.sha256(b).hexdigest()
norm=lambda s:re.sub(r'\s+','',s)
catalog=json.loads((OUT/'catalog-snapshot.json').read_text(encoding='utf-8'))
provenance=json.loads((ROOT/'cpa_uploader/drafts/frequency-priority-2026-09-10/sources/provenance.json').read_text(encoding='utf-8'))
selected={'7','9','19','20','21','22','23','24','26','27','28','29','30','42','A32','A33','A34','A35','A36','A37','A38','A39','A40','A41','A43','A44','A45','A46','A47','A48','A49','A50','A51','A52','A53','A54','A55'}
units=[u for u in catalog['units'] if u['paragraph'] in selected]
def download(item):
    data=urllib.request.urlopen(urllib.request.Request(item['official_url'],headers={'User-Agent':'Mozilla/5.0'}),timeout=50).read()
    result={k:item[k] for k in ['edition','official_url','cached_file']}
    result.update(download_sha256=sha(data),checked_at=datetime.now(timezone.utc).isoformat())
    if zipfile.is_zipfile(io.BytesIO(data)):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            name=next(n for n in z.namelist() if n.lower().endswith('.pdf') and sha(z.read(n))==item['cached_pdf_sha256'])
            result['archive_member']=name
            data=z.read(name)
    result.update(pdf_sha256=sha(data),cache_match=sha(data)==sha((ROOT/item['cached_file']).read_bytes()))
    return result
with ThreadPoolExecutor(max_workers=2) as pool: downloads=list(pool.map(download,provenance['downloads']))
pages={}
for item in downloads:
    edition=item['edition']; reader=PdfReader(ROOT/item['cached_file'])
    first,last=(590,621) if edition=='2025' else (616,647)
    pages[edition]={p:reader.pages[p-1].extract_text() for p in range(first,last+1)}
    (OUT/f'pdf-{edition}-selected-pages.txt').write_text('\n\n'.join(f'## PDF page {p}\n{t}' for p,t in pages[edition].items()),encoding='utf-8',newline='\n')
def clean(t):
    return '\n'.join(line for line in t.splitlines() if not re.match(r'^\s*감사기준서 600 [‘\u0027]',line) and not re.match(r'^\s*\d+ / \d+\s*$',line))
comparisons=[]
for u in units:
    q=u['quote']; editions={}
    for edition,pg in pages.items():
        # Locate the complete quote in one/two consecutive pages after only headers/footers/whitespace removal.
        matches=[]
        for p in pg:
            if norm(q) in norm(clean(pg[p])): matches=[p];break
            if p+1 in pg and norm(q) in norm(clean(pg[p])+'\n'+clean(pg[p+1])): matches=[p,p+1];break
        editions[edition]={'pdf_pages':matches,'exact_normalized_match':bool(matches)}
    comparisons.append({'paragraph':u['paragraph'],'source_unit_id':u['id'],'quote_sha256':sha(q.encode()),'quote':q,'editions':editions})
result={'artifact_type':'n05_official_source_comparison','created_at':datetime.now(timezone.utc).isoformat(),'downloads':downloads,
 'source_file':catalog['source']['file'],'source_file_sha256':sha((ROOT/catalog['source']['file']).read_bytes()),
 'normalization':'Whitespace and recurring page header/footer only; no wording/footnote changes silently accepted.',
 'comparisons':comparisons,'policy':'2027 CPA target; 2026-01-01 commencing reporting period. Domestic KGA 600.7 and full text; revised international ISA 600 is not presumed adopted in Korea.',
 'official_listing':'https://www.kicpa.or.kr/board/list.brd?boardId=acc0102','listing_checked_date':'2026-09-11',
 'listing_observation':'Latest official list contains 2026 complete standards and revised KGA 220 notice. No separate domestic revised KGA 600 commencement notice obtained in this investigation; absence of search result is not proof no notice can exist.'}
(OUT/'official-comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'downloads':[{k:r[k] for k in ['edition','cache_match']} for r in downloads],'comparisons':len(comparisons),'unmatched':[{k:r[k] for k in ['paragraph','editions']} for r in comparisons if not all(x['exact_normalized_match'] for x in r['editions'].values())]},ensure_ascii=False))
