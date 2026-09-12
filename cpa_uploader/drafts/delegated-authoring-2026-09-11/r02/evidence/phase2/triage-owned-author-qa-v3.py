from pathlib import Path
import json,hashlib,datetime
root=Path('cpa_uploader/drafts/delegated-authoring-2026-09-11')
manifest=json.loads(Path('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v1/manifest.json').read_text(encoding='utf-8'))
entries=[e for e in manifest['entries'] if any('/'+o+'/' in e['file'].replace('\\','/') for o in ['r02','n02','n03','s02','s04'])]
progress=[]
findings=[]
for entry in entries:
 folder=Path(entry['file']).parent/'evidence/phase2/phase-two-v3'/entry['set_id']/'author-qa-run1'
 files=sorted(folder.glob('case-*.json'))
 rows=[]
 for file in files:
  try:r=json.loads(file.read_text(encoding='utf-8'))
  except json.JSONDecodeError:continue
  rows.append(r)
  if r.get('matched') is not False:continue
  expected=r.get('expected',{})
  actual=next((s for s in r.get('result',{}).get('subquestions',[]) if s['subquestion_id']==expected.get('subquestion_id')),None)
  raw=next((s for s in (r.get('raw_judgment') or {}).get('subquestions',[]) if s['subquestion_id']==expected.get('subquestion_id')),None)
  mismatched_ids=[c['criterion_id'] for c in r.get('verdict_differences',[])]
  candidate=json.loads(Path(entry['file']).read_text(encoding='utf-8'))
  if isinstance(candidate,list):candidate=candidate[0]
  sub=next((s for s in candidate['subquestions'] if s['id']==expected.get('subquestion_id')),None)
  findings.append({'set_id':entry['set_id'],'plan_id':entry['plan_id'],'case_id':r['case_id'],'attempt':r['attempt'],'file':str(file),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'request_hash':r.get('request_hash'),'schema_hash':r.get('schema_hash'),'answer':expected.get('answer'),'expected_points':expected.get('expected_points'),'actual_points':actual['score'] if actual else None,'kind':r.get('kind'),'security_flag':r.get('result',{}).get('security_flag'),'verdict_differences':r.get('verdict_differences'),'raw_target_verdicts':[c for c in raw['verdicts'] if c['criterion_id'] in mismatched_ids] if raw else [],'final_target_criteria':[c for c in actual['criteria'] if c['criterion_id'] in mismatched_ids] if actual else [],'candidate_criteria':[c for c in sub['criteria'] if c['id'] in mismatched_ids] if sub else [],'source_refs':[s for s in candidate['source_refs'] if sub and s['id'] in {sid for c in sub['criteria'] if c['id'] in mismatched_ids for sid in c['source_ref_ids']}],'error':r.get('error'),'trace_stages':[t['stage'] for t in r.get('trace',[])]})
 progress.append({'set_id':entry['set_id'],'plan_id':entry['plan_id'],'recorded_unique_cases':len({r['case_id'] for r in rows}),'recorded_executions':len(rows),'mismatched_case_ids':list(dict.fromkeys(r['case_id'] for r in rows if not r['matched'])),'completed_summary':str(folder/'summary.json') if (folder/'summary.json').exists() else None})
report={'read_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'read_only_triage':True,'automated_diff_not_content_verdict':True,'progress':progress,'findings':findings}
output=root/'r02/evidence/phase2/phase-two-v3-control'/('triage-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json')
output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'file':str(output),'recorded_unique_cases':sum(p['recorded_unique_cases'] for p in progress),'mismatched_events':len(findings),'completed_sets':sum(bool(p['completed_summary']) for p in progress)},ensure_ascii=True))
