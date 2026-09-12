from pathlib import Path
import json,re,hashlib,html,urllib.request
B=Path(__file__).parent;S=B/'sources'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def clean(x):return html.unescape(re.sub('<[^>]+>','',x)).strip()
url='https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1027658225'
p=S/'capital-market-law-159.html'
if not p.exists():p.write_bytes(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read())
raw=(S/'external-audit-law-view.html').read_text(encoding='utf8');ps=re.findall(r'<p\b[^>]*>.*?</p>',raw,re.S)
lawtext='\n'.join(clean(x) for x in ps if clean(x))
(S/'external-audit-law-text.txt').write_text(lawtext+'\n',encoding='utf8')
selected={}
for n in [2,4,9,11]:
 m=re.search(r'^제'+str(n)+r'조\(',lawtext,re.M)
 end=re.search(r'^제\d+조(?:의\d+)?\(',lawtext[m.end():],re.M)
 selected[str(n)]=lawtext[m.start():m.end()+end.start() if end else len(lawtext)].strip()
capitaltext=clean(re.sub(r'</(p|div|h\d)>','\n',p.read_text(encoding='utf8')))
(S/'capital-market-law-159-text.txt').write_text(capitaltext+'\n',encoding='utf8')
c159=re.search(r'제159조\(사업보고서 등의 제출\).*?(?=②)',capitaltext,re.S)[0].strip()
interim=(S/'interim-2014-text.txt').read_text(encoding='utf8');start=interim.index('<보론 4>');end=interim.index('<보론 5>',start)
annex=interim[start:end].strip()
(S/'interim-2014-annex4.txt').write_text(annex+'\n',encoding='utf8')
legal_context=('보충 법률 대조(득점명제 추가 아님). 확인일2026-09-11. 외부감사법은 현행 공식 law.go.kr 시행2025-04-01/법률20896호를 확인했고1200.2의 법적 인용인2조3·4호,4조1항2호,9조1항3호,11조1항을 대조했다. 11조2항은 별도 주기적지정이므로1200.2의1항을 모든 지정으로 확대하지 않는다. 자본시장법159조1항은 현행 시행2026-08-04/법률21324호의 문구(해당항2008-02-29개정)를 대조했다. 개별 회사가 법령상 범주에 해당하는지는 사례 사실로 주며 금융업의 전체 정의·법정감사의무·지정 세부사유를 추가 득점요건으로 삼지 않는다. 이후 공표되지 않은 개정은 예측하지 않는다.\n')
legal_context+=f"외부감사법 출처 https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=270309&efYd=20250401; 파일{(S/'external-audit-law-view.html').as_posix()}; SHA256 {sha(S/'external-audit-law-view.html')}.\n"
legal_context+='\n\n'.join([selected['2'],selected['4'].split('②')[0],selected['9'].split('②')[0],selected['11'].split('\n1.')[0]])
legal_context+=f"\n자본시장법 출처 {url}; 파일{p.as_posix()}; SHA256 {sha(p)}.\n{c159}"
review_context=f"공식 보론4 문맥: KICPA2014-12-30 개정 분·반기재무제표 검토준칙 HWP {str(S/'interim-2014.hwp').replace(chr(92),'/')}; SHA256 {sha(S/'interim-2014.hwp')}; URL https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc1401&bltnNo=11501851835462&fileSeq=1&subId=sub06. 다음은 실제 보론4 전체 연속 인용이며2015고시의첨부가아닌2014보론이다. 직접 요구는등록된2015.7~9/19~20/36/46이고,2015에서선택본문은동일함을대조했다.2015.46은전체형식공정표시·(46-1)은요약형식작성으로구분한다. 제한적확신은아래보통수준/감사보다낮은확신을나타내는현행학습동의표현으로인정하고정확단어만채점하지않는다.\n{annex}"
out={'artifact_type':'s06_manual_dependency_context','version':1,'T17-B':'기말 후 새로운 거래 자체와 기말 전에 실제 운영한 통제의 증거를 기말 후 입수하는 경우를 구분한다. 평가기준일 현재 의견은1100.10(a),충분한기간은43/A66,빈도는A53이다. 다음해자료의 일률적인 금지는 공식 문단에 없으므로 그러한 금지를 추론하지 않는다.','T18-A':legal_context,'T19-A':review_context}
(S/'dependency-context.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(S/'legal-edition-check.json').write_text(json.dumps({'checked_at':'2026-09-11','status':'target_citations_confirmed','source_urls':['https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=270309&efYd=20250401',url],'external_audit_law_effective':'2025-04-01','capital_market_law_effective':'2026-08-04','actual_case_period':'2026-01-01 onward','narrow_scope':'1200.2 named categories; company legal status supplied as case fact; no exhaustive legal status adjudication','external_selected_articles':selected,'capital_159_1':c159},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('legal citations and full2014annex4 context saved')
