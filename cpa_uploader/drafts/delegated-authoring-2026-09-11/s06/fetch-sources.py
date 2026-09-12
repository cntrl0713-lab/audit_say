from pathlib import Path
import urllib.request,json,hashlib,re
D=Path(__file__).parent/'sources';D.mkdir(parents=True,exist_ok=True)
urls={
'fsc-interim-2015.html':'https://www.fsc.go.kr/po040200/84640',
'kicpa-interim-list.html':'https://www.kicpa.or.kr/board/list.brd?boardId=acc1401',
'interim-2014.hwp':'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc1401&bltnNo=11501851835462&fileSeq=1&subId=sub06',
'external-audit-law.html':'https://www.law.go.kr/법령/주식회사등의외부감사에관한법률',
}
from urllib.parse import quote
out=[]
for name,url in urls.items():
 try:
  req=urllib.request.Request(quote(url,safe=':/?=&'),headers={'User-Agent':'Mozilla/5.0'})
  with urllib.request.urlopen(req,timeout=40) as r: data=r.read(); final=r.url; content=r.headers.get('Content-Type')
  (D/name).write_bytes(data)
  out.append(dict(file=name,url=url,final_url=final,content_type=content,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
 except Exception as e:out.append(dict(file=name,url=url,error=str(e)))
(D/'download-manifest-initial.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(out,ensure_ascii=False))
