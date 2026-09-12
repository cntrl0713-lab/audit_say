"""Read-only question investigation; outputs only beside preserved phase-two logs."""
from pathlib import Path
from pypdf import PdfReader
from datetime import datetime, timezone
import hashlib, json

base = Path(__file__).resolve().parent
root = Path.cwd()
read = lambda p: json.loads(Path(p).read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
relative = lambda p: Path(p).resolve().relative_to(root).as_posix()
candidate = base.parents[1] / 'draft-09-501-freq01.json'
set_data = read(candidate)
raw = [json.loads(line) for line in (base/'semantic.json.chunks.jsonl').read_text(encoding='utf-8').splitlines()]
pdf = root/'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf'
reader = PdfReader(pdf)
pages = [{'physical_page': n, 'text': reader.pages[n-1].extract_text()} for n in (390, 391)]
result = {
    'recorded_at': datetime.now(timezone.utc).isoformat(),
    'kind': 'independent_content_investigation_after_partial_live_review',
    'set_id': set_data['id'], 'subquestion_id': 'q1',
    'candidate': {'file': relative(candidate), 'sha256': sha(candidate)},
    'official_source': {'file': relative(pdf), 'sha256': sha(pdf), 'edition': '2025', 'paragraphs': ['501.4', '501.5'], 'pages': pages},
    'actual_facts': set_data['shared_context']['facts'],
    'actual_question': set_data['subquestions'][0],
    'observed_model_unit': raw[0],
    'transport_errors': [{'unit_id': x['unit_id'], 'attempt': x['attempt'], 'performed_at': x['performed_at'], 'error_code': x.get('error_code'), 'error': x.get('error')} for x in raw if x.get('error')],
    'assessment': '현재 지문과 발문에 추가 절차라는 범위가 명시되어 있으므로, 모범답안에 문단4에 추가하여라는 표현을 다시 쓰지 않았다는 이유만으로 내용 결함이라고 판단하지 않는다.',
    'reasoning': [
        '공식501.4는 중요한 재고자산의 실재성·상태 증거를 위한 실사 입회와 관련 절차 및 최종 기록 감사를 요구한다. 공식501.5는 그 절차에 추가하여 두 날짜 사이 변동의 적절한 기록을 검증하도록 한다.',
        'f1은 실사 입회를, f2는 실사 입회 시 절차와 최종 기록 검사를 별도로 계획한 사실을 명시한다. f2와 q1은 다음 요구가 날짜 차이로 인한 추가 절차임을 명시한다.',
        '이 사례에서 기존 절차와의 추가 관계는 지문·발문에 주어진 범위다. 정답에는 실제 추가 절차의 기간·검증목적·행위를 쓰게 하며, 모범답안과 q1.c1은 이를 충족한다.',
        '계획하였다는 사실은 모든 절차를 이미 완료했다는 뜻이 아니다. 하지만 앞으로 수행할 추가 절차를 묻는 현재 발문에 답하면서 선행 계획을 다시 열거할 의무가 생기는 것도 아니다.',
        '문단4 절차를 생략·대체해도 된다고 명시하는 반대 답안은 별도로 구별해야 한다. 현재 모범답안에는 그런 부정이 없다. 조건 보존과 주어진 조건의 반복 요구는 구별한다.'
    ],
    'disposition': 'no_fixed_input_change_proposed; preserve partial model fail for independent reassessment',
    'limitations': ['T09-A 의미검수는 전송 오류로 미완료이며 정식 receipt가 없다.', '내용 판단은 작성자의 독립 원문 대조이며 실패 판정을 pass로 덮어쓴 receipt가 아니다.', '현재 생성 사례·작성자 QA 모델 채점은 미실행이다.', '공통 전송 장애 원인 진단과 재개 시점은 총괄이 담당한다.'],
    'question_mutation': False, 'additional_model_calls': 0,
}
with (base/'content-investigation.json').open('x', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
    f.write('\n')
print(json.dumps({'set_id': set_data['id'], 'candidate_sha256': sha(candidate), 'official_pdf_sha256': sha(pdf), 'new_model_calls': 0}, ensure_ascii=False))
