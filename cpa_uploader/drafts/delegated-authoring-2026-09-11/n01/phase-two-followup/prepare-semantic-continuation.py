"""Create a preserved successor controller with one bounded transport resume."""
import hashlib
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
original = HERE / 'run-owned-semantic.py'
target = HERE / 'run-owned-semantic-continuation.py'
source = original.read_text(encoding='utf-8')
source = source.replace("parser.add_argument('--execute', action='store_true')", "parser.add_argument('--execute', action='store_true')\nparser.add_argument('--exclude-plan-id', action='append', default=[])")
needle = "    raise RuntimeError('Assigned set inventory differs')\nsnapshots = {}"
assert needle in source
source = source.replace(needle, "    raise RuntimeError('Assigned set inventory differs')\nif not set(args.exclude_plan_id) <= EXPECTED_PLANS:\n    raise RuntimeError('Excluded plan is outside the assignment')\nentries = [row for row in entries if row['plan_id'] not in args.exclude_plan_id]\nsnapshots = {}")
start = source.index('completed = []\nblocked = None\nfor job in jobs:')
source = source[:start] + '''completed = []
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
            if transport_failure and result.get('error', {}).get('code') == 'transport':
                failed_sets.append(failure)
                event({'stage': 'set_incomplete_after_bounded_transport_resume', **failure})
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
    stream.write('\\n')
'''
with target.open('x', encoding='utf-8') as stream:
    stream.write(source)
digest = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
with (HERE / 'semantic-controller-continuation-delta.json').open('x', encoding='utf-8') as stream:
    json.dump({'original': original.name, 'original_sha256': digest(original),
               'successor': target.name, 'successor_sha256': digest(target),
               'changes': ['Explicit excluded plan IDs for independently recovered first set.',
                           'One 30-second-wait exact-cache resume after retryable transport failure.',
                           'A second transport failure preserves an incomplete record and continues independent sets.',
                           'All other identity, code, ownership, input, model and API-stream guards remain.'],
               'api_calls_by_preparation': 0}, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
