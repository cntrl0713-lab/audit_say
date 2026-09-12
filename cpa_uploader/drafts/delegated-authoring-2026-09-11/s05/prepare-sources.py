from pathlib import Path
from pypdf import PdfReader
from datetime import datetime, timezone
import hashlib, json, re

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[3]
OUT = BASE / 'sources'
OUT.mkdir(parents=True, exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
norm = lambda s: re.sub(r'\s+', '', s)
specs = {
    '600': {'title':'그룹재무제표 감사', 'pages':{'2025':(590,620),'2026':(616,646)}, 'paras':['7','9','21','22','23','A42','A43','A44','A45','A46']},
    '700': {'title':'재무제표에 대한 의견형성과 보고', 'pages':{'2025':(674,701),'2026':(701,728)}, 'paras':['6','20','21','22','23','24','25','46','47','48','49','A61','A62','A63','A64','A65','A66','A67','A68','A69']},
    '701': {'title':'감사보고서 핵심감사사항 커뮤니케이션', 'pages':{'2025':(722,740),'2026':(749,767)}, 'paras':['6','14','15','16','17','18']+['A'+str(n) for n in range(52,65)]},
    '705': {'title':'감사의견의 변형', 'pages':{'2025':(742,757),'2026':(769,784)}, 'paras':['4','16','17','18','19','28','29','A26']},
}
pdfs = {'2025':'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf', '2026':'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf'}
urls = {'2025':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06', '2026':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06'}
editions = {}
for edition, pdf in pdfs.items():
    reader = PdfReader(ROOT / pdf)
    entries = []
    for standard, spec in specs.items():
        first,last = spec['pages'][edition]
        full = []
        page_text = {}
        for p in range(first,last+1):
            t = reader.pages[p-1].extract_text()
            page_text[str(p)] = t
            for line in t.splitlines():
                if re.match(r'^\s*감사기준서 '+standard+r' [‘\u0027]',line) or re.match(r'^\s*\d+ / \d+\s*$',line): continue
                full.append((p,line))
        (OUT/f'kga{standard}-{edition}-pages.json').write_text(json.dumps(page_text,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        starts = [(i,re.match(r'^\s*(A?\d+)\.\s*',line).group(1)) for i,(_,line) in enumerate(full) if re.match(r'^\s*(A?\d+)\.\s*',line)]
        for para in spec['paras']:
            matches = [(j,i) for j,(i,num) in enumerate(starts) if num==para]
            if len(matches)!=1: raise RuntimeError(f'{edition}/{standard}/{para}: {matches}')
            j,i = matches[0]
            end = starts[j+1][0] if j+1<len(starts) else len(full)
            body='\n'.join(line for _,line in full[i:end]).strip()
            pages=sorted(set(p for p,_ in full[i:end]))
            entries.append({'standard':'KGA '+standard,'paragraph':para,'pages':pages,'quote':body,'quote_sha256':sha(body.encode())})
    editions[edition]={'pdf_file':pdf,'pdf_sha256':sha((ROOT/pdf).read_bytes()),'url':urls[edition],'entries':entries}
    content = f'확인일: 2026-09-11. 공식 {edition} 전문에서 pypdf로 직접 추출. 반복 페이지 머리말·꼬리말만 제외하고 각주·다음 소제목은 보존했다.\n공식 URL: {urls[edition]}\nPDF SHA-256: {editions[edition]["pdf_sha256"]}\n# 제목과 PDF PAGE는 탐색용 색인이다. 기본 사례 2026-01-01 개시, 2027 CPA 목표.\n'
    for standard,spec in specs.items():
        content += '\n# KGA '+standard+': '+spec['title']+'\n'
        for e in entries:
            if e['standard']!='KGA '+standard: continue
            content += '\n## PDF PAGE '+str(e['pages'][0])+'\n\n'+e['quote']+'\n'
    (OUT/f'official-excerpts-{edition}.txt').write_text(content,encoding='utf-8')
comparisons=[]
for old in editions['2025']['entries']:
    new=next(e for e in editions['2026']['entries'] if (e['standard'],e['paragraph'])==(old['standard'],old['paragraph']))
    comparisons.append({'standard':old['standard'],'paragraph':old['paragraph'],'same_ignoring_whitespace':norm(old['quote'])==norm(new['quote']),'old_pages':old['pages'],'new_pages':new['pages']})
(OUT/'official-comparison.json').write_text(json.dumps({'created_at':datetime.now(timezone.utc).isoformat(),'editions':editions,'comparisons':comparisons,'actual_model_calls':0},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'paragraphs':len(comparisons),'differences':[x for x in comparisons if not x['same_ignoring_whitespace']]},ensure_ascii=False))
