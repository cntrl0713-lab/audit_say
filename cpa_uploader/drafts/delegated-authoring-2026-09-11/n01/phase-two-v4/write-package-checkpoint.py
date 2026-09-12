"""Append a package checkpoint after its immutable author-QA runs finish."""
import collections
import datetime
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path.cwd()
CONTROL = ROOT / 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11'
BASE = ROOT / 'cpa_uploader/drafts/delegated-authoring-2026-09-11'
PACKAGE = sys.argv[1].upper()
assert PACKAGE in {'S01', 'S05', 'S06'}


def read(path):
    return json.loads(pathlib.Path(path).read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def rel(path):
    return pathlib.Path(path).relative_to(ROOT).as_posix()


manifest = read(CONTROL / 'final-153-v1/manifest.json')
records = []
totals = collections.Counter()
findings = []
for row in manifest['entries']:
    if row['package'] != PACKAGE:
        continue
    folder = BASE / PACKAGE.lower() / 'phase-two-v4' / row['set_id'] / 'author-qa-01'
    summary_file, inputs_file = folder / 'summary.json', folder / 'inputs.json'
    summary, inputs = read(summary_file), read(inputs_file)
    assert summary['planned_cases'] == summary['recorded_cases'] == row['qa_cases']
    assert not summary['stopped_on_execution_error'] and not summary['changed_inputs']
    changed = [path for path, value in inputs['hashes'].items() if sha(ROOT / path) != value]
    assert not changed, changed
    assert not inputs['mock'] and inputs['model'] == 'gpt-5.6-luna'
    raw_records = [read(folder / item['file']) for item in summary['records']]
    transports = collections.Counter(item['transport'] for item in raw_records)
    assert set(transports) <= {'live_model', 'production_empty_answer_no_model'}
    case_ids = {item['case_id'] for item in raw_records}
    assert case_ids == {item['id'] for item in inputs['qa']['cases']}
    totals.update(cases=len(case_ids), observations=len(raw_records),
                  live=transports['live_model'], blank=transports['production_empty_answer_no_model'],
                  mismatch_cases=len(summary['mismatched_case_ids']))
    records.append({
        'plan_id': row['plan_id'], 'set_id': row['set_id'],
        'required_cases': len(case_ids), 'actual_attempts': len(raw_records),
        'transports': dict(transports),
        'summary': rel(summary_file), 'summary_sha256': sha(summary_file),
        'inputs': rel(inputs_file), 'inputs_sha256': sha(inputs_file),
        'mismatched_case_ids': summary['mismatched_case_ids'],
        'all_inputs_unchanged_at_check': True,
        'raw_records': [{'file': rel(folder / item['file']), 'sha256': sha(folder / item['file'])}
                        for item in summary['records']],
    })
    for issue in folder.parent.glob('grading-findings-*.json'):
        findings.append({'file': rel(issue), 'sha256': sha(issue)})

out = BASE / PACKAGE.lower() / 'phase-two-v4/package-author-qa-checkpoint.json'
payload = {
    'recorded_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'package': PACKAGE,
    'status': 'author_qa_completed_with_variance' if totals['mismatch_cases'] else 'author_qa_pass_v4',
    'sets': len(records), 'required_cases': totals['cases'],
    'actual_observations': totals['observations'],
    'live_model_attempts': totals['live'], 'production_empty_answer_attempts': totals['blank'],
    'mismatched_case_count': totals['mismatch_cases'],
    'records': records, 'findings': findings,
    'limitation': '작성자 QA 증거 범위다. 최초 불일치 사례의 세 차례 결과를 보존하며 최종 일치만으로 통과 처리하지 않는다. 의미검수·생성 사례 채점은 별도다.',
}
with out.open('x', encoding='utf-8') as stream:
    json.dump(payload, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
print(json.dumps({key: value for key, value in payload.items() if key not in {'records', 'findings'}}, ensure_ascii=False))
