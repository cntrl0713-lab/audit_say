"""After the semantic loop, grade the authoritative pass receipts sequentially.

No favorable receipt is selected from a glob: each receipt is the one recorded
by the completed semantic controller, plus the explicitly recovered T02-A.
Default mode prints the plan and makes no API request.
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
BASE = ROOT / 'cpa_uploader/drafts/delegated-authoring-2026-09-11'
CONTROL = ROOT / 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11'
OWNED = {'N01', 'N06', 'S01', 'S05', 'S06'}
read = lambda file: json.loads(pathlib.Path(file).read_text(encoding='utf-8'))
sha = lambda file: hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
rel = lambda file: pathlib.Path(file).resolve().relative_to(ROOT).as_posix()
parser = argparse.ArgumentParser(description=__doc__)
for option in ['manifest', 'runtime-lock', 'receipt-index', 'run-name']:
    parser.add_argument('--' + option, required=True)
parser.add_argument('--execute', action='store_true')
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9][a-z0-9-]{2,60}', args.run_name):
    raise RuntimeError('New lowercase run name required')
lock = read(args.runtime_lock)
manifest = read(args.manifest)
phase = lock['phase_directory']
if not re.fullmatch(r'phase-two-v[0-9]+', phase):
    raise RuntimeError('Unexpected explicit phase directory')
index = read(args.receipt_index)
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
snapshots = {}


def remember(file, expected=None):
    file = pathlib.Path(file).resolve()
    actual = sha(file)
    if expected is not None and actual != expected:
        raise RuntimeError('Frozen identity differs: ' + rel(file))
    snapshots[file] = actual


remember(args.manifest, lock['manifest_sha256'])
for file in [args.runtime_lock, args.receipt_index, __file__, CONTROL / 'run-generated-qa.ts']:
    remember(file)
for identity in [lock['comparison_bank'], *lock['code_files'], *lock.get('source_files', [])]:
    remember(ROOT / identity['file'], identity['sha256'])
for identity in index.get('provenance_files', []):
    remember(ROOT / identity['file'], identity['sha256'])
jobs, skipped = [], []
for entry in entries:
    identity = receipts.get(entry['plan_id'])
    if identity is None:
        skipped.append({'plan_id': entry['plan_id'], 'reason': 'No completed authoritative receipt; prior incomplete records remain.'})
        continue
    receipt_path = pathlib.Path(identity['receipt']).resolve()
    remember(receipt_path, identity['receipt_sha256'])
    receipt = read(receipt_path)['reviews'][0]
    if receipt['set_id'] != entry['set_id']:
        raise RuntimeError('Semantic set ID mismatch')
    if receipt['verdict'] != 'pass':
        skipped.append({'plan_id': entry['plan_id'], 'reason': 'Non-pass semantic receipt retained for investigation.',
                        'verdict': receipt['verdict'], 'receipt': rel(receipt_path)})
        continue
    remember(ROOT / entry['file'], entry['sha256'])
    for source in [*entry['plan_files'], *entry['source_files']]:
        remember(ROOT / source['file'], source['sha256'])
    for suffix in ['.runtime.json', '.runtime-result.json']:
        remember(str(receipt_path) + suffix)
    parent = BASE / entry['package'].lower() / phase / entry['set_id']
    output, log = parent / args.run_name, parent / (args.run_name + '.console.log')
    if output.exists() or log.exists():
        raise RuntimeError('Existing generated-case evidence: ' + rel(output))
    command = ['node', '--env-file=.env.local', '--import', 'tsx', rel(CONTROL / 'run-generated-qa.ts'),
               '--manifest', rel(args.manifest), '--plan-id', entry['plan_id'],
               '--runtime-lock', rel(args.runtime_lock), '--semantic', rel(receipt_path),
               '--output', rel(output), '--execute']
    jobs.append({'plan_id': entry['plan_id'], 'set_id': entry['set_id'],
                 'semantic': rel(receipt_path), 'output': rel(output), 'console_log': rel(log), 'command': command})
if not args.execute:
    print(json.dumps({'mode': 'prepare_only', 'api_calls': 0, 'pass_receipts': len(jobs),
                      'skipped': skipped, 'jobs': jobs}, ensure_ascii=False, indent=2))
    raise SystemExit(0)
events = BASE / 'n01' / phase / (args.run_name + '-controller.jsonl')
summary_file = events.with_name(args.run_name + '-controller-summary.json')
if events.exists() or summary_file.exists():
    raise RuntimeError('New controller output label required')
events.parent.mkdir(parents=True, exist_ok=True)
events.touch(exist_ok=False)


def guard():
    changed = [rel(file) for file, expected in snapshots.items() if not file.exists() or sha(file) != expected]
    if changed:
        raise RuntimeError('Frozen input changed: ' + ', '.join(changed))


def event(value):
    value = {'recorded_at': now(), **value}
    with events.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(value, ensure_ascii=False) + '\n')
    print(json.dumps(value, ensure_ascii=False), flush=True)


def fatal_provider_codes(value):
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


event({'stage': 'start', 'pass_receipts': len(jobs), 'skipped': skipped, 'parallel_api_streams': 1,
       'input_hashes': {rel(file): value for file, value in snapshots.items()}})
completed, blocked = [], None
for job in jobs:
    if (events.parent / 'HALT').exists():
        blocked = 'Root-requested halt before next set'
        break
    try:
        guard()
        output, log = ROOT / job['output'], ROOT / job['console_log']
        output.parent.mkdir(parents=True, exist_ok=True)
        event({'stage': 'set_start', **job})
        with log.open('x', encoding='utf-8') as stream:
            proc = subprocess.Popen(job['command'], cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
            while proc.poll() is None:
                time.sleep(5)
        guard()
        fatal = set()
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
        if (output / 'stopped.json').exists():
            blocked = {'plan_id': job['plan_id'], 'set_id': job['set_id'], 'stopped': read(output / 'stopped.json'), 'output': job['output']}
            break
        run_summary = output / 'summary.json'
        if not run_summary.exists():
            blocked = {'plan_id': job['plan_id'], 'exit_code': proc.returncode, 'missing_summary': True, 'console_log': job['console_log']}
            break
        result = read(run_summary)
        completed.append({'plan_id': job['plan_id'], 'set_id': job['set_id'],
                          'output': job['output'], 'summary': rel(run_summary), 'summary_sha256': sha(run_summary), **result})
        event({'stage': 'set_finished', **completed[-1]})
    except RuntimeError as error:
        blocked = str(error)
        break
event({'stage': 'finished' if blocked is None else 'paused', 'completed_sets': len(completed), 'blocked': blocked})
with summary_file.open('x', encoding='utf-8') as stream:
    json.dump({'finished_at': now(), 'completed': completed, 'blocked': blocked, 'skipped': skipped,
               'remaining_pass_receipts': len(jobs) - len(completed),
               'limitation': 'All mismatches and three observations remain in original generated QA outputs. Manual expectation corrections require complete source/unit/case review and a separately linked manual_reasoned follow-up, never editing original model receipts.'},
              stream, ensure_ascii=False, indent=2)
    stream.write('\n')
