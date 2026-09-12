"""Read-only compact progress of the current owned semantic stream."""
import argparse
import json
import pathlib

parser = argparse.ArgumentParser()
parser.add_argument('--manifest', required=True)
parser.add_argument('--phase', required=True)
parser.add_argument('--run-name', required=True)
args = parser.parse_args()
read = lambda file: json.loads(pathlib.Path(file).read_text(encoding='utf-8'))
owned = {'N01', 'N06', 'S01', 'S05', 'S06'}
progress, issues = [], []
for entry in read(args.manifest)['entries']:
    if entry['package'] not in owned:
        continue
    folder = pathlib.Path(entry['output_directory']) / args.phase / entry['set_id'] / args.run_name
    if not folder.exists():
        continue
    summary_file = folder / 'summary.json'
    summary = read(summary_file) if summary_file.exists() else {}
    cache_file = folder / 'cache-audit.json'
    cache = read(cache_file) if cache_file.exists() else {}
    raw_file = folder / 'semantic.json.chunks.jsonl'
    rows = [json.loads(line) for line in raw_file.read_text(encoding='utf-8').splitlines() if line.strip()] if raw_file.exists() else []
    valid = [row for row in rows if not row.get('error') and row.get('response')]
    progress.append({'plan_id': entry['plan_id'], 'set_id': entry['set_id'],
                     'expected_units': cache.get('expected_units'), 'saved_actual_requests': len(rows),
                     'valid_responses': len(valid), 'status': summary.get('status', 'running'),
                     'receipt_verdict': summary.get('receipt_verdict'),
                     'generated_cases': sum(len(row['response'].get('cases', [])) for row in valid)})
    for index, row in enumerate(rows):
        checks = row.get('response', {}).get('checks', {}) if row.get('response') else {}
        failing = {key: value for key, value in checks.items() if value != 'pass'}
        if row.get('error') or failing:
            issues.append({'plan_id': entry['plan_id'], 'set_id': entry['set_id'], 'unit_id': row['unit_id'],
                           'file': raw_file.as_posix(), 'line': index + 1, 'attempt': row['attempt'],
                           'checks': failing, 'error': row.get('error'), 'http_status': row.get('http_status'),
                           'rationale': row.get('response', {}).get('rationale') if row.get('response') else None})
print(json.dumps({'completed_sets': sum(row['status'] == 'receipt_created' for row in progress),
                  'saved_actual_requests': sum(row['saved_actual_requests'] for row in progress),
                  'generated_cases_so_far': sum(row['generated_cases'] for row in progress),
                  'recent_progress': progress[-2:], 'issues': issues}, ensure_ascii=False, indent=2))
