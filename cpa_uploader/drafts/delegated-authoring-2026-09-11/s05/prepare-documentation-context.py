from pathlib import Path
from pypdf import PdfReader
import re, hashlib, json

base=Path(__file__).resolve().parent
root=base.parents[3]
outputs={}
for edition,pdf,first,last in [('2025','kga-2025.pdf',71,77),('2026','kga-2026-full.pdf',96,104)]:
    file=root/'cpa_uploader/drafts/frequency-gap-2026-09-10/sources'/pdf
    reader=PdfReader(file)
    lines=[]
    for page in range(first,last+1):
        for line in reader.pages[page-1].extract_text().splitlines():
            if re.match(r'^\s*감사기준서 230 ',line) or re.match(r'^\s*\d+ / \d+\s*$',line):continue
            lines.append((page,line))
    starts=[(i,m.group(1)) for i,(_,line) in enumerate(lines) if (m:=re.match(r'^\s*(A?\d+)\.\s*',line))]
    entries=[]
    for para in ['8','A6']:
        found=[(j,i) for j,(i,num) in enumerate(starts) if num==para]
        if len(found)!=1:raise ValueError((edition,para,found))
        j,i=found[0];end=starts[j+1][0]
        quote='\n'.join(line for _,line in lines[i:end]).strip()
        entries.append({'paragraph':para,'page':lines[i][0],'quote':quote,'quote_sha256':hashlib.sha256(quote.encode()).hexdigest()})
    outputs[edition]={'file':str(file.relative_to(root)).replace('\\','/'),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'entries':entries}
result={'editions':outputs,'comparisons':[{'paragraph':a['paragraph'],'same_ignoring_whitespace':re.sub(r'\s+','',a['quote'])==re.sub(r'\s+','',b['quote'])} for a,b in zip(outputs['2025']['entries'],outputs['2026']['entries'])]}
(base/'sources/documentation-context-comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
body='확인일: 2026-09-11. 공식 2025/2026 전문을 직접 추출하여 대조. 701.18 각주와 A64의 주변 문맥이며 S05의 별도 득점 요구가 아니다.\n공식 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06\nPDF SHA256: '+outputs['2025']['sha256']+'\n# KGA 230: 감사문서\n'
for e in outputs['2025']['entries']:body+='\n## PDF PAGE '+str(e['page'])+'\n\n'+e['quote']+'\n'
(base/'sources/documentation-context-2025.txt').write_text(body,encoding='utf8')
print(json.dumps(result['comparisons'],ensure_ascii=False))
