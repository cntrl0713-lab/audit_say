"""Record why semantic-only v5 does not invalidate the running v4 author QA."""
import datetime
import hashlib
import json
import pathlib

ROOT = pathlib.Path.cwd()
CONTROL = ROOT / 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11'
HERE = pathlib.Path(__file__).resolve().parent
OWNED = {'N01', 'N06', 'S01', 'S05', 'S06'}


def read(path):
    return json.loads(pathlib.Path(path).read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def ref(path):
    return {'file': pathlib.Path(path).relative_to(ROOT).as_posix(), 'sha256': sha(path)}


v4_file = CONTROL / 'runtime-v4-stable/runtime-lock.json'
v5_file = CONTROL / 'runtime-v5-stable/runtime-lock.json'
v4, v5 = read(v4_file), read(v5_file)
old = {row['file']: row['sha256'] for row in v4['code_files']}
new = {row['file']: row['sha256'] for row in v5['code_files']}
changed_code = [path for path in old if old[path] != new.get(path)]
assert changed_code == ['cpa_uploader/questionSemanticReview.ts']
assert v4['settings']['grading_model'] == v5['settings']['grading_model'] == 'gpt-5.6-luna'
grader_paths = ['lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts',
                'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts',
                'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts']
for path in grader_paths:
    assert old[path] == new[path] == sha(ROOT / path)
first_manifest = CONTROL / 'final-153-v1/manifest.json'
second_manifest = CONTROL / 'final-153-v2/manifest.json'
before = [row for row in read(first_manifest)['entries'] if row['package'] in OWNED]
after = {row['plan_id']: row for row in read(second_manifest)['entries']}
start_event = json.loads((HERE / 'author-qa-controller-01.jsonl').read_text(encoding='utf-8').splitlines()[0])
qa_overrides = start_event['qa_override']
rows = []
for row in before:
    current = after[row['plan_id']]
    for field in ['file', 'sha256', 'source_files']:
        assert row[field] == current[field], (row['plan_id'], field)
    assert sha(ROOT / row['file']) == row['sha256']
    for source in row['source_files']:
        assert sha(ROOT / source['file']) == source['sha256']
    selected = qa_overrides.get(row['plan_id'], {'file': row['qa_file'], 'sha256': row['qa_sha256']})
    assert sha(ROOT / selected['file']) == selected['sha256']
    subset = row['plan_id'] == 'T16-A'
    if not subset:
        assert selected['file'] == current['qa_file'] and selected['sha256'] == current['qa_sha256']
    else:
        assert row['qa_file'] == current['qa_file'] and row['qa_sha256'] == current['qa_sha256']
    rows.append({'plan_id': row['plan_id'], 'set_id': row['set_id'],
                 'question': {'file': row['file'], 'sha256': row['sha256']},
                 'v4_selected_qa': selected,
                 'v5_manifest_qa': {'file': current['qa_file'], 'sha256': current['qa_sha256']},
                 'same_graded_content': True,
                 'subset_with_existing_v4_reuse_linkage': subset})
payload = {
    'recorded_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'v4_runtime_lock': ref(v4_file), 'v5_runtime_lock': ref(v5_file),
    'v4_manifest': ref(first_manifest), 'v5_manifest': ref(second_manifest),
    'changed_code_files': changed_code,
    'grader_files_unchanged': [{'file': path, 'sha256': old[path]} for path in grader_paths],
    'grading_model': 'gpt-5.6-luna', 'owned_sets': rows,
    'decision': 'Continue the same sequential author-QA stream in phase-two-v4. Semantic instructions and comparison-bank changes are not author-grader inputs. No v3 result is counted as v4 evidence. T16-A retains its explicit 33+8 current-v4 linkage.',
    'scope': 'This record does not transfer semantic-review receipts across changed instructions or comparison banks.',
}
with (HERE / 'v5-grader-identity.json').open('x', encoding='utf-8') as stream:
    json.dump(payload, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
print(json.dumps({'owned_sets': len(rows), 'grader_files': len(grader_paths), 'changed_code': changed_code}))
