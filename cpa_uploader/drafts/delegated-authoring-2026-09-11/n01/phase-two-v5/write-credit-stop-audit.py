"""Build a read-only inventory of completed, partial and failed actual runs."""
import ast
import collections
import datetime
import hashlib
import json
import pathlib

ROOT = pathlib.Path.cwd()
BASE = ROOT / 'cpa_uploader/drafts/delegated-authoring-2026-09-11'
HERE = pathlib.Path(__file__).resolve().parent
read = lambda file: json.loads(pathlib.Path(file).read_text(encoding='utf-8'))
sha = lambda file: hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest()
rel = lambda file: pathlib.Path(file).resolve().relative_to(ROOT).as_posix()
successor = BASE / 'n01/phase-two-followup/run-owned-semantic-after-credit.py'
syntax = ast.parse(successor.read_text(encoding='utf-8'))
function = next(node for node in syntax.body if isinstance(node, ast.FunctionDef) and node.name == 'fatal_provider_codes')
namespace = {}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(successor), 'exec'), namespace)
fatal_codes = namespace['fatal_provider_codes']
assert fatal_codes({'code': 'transport', 'retryable': True, 'cause': {'code': 'credit_balance_exhausted'}}) == {'credit_balance_exhausted'}
assert fatal_codes({'error': {'cause': {'cause': {'code': 'insufficient_quota'}}}}) == {'insufficient_quota'}
assert fatal_codes({'code': 'transport', 'retryable': True, 'cause': {'name': 'TypeError'}}) == set()
assert fatal_codes([{'provider_error': {'status': 429, 'code': 'insufficient_quota'}}]) == {'insufficient_quota'}
assert fatal_codes({'status': 429, 'code': 'rate_limit_exceeded'}) == set()

run_rows, observations, reuse_rows = [], [], []
for package in ['n01', 'n06', 's01', 's05', 's06']:
    for log in sorted((BASE / package / 'phase-two-v5').glob('*/bank-v3-owned-*/semantic.json.chunks.jsonl')):
        folder = log.parent
        summary_file = folder / 'summary.json'
        runtime_file = folder / 'semantic.json.runtime.json'
        runtime_result_file = folder / 'semantic.json.runtime-result.json'
        summary, runtime, runtime_result = read(summary_file), read(runtime_file), read(runtime_result_file)
        assert runtime['mock'] is False
        assert not runtime_result['changed_code_files'] and not runtime_result.get('changed_input_files')
        changed_at_audit = [file for file, value in runtime['code_hashes'].items() if sha(ROOT / file) != value]
        assert not changed_at_audit, changed_at_audit
        records = [json.loads(line) for line in log.read_text(encoding='utf-8').splitlines() if line.strip()]
        for line, record in enumerate(records, 1):
            assert record['transport'] == 'model' and record['record_kind'] == 'new_actual_model_request'
            observations.append({'file': rel(log), 'line': line, 'log_sha256': sha(log),
                                 'set_id': record['set_id'], 'unit_id': record['unit_id'],
                                 'performed_at': record['performed_at'], 'attempt': record['attempt'],
                                 'model': record['model'], 'input_hash': record['input_hash'],
                                 'schema_hash': record['schema_hash'], 'instructions_hash': record['instructions_hash'],
                                 'success': not record.get('error') and record.get('response') is not None,
                                 'provider_error': record.get('provider_error'), 'error_details': record.get('error_details'),
                                 'fatal_provider_codes': sorted(fatal_codes(record.get('provider_error')) | fatal_codes(record.get('error_details')))})
        reuse_file = folder / 'reused-actual-model-evidence.jsonl'
        reused = [json.loads(line) for line in reuse_file.read_text(encoding='utf-8').splitlines() if line.strip()] if reuse_file.exists() else []
        reuse_rows.extend({'file': rel(reuse_file), 'line': index + 1, 'sha256': sha(reuse_file),
                           'set_id': row['set_id'], 'unit_id': row['unit_id'],
                           'original_log': row['original_log'], 'original_line': row['original_line'],
                           'new_api_request': row['new_api_request']} for index, row in enumerate(reused))
        assert all(row['new_api_request'] is False for row in reused)
        receipt_file = folder / 'semantic.json'
        run_rows.append({'set_id': records[0]['set_id'], 'folder': rel(folder),
                         'status': summary['status'], 'receipt_verdict': summary.get('receipt_verdict'),
                         'actual_requests': len(records), 'successful_new_units': sum(not row.get('error') and row.get('response') is not None for row in records),
                         'reused_applications_without_api': len(reused),
                         'summary': rel(summary_file), 'summary_sha256': sha(summary_file),
                         'raw_log': rel(log), 'raw_log_sha256': sha(log),
                         'runtime': rel(runtime_file), 'runtime_sha256': sha(runtime_file),
                         'runtime_result': rel(runtime_result_file), 'runtime_result_sha256': sha(runtime_result_file),
                         'receipt': rel(receipt_file) if receipt_file.exists() else None,
                         'receipt_sha256': sha(receipt_file) if receipt_file.exists() else None,
                         'changed_inputs_or_code': False})

observations.sort(key=lambda row: row['performed_at'])
credit = [row for row in observations if row['fatal_provider_codes']]
successful = [row for row in observations if row['success']]
finished = read(HERE / 'bank-v3-owned-02-controller-summary.json')['finished_at']
halt_time = datetime.datetime.fromtimestamp((HERE / 'HALT').stat().st_mtime, datetime.timezone.utc).isoformat()
assert observations[-1]['performed_at'] < finished < halt_time
payload = {
    'recorded_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'stopped_external_credit_balance', 'active_owned_api_streams': 0,
    'actual_model_request_attempts': len(observations),
    'successful_actual_responses': len(successful), 'failed_actual_requests': len(observations) - len(successful),
    'completed_receipts': sum(row['status'] == 'receipt_created' for row in run_rows),
    'incomplete_actual_run_logs': sum(row['status'] != 'receipt_created' for row in run_rows),
    'reused_unit_applications_without_new_api': len(reuse_rows),
    'successful_units_by_set': dict(collections.Counter(row['set_id'] for row in successful)),
    'explicit_credit_exhaustion_records': credit,
    'first_explicit_credit_error_record': credit[0],
    'last_actual_request_started_at': observations[-1]['performed_at'],
    'controller_finished_at': finished, 'halt_file_timestamp': halt_time,
    'detection_and_call_boundary': [
        'The agent first recognized explicit credit_balance_exhausted while reading the completed controller tail containing the final T19-A error and finished event. This was after all64 requests had ended.',
        'A subsequent full raw-log audit located the first explicit credit error earlier in T03-A resume. Before recognition, the controller had continued under the outer transport/retryable=true classification, including its bounded one-resume policy for each independent set.',
        'No new API calls occurred after that recognition. All semantic processes were complete/closed, HALT was preserved, and only local preparation/read-only audits followed. Exact earlier logs and executables remain unchanged.',
        'The historical metadata demonstrates the classification gap; it is not relabeled as a successful or newly repaired run.',
    ],
    'successor_controller': {'file': rel(successor), 'sha256': sha(successor), 'syntax_and_nested_stop_checks': 5, 'api_calls_in_validation': 0},
    'generated_case_grading': {'actual_calls': 0, 'T02_A_local_preflight_cases': 45, 'T02_A_unique_answers': 38},
    'author_qa_evidence': {'file': rel(BASE / 'n01/phase-two-v4/owned-author-qa-evidence-index.json'), 'mandatory_cases': 808, 'unresolved_variance_cases': 5},
    'runs': run_rows, 'actual_observations': observations, 'reused_unit_applications': reuse_rows,
    'resume_conditions': 'Restore the provider credit balance and confirm the explicit lock/model/source/bank identities. Preserve HALT history; use new paths, the nested-quota-stop successor, and exact original successful chunk logs. Do not rerequest the two complete pass receipts or manufacture a completion for the16 incomplete sets.',
}
with (HERE / 'credit-stop-audit.json').open('x', encoding='utf-8') as stream:
    json.dump(payload, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
print(json.dumps({key: value for key, value in payload.items() if key in ['status', 'actual_model_request_attempts', 'successful_actual_responses', 'failed_actual_requests', 'completed_receipts', 'incomplete_actual_run_logs', 'reused_unit_applications_without_new_api', 'successful_units_by_set', 'last_actual_request_started_at', 'controller_finished_at', 'halt_file_timestamp']}, ensure_ascii=False))
