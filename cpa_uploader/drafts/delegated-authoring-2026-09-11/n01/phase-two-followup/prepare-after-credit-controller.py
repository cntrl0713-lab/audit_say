"""Prepare, but do not execute, a controller that stops on nested quota errors."""
import ast
import hashlib
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
original = HERE / 'run-owned-semantic-continuation.py'
target = HERE / 'run-owned-semantic-after-credit.py'
source = original.read_text(encoding='utf-8')
needle = "parser.add_argument('--exclude-plan-id', action='append', default=[])"
assert needle in source
source = source.replace(needle, needle + "\nparser.add_argument('--seed-plan-id', action='append', default=[])\nparser.add_argument('--seed-log', action='append', default=[])")
needle = "entries = [row for row in entries if row['plan_id'] not in args.exclude_plan_id]\nsnapshots = {}"
assert needle in source
source = source.replace(needle, """entries = [row for row in entries if row['plan_id'] not in args.exclude_plan_id]
if len(args.seed_plan_id) != len(args.seed_log) or len(set(args.seed_plan_id)) != len(args.seed_plan_id):
    raise RuntimeError('Each seed plan needs exactly one original actual chunk log')
seed_logs = dict(zip(args.seed_plan_id, args.seed_log))
if not set(seed_logs) <= {row['plan_id'] for row in entries}:
    raise RuntimeError('Seed logs must belong to included plans')
snapshots = {}""")
needle = "    jobs.append({'plan_id': entry['plan_id'], 'set_id': entry['set_id'],"
assert needle in source
source = source.replace(needle, """    if entry['plan_id'] in seed_logs:
        seed_log = pathlib.Path(seed_logs[entry['plan_id']]).resolve()
        if not seed_log.name.endswith('.chunks.jsonl'):
            raise RuntimeError('Seed must be an original actual chunk log')
        remember(seed_log)
        for suffix in ['.runtime.json', '.runtime-result.json']:
            remember(str(seed_log)[:-len('.chunks.jsonl')] + suffix)
        command.extend(['--resume-log', rel(seed_log)])
    jobs.append({'plan_id': entry['plan_id'], 'set_id': entry['set_id'],""")
needle = "completed = []\nfailed_sets = []\nblocked = None\n"
assert needle in source
source = source.replace(needle, """def fatal_provider_codes(value):
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
""")
needle = "    result = read(summary_path)\n    runtime_result = read(output / 'semantic.json.runtime-result.json')"
assert needle in source
source = source.replace(needle, """    result = read(summary_path)
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
    runtime_result = read(output / 'semantic.json.runtime-result.json')""")
ast.parse(source)
with target.open('x', encoding='utf-8') as stream:
    stream.write(source)
digest = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
with (HERE / 'after-credit-controller-delta.json').open('x', encoding='utf-8') as stream:
    json.dump({'original': original.name, 'original_sha256': digest(original),
               'successor': target.name, 'successor_sha256': digest(target),
               'api_calls': 0,
               'changes': ['Nested credit_balance_exhausted/insufficient_quota override outer transport/retryable and immediately stop the entire queue.',
                           'Both summary error chains and raw provider/error_details are inspected before any retry or next set.',
                           'Explicit original actual seed logs enable partial T03-A reuse without rerequesting successful units.',
                           'Original executable, past raw logs and the phase HALT remain unchanged.']},
              stream, ensure_ascii=False, indent=2)
    stream.write('\n')
print('Prepared successor; syntax checked; API calls 0')
