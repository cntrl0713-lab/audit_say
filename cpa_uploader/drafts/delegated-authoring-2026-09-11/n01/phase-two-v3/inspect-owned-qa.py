"""Read-only progress and mismatch details for this worker's v3 author QA."""
import json
import pathlib

root = pathlib.Path.cwd()
manifest = json.loads((root / 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v1/manifest.json').read_text(encoding='utf-8'))
entries = [row for row in manifest['entries'] if row['package'] in {'N01', 'N06', 'S01', 'S05', 'S06'}]
progress = []
issues = []
for entry in entries:
    folder = root / entry['output_directory'] / 'phase-two-v3' / entry['set_id'] / 'author-qa-01'
    if not folder.exists():
        continue
    files = sorted(folder.glob('case-*-attempt-*.json'))
    records = [json.loads(file.read_text(encoding='utf-8')) for file in files]
    summary_file = folder / 'summary.json'
    summary = json.loads(summary_file.read_text(encoding='utf-8')) if summary_file.exists() else None
    progress.append({
        'plan_id': entry['plan_id'], 'set_id': entry['set_id'], 'planned': entry['qa_cases'],
        'cases': len({row['case_id'] for row in records}), 'attempts': len(records),
        'live': sum(row.get('transport') == 'live_model' for row in records),
        'blank': sum(row.get('transport') == 'production_empty_answer_no_model' for row in records),
        'mismatch_cases': sorted({row['case_id'] for row in records if not row['matched']}),
        'completed': summary is not None,
        'execution_error': summary['stopped_on_execution_error'] if summary else None,
    })
    for file, row in zip(files, records):
        if row['matched']:
            continue
        actual = row.get('result', {})
        subquestion = next((q for q in actual.get('subquestions', []) if q['subquestion_id'] == row['expected']['subquestion_id']), {})
        issues.append({
            'file': file.relative_to(root).as_posix(), 'case_id': row['case_id'], 'attempt': row['attempt'],
            'answer': row['expected']['answer'], 'expected_points': row['expected']['expected_points'],
            'actual_points': actual.get('score'), 'security_flag': actual.get('security_flag'),
            'differences': row.get('verdict_differences'), 'actual_criteria': subquestion.get('criteria'),
            'error': row.get('error'),
        })
print(json.dumps({'progress': progress, 'issues': issues}, ensure_ascii=False, indent=2))
