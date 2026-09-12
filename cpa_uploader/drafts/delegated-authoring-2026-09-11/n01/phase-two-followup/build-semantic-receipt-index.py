"""Read named, completed controller logs; preserve partial/non-pass evidence separately.
No API calls, no receipt edits, no favorable verdict selection.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path

root=Path.cwd()
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--manifest',required=True)
parser.add_argument('--runtime-lock',required=True)
parser.add_argument('--controller-summary',action='append',default=[])
parser.add_argument('--recovered-t02-receipt',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
rel=lambda p:Path(p).resolve().relative_to(root).as_posix()
manifest,lock=read(args.manifest),read(args.runtime_lock)
assert sha(args.manifest)==lock['manifest_sha256']
entries=[e for e in manifest['entries'] if e['package'] in {'N01','N06','S01','S05','S06'}]
assert len(entries)==18
byplan={e['plan_id']:e for e in entries}
completed={}
partial=[]
historical_incomplete=[]
provenance={}
def remember(p): provenance[rel(p)]=sha(p)
remember(args.manifest)
remember(args.runtime_lock)
remember(__file__)
for file in args.controller_summary:
    summary=read(file)
    assert 'finished_at' in summary
    remember(file)
    for row in summary.get('completed',[]):
        pid=row['plan_id']
        assert pid in byplan and pid not in completed, 'Duplicate authoritative completed receipt'
        receipt=read(row['receipt'])['reviews'][0]
        assert receipt['set_id']==byplan[pid]['set_id']
        assert sha(row['receipt'])==row['receipt_sha256']
        remember(row['receipt'])
        completed[pid]={'plan_id':pid,'set_id':receipt['set_id'],'receipt':row['receipt'],
                       'receipt_sha256':row['receipt_sha256'],'verdict':receipt['verdict'],
                       'authority':{'controller_summary':rel(file),'sha256':sha(file)}}
    for row in summary.get('partial_sets',[]):
        assert row['plan_id'] in byplan and row['completed_receipt'] is False
        assert sha(row['evidence'])==row['evidence_sha256']
        remember(row['evidence'])
        partial.append({'controller_summary':rel(file),**row})
    for row in summary.get('failed_sets',[]):
        historical_incomplete.append({'controller_summary':rel(file),**row})
    if isinstance(summary.get('blocked'),dict):
        historical_incomplete.append({'controller_summary':rel(file),'blocked':summary['blocked']})
receipt=read(args.recovered_t02_receipt)['reviews'][0]
assert receipt['set_id']=='pilot-02-006' and 'T02-A' not in completed
remember(args.recovered_t02_receipt)
completed['T02-A']={'plan_id':'T02-A','set_id':receipt['set_id'],'receipt':rel(args.recovered_t02_receipt),
                  'receipt_sha256':sha(args.recovered_t02_receipt),'verdict':receipt['verdict'],
                  'authority':{'reason':'Parent-directed first bounded transport recovery; 10 original exact units and 2 new units, never a favorable rerun.',
                   'summary':rel(Path(args.recovered_t02_receipt).parent/'summary.json')}}
remember(Path(args.recovered_t02_receipt).parent/'summary.json')
missing=[{'plan_id':e['plan_id'],'set_id':e['set_id'],
          'reason':'No complete receipt; partial evidence and all failures remain distinct.'} for e in entries if e['plan_id'] not in completed]
record={'artifact_type':'authoritative_semantic_receipt_index','created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'manifest':rel(args.manifest),'runtime_lock':rel(args.runtime_lock),'assigned_sets':18,
 'completed':[completed[e['plan_id']] for e in entries if e['plan_id'] in completed],
 'partial_evidence':partial,'without_complete_receipt':missing,'historical_incomplete':historical_incomplete,
 'provenance_files':[{'file':file,'sha256':value} for file,value in provenance.items()],
 'policy':'A complete receipt is selected only from its named authoritative first/recovery controller. Non-pass stays non-pass. Partial evidence is never a receipt; original errors and skipped units remain.','api_calls':0}
output=Path(args.output).resolve()
assert output.is_relative_to(root/'cpa_uploader/drafts/delegated-authoring-2026-09-11/n01') and not output.exists()
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'complete_receipts':len(completed),'pass':sum(r['verdict']=='pass' for r in completed.values()),
                  'without_complete_receipt':len(missing),'partial_evidence_runs':len(partial),'api_calls':0},ensure_ascii=False))
