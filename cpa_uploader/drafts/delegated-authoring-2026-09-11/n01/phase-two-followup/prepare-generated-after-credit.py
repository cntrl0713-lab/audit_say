from pathlib import Path
import hashlib
import json

base=Path(__file__).resolve().parent
source=base/'run-owned-generated.py'
target=base/'run-owned-generated-after-credit.py'
before=source.read_text(encoding='utf-8')
after=before.replace("['manifest', 'runtime-lock', 'semantic-controller-summary', 'first-recovered-receipt', 'run-name']", "['manifest', 'runtime-lock', 'receipt-index', 'run-name']")
start=after.index('semantic = read(args.semantic_controller_summary)')
end=after.index('snapshots = {}',start)
after=after[:start]+'''index = read(args.receipt_index)
if index.get('artifact_type') != 'authoritative_semantic_receipt_index':
    raise RuntimeError('Explicit authoritative receipt index required')
entries = [row for row in manifest['entries'] if row['package'] in OWNED]
if len(entries) != 18:
    raise RuntimeError('Expected the 18 assigned sets')
receipts = {}
for row in index['completed']:
    if row['plan_id'] in receipts:
        raise RuntimeError('Duplicate authoritative semantic receipt')
    if row['plan_id'] not in {entry['plan_id'] for entry in entries}:
        raise RuntimeError('Receipt is outside assigned scope')
    receipts[row['plan_id']] = row
''' + after[end:]
after=after.replace('args.semantic_controller_summary, __file__', 'args.receipt_index, __file__')
needle='jobs, skipped = [], []'
after=after.replace(needle, '''for identity in index.get('provenance_files', []):
    remember(ROOT / identity['file'], identity['sha256'])
jobs, skipped = [], []''')
needle="event({'stage': 'start', 'pass_receipts': len(jobs), 'skipped': skipped, 'parallel_api_streams': 1,"
insert='''def fatal_provider_codes(value):
    found = set()
    if isinstance(value, dict):
        if value.get('code') in {'credit_balance_exhausted', 'insufficient_quota'}:
            found.add(value['code'])
        for child in value.values():
            found.update(fatal_provider_codes(child))
    elif isinstance(value, list):
        for child in value:
            found.update(fatal_provider_codes(child))
    return found


'''
after=after.replace(needle,insert+needle)
needle="        if (output / 'stopped.json').exists():"
replacement='''        fatal = set()
        for evidence in sorted(output.glob('*.json')):
            fatal.update(fatal_provider_codes(read(evidence)))
        for evidence in sorted(output.glob('*.jsonl')):
            for line in evidence.read_text(encoding='utf-8').splitlines():
                if line.strip():
                    fatal.update(fatal_provider_codes(json.loads(line)))
        if fatal:
            blocked = {'plan_id': job['plan_id'], 'set_id': job['set_id'], 'fatal_provider_codes': sorted(fatal), 'output': job['output'],
                       'policy': 'Nested credit/quota overrides transport; no retry and no next set.'}
            event({'stage': 'fatal_provider_stop', **blocked})
            break
        if (output / 'stopped.json').exists():'''
assert after.count(needle)==1
after=after.replace(needle,replacement)
assert 'semantic_controller_summary' not in after and 'first_recovered_receipt' not in after
compile(after,str(target),'exec')
assert not target.exists()
target.write_text(after,encoding='utf-8',newline='\n')
data={'source':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
      'target':target.name,'target_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
      'changes':['An explicit authoritative index selects one prescribed completed receipt per plan with immutable provenance; no glob or favorable-pass selection.',
                 'Nested provider credit/quota codes stop the whole generated-grading queue before any next set; no retry is added.'],
      'api_calls':0}
(base/'generated-after-credit-controller-delta.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(data,ensure_ascii=False))
