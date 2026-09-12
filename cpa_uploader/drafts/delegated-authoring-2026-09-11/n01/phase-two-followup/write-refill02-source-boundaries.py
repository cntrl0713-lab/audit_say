"""Read-only boundary evidence for completed refill-02 runs with page observations."""
from pathlib import Path
import datetime
import hashlib
import json
import re

root=Path.cwd();base=root/'cpa_uploader/drafts/delegated-authoring-2026-09-11'
manifest=json.loads((root/'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v3/manifest.json').read_text(encoding='utf-8'))
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
records=[]
for pid in ['T14-C','T17-B','T18-A']:
    entry=next(e for e in manifest['entries'] if e['plan_id']==pid)
    question=read(root/entry['file']);sources={r['id']:r for r in question['source_refs']}
    run=base/entry['package'].lower()/'phase-two-v5'/entry['set_id']/'bank-v3-after-refill-04'
    assert (run/'summary.json').exists()
    log=run/'semantic.json.chunks.jsonl'
    rows=[json.loads(x) for x in log.read_text(encoding='utf-8').splitlines() if x.strip()]
    failed_subs={r['unit_id'].split(':')[1] for r in rows if not r.get('error') and r['response']['checks']['source_support']!='pass'}
    for sub in question['subquestions']:
        if sub['id'] not in failed_subs:continue
        for req in sub['requirements']:
            match=re.search(r'L(\d+)-L(\d+)',req['source_span'])
            page=re.search(r'원문 페이지 (\d+)',req['source_span'])
            if not match or not page:continue
            start,end=map(int,match.groups())
            source=sources[req['source_ref_id']];file=root/source['file'];lines=file.read_text(encoding='utf-8').splitlines()
            preceding=[(i+1,int(m.group(1))) for i,line in enumerate(lines[:start]) if (m:=re.fullmatch(r'## PDF PAGE (\d+)',line.strip()))]
            assert preceding
            marker_line,actual_page=preceding[-1]
            after=[{'line':i+1,'page':int(m.group(1))} for i,line in enumerate(lines[start-1:end],start-1) if (m:=re.fullmatch(r'## PDF PAGE (\d+)',line.strip()))]
            records.append({'plan_id':pid,'subquestion_id':sub['id'],'requirement_id':req['id'],'source_ref_id':req['source_ref_id'],
                'file':source['file'],'file_sha256':sha(file),'source_span':req['source_span'],
                'declared_page':int(page.group(1)),'preceding_actual_page_marker':{'line':marker_line,'page':actual_page},
                'declared_page_matches_preceding_marker':int(page.group(1))==actual_page,
                'markers_inside_declared_quote_range':after,
                'boundary_lines':[{'line':i+1,'text':lines[i]} for i in sorted(set([marker_line-1,start-1,end-1,*[max(0,start-2)],min(len(lines)-1,end),min(len(lines)-1,end+1)]))],
                'original_log':log.relative_to(root).as_posix(),'original_log_sha256':sha(log)})
output=base/'n01/phase-two-v5/refill02-source-boundaries.json'
assert not output.exists()
output.write_text(json.dumps({'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'status':'manual_readonly_source_investigation','records':records,
 'decision':'각 선언 페이지와 실제 본문 직전 페이지 표지를 대조했다. 인용 말미의 다음 표지를 현재 문단 페이지로 바꾸지 않는다. 원문·문항·원 모델 판정을 유지한다. T17-B plan-only 후속은 실제 중복 관계만 바꾸며 이 원문 조사와 별개이다.',
 'api_calls':0},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'requirements_checked':len(records),'page_mismatches':[r for r in records if not r['declared_page_matches_preceding_marker']]},ensure_ascii=False))
