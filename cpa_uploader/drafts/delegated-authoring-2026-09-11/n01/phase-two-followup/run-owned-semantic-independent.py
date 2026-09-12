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
parser.add_argument('--exclude-plan-id', action='append', default=[])
parser.add_argument('--seed-plan-id', action='append', default=[])
parser.add_argument('--seed-log', action='append', default=[])
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
if not set(args.exclude_plan_id) <= EXPECTED_PLANS:
    raise RuntimeError('Excluded plan is outside the assignment')
entries = [row for row in entries if row['plan_id'] not in args.exclude_plan_id]
if len(args.seed_plan_id) != len(args.seed_log) or len(set(args.seed_plan_id)) != len(args.seed_plan_id):
    raise RuntimeError('Each seed plan needs exactly one original actual chunk log')
seed_logs = dict(zip(args.seed_plan_id, args.seed_log))
if not set(seed_logs) <= {row['plan_id'] for row in entries}:
    raise RuntimeError('Seed logs must belong to included plans')
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
    if entry['plan_id'] in seed_logs:
        seed_log = pathlib.Path(seed_logs[entry['plan_id']]).resolve()
        if not seed_log.name.endswith('.chunks.jsonl'):
            raise RuntimeError('Seed must be an original actual chunk log')
        remember(seed_log)
        for suffix in ['.runtime.json', '.runtime-result.json']:
            remember(str(seed_log)[:-len('.chunks.jsonl')] + suffix)
        command.extend(['--resume-log', rel(seed_log)])
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
def fatal_provider_codes(value):
    found = set()
    if isinstance(value, dict):
        code = value.get('code')
        if code in {'credit_balance_exhausted', 'insufficient_quota'}:
            found.add(code)
        for child in value.values():
            found.update(fatal_provider_codes(child))
    elif isinstance(value, list):
        for child in value:
            found.update(fatal_provider_codes(child))
    return found


completed = []
failed_sets = []
blocked = None


def run_once(job, resume_from=None):
    command = list(job['command'])
    output = ROOT / job['output']
    log = ROOT / job['console_log']
    if resume_from:
        output = output.parent / (output.name + '-resume-01')
        log = output.parent / (output.name + '.console.log')
        command[command.index('--output') + 1] = rel(output)
        command.extend(['--resume-log', rel(resume_from / 'semantic.json.chunks.jsonl')])
    if output.exists() or log.exists():
        raise RuntimeError('Existing output at ' + rel(output))
    output.parent.mkdir(parents=True, exist_ok=True)
    guard()
    event({'stage': 'set_resume' if resume_from else 'set_start', 'plan_id': job['plan_id'],
           'set_id': job['set_id'], 'output': rel(output), 'command': command})
    with log.open('x', encoding='utf-8') as stream:
        proc = subprocess.Popen(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
        previous_count = -1
        while proc.poll() is None:
            time.sleep(5)
            chunk_file = output / 'semantic.json.chunks.jsonl'
            count = sum(bool(line.strip()) for line in chunk_file.read_text(encoding='utf-8').splitlines()) if chunk_file.exists() else 0
            if count != previous_count:
                print(json.dumps({'set_id': job['set_id'], 'saved_raw_requests': count, 'resume': bool(resume_from)}), flush=True)
                previous_count = count
    guard()
    summary_path = output / 'summary.json'
    if not summary_path.exists():
        raise RuntimeError('Execution ended without summary: ' + rel(log))
    result = read(summary_path)
    fatal = fatal_provider_codes(result)
    chunk_path = output / 'semantic.json.chunks.jsonl'
    if chunk_path.exists():
        for line in chunk_path.read_text(encoding='utf-8').splitlines():
            if line.strip():
                row = json.loads(line)
                fatal.update(fatal_provider_codes(row.get('provider_error')))
                fatal.update(fatal_provider_codes(row.get('error_details')))
    if fatal:
        event({'stage': 'fatal_provider_stop', 'plan_id': job['plan_id'],
               'set_id': job['set_id'], 'codes': sorted(fatal), 'output': rel(output),
               'policy': 'Nested provider credit/quota code overrides outer transport/retryable. No retry and no next set.'})
        raise RuntimeError('Fatal provider credit/quota stop: ' + ', '.join(sorted(fatal)) + '; evidence=' + rel(output))
    runtime_result = read(output / 'semantic.json.runtime-result.json')
    if runtime_result.get('changed_code_files') or runtime_result.get('changed_input_files'):
        raise RuntimeError('Runtime changed: ' + rel(output))
    return output, result


for job in jobs:
    if (events.parent / 'HALT').exists():
        blocked = 'Root-requested HALT before next set'
        break
    try:
        output, result = run_once(job)
        first_output = output
        first_result = result
        transport_failure = result.get('status') == 'stopped' and result.get('error', {}).get('code') == 'transport' and result.get('error', {}).get('retryable') is True
        if transport_failure:
            event({'stage': 'bounded_transport_resume_wait', 'plan_id': job['plan_id'], 'set_id': job['set_id'],
                   'first_output': rel(first_output), 'wait_seconds': 30, 'maximum_resumes': 1})
            time.sleep(30)
            output, result = run_once(job, resume_from=first_output)
        if result.get('status') != 'receipt_created':
            failure = {'plan_id': job['plan_id'], 'set_id': job['set_id'], 'output': rel(output),
                       'summary': rel(output / 'summary.json'), 'result': result,
                       'first_output': rel(first_output), 'first_result': first_result}
            source_case_shape_failure = '전체 근거 인용 누락' in str(result.get('validation_error') or '')
            if (transport_failure and result.get('error', {}).get('code') == 'transport') or source_case_shape_failure:
                failed_sets.append(failure)
                event({'stage': 'set_incomplete_after_source_case_shape_failure' if source_case_shape_failure else 'set_incomplete_after_bounded_transport_resume', **failure})
                continue
            blocked = failure
            break
        item = {'plan_id': job['plan_id'], 'set_id': job['set_id'], 'output': rel(output),
                'summary': rel(output / 'summary.json'), 'summary_sha256': sha(output / 'summary.json'),
                'receipt': rel(output / 'semantic.json'), 'receipt_sha256': sha(output / 'semantic.json'),
                'first_output': rel(first_output), 'first_result': first_result, **result}
        completed.append(item)
        event({'stage': 'set_finished', **item})
    except RuntimeError as error:
        blocked = str(error)
        break
event({'stage': 'finished' if blocked is None else 'paused', 'completed_sets': len(completed),
       'failed_sets': len(failed_sets), 'excluded_plan_ids': args.exclude_plan_id, 'blocked': blocked})
with summary_file.open('x', encoding='utf-8') as stream:
    json.dump({'finished_at': now(), 'completed': completed, 'failed_sets': failed_sets,
               'blocked': blocked, 'excluded_plan_ids': args.exclude_plan_id,
               'sets_remaining': len(jobs) - len(completed), 'actual_grading_cases': 0,
               'limitation': 'First semantic observations with one exact-cache resume after a transient transport error. A second such error leaves that set incomplete and continues independent assigned sets. Non-pass receipts retain their verdict and need exact-unit repeats; generated-case grading remains separate.'},
              stream, ensure_ascii=False, indent=2)
    stream.write('\n')
