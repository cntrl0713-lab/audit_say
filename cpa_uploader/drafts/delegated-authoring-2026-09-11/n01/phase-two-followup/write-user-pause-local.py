"""Local evidence inventory only. No model/API/network imports or execution."""
from pathlib import Path
import datetime
import hashlib
import json

root = Path.cwd()
base = root / 'cpa_uploader/drafts/delegated-authoring-2026-09-11'
control = root / 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11'
out = base / 'n01/phase-two-v5'
read = lambda p: json.loads(Path(p).read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
rel = lambda p: Path(p).relative_to(root).as_posix()
manifest_path = control / 'final-153-v3/manifest-plan-followup-02.json'
entries = [e for e in read(manifest_path)['entries'] if e['package'] in {'N01', 'N06', 'S01', 'S05', 'S06'}]
labels = {
    'T02-A': 'bank-v3-owned-resume-01', 'T01-A': 'bank-v3-owned-02',
    'T03-A': 'bank-v3-after-refill-01', 'T04-B': 'bank-v3-after-refill-01',
    'T16-A': 'bank-v3-after-refill-02', 'T16-B': 'bank-v3-after-refill-02',
    'T17-A': 'bank-v3-after-refill-02', 'T02-B': 'bank-v3-after-refill-02',
    'T01-B': 'bank-v3-after-refill-03', 'T03-B': 'bank-v3-after-refill-03',
    'T04-C': 'bank-v3-after-refill-03', 'T15-A': 'bank-v3-after-refill-03',
    'T15-B': 'bank-v3-after-refill-03', 'T16-C': 'bank-v3-after-refill-04',
    'T14-C': 'bank-v3-after-refill-04', 'T17-B': 'bank-v3-after-refill-04',
    'T18-A': 'bank-v3-after-refill-04', 'T19-A': 'bank-v3-after-refill-04',
}
observations, reused, inventory = [], [], []
for entry in entries:
    folder = base / entry['package'].lower() / 'phase-two-v5' / entry['set_id']
    q = read(root / entry['file'])
    assert sha(root / entry['file']) == entry['sha256']
    valid, attempted = set(), set()
    for log in sorted(folder.glob('bank-v3-*/semantic.json.chunks.jsonl')):
        assert (log.parent / 'summary.json').exists(), 'Unexpected unfinished process log'
        for n, row in enumerate([json.loads(s) for s in log.read_text(encoding='utf-8').splitlines() if s.strip()], 1):
            assert row['record_kind'] == 'new_actual_model_request' and row['transport'] == 'model'
            okay = not row.get('error') and row.get('response') is not None
            attempted.add(row['unit_id'])
            if okay:
                assert row['unit_id'] not in valid
                valid.add(row['unit_id'])
            observations.append({'plan_id': entry['plan_id'], 'log': rel(log), 'sha256': sha(log), 'line': n,
                'unit_id': row['unit_id'], 'performed_at': row['performed_at'], 'valid_response': okay,
                'request_id': row.get('request_id'), 'error': row.get('error')})
        reuse_path = log.parent / 'reused-actual-model-evidence.jsonl'
        if reuse_path.exists():
            for row in [json.loads(s) for s in reuse_path.read_text(encoding='utf-8').splitlines() if s.strip()]:
                assert row['new_api_request'] is False
                reused.append({'file': rel(reuse_path), 'unit_id': row['unit_id'], 'original_log': row['original_log'], 'original_line': row['original_line']})
    active = folder / labels[entry['plan_id']]
    result = read(active / 'summary.json')
    expected = [uid for sub in q['subquestions'] for uid in ['subquestion:' + sub['id'], *['criterion:' + sub['id'] + ':' + c['id'] for c in sub['criteria']]]]
    inventory.append({'plan_id': entry['plan_id'], 'set_id': entry['set_id'], 'latest_output': rel(active),
        'status': result['status'], 'receipt_verdict': result.get('receipt_verdict'),
        'expected_units': len(expected), 'unique_valid_units': len(valid),
        'unreached_units': [u for u in expected if u not in attempted],
        'units_without_valid_response': [u for u in expected if u not in valid],
        'current_plan_review_status': 'not_started_after_accepted_plan_followup' if entry['plan_id'] == 'T17-B' else 'same_current_input',
        'original_evidence_preserved': True})
observations.sort(key=lambda r: (r['performed_at'], r['log'], r['line']))
pause = '2026-09-11T05:17:20+00:00'
assert all(datetime.datetime.fromisoformat(r['performed_at'].replace('Z', '+00:00')) < datetime.datetime.fromisoformat(pause) for r in observations)
totals = {'assigned_sets': len(entries), 'actual_semantic_requests_bank_v3': len(observations),
    'valid_semantic_responses': sum(r['valid_response'] for r in observations),
    'failed_requests_or_grounding': sum(not r['valid_response'] for r in observations),
    'reuse_applications_without_api': len(reused),
    'full_pass_receipts': sum(r['receipt_verdict'] == 'pass' for r in inventory),
    'full_nonpass_receipts': sum(r['receipt_verdict'] not in {None, 'pass'} for r in inventory),
    'partial_all_independent_units_attempted': sum(r['status'] == 'partial_units_completed' for r in inventory),
    'mid_set_incomplete': sum(r['status'] == 'stopped' for r in inventory),
    'expected_units_original_plans': sum(r['expected_units'] for r in inventory),
    'valid_units_original_plans': sum(r['unique_valid_units'] for r in inventory),
    'unreached_original_plan_units': sum(len(r['unreached_units']) for r in inventory),
    'current_t17_b_plan_semantic_requests': 0, 'generated_case_grading_requests': 0,
    'new_requests_after_user_pause': 0}
report = {'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'user_requested_api_pause_local_review_only', 'pause_confirmed_at': pause,
    'manifest': rel(manifest_path), 'manifest_sha256': sha(manifest_path),
    'last_owned_session': 47336, 'session_status': 'already_completed_and_closed_before_pause',
    'last_controller_finished_at': read(out / 'bank-v3-after-refill-04-controller-summary.json')['finished_at'],
    'owned_api_processes_at_pause': [], 'owned_queued_api_jobs_started_after_pause': [],
    'last_request': observations[-1], 'last_valid_response': next(r for r in reversed(observations) if r['valid_response']),
    'totals': totals, 'sets': inventory, 'actual_requests': observations, 'reuse_applications': reused,
    'author_qa': {'unique_cases': 808, 'observations': 834, 'live_requests': 783, 'production_blank': 51, 'unresolved_variance_cases': 5},
    'remaining': 'Three stopped sets have unreached units; T17-B accepted new plan has no actual review. Nonpass exact diagnostics and generated-case grading remain unexecuted. All future API work paused by user.',
    'api_calls_for_this_audit': 0}
target = out / 'user-pause-20260911-1417.json'
assert not target.exists()
target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(totals, ensure_ascii=False, indent=2))
