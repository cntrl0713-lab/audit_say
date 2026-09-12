"""Preserve a judgment-only answer incorrectly credited for judgment and reason."""
import datetime
import hashlib
import json
import pathlib

ROOT = pathlib.Path.cwd()
FOLDER = ROOT / 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s06/phase-two-v4/pilot-18-005/author-qa-01'
read = lambda file: json.loads(file.read_text(encoding='utf-8'))
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
inputs = read(FOLDER / 'inputs.json')
question = inputs['question_set']['subquestions'][2]
files = sorted(FOLDER.glob('case-0055-attempt-*.json'))
assert len(files) == 3
records = [read(file) for file in files]
assert all(row['case_id'] == 'sub3/boundary-crit11' for row in records)
assert len({row['request_hash'] for row in records}) == len({row['schema_hash'] for row in records}) == len({row['model'] for row in records}) == 1
assert all(row['answers'] == records[0]['answers'] and row['expected'] == records[0]['expected'] for row in records)
payload = {
    'recorded_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'finding_id': 'S06-GRADING-002', 'status': 'unresolved_judgment_only_overcredit_variance',
    'plan_id': 'T18-A', 'set_id': 'pilot-18-005', 'subquestion_id': 'sub3',
    'case_id': 'sub3/boundary-crit11', 'target_criterion_id': 'crit11',
    'original_answer': records[0]['expected']['answer'], 'expected': records[0]['expected'],
    'question_prompt': question['prompt'], 'target_criterion': question['criteria'][0],
    'shared_context': inputs['question_set']['shared_context'],
    'direct_requirement': question['requirements'][0],
    'input_snapshot': {'file': (FOLDER / 'inputs.json').relative_to(ROOT).as_posix(), 'sha256': sha(FOLDER / 'inputs.json')},
    'request_hash': records[0]['request_hash'], 'schema_hash': records[0]['schema_hash'], 'model': records[0]['model'],
    'same_answer_expected_input_schema_model': True,
    'score_sequence': [row['result']['score'] for row in records],
    'observations': [{
        'file': file.relative_to(ROOT).as_posix(), 'sha256': sha(file), 'attempt': row['attempt'],
        'raw_criterion': row['raw_judgment']['subquestions'][2]['verdicts'][0],
        'final_criterion': row['result']['subquestions'][2]['criteria'][0],
        'score': row['result']['score'], 'security_flag': row['result']['security_flag'],
        'trace_stages': [item['stage'] for item in row['trace']], 'matched': row['matched'],
    } for file, row in zip(files, records)],
    'analysis': [
        '발문은 적용대상 판단과 결정적인 이유를 연결하여 요구하고 crit11은 그 둘을 결합한1점을 명시한다. 기준서1200.2(b)의 자산 또는 매출 미만 조건을 사례에 적용하여 A의 매출99억원이100억원 미만이라는 이유를 설명해야 한다.',
        '답안에는 A의 적용대상이라는 결론만 있다. 매출금액·미만 조건·자산과 무관한 또는 관계 등 이유 명제는 전혀 제시하지 않았다. 이미 주어진 수치가 있다는 사실은 응시자가 그 이유를 서술했다는 증거가 아니다.',
        '이유가 결론을 함축할 수 있다는 허용과 반대로, 결론만으로 특정 근거의 이해를 인정하지 않는다. 현재 기대0점은 발문과 명시된 결합 채점 계약에 맞다.',
        '첫두 원시 판단은 판단했다는 사실만 이유로 들어 met를 부여했고 세번째는 결정적인 이유의 누락을 식별했다. 모든 점수 차이는 judgment 단계이며 인용검증·보안보정·합산이 명제를 변경한 결과가 아니다.',
    ],
    'decision': 'Retain the correct zero-point expectation and all 1/1/0 observations. Do not strengthen the answer or weaken the claim to make this case pass. Root owns any shared grading-policy follow-up.',
}
with (FOLDER.parent / 'grading-findings-02.json').open('x', encoding='utf-8') as stream:
    json.dump(payload, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
print(json.dumps({'finding_id': payload['finding_id'], 'scores': payload['score_sequence']}, ensure_ascii=False))
