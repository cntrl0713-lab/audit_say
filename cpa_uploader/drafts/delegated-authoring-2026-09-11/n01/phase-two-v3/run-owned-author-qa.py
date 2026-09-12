"""Run the 18 assigned immutable QA inputs sequentially; preserve every attempt."""
import datetime
import hashlib
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path.cwd()
CONTROL = ROOT / 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11'
HERE = pathlib.Path(__file__).resolve().parent
MANIFEST = CONTROL / 'final-153-v1/manifest.json'
PACKAGES = {'N01', 'N06', 'S01', 'S05', 'S06'}

def read(file):
    return json.loads(pathlib.Path(file).read_text(encoding='utf-8'))

def sha(file):
    return hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest()

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

EVENTS = HERE / 'author-qa-controller-01.jsonl'
if EVENTS.exists():
    raise RuntimeError('Controller evidence exists; use a separately reviewed continuation.')

def event(value):
    value = {'recorded_at': now(), **value}
    with EVENTS.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + '\n')
    print(json.dumps(value, ensure_ascii=False), flush=True)

manifest = read(MANIFEST)
LOCK_FILE = CONTROL / 'runtime-v3-stable/runtime-lock.json'
lock = read(LOCK_FILE)
if sha(MANIFEST) != lock['manifest_sha256']:
    raise RuntimeError('Manifest hash changed')
for item in [*lock['code_files'], *lock['source_files'], lock['comparison_bank']]:
    if sha(ROOT / item['file']) != item['sha256']:
        raise RuntimeError('Runtime lock changed: '+item['file'])
entries = [row for row in manifest['entries'] if row['package'] in PACKAGES]
for row in entries:
    row['original_qa_file'] = row['qa_file']
    row['original_qa_sha256'] = row['qa_sha256']
    if row['plan_id'] == 'T02-A':
        row['qa_file'] = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/phase-two-followup/qa-v2/qa-cases-t02-a.json'
        row['qa_sha256'] = '6fbeccda4514f500bca58e9d9d17269785834b28cd5cc0de197404cf1dfd2bdf'
if len(entries) != 18:
    raise RuntimeError('Assigned set count changed')
grader_paths = {
    'lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts',
    'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts',
    'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts',
}
grader_locks = [row for row in lock['code_files'] if row['file'] in grader_paths]
if len(grader_locks) != len(grader_paths):
    raise RuntimeError('Missing grader lock')
event({'stage': 'start', 'manifest_sha256': sha(MANIFEST), 'sets': len(entries),
       'planned_cases': sum(row['qa_cases'] for row in entries), 'parallel_sets': 1,
       'runtime_lock': str(LOCK_FILE.relative_to(ROOT)), 'runtime_lock_sha256': sha(LOCK_FILE),
       'qa_override': {row['plan_id']: {'file': row['qa_file'], 'sha256': row['qa_sha256'], 'original_file': row['original_qa_file'], 'original_sha256': row['original_qa_sha256']} for row in entries if row['qa_file'] != row['original_qa_file']},
       'policy': 'Policy v3 stable-code follow-up; original v1 evidence remains immutable. Full cohort includes all 808 cases; only the two accepted T02-A opposite answers use QA revision 2.'})
completed = []
blocked = None
for row in entries:
    if (HERE / 'HALT').exists():
        blocked = 'HALT requested before next set'
        break
    expected = [{'file': row['file'], 'sha256': row['sha256']},
                {'file': row['qa_file'], 'sha256': row['qa_sha256']},
                *grader_locks, *row['source_files']]
    changed = [item['file'] for item in expected if sha(ROOT / item['file']) != item['sha256']]
    if changed:
        blocked = {'changed_inputs': changed}
        break
    folder = ROOT / row['output_directory'] / 'phase-two-v3' / row['set_id']
    folder.mkdir(parents=True, exist_ok=True)
    output = folder / 'author-qa-01'
    log = folder / 'author-qa-01.console.log'
    if output.exists() or log.exists():
        blocked = {'existing_output': str(output.relative_to(ROOT))}
        break
    command = ['node', '--env-file=.env.local', '--import', 'tsx',
               str((CONTROL / 'run-author-qa.ts').relative_to(ROOT)),
               '--file', row['file'], '--qa', row['qa_file'],
               '--output', str(output.relative_to(ROOT))]
    event({'stage': 'set_start', 'set_id': row['set_id'], 'qa_cases': row['qa_cases'],
           'qa_file': row['qa_file'], 'qa_sha256': row['qa_sha256'],
           'output': str(output.relative_to(ROOT))})
    with log.open('x', encoding='utf-8') as stream:
        proc = subprocess.Popen(command, stdout=stream, stderr=subprocess.STDOUT, cwd=ROOT)
        last_count = -1
        while proc.poll() is None:
            time.sleep(5)
            count = len(list(output.glob('case-*-attempt-*.json'))) if output.exists() else 0
            if count != last_count:
                print(json.dumps({'set_id': row['set_id'], 'saved_attempts': count}), flush=True)
                last_count = count
    summary_file = output / 'summary.json'
    if not summary_file.exists():
        blocked = {'set_id': row['set_id'], 'exit_code': proc.returncode, 'missing_summary': True}
        break
    summary = read(summary_file)
    result = {key: summary[key] for key in ['set_id', 'planned_cases', 'recorded_cases',
              'actual_attempts', 'mismatched_case_ids', 'stopped_on_execution_error', 'changed_inputs']}
    result.update(exit_code=proc.returncode, summary=str(summary_file.relative_to(ROOT)))
    completed.append(result)
    event({'stage': 'set_finished', **result})
    if summary['stopped_on_execution_error'] or summary['changed_inputs'] or summary['recorded_cases'] != row['qa_cases']:
        blocked = result
        break
event({'stage': 'finished' if blocked is None else 'paused', 'completed_sets': len(completed), 'blocked': blocked})
with (HERE / 'author-qa-controller-summary-01.json').open('x', encoding='utf-8') as stream:
    json.dump({'finished_at': now(), 'completed': completed, 'blocked': blocked,
               'sets_remaining': len(entries)-len(completed)}, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
