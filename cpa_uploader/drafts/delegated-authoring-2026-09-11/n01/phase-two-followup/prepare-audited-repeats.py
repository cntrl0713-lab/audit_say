from pathlib import Path
import hashlib
import json

base=Path(__file__).resolve().parent
source=base/'run-owned-semantic-exact-repeats.py'
target=base/'run-owned-semantic-exact-repeats-audit.py'
before=source.read_text(encoding='utf-8')
after=before.replace("parser.add_argument('--execute',action='store_true')", "parser.add_argument('--execute',action='store_true')\nparser.add_argument('--observations-audit')")
needle='jobs=[]'
insert='''if args.observations_audit:
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

jobs=[]'''
assert after.count(needle)==1
after=after.replace(needle,insert)
compile(after,str(target),'exec')
assert not target.exists()
target.write_text(after,encoding='utf-8',newline='\n')
record={'source':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'target':target.name,'target_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
 'change':'Include explicitly audited valid non-pass units from an earlier stopped run, preserving the exact original row and avoiding omission of reused partial units. No duplicate/favorable original selection.','api_calls':0}
(base/'audited-repeat-controller-delta.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,ensure_ascii=False))
