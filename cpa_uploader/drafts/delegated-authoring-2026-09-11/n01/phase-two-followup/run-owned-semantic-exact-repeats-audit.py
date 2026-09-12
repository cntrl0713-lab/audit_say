"""Two exact follow-up requests per valid non-pass first unit. Default: API 0."""
import argparse
import datetime
import hashlib
import json
import re
import subprocess
from pathlib import Path

root=Path.cwd()
base=root/'cpa_uploader/drafts/delegated-authoring-2026-09-11'
parser=argparse.ArgumentParser(description=__doc__)
for option in ['manifest','runtime-lock','run-name']:
    parser.add_argument('--'+option,required=True)
parser.add_argument('--controller-summary',action='append',default=[])
parser.add_argument('--execute',action='store_true')
parser.add_argument('--observations-audit')
args=parser.parse_args()
assert re.fullmatch('[a-z0-9-]+',args.run_name)
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
rel=lambda p:Path(p).resolve().relative_to(root).as_posix()
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
manifest,lock=read(args.manifest),read(args.runtime_lock)
assert sha(args.manifest)==lock['manifest_sha256']
entries={e['plan_id']:e for e in manifest['entries'] if e['package'] in {'N01','N06','S01','S05','S06'}}
helper=Path(__file__).parent/'repeat-owned-semantic-unit.mjs'
snapshots={Path(f).resolve():sha(f) for f in [__file__,helper,args.manifest,args.runtime_lock,*args.controller_summary]}
targets={}
for file in args.controller_summary:
    summary=read(file)
    assert 'finished_at' in summary
    for result in [*summary.get('completed',[]),*summary.get('partial_sets',[])]:
        pid=result['plan_id']; entry=entries[pid]
        log=root/result['output']/'semantic.json.chunks.jsonl'
        snapshots[log]=sha(log)
        rows=[json.loads(x) for x in log.read_text(encoding='utf-8').splitlines() if x.strip()]
        for line,row in enumerate(rows,1):
            if row.get('error') or not row.get('response'):
                continue
            response=row['response']
            nonpass=any(v!='pass' for v in response['checks'].values()) or any(c['verdict']!='pass' for c in response.get('cases',[]))
            if not nonpass:
                continue
            key=(pid,row['unit_id'])
            assert key not in targets, 'Do not select among duplicate valid observations'
            targets[key]={'plan_id':pid,'set_id':entry['set_id'],'unit_id':row['unit_id'],'original_log':rel(log),
                'original_line':line,'original_attempt':row['attempt'],'original_checks':response['checks'],
                'input_hash':row['input_hash'],'schema_hash':row['schema_hash'],'instructions_hash':row['instructions_hash']}

if args.observations_audit:
    audit=read(args.observations_audit)
    snapshots[Path(args.observations_audit).resolve()]=sha(args.observations_audit)
    for observed in audit['valid_nonpass_observations']:
        pid=observed['plan_id'];entry=entries[pid]
        log=root/observed['log']
        assert sha(log)==observed['log_sha256']
        snapshots[log]=sha(log)
        rows=[json.loads(x) for x in log.read_text(encoding='utf-8').splitlines() if x.strip()]
        row=rows[observed['line']-1]
        assert not row.get('error') and row.get('response') is not None
        key=(pid,row['unit_id'])
        proposed={'plan_id':pid,'set_id':entry['set_id'],'unit_id':row['unit_id'],'original_log':rel(log),
            'original_line':observed['line'],'original_attempt':row['attempt'],'original_checks':row['response']['checks'],
            'input_hash':row['input_hash'],'schema_hash':row['schema_hash'],'instructions_hash':row['instructions_hash']}
        if key in targets:
            assert targets[key]==proposed, 'Cannot choose between different actual originals'
        else:
            targets[key]=proposed

jobs=[]
for key,target in targets.items():
    entry=entries[target['plan_id']]
    for observation in [2,3]:
        name=target['unit_id'].replace(':','-')+f'-observation-{observation}.json'
        output=base/entry['package'].lower()/lock['phase_directory']/entry['set_id']/args.run_name/name
        assert not output.exists()
        command=['node','--env-file=.env.local','--import','tsx',rel(helper),'--manifest',args.manifest,
             '--runtime-lock',args.runtime_lock,'--plan-id',target['plan_id'],'--log',target['original_log'],
             '--unit-id',target['unit_id'],'--original-attempt',str(target['original_attempt']),
             '--output',rel(output),'--execute']
        jobs.append({**target,'observation':observation,'output':rel(output),'command':command})
if not args.execute:
    print(json.dumps({'mode':'prepare_only','api_calls':0,'units':len(targets),'followup_requests':len(jobs),'jobs':jobs},ensure_ascii=False,indent=2))
    raise SystemExit(0)

def fatal(value):
    if isinstance(value,dict):
        return value.get('code') in {'credit_balance_exhausted','insufficient_quota'} or any(fatal(v) for v in value.values())
    return isinstance(value,list) and any(fatal(v) for v in value)
def guard():
    assert all(p.exists() and sha(p)==h for p,h in snapshots.items()), 'Changed fixed repeat controller input'
controller=base/'n01'/lock['phase_directory']/(args.run_name+'-controller.jsonl')
final=controller.with_name(args.run_name+'-controller-summary.json')
assert not controller.exists() and not final.exists()
controller.touch()
completed=[];blocked=None
for job in jobs:
    if (controller.parent/'HALT').exists():
        blocked='Root HALT before next request';break
    guard()
    output=root/job['output'];output.parent.mkdir(parents=True,exist_ok=True)
    with output.with_suffix('.console.log').open('x',encoding='utf-8') as stream:
        proc=subprocess.run(job['command'],cwd=root,stdout=stream,stderr=subprocess.STDOUT)
    guard()
    if not output.exists():
        blocked={'job':job,'reason':'No actual result file','exit_code':proc.returncode};break
    result=read(output)
    if fatal(result) or result.get('changed_inputs') or result.get('status')=='request_failed':
        blocked={'job':job,'result':result,'reason':'Provider request/fatal quota or input change; no next request'};break
    for key in ['input_hash','schema_hash','instructions_hash']:
        assert result[key]==job[key], 'Exact repeat identity differs'
    record={'at':now(),**job,'status':result['status'],'result_sha256':sha(output),
            'checks':result.get('grounded',{}).get('units',[{}])[0].get('checks')}
    completed.append(record)
    with controller.open('a',encoding='utf-8') as stream:stream.write(json.dumps(record,ensure_ascii=False)+'\n')
    print(json.dumps({k:record[k] for k in ['plan_id','unit_id','observation','status','checks']},ensure_ascii=False),flush=True)
final.write_text(json.dumps({'finished_at':now(),'target_units':len(targets),'completed':completed,'blocked':blocked,
 'policy':'Original non-pass observations and exactly two follow-ups remain separate. No pass selection or receipt rewrite. Invalid grounding on a follow-up remains an observed failure.','snapshots':{rel(p):h for p,h in snapshots.items()}},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
