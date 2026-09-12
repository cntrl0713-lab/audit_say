from pathlib import Path
import json,hashlib,subprocess,datetime
B=Path(__file__).parent
def read(p):return json.loads(Path(p).read_text(encoding='utf8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
elementsfile=Path('cpa_uploader/analysis/question-elements/question-elements.json');d=read(elementsfile)
ids=['element-5d1ca019e7d2fb20','element-d7777757fcd1f465','element-1baaf21ec64d2ae0','element-03569b50e6f37ed2','element-6e4e5e4694361bfb','element-4885d195f12cba9f','element-a00398a4176dc20b','element-0493607fb29f9b7a','element-d2b8f09383972908']
es=[e for e in d['elements'] if e['id'] in ids];assert len(es)==len(ids)
oc=[o for o in d['occurrences'] if o['element_id'] in ids];rs=set(o['record_id'] for o in oc)
freq=dict(artifact_type='s06_frequency_evidence',version=1,input=elementsfile.as_posix(),sha256=sha(elementsfile),elements=es,occurrences=oc,records=[r for r in d['records'] if r['id'] in rs],policy='exam/mock/practice/OX kept separately; source reprints are not added as distinct exam events')
(B/'frequency-evidence.json').write_text(json.dumps(freq,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
initial=Path('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json');bank={s['id']:(initial.as_posix(),s) for s in read(initial)}
static=read(B/'static-validation-01.json')
for row in static['active_selection']:
 raw=read(row['file']);s=next(x for x in raw if x['id']==row['set_id']) if isinstance(raw,list) else raw
 bank[row['set_id']]=(row['file'],s)
selected=[]
for sid,(f,s) in bank.items():
 if (s['classification']['topic_id'] not in ['17','18','19'] and sid!='pilot-03-006') or sid in ['pilot-17-006','pilot-18-005','pilot-19-005']:continue
 selected.append(dict(set_id=sid,file=f,sha256=sha(f),title=s['title'],classification=s['classification'],shared_facts=s['shared_context']['facts'],questions=[dict(id=q['id'],prompt=q['prompt'],model_answer=q['model_answer'],criteria=q['criteria']) for q in s['subquestions']]))
(B/'existing-comparison.json').write_text(json.dumps(dict(artifact_type='s06_existing_comparison',version=1,compared_sets=selected,source_selection='initial111 plus currently materialized single root-ledger candidate for each actualID',comparison_sets_at_check=static['comparison_sets']+3),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
outputs=[]
for o in read(B/'build-manifest.json')['outputs']:
 command=['node','--import','tsx','cpa_uploader/validate_draft_v3.ts','--file',(B/o['file']).as_posix(),'--against-bank']
 r=subprocess.run(command,capture_output=True,text=True,encoding='utf8')
 outputs.append(dict(set_id=o['set_id'],command=command,exit_code=r.returncode,stdout=r.stdout,stderr=r.stderr))
(B/'cli-validation-01.json').write_text(json.dumps(dict(artifact_type='s06_cli_validation',version=1,performed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),outputs=outputs,status='pass' if all(x['exit_code']==0 for x in outputs) else 'fail',model_calls=0),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('elements',len(es),'compared sets',len(selected),'CLI',[(x['set_id'],x['exit_code']) for x in outputs])
print(json.dumps([(e['id'],e['exam_frequency'],e['mock_frequency'],e.get('practice_frequency'),e.get('ox_frequency')) for e in es],ensure_ascii=False))
