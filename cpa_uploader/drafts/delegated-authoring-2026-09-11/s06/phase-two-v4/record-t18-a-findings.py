"""Record the observed strict-opposite classification variance without edits."""
import datetime
import hashlib
import json
import pathlib

ROOT = pathlib.Path.cwd()
FOLDER = ROOT / 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s06/phase-two-v4/pilot-18-005/author-qa-01'
read = lambda file: json.loads(file.read_text(encoding='utf-8'))
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
inputs = read(FOLDER / 'inputs.json')
question = inputs['question_set']['subquestions'][0]
files = sorted(FOLDER.glob('case-0009-attempt-*.json'))
assert len(files) == 3
records = [read(file) for file in files]
assert all(record['case_id'] == 'sub1/opposite-crit1' for record in records)
assert len({record['request_hash'] for record in records}) == 1
assert len({record['schema_hash'] for record in records}) == 1
assert len({record['model'] for record in records}) == 1
assert all(record['answers'] == records[0]['answers'] and record['expected'] == records[0]['expected'] for record in records)
observations = []
for file, record in zip(files, records):
    observations.append({
        'file': file.relative_to(ROOT).as_posix(), 'sha256': sha(file),
        'attempt': record['attempt'], 'raw_criterion': record['raw_judgment']['subquestions'][0]['verdicts'][0],
        'final_criterion': record['result']['subquestions'][0]['criteria'][0],
        'score': record['result']['score'], 'security_flag': record['result']['security_flag'],
        'trace_stages': [row['stage'] for row in record['trace']], 'matched': record['matched'],
    })
payload = {
    'recorded_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'finding_id': 'S06-GRADING-001', 'status': 'unresolved_zero_verdict_classification_variance',
    'plan_id': 'T18-A', 'set_id': 'pilot-18-005', 'subquestion_id': 'sub1',
    'case_id': 'sub1/opposite-crit1', 'target_criterion_id': 'crit1',
    'original_answer': records[0]['expected']['answer'], 'expected': records[0]['expected'],
    'question_prompt': question['prompt'], 'target_criterion': question['criteria'][0],
    'direct_requirement': question['requirements'][0],
    'input_snapshot': {'file': (FOLDER / 'inputs.json').relative_to(ROOT).as_posix(), 'sha256': sha(FOLDER / 'inputs.json')},
    'request_hash': records[0]['request_hash'], 'schema_hash': records[0]['schema_hash'],
    'model': records[0]['model'], 'same_answer_expected_input_schema_model': True,
    'score_sequence': [record['result']['score'] for record in records],
    'target_verdict_sequence': [record['raw_judgment']['subquestions'][0]['verdicts'][0]['verdict'] for record in records],
    'observations': observations,
    'analysis': [
        'KGA 1200 문단2는 (a)의 질적 제외조건과 (b)의 규모조건을 모두 충족해야 적용한다고 정한다. 문단2(a)(i)는 주권상장법인을 제외하므로 작은 규모가 이 제외를 해제하지 않는다.',
        '답안은 주권상장법인에 대한 작은 규모의 예외를 직접 주장한다. 대상 crit1과 명시적으로 반대되므로 contradicted 기대값을 유지한다. 다른 다섯 기업 범주는 이 답안에 없고, 실제 상장법인을 말한 것을 상장 예정 등 다른 범주에 확대하지 않는다.',
        '세 차례 점수는 모두0으로 같다. 대상 판정은 not_met/contradicted/not_met로 변동했다. 최초·세 번째 원시 판단이 반대를 단순 미제시로 분류했고, 인용 검증·보안 보정·합산에서의 변경은 없다.',
        'condition_boundary 사례가 아닌 명시 opposite 사례이므로 두0점 분류를 허용범위로 합쳐 통과시키지 않는다. 두 번째 일치만 선택하거나 원답안·기대값을 변경하지 않는다.',
    ],
    'decision': 'Preserve all three observations and correct strict expected verdict; report model judgment variance with no score impact. No extra API or content/QA patch is proposed.',
}
output = FOLDER.parent / 'grading-findings-01.json'
with output.open('x', encoding='utf-8') as stream:
    json.dump(payload, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
print(json.dumps({'finding_id': payload['finding_id'], 'score_sequence': payload['score_sequence'], 'verdicts': payload['target_verdict_sequence']}, ensure_ascii=False))
