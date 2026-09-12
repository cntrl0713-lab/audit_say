"""Preserve the first extraction check and explain six locator/footnote differences."""
from pathlib import Path
import hashlib,json,re
BASE=Path(__file__).resolve().parent/'sources'
data=json.loads((BASE/'official-comparison.json').read_text(encoding='utf-8'))
norm=lambda x:re.sub(r'\s+','',x)
clean=lambda t:'\n'.join(x for x in t.splitlines() if not re.match(r'^\s*(?:감사기준서 600 [‘\u0027]|\d+ / \d+|## PDF page)',x))
pages={ed:clean((BASE/f'pdf-{ed}-selected-pages.txt').read_text(encoding='utf-8')) for ed in ['2025','2026']}
fixes={
 '24':('다.9','다.10','600.24의 330 인용각주가 9에서 10으로 이동; 쪽 중간 각주본문은 비교에서 별도로 제거한다.'),
 'A35':('평가함19','평가함20','모니터링 시스템 문장 뒤 각주 19→20. 문장 본문 변화 없음.'),
 'A37':('19품질관리기준서1','20품질관리기준서1','직전 A35의 각주가 A37 페이지 중간에 포함됨. 그 각주 번호 19→20 외 문장 변화 없음.'),
 'A52':('검토업무기준21','검토업무기준22','검토업무기준 각주 21→22. 검토업무 수행 조건 변화 없음.'),
 'A54':('21“재무제표','22“재무제표','직전 A52 각주 본문 번호 21→22. 비유의적 부문에서 경미한 우려에 따른 관여 예시 변화 없음.')}
resolutions=[]
for r in data['comparisons']:
 p=r['paragraph']
 if all(x['exact_normalized_match'] for x in r['editions'].values()): continue
 q=r['quote']; checked=q
 if p=='A47':
  checked=q[:q.index('보여주고 있다.')+len('보여주고 있다.')]
  note='카탈로그 A47 단위에는 다음 도표의 일부 추출문자가 붙어 있어 2쪽 창에서 전체가 일치하지 않음. A47 본문만 원문 그대로 한정하여 비교했고, 도표는 별도 PNG로 확인한다.'
 elif p in fixes: note=fixes[p][2]
 else: raise ValueError(p)
 results={}
 for ed,t in pages.items():
  n=norm(t);nq=norm(checked)
  if p=='24':
   n=re.sub(r'(?:9|10)감사기준서330「?\(?“?평가된위험에대한감사인의대응[”」\)]*','',n)
  if ed=='2026' and p in fixes:n=n.replace(fixes[p][1],fixes[p][0])
  results[ed]={'after_explicit_adjustment_match':nq in n}
 resolutions.append({'paragraph':p,'note':note,'checked_source_quote':checked,'checked_quote_sha256':hashlib.sha256(checked.encode()).hexdigest(),'editions':results})
(BASE/'comparison-resolutions.json').write_text(json.dumps({'first_pass':'official-comparison.json','resolutions':resolutions,'meaning':'Numbering and extraction-context reconciliation only. Original source/PDF bytes unchanged; latest PDF not declared wholesale identical.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps([{'paragraph':r['paragraph'],'editions':r['editions']} for r in resolutions],ensure_ascii=False))
