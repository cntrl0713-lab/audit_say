"""Sequentially run only the 18 assigned sets against a supplied frozen bank.

Default: verify identities and print a local preparation summary without API calls.
An explicit --execute is required. The root supplies the new manifest/lock before
execution. Non-pass receipts are evidence, never silently converted into passes.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import time

ROOT = pathlib.Path.cwd()
CONTROL = ROOT / 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11'
BASE = ROOT / 'cpa_uploader/drafts/delegated-authoring-2026-09-11'
OWNED = {'N01', 'N06', 'S01', 'S05', 'S06'}
EXPECTED_PLANS = {'T02-A', 'T01-A', 'T03-A', 'T04-B', 'T16-A', 'T16-B', 'T17-A',
                  'T02-B', 'T01-B', 'T03-B', 'T04-C', 'T15-A', 'T15-B', 'T16-C',
                  'T14-C', 'T17-B', 'T18-A', 'T19-A'}


def read(file):
    return json.loads(pathlib.Path(file).read_text(encoding='utf-8'))


def sha(file):
    return hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def rel(file):
    return pathlib.Path(file).resolve().relative_to(ROOT).as_posix()


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--manifest', required=True)
parser.add_argument('--runtime-lock', required=True)
parser.add_argument('--run-name', required=True)
parser.add_argument('--execute', action='store_true')
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9][a-z0-9-]{2,60}', args.run_name):
    raise RuntimeError('Use a simple new lowercase run name')
manifest_path, lock_path = pathlib.Path(args.manifest).resolve(), pathlib.Path(args.runtime_lock).resolve()
manifest, lock = read(manifest_path), read(lock_path)
phase = lock['phase_directory']
if not re.fullmatch(r'phase-two-v[0-9]+', phase):
    raise RuntimeError('Runtime lock must explicitly name the new phase directory')
if lock['settings'] != {
    'grading_model': 'gpt-5.6-luna', 'review_model': 'gpt-5.6-luna',
    'review_input_max_chars': 500000, 'general_cli_default_chars': 160000,
}:
    raise RuntimeError('Unexpected runtime settings; do not override them locally')
entries = [row for row in manifest['entries'] if row['package'] in OWNED]
if len(entries) != 18 or {row['plan_id'] for row in entries} != EXPECTED_PLANS:
    raise RuntimeError('Assigned set inventory differs')
snapshots = {}


def remember(file, expected=None):
    absolute = pathlib.Path(file).resolve()
    actual = sha(absolute)
    if expected is not None and actual != expected:
        raise RuntimeError('Frozen hash differs: ' + rel(absolute))
    snapshots[absolute] = actual


remember(manifest_path, lock['manifest_sha256'])
remember(lock_path)
remember(__file__)
helper = CONTROL / 'resume-semantic.ts'
remember(helper)
for identity in [lock['comparison_bank'], *lock['code_files'], *lock.get('source_files', [])]:
    remember(ROOT / identity['file'], identity['sha256'])
jobs = []
for entry in entries:
    remember(ROOT / entry['file'], entry['sha256'])
    remember(ROOT / entry['qa_file'], entry['qa_sha256'])
    if len(entry['plan_files']) != 1:
        raise RuntimeError('Exactly one manual authoring plan is required')
    for identity in [*entry['plan_files'], *entry['source_files']]:
        remember(ROOT / identity['file'], identity['sha256'])
    package_root = BASE / entry['package'].lower()
    if pathlib.Path(entry['output_directory']).resolve() != package_root.resolve():
        raise RuntimeError('Manifest output ownership differs')
    parent = package_root / phase / entry['set_id']
    output, log = parent / args.run_name, parent / (args.run_name + '.console.log')
    if output.exists() or log.exists():
        raise RuntimeError('Existing evidence would be overwritten: ' + rel(output))
    command = ['node', '--env-file=.env.local', '--import', 'tsx', rel(helper),
               '--manifest', rel(manifest_path), '--plan-id', entry['plan_id'],
               '--runtime-lock', rel(lock_path), '--output', rel(output), '--execute']
    jobs.append({'plan_id': entry['plan_id'], 'set_id': entry['set_id'],
                 'output': rel(output), 'console_log': rel(log), 'command': command})
if not args.execute:
    print(json.dumps({'mode': 'prepare_only', 'api_calls': 0, 'sets': len(jobs),
                      'manifest': rel(manifest_path), 'manifest_sha256': sha(manifest_path),
                      'runtime_lock': rel(lock_path), 'runtime_lock_sha256': sha(lock_path),
                      'phase': phase, 'jobs': jobs}, ensure_ascii=False, indent=2))
    raise SystemExit(0)

qa_complete_file = BASE / 'n01/phase-two-v4/author-qa-controller-summary-01.json'
qa_complete = read(qa_complete_file)
if qa_complete['blocked'] is not None or qa_complete['sets_remaining'] != 0 or len(qa_complete['completed']) != 18:
    raise RuntimeError('Finish the mandatory QA stream before starting this stream')
remember(qa_complete_file)
events = BASE / 'n01' / phase / (args.run_name + '-controller.jsonl')
summary_file = BASE / 'n01' / phase / (args.run_name + '-controller-summary.json')
if events.exists() or summary_file.exists():
    raise RuntimeError('Controller evidence exists; choose a new run name')
events.parent.mkdir(parents=True, exist_ok=True)
events.touch(exist_ok=False)


def event(value):
    value = {'recorded_at': now(), **value}
    with events.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + '\n')
    print(json.dumps(value, ensure_ascii=False), flush=True)


def guard():
    changed = [rel(file) for file, expected in snapshots.items() if not file.exists() or sha(file) != expected]
    if changed:
        raise RuntimeError('Changed frozen inputs: ' + ', '.join(changed))


event({'stage': 'start', 'sets': len(jobs), 'parallel_api_streams': 1,
       'manifest': rel(manifest_path), 'runtime_lock': rel(lock_path),
       'input_hashes': {rel(file): value for file, value in snapshots.items()},
       'policy': 'New-bank first-pass semantic receipts. No old-bank cache, no packet impersonation, no generated grading or non-pass retry is silently mixed into this stage.'})
completed = []
blocked = None
for job in jobs:
    if (events.parent / 'HALT').exists():
        blocked = 'Root-requested HALT before next set'
        break
    try:
        guard()
    except RuntimeError as error:
        blocked = str(error)
        break
    output = ROOT / job['output']
    log = ROOT / job['console_log']
    output.parent.mkdir(parents=True, exist_ok=True)
    event({'stage': 'set_start', **job})
    with log.open('x', encoding='utf-8') as stream:
        proc = subprocess.Popen(job['command'], cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
        previous_count = -1
        while proc.poll() is None:
            time.sleep(5)
            chunk_file = output / 'semantic.json.chunks.jsonl'
            count = sum(bool(line.strip()) for line in chunk_file.read_text(encoding='utf-8').splitlines()) if chunk_file.exists() else 0
            if count != previous_count:
                print(json.dumps({'set_id': job['set_id'], 'saved_raw_units': count}), flush=True)
                previous_count = count
    run_summary_file = output / 'summary.json'
    if not run_summary_file.exists():
        blocked = {'set_id': job['set_id'], 'exit_code': proc.returncode, 'missing_summary': True, 'console_log': job['console_log']}
        break
    result = read(run_summary_file)
    if result.get('status') != 'receipt_created':
        blocked = {'set_id': job['set_id'], 'exit_code': proc.returncode, 'summary': rel(run_summary_file), 'result': result}
        break
    try:
        guard()
    except RuntimeError as error:
        blocked = str(error)
        break
    completed.append({'plan_id': job['plan_id'], 'set_id': job['set_id'],
                      'summary': rel(run_summary_file), 'summary_sha256': sha(run_summary_file),
                      'receipt': rel(output / 'semantic.json'),
                      'receipt_sha256': sha(output / 'semantic.json'), **result})
    event({'stage': 'set_finished', **completed[-1]})
event({'stage': 'finished' if blocked is None else 'paused', 'completed_sets': len(completed), 'blocked': blocked})
with summary_file.open('x', encoding='utf-8') as stream:
    json.dump({'finished_at': now(), 'completed': completed, 'blocked': blocked,
               'sets_remaining': len(jobs) - len(completed), 'actual_grading_cases': 0,
               'limitation': 'First semantic observations only. Non-pass units need original-input repeats and investigation; generated-case grading is a separate stage.'},
              stream, ensure_ascii=False, indent=2)
    stream.write('\n')
