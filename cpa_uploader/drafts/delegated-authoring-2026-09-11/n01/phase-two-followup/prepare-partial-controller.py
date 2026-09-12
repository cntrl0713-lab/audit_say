from pathlib import Path
import hashlib
import json

base=Path(__file__).resolve().parent
source=base/'run-owned-semantic-independent.py'
target=base/'run-owned-semantic-partial.py'
before=source.read_text(encoding='utf-8')
after=before.replace("helper = CONTROL / 'resume-semantic.ts'", "helper = CONTROL / 'continue-semantic-partial.ts'")
after=after.replace("parser.add_argument('--seed-log', action='append', default=[])", "parser.add_argument('--seed-log', action='append', default=[])\nparser.add_argument('--skip-plan-id', action='append', default=[])\nparser.add_argument('--skip-unit', action='append', default=[])")
needle='snapshots = {}'
after=after.replace(needle,"""if len(args.skip_plan_id) != len(args.skip_unit):
    raise RuntimeError('Each explicit skipped unit needs its plan')
skip_units = {}
for plan_id, unit_id in zip(args.skip_plan_id, args.skip_unit):
    if plan_id not in seed_logs:
        raise RuntimeError('Skipped unit requires original actual seed log')
    skip_units.setdefault(plan_id, []).append(unit_id)
snapshots = {}""")
needle="               '--runtime-lock', rel(lock_path), '--output', rel(output), '--execute']"
assert after.count(needle)==1
after=after.replace(needle,needle+"\n    for unit_id in skip_units.get(entry['plan_id'], []):\n        command.extend(['--skip-unit', unit_id])")
after=after.replace('completed = []\nfailed_sets = []', 'completed = []\npartial_sets = []\nfailed_sets = []')
needle="        if result.get('status') != 'receipt_created':"
assert after.count(needle)==1
after=after.replace(needle,"""        if result.get('status') == 'partial_units_completed':
            partial = {'plan_id': job['plan_id'], 'set_id': job['set_id'], 'output': rel(output),
                       'summary': rel(output / 'summary.json'), 'summary_sha256': sha(output / 'summary.json'),
                       'evidence': rel(output / 'partial-actual-model-evidence.json'),
                       'evidence_sha256': sha(output / 'partial-actual-model-evidence.json'), **result}
            partial_sets.append(partial)
            event({'stage': 'partial_units_finished', **partial})
            continue
"""+needle)
after=after.replace("'failed_sets': len(failed_sets), 'excluded_plan_ids'", "'failed_sets': len(failed_sets), 'partial_sets': len(partial_sets), 'excluded_plan_ids'")
after=after.replace("'completed': completed, 'failed_sets': failed_sets,", "'completed': completed, 'partial_sets': partial_sets, 'failed_sets': failed_sets,")
after=after.replace("'sets_remaining': len(jobs) - len(completed),", "'sets_without_complete_receipt': len(jobs) - len(completed),\n               'sets_not_finished_to_unit_boundary': len(jobs) - len(completed) - len(partial_sets) - len(failed_sets),")
after=after.replace("'limitation': 'First semantic observations", "'limitation': 'Partial evidence preserves unresolved units and is never a completed receipt. First semantic observations")
compile(after,str(target),'exec')
assert not target.exists()
target.write_text(after,encoding='utf-8',newline='\n')
record={'source':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'target':target.name,'target_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
 'changes':['Use root-provided continue-semantic-partial.ts without changing original or common code.',
 'Record partial_units_completed separately from complete receipts and continue the independent set queue.',
 'Optional explicit skipped units require original seed logs and are validated by the root helper; nested credit/quota stop remains.'], 'api_calls':0}
(base/'partial-controller-delta.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,ensure_ascii=False))
