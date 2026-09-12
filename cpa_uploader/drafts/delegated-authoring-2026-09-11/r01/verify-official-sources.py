"""Read original PDFs and official downloads; write only this R01 evidence folder."""
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from pypdf import PdfReader
import hashlib, io, json, re, urllib.request, zipfile

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[3]
OLD = ROOT / 'cpa_uploader/drafts/frequency-priority-2026-09-10'
OUT = BASE / 'sources'
OUT.mkdir(parents=True, exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
norm = lambda s: re.sub(r'\s+', '', s)
provenance = json.loads((OLD / 'sources/provenance.json').read_text(encoding='utf-8'))
blocks = json.loads((OLD / 'sources/blocks.json').read_text(encoding='utf-8'))

def check_download(item):
    cached = ROOT / item['cached_file']
    result = {'edition': item['edition'], 'official_url': item['official_url'], 'cached_file': item['cached_file'],
              'cached_sha256': sha(cached.read_bytes()), 'checked_at': datetime.now(timezone.utc).isoformat()}
    try:
        data = urllib.request.urlopen(urllib.request.Request(item['official_url'], headers={'User-Agent':'Mozilla/5.0'}), timeout=40).read()
        result.update(download_sha256=sha(data), downloaded_bytes=len(data))
        if zipfile.is_zipfile(io.BytesIO(data)):
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                match = next(((name, archive.read(name)) for name in archive.namelist()
                              if name.lower().endswith('.pdf') and sha(archive.read(name)) == result['cached_sha256']), None)
                if match is None: raise ValueError('No archive member matches the cached PDF')
                result['archive_member'], data = match
        result.update(pdf_header=data.startswith(b'%PDF'), official_pdf_sha256=sha(data), download_matches_cache=sha(data)==result['cached_sha256'])
    except Exception as error:
        result['download_error'] = str(error)
    return result

with ThreadPoolExecutor(max_workers=2) as pool:
    downloads = list(pool.map(check_download, provenance['downloads']))
readers = {item['edition']: PdfReader(ROOT / item['cached_file']) for item in provenance['downloads']}
pages = {}
selected_2026 = {1,332,416,427,457,561,574}
for block in blocks.values():
    selected_2026.update(block.get('pdf_pages_2026', []))
for edition, reader in readers.items():
    selected = selected_2026 if edition == '2026' else {p for block in blocks.values() for p in block.get('pdf_pages_2025', [])}
    pages[edition] = {p: reader.pages[p-1].extract_text() for p in sorted(selected)}
    (OUT / f'pdf-{edition}-selected-pages.txt').write_text('\n\n'.join(f'## PDF page {p}\n{text}' for p,text in pages[edition].items()), encoding='utf-8', newline='\n')

comparisons = []
for key, block in blocks.items():
    if not block.get('pdf_pages_2025'): continue
    quote = block['quote']
    results = {}
    for edition in ['2025','2026']:
        target = '\n'.join(pages[edition][p] for p in block[f'pdf_pages_{edition}'])
        target = '\n'.join(line for line in target.splitlines() if not re.match(r'^\s*감사기준서 \d+ ',line)
                           and not re.match(r'^\s*\d+ / \d+\s*$',line)
                           and not re.match(r'^\s*5 감사기준서 580 ',line))
        nquote, ntarget = norm(quote), norm(target)
        if key == '570.23':
            nquote = nquote.replace('감사기준서7054에','감사기준서705에')
            ntarget = ntarget.replace('감사기준서7055에','감사기준서705에').replace('감사기준서7054에','감사기준서705에')
        results[edition] = {'pdf_pages':block[f'pdf_pages_{edition}'], 'quote_in_fresh_pdf_extraction': nquote in ntarget}
    comparisons.append({'key':key,'quote_sha256':sha(quote.encode()),'normalization':'whitespace; page headers/footers; 570.23 KGA705 footnote 4/5 only','editions':results})

effective = []
for standard, paragraph, page in [('320','7',332),('501','2',416),('505','4',427),('530','3',457),('560','3',561),('570','8',574)]:
    text = pages['2026'][page]
    start = text.find('시행일')
    end = text.find('목적',start)
    quote = text[start:end if end > start else len(text)].strip()
    effective.append({'standard':'KGA '+standard,'paragraph':paragraph,'pdf_page':page,'quote':quote,'quote_sha256':sha(quote.encode()),
                      'scope':'2026-01-01 이후 개시 보고기간. 570.8의 20/A24-A25 예외는 별도 보존하며 R01의 22/23에 전용하지 않음.'})
result = {'artifact_type':'r01_official_source_investigation','created_at':datetime.now(timezone.utc).isoformat(),
          'downloads':downloads,'fresh_extractor':'pypdf PdfReader.pages[].extract_text()',
          'comparisons':comparisons,'effective_dates':effective,
          'limitations':['추출 순서가 다른 표/페이지는 이미지 확인 후 별도 기록한다. 불일치를 자동으로 본문 변경으로 단정하지 않는다.',
                         '2027 시험 공고가 특정 판본을 지정했는지는 총괄 정책에서 별도로 확인한다.']}
(OUT/'official-comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'downloads':[{'edition':x['edition'],'matches':x.get('download_matches_cache'),'error':x.get('download_error')} for x in downloads],
                  'paragraphs':len(comparisons),'extraction_unmatched':[x['key'] for x in comparisons if not all(v['quote_in_fresh_pdf_extraction'] for v in x['editions'].values())]},ensure_ascii=False))
