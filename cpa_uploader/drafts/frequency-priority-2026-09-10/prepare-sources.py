"""Preserve bounded official excerpts and their PDF/page provenance for this batch."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import urllib.request
import io
import zipfile
from concurrent.futures import ThreadPoolExecutor

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
CACHE = ROOT / 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources'
OUT = BASE / 'sources'
OUT.mkdir(exist_ok=True)
sha = lambda value: hashlib.sha256(value).hexdigest()
norm = lambda value: re.sub(r'\s+', '', value)
def pages(file):
    parts = re.split(r'## PDF page (\d+)\n', file.read_text(encoding='utf-8'))
    return {int(parts[i]): parts[i+1] for i in range(1, len(parts), 2)}
old, new = pages(CACHE/'kga-2025-pymupdf-pages.txt'), pages(CACHE/'kga-2026-pymupdf-pages.txt')
def clean_page(text):
    return '\n'.join(line for line in text.splitlines()
        if not re.match(r'^\s*감사기준서 \d+ ', line)
        and not re.match(r'^\s*\d+ / \d+\s*$', line)
        and not re.match(r'^\s*5 감사기준서 580 ', line)).strip()
def excerpt(first, last, start, end):
    text = '\n'.join(clean_page(old[p]) for p in range(first, last+1))
    a = re.search(start, text, re.M)
    if not a: raise ValueError(start)
    b = re.search(end, text[a.end():], re.M)
    if not b: raise ValueError(end)
    return text[a.start():a.end()+b.start()].strip()

specs = [
 ('320.2',305,305,r'^2\.',r'^3\.'),
 ('320.A6',310,310,r'^A6\.',r'^A7\.'),
 ('501.5',391,391,r'^5\.',r'^6\.'),
 ('501.A9',394,394,r'^A9\.',r'^A10\.'),
 ('505.A5',405,405,r'^A5\.',r'^A6\.'),
 ('505.13',403,403,r'^13\.',r'^불일치사항'),
 ('530.appendix2-1',439,439,r'^1\. 감사인이',r'^2\. 허용'),
 ('530.appendix2-4',439,440,r'^4\. 모집단의',r'^5\. 모집단의'),
 ('530.appendix3-2',441,441,r'^2\. 동일한',r'^3\. 모집단의'),
 ('530.appendix3-5',442,442,r'^5\. 모집단에서',r'^6\. 적절한'),
 ('560.11',537,537,r'^11\.',r'^12\.'),
 ('560.12',537,538,r'^12\.',r'^13\.'),
 ('560.A13',543,543,r'^A13\.',r'^경영진이 재무제표를 수정하지'),
 ('570.19',551,551,r'^19\.',r'^사건이나 상황이 식별되었으나'),
 ('570.22',552,552,r'^22\.',r'^23\.'),
 ('570.23',552,552,r'^23\.',r'^24\.'),
]
blocks = {}
for key,first,last,start,end in specs:
    quote = excerpt(first,last,start,end)
    matching = []
    exact = False
    comparison = 'whitespace_and_page_headers_only'
    for p,t in new.items():
        if key.split('.')[0] not in t[:100]: continue
        span=list(range(p,p+last-first+1))
        if not all(n in new for n in span): continue
        newer='\n'.join(clean_page(new[n]) for n in span)
        if norm(quote) in norm(newer): matching,exact=span,True; break
        if key=='570.23' and norm(quote).replace('감사기준서7054에','감사기준서705에') in norm(newer).replace('감사기준서7055에','감사기준서705에'):
            matching,exact=span,True
            comparison='same_body_with_KGA705_footnote_renumbered_4_to_5'
            break
    blocks[key] = {'standard': 'KGA '+key.split('.')[0], 'paragraph': key.split('.',1)[1],
        'pdf_pages_2025': list(range(first,last+1)), 'pdf_pages_2026': matching,
        'quote': quote, 'quote_sha256': sha(quote.encode()), 'normalized_2026_match': exact,
        'comparison_normalization':comparison}

# Opinion boundaries are already in the official domestic excerpt; retain its exact quote.
bank = json.loads((ROOT/'cpa_uploader/data/cpa_question_sets_v3.authoring.json').read_text(encoding='utf-8-sig'))
opinion = next(s for s in bank if s['id']=='pilot-15-003')
for ref in opinion['source_refs']:
    if ref['id'] in {r for c in opinion['subquestions'][0]['criteria'] for r in c['source_ref_ids']}:
        key='705.'+ref['id']
        blocks[key]={'standard':'KGA 705','paragraph': ref.get('title',ref.get('page')),
            'quote':ref['source_quote'],'quote_sha256':sha(ref['source_quote'].encode()),
            'inherited_from_file':ref['file'],'inherited_ref':ref['id'],
            'normalized_2026_match':norm(ref['source_quote']) in norm('\n'.join(clean_page(t) for t in new.values()))}

urls = {
 '2025':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06',
 '2026':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06',
}
def check_download(edition):
    file=CACHE/('kga-2025.pdf' if edition=='2025' else 'kga-2026-full.pdf')
    record={'edition':edition,'official_url':urls[edition], 'cached_file':file.relative_to(ROOT).as_posix(),
            'cached_pdf_sha256':sha(file.read_bytes()), 'checked_at':datetime.now(timezone.utc).isoformat()}
    try:
        data=urllib.request.urlopen(urllib.request.Request(urls[edition],headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read()
        record.update(download_sha256=sha(data), bytes=len(data))
        pdf_data = data
        if zipfile.is_zipfile(io.BytesIO(data)):
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                matches = [(name,archive.read(name)) for name in archive.namelist() if name.lower().endswith('.pdf')]
                match = next(((name,body) for name,body in matches if sha(body)==record['cached_pdf_sha256']), None)
                if match is None: raise ValueError('Official archive has no PDF matching cached edition')
                record['archive_member'], pdf_data = match
        record.update(pdf_header=pdf_data.startswith(b'%PDF'), official_pdf_sha256=sha(pdf_data))
        record['download_matches_cache']=record['pdf_header'] and record['official_pdf_sha256']==record['cached_pdf_sha256']
    except Exception as error: record['download_error']=str(error)
    return record
if (OUT/'provenance.json').exists():
    downloads=json.loads((OUT/'provenance.json').read_text(encoding='utf-8'))['downloads']
    for item in downloads:
        if sha((ROOT/item['cached_file']).read_bytes())!=item['cached_pdf_sha256']: raise ValueError('Cached PDF changed')
else:
    with ThreadPoolExecutor(max_workers=2) as pool: downloads=list(pool.map(check_download,urls))
for item in downloads:
    if 'download_matches_cache' in item and not item['download_matches_cache']: raise ValueError(item)

official = '# 한국공인회계사회 회계감사기준: 빈도 우선 보완 초안의 근거\n\n'
official += '기준: 2025 개정 전문의 해당 문단. 2026 개정 전문의 대응 문단 대조 결과는 provenance.json에 별도 기록한다. 특정 미래 시험의 적용 판본 확정이 아니다.\n'
official += '\n'.join(f'{y} 공식 URL: {url}' for y,url in urls.items())+'\n'
official += 'PDF 원문의 줄바꿈·표 셀 추출 순서는 유지하고 페이지 머리말·꼬리말 및 문단 사이의 각주를 제거해 연결했다. 제목과 대괄호 위치 표시는 작성자 색인이다.\n\n'
for standard in dict.fromkeys(b['standard'] for b in blocks.values()):
    official += f'# {standard}: 공식 문단 발췌\n\n'
    for key,b in blocks.items():
        if b['standard']==standard: official+=f'[{key}; PDF {b.get("pdf_pages_2025", "별도 공식 발췌 참조")}]\n{b["quote"]}\n\n'
(OUT/'official-excerpts.txt').write_text(official,encoding='utf-8',newline='\n')
(OUT/'blocks.json').write_text(json.dumps(blocks,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUT/'provenance.json').write_text(json.dumps({'downloads':downloads,'blocks':{k:{a:v for a,v in b.items() if a!='quote'} for k,b in blocks.items()}},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'download_checks':downloads,'paragraphs':len(blocks),'comparison_pending':[k for k,b in blocks.items() if not b['normalized_2026_match']]},ensure_ascii=False))
