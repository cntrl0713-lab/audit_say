from pathlib import Path
import re,json,hashlib,html,urllib.request,xml.etree.ElementTree as ET
D=Path(__file__).parent; S=D/'sources'; B=Path('cpa_uploader/drafts/frequency-gap-2026-09-10/sources')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def pages(year):
 t=(B/f'kga-{year}-pymupdf-pages.txt').read_text(encoding='utf8')
 z=re.split(r'^## PDF page (\d+)\s*\n',t,flags=re.M)
 return {int(z[i]):z[i+1] for i in range(1,len(z),2)}
def paras(year,lo,hi):
 p=pages(year);whole='';mapping=[]
 for n in range(lo,hi+1):
  text=re.sub(r'^감사기준서[^\n]+\n','',p[n],flags=re.M)
  text=re.sub(r'^\s*\d+ / \d+\s*\n','',text,flags=re.M)
  start=len(whole);whole+=text+'\n';mapping.append((start,len(whole),n))
 ms=list(re.finditer(r'^(A?\d+)\.\s',whole,re.M));out={}
 for i,m in enumerate(ms):
  end=ms[i+1].start() if i+1<len(ms) else len(whole)
  out[m[1]]={'quote':whole[m.start():end].strip(),'pages':[n for a,b,n in mapping if b>m.start() and a<end]}
 return out
units=[];comparison=[]
for std,keys,a,b,off in [('1100',['4','10','39','40','41','43','44','A52','A53','A54','A55','A56','A57','A58','A59','A60','A61','A63','A64','A65','A66','A67','A68'],852,906,27),('1200',['2','3','5','8'],909,954,27)]:
 old=paras(2025,a,b);new=paras(2026,a+off,b+off)
 for k in keys:
  x=old[k];y=new[k]
  units.append(dict(standard=f'KGA {std}',paragraph=k,**x))
  same=re.sub(r'\s+','',x['quote'])==re.sub(r'\s+','',y['quote'])
  comparison.append(dict(standard=f'KGA {std}',paragraph=k,normalized_equal=same,old_pages=x['pages'],new_pages=y['pages'],old_quote=x['quote'],new_quote=y['quote']))
body=[]
for std in ['KGA 1100','KGA 1200']:
 body.append(f'# {std}: '+('내부회계관리제도의 감사' if std.endswith('1100') else '소규모기업 재무제표에 대한 감사'))
 for u in units:
  if u['standard']==std:body.extend([f"## PDF PAGE {u['pages'][0]}",u['quote']])
out=S/'official-kga1100-1200-proposed.txt';out.write_text('\n\n'.join(body)+'\n',encoding='utf8')
(S/'kga-edition-comparison.json').write_text(json.dumps({'units':comparison},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
text=(S/'interim-2015-text.txt').read_text(encoding='utf8');old=(S/'interim-2014-text.txt').read_text(encoding='utf8')
def interim(t):
 t=t[t.index('1. 이 준칙'):];t=t[:t.index('부칙')]
 matches=list(re.finditer(r'^(\d+)\.\s',t,re.M));return {m[1]:t[m.start():(matches[i+1].start() if i+1<len(matches) else len(t))].strip() for i,m in enumerate(matches)}
ip=interim(text);op=interim(old);ik=['1','7','8','9','19','20','36','46'];norm=lambda s:re.sub(r'[\s·ㆍ․]','',s)
ib=['# 분·반기재무제표 검토준칙: 금융위원회고시 제2015-20호']
for k in ik:ib.extend([f'## 문단 {k}',ip[k]])
(S/'official-interim-proposed.txt').write_text('\n\n'.join(ib)+'\n',encoding='utf8')
(S/'interim-edition-comparison.json').write_text(json.dumps({'2015_hwp_is_hwpml_xml':True,'2014_hwp_sha256':sha(S/'interim-2014.hwp'),'2015_hwp_sha256':sha(S/'interim-2015.hwp'),'units':[dict(paragraph=k,normalized_equal=norm(ip[k])==norm(op[k]),old_quote=op[k],new_quote=ip[k]) for k in ik]},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
proposal={'artifact_type':'official_source_registration_proposal','version':1,'status':'awaiting_root_registration','checked_at':'2026-09-11','items':[
 {'proposed_file':'cpa_uploader/data/official/delegated-s06-kga1100-1200-2025.txt','input_file':str(out).replace('\\','/'),'sha256':sha(out),'units':[{k:v for k,v in u.items() if k!='quote'} for u in units],'official_url':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06','pdf_file':str(B/'kga-2025.pdf').replace('\\','/'),'pdf_sha256':sha(B/'kga-2025.pdf'),'comparison_file':str(S/'kga-edition-comparison.json').replace('\\','/')},
 {'proposed_file':'cpa_uploader/data/official/delegated-s06-interim-2015.txt','input_file':str(S/'official-interim-proposed.txt').replace('\\','/'),'sha256':sha(S/'official-interim-proposed.txt'),'official_url':'https://www.fsc.go.kr/comm/getFile?srvcId=BBSTY1&upperNo=84640&fileTy=ATTACH&fileNo=1','landing_url':'https://www.fsc.go.kr/po040200/84640','original_file':str(S/'interim-2015.hwp').replace('\\','/'),'original_sha256':sha(S/'interim-2015.hwp'),'format':'HWPML XML; actual downloaded bytes are a valid HWPML document, not HTML error','effective':'2015-07-01, 금융위원회고시 제2015-20호(2015-06-30 타법개정);67의 재검토기한 개정','units':[{'standard':'분·반기재무제표 검토준칙','paragraph':k} for k in ik],'comparison_file':str(S/'interim-edition-comparison.json').replace('\\','/'),'note':'46 본문은 (46-1) 요약재무제표 예외도 연속 보존. 본문모델답안은 전체형식 중간재무제표 46(8)을 적용. 표제상 보론4가 언급되지만 2015파일에 보론4 전문은 없으며, KICPA2014 원본 보론4는 별도 문맥으로 제공.'}
]}
(D/'source-registration-proposal.json').write_text(json.dumps(proposal,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'kga_units':len(units),'kga_differences':[(x['standard'],x['paragraph']) for x in comparison if not x['normalized_equal']],'interim_units':len(ik),'interim_differences':[k for k in ik if norm(ip[k])!=norm(op[k])]},ensure_ascii=False))
