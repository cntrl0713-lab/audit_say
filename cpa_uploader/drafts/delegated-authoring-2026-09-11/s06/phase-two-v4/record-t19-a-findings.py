"""Preserve the boundary between assurance-level explanation and conclusion."""
import datetime
import hashlib
import json
import pathlib

ROOT = pathlib.Path.cwd()
FOLDER = ROOT / 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s06/phase-two-v4/pilot-19-005/author-qa-01'
read = lambda file: json.loads(file.read_text(encoding='utf-8'))
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
inputs = read(FOLDER / 'inputs.json')
question = inputs['question_set']['subquestions'][0]
files = sorted(FOLDER.glob('case-0013-attempt-*.json'))
assert len(files) == 3
records = [read(file) for file in files]
assert all(row['case_id'] == 'sub1/boundary-crit2' for row in records)
assert len({row['request_hash'] for row in records}) == len({row['schema_hash'] for row in records}) == len({row['model'] for row in records}) == 1
assert all(row['answers'] == records[0]['answers'] and row['expected'] == records[0]['expected'] for row in records)
payload = {
    'recorded_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'finding_id': 'S06-GRADING-003', 'status': 'unresolved_assurance_level_inference_variance',
    'plan_id': 'T19-A', 'set_id': 'pilot-19-005', 'subquestion_id': 'sub1',
    'case_id': 'sub1/boundary-crit2', 'affected_criterion_id': 'crit1', 'satisfied_criterion_id': 'crit2',
    'original_answer': records[0]['expected']['answer'], 'expected': records[0]['expected'],
    'question_prompt': question['prompt'], 'criteria': question['criteria'],
    'direct_requirements': question['requirements'],
    'input_snapshot': {'file': (FOLDER / 'inputs.json').relative_to(ROOT).as_posix(), 'sha256': sha(FOLDER / 'inputs.json')},
    'request_hash': records[0]['request_hash'], 'schema_hash': records[0]['schema_hash'], 'model': records[0]['model'],
    'same_answer_expected_input_schema_model': True,
    'score_sequence': [row['result']['score'] for row in records],
    'observations': [{
        'file': file.relative_to(ROOT).as_posix(), 'sha256': sha(file), 'attempt': row['attempt'],
        'raw_criteria': row['raw_judgment']['subquestions'][0]['verdicts'],
        'final_criteria': row['result']['subquestions'][0]['criteria'],
        'score': row['result']['score'], 'security_flag': row['result']['security_flag'],
        'trace_stages': [item['stage'] for item in row['trace']], 'matched': row['matched'],
    } for file, row in zip(files, records)],
    'analysis': [
        '발문은 확신 수준 제시와 소극적 결론 문구 작성을 각각 요청한다. crit1은 감사의 합리적 확신보다 낮은 제한적 확신이라는 개념을, crit2는 대상·회계기준·중요성을 갖춘 소극적 결론 문구를 평가한다.',
        '답안은 crit2의 소극적 결론을 완전히 충족하지만 감사와의 확신 비교나 제한적·보통수준이라는 수준 설명을 제시하지 않는다. 특정 용어의 축자재현을 요구한다는 뜻이 아니며, 같은 의미의 비교 설명은 허용된다.',
        '분·반기재무제표 검토준칙9는 감사와 같은 합리적 확신을 얻도록 설계되지 않았음을,46(7)은 감사와 비교한 범위·확신의 제한을,46(8)은 결론 문구를 각각 규정한다. 소극적 결론이 통상 제한적 확신 업무의 산물이라는 전문가 배경지식과 응시자가 요청된 확신 수준을 제시했는지는 구별한다.',
        '첫 원시 판단은 낮은 확신이 전제된다는 이유로 별도 명제까지 met를 부여했다. 후속2회는 수준 설명 미제시를 식별했다. 이 사례는 배경지식으로 누락 명제를 채우는 것과 의미상 충분한 함축을 인정하는 것의 경계로 기록한다.',
        '현재 발문·독립 명제 계약에서는1점 기대값을 유지한다. 질문을 새로 설계하거나 기대값을 모델에 맞춰 바꾸지 않는다. 전제의 의미적 함축 범위를 총괄이 다르게 판단한다면 원자료와 질문 계약을 함께 재검토해야 한다.',
    ],
    'decision': 'Retain expected1 and all2/1/1 observations, with no question or QA change. Source/contract analysis is preserved for root review; no extra repeat beyond three is proposed.',
}
with (FOLDER.parent / 'grading-findings-01.json').open('x', encoding='utf-8') as stream:
    json.dump(payload, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
print(json.dumps({'finding_id': payload['finding_id'], 'scores': payload['score_sequence']}, ensure_ascii=False))
