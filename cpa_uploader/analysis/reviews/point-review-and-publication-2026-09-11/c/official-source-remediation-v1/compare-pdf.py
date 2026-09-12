import json, re, hashlib
from pathlib import Path
from pypdf import PdfReader

out=Path('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/official-source-remediation-v1')
e=json.loads((out/'stage-evidence.json').read_text(encoding='utf8'))
master=Path(e['source_file']).read_text(encoding='utf8')
reader=PdfReader(e['source_pdf'])
norm=lambda s:re.sub(r'\s+','',s)
pages=sorted({p for x in e['extracts'] for p in range(x['pdf_pages'][0],x['pdf_pages'][1]+1)})
extracted={p:reader.pages[p-1].extract_text() for p in pages}
results=[]
for p in pages:
 match=re.search(r'(?im)^## PDF page '+str(p)+r'\s*\n(.*?)(?=^## PDF page |\Z)',master,re.S|re.M)
 results.append({'physical_page':p,'normalized_page_exact':norm(match[1])==norm(extracted[p]),'independent_text_sha256':hashlib.sha256(extracted[p].encode()).hexdigest()})
paragraphs=[]
for x in e['extracts']:
 q=re.sub(r'(?im)^## PDF page \d+\s*\n','',x['quote'])
 actual='\n'.join(extracted[p] for p in range(x['pdf_pages'][0],x['pdf_pages'][1]+1))
 paragraphs.append({'standard':x['standard'],'paragraph':x['paragraph'],'normalized_paragraph_contained_in_independent_pdf':norm(q) in norm(actual)})
record={'method':'pypdf 6.10.0 direct local PDF extraction, compared independently with saved PyMuPDF extract; whitespace ignored only for comparison, no original/staged source edits','pdf_sha256':e['pdf_sha256'],'pages':results,'paragraphs':paragraphs,'all_pass':all(x['normalized_page_exact'] for x in results) and all(x['normalized_paragraph_contained_in_independent_pdf'] for x in paragraphs),'real_api_calls':0}
(out/'pdf-comparison-evidence.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(record,ensure_ascii=False,indent=2))
