"""Local manual-spec assembly only. No network, model, canonical-bank, or registry writes."""
import hashlib
import json
from pathlib import Path

D = Path('cpa_uploader/drafts/case-trio-2026-09-14')
O = D / 'a'
RAW = Path('cpa_uploader/raw/materials/verification/case-trio-2026-09-14-a')
EX = 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md'
ADV = 'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md'
OFF = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt'
PDF = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf'

def read(p):
    return json.loads(Path(p).read_text(encoding='utf-8-sig'))

def sha_bytes(x):
    return hashlib.sha256(x).hexdigest()

def sha_file(p):
    return sha_bytes(Path(p).read_bytes())

def sha_json(x):
    return sha_bytes(json.dumps(x, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))

def write(p, value):
    Path(p).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

spec = read(O / 'spec.json')
bank = read(D / 'bank-before.json')
cat = read(D / 'source-catalog.json')
units = {u['id']: u for u in cat['units']}
inventory = read(D / 'draft-inventory.json')
near_drafts = [r for r in inventory['rows'] if '분석적' in json.dumps(r, ensure_ascii=False)]

# ID, complete body lines in the exact registered unit, 2026 PDF page and extracted lines.
definitions = {
    '520.6': ('src-e67ae1831db41aa655', 3, 450, 19126, 19129),
    '520.7': ('src-e7d17e54be2d240805', 5, 450, 19131, 19138),
    '520.A17': ('src-93c9a60b32ac6a97bd', 3, 454, 19301, 19303),
    '520.A18': ('src-805f45ff18dbcd0b6f', 3, 454, 19304, 19306),
    '520.A19': ('src-5c224e2b3d26cb7abb', 2, 455, 19317, 19318),
    '520.A20': ('src-610dfeb49d38af086d', 3, 455, 19320, 19322),
    '520.A21': ('src-6c6cc0b55e6b722cad', 3, 455, 19323, 19325),
    '315.37': ('src-9dc3ef023abb077fff', 3, 229, 9598, 9601),
}
refs = {}
official_comparisons = []
for key, (uid, lines, page, start, end) in definitions.items():
    u = units[uid]
    quote = '\r\n'.join(u['quote'].split('\r\n')[:lines])
    assert quote in Path(u['file']).read_bytes().decode('utf-8-sig'), (key, 'nonexact source quote')
    stop = u['startLine'] + lines - 1
    span = f'2026 KGA {key}; PDF {page}; {OFF} L{start}~{end}; 등록 {u["file"]} L{u["startLine"]}~{stop}'
    refs[key] = {'id': uid, 'file': u['file'], 'title': f'KGA {key}; 2026 전문 대조 PDF {page}쪽, 원 추출 L{start}~{end}; 기존 등록 전사 L{u["startLine"]}~{stop}', 'page': u['standard'], 'source_quote': quote, 'role': 'standard', 'content_hash': sha_bytes(quote.encode('utf-8')), 'source_span': span}
    official_comparisons.append({'key': key, 'source_ref_id': uid, 'official_file': OFF, 'official_file_sha256': sha_file(OFF), 'pdf_file': PDF, 'pdf_sha256': sha_file(PDF), 'pdf_page': page, 'start_line': start, 'end_line': end, 'registered_file': u['file'], 'registered_file_sha256': sha_file(u['file']), 'registered_start_line': u['startLine'], 'registered_end_line': stop, 'registered_quote_sha256': refs[key]['content_hash'], 'render_file': (RAW / f'kga2026-page-{page}.png').as_posix(), 'render_sha256': sha_file(RAW / f'kga2026-page-{page}.png'), 'visual_review_performed': True, 'review_method': 'agent read of original rendered PDF body and footnotes, compared with registered exact quote and 2026 extracted lines', 'finding': '2025 기존 등록의 해당 완결 본문이 2026 공식 전문의 같은 요구·적용자료와 의미상 동일함을 직접 대조하였다. 원 등록 바이트와 판본 표시는 변경하지 않는다.', 'footnote_scope': 'A18의 각주10은 315.37이며 PDF454 하단·추출19311을 확인하고 PDF229의 315.37 본문도 읽었다. 같은 페이지의 각주7~9는 A16, PDF450의 각주3은 520.5에 속하므로 새 요구로 편입하지 않는다. A19~A21에는 각주가 없다.'})

facts = [{'id': f'fact{i+1}', 'text': text, 'scoreable': False} for i, text in enumerate(spec['facts'])]
set_out = {'schema_version': '3.0', 'id': spec['id'], 'type': 'linked_question_set', 'status': 'needs_review', 'title': spec['title'], 'classification': {'topic_id': '10', 'part': 'PART3', 'chapter': '분석적절차와 표본감사', 'domain': 'audit', 'standards': ['KGA 520', 'KGA 315'], 'tags': ['사례형', '사례 추가', '감사종결 분석']}, 'source_refs': [], 'shared_context': {'facts': facts}, 'learning_order': ['sub1', 'sub2', 'sub3'], 'subquestions': [], 'verification': {'source_fidelity': 'reconstructed', 'review_status': 'needs_human_review', 'calculation_required': False, 'notes': ['2026-09-14 사용자 사례형 3개 추가 요청 중 A 담당의 수동 제작 1사례·3물음이다.', '2026년 1월 1일 개시 보고기간을 가정하여 KICPA 2026 전문과 기존 공식 등록 본문을 직접 대조하였다. 시험 적용판본 확정과는 구별한다.', 'agent 의미검수와 작성자 기대값은 a/review.json 및 a/qa.json에 기록한다. 실제 모델채점·사람확인·정본수록·DB등록은 별도이며 이 초안 생성으로 완료되지 않는다.']}}
used_keys = []
for item in spec['questions']:
    keys = list(dict.fromkeys(k for group in item['refs'] for k in group))
    used_keys.extend(k for k in keys if k not in used_keys)
    q = {'id': item['id'], 'type': item['type'], 'question_style': 'case', 'topic_ids': item['topics'], 'prompt': item['prompt'], 'selection': {'type': 'all', 'n': None}, 'constraints': {'ordered': False, 'max_entries': None, 'overflow_policy': 'none'}, 'model_answer': item['answer'], 'requirements': [], 'criteria': []}
    req_ids = {}
    for i, key in enumerate(keys, 1):
        r = refs[key]
        rid = f'{q["id"]}.req{i}'
        req_ids[key] = rid
        q['requirements'].append({'id': rid, 'source_ref_id': r['id'], 'source_quote': r['source_quote'], 'source_span': r['source_span']})
    for i, claim in enumerate(item['claims'], 1):
        cid = f'{q["id"]}.c{i}'
        q['criteria'].append({'id': cid, 'requirement_id': req_ids[item['refs'][i-1][0]], 'claim': claim, 'critical_facts': [{'id': f'{cid}.fact', 'type': 'conclusion' if i == 1 else 'action', 'expected': claim}], 'max_points': 1, 'scores': {'met': 1, 'not_met': 0, 'contradicted': 0}, 'source_ref_ids': [refs[k]['id'] for k in item['refs'][i-1]]})
    set_out['subquestions'].append(q)
set_out['source_refs'] = [refs[k] for k in used_keys]
write(O / 'sets.json', [set_out])

def loc(file, start, end, page, original, role):
    return {'file': file, 'start_line': start, 'end_line': end, 'page': page, 'original': original, 'role': role, 'file_sha256': sha_file(file)}

locations = [loc(EX, 14751, 14754, 374, 'cpa_exam:2018:2:5', 'context'), loc(EX, 14798, 14800, 375, 'cpa_exam:2018:2:5', 'prompt'), loc(EX, 14981, 14991, 380, 'cpa_exam:2018:2:5', 'answer'), loc(EX, 14995, 15036, 380, 'cpa_exam:2018:2:5', 'adjacent_explanation_not_direct_question'), loc(ADV, 2039, 2042, 64, 'mock:2024:GS2-2:2', 'context'), loc(ADV, 2063, 2066, 64, 'mock:2024:GS2-2:2', 'prompt'), loc(ADV, 2106, 2114, 66, 'mock:2024:GS2-2:2', 'answer_and_explanation')]
learning_ids = ['src-f0768e531154c58169', 'src-b3f69bc86cdd795272', 'src-2de02e02e8c4b13e0a', 'src-65fd01278ffc898823', 'src-b3f019100980567203']
all_plan_ids = [refs[k]['id'] for k in definitions] + learning_ids
assert all(uid in units for uid in all_plan_ids)

comparison_ids = ['pilot-10-002', 'pilot-10-007', 'pilot-10-007-standards-20260913', 'std-points-20260914-82e96243c6aa', 'case-16-other-information-cause-20260914']
compared = []
for sid in comparison_ids:
    old = next(s for s in bank if s['id'] == sid)
    compared.append({'set_id': sid, 'title': old['title'], 'content_sha256': sha_json(old), 'facts': old['shared_context']['facts'], 'questions': [{'id': q['id'], 'question_style': q.get('question_style'), 'prompt': q['prompt'], 'model_answer': q['model_answer'], 'points': sum(c['max_points'] for c in q['criteria']), 'criterion_ids': [c['id'] for c in q['criteria']]} for q in old['subquestions']]})

q_designs, qa, reviews = [], [], []
for item, q in zip(spec['questions'], set_out['subquestions']):
    cid = [c['id'] for c in q['criteria']]
    regression = []
    answers = [('model_answer', '\n'.join(q['model_answer']), 2, cid), ('empty', '', 0, []), ('partial', item['partial'], 1, cid[:1]), ('wrong', item['wrong'], 0, []), ('reverse_partial', item['reverse_partial'], 1, cid[1:]), ('implicit', item['implicit'], 2, cid), ('same_meaning_repetition', item['partial'] + ' ' + item['partial'], 1, cid[:1]), ('general_only', {'sub1': '종결 분석은 수행해야 하며 재무제표와 기업 이해의 일관성을 확인한다.', 'sub2': '위험평가를 수정하고 감사절차를 추가한다.', 'sub3': '관련성이 있는 기존 감사증거를 활용할 수 있고 반드시 새 외부증거를 받을 필요는 없다.'}[q['id']], 0 if q['id'] == 'sub2' else 1, [] if q['id'] == 'sub2' else cid[:1])]
    for kind, answer, points, met in answers:
        regression.append({'kind': kind, 'answer': answer, 'expected_points': points, 'met_criterion_ids': met, 'method': 'author_content_expectation', 'actual_model_grading': False, 'rationale': '주어진 사실·발문·독립 criterion을 직접 대조한 작성자 기대값이다. 자동 채점 결과가 아니다.'})
    for kind, answer, pts, met in answers:
        if kind in ['partial', 'wrong']:
            qa.append({'set_id': spec['id'], 'subquestion_id': q['id'], 'kind': kind, 'answer': answer, 'expected_points': pts, 'met_criterion_ids': met, 'reason': ('판단 또는 위험 추론의 첫 독립 명제만 충족하며 사례에 맞춘 구체 설명·절차는 제시하지 않아 1점이다.' if pts else '명시적으로 반대 결론과 잘못된 이유·조치를 제시하여 어느 독립 명제도 충족하지 않는다.'), 'single_point_no_partial': False})
    old = next(s for s in bank if s['id'] == item['comparison']['set_id'])
    oldq = next(s for s in old['subquestions'] if s['id'] == item['comparison']['subquestion_id'])
    q_designs.append({'subquestion_id': q['id'], 'question_style': 'case', 'topic_ids': item['topics'], 'fact_ids': item['facts'], 'learning_objective': q['prompt'], 'max_points': 2, 'minimal_sufficient_answer': q['model_answer'], 'fact_dependency_rationale': item['dependency'], 'point_rationale': item['points_reason'], 'point_decision': '유지', 'response_and_inference_burden': '두 독립 명제의 약 두 문장. 판단·자료 관계 추론과 사례 증거/목적 연결을 각각 확인하되 표현 길이는 배점하지 않는다.', 'overload_decision': '종결 생략 평가, 새 위험 대응, 기존 증거를 통한 설명 평가를 별도 물음으로 분리했다. 각 물음 안에서는 같은 목적의 포괄 문구와 구체 조치를 중복 가점하지 않는다.', 'criterion_mapping': [{'criterion_id': c['id'], 'points': 1, 'fact_ids': item['facts'], 'claim': c['claim'], 'direct_source_ref_ids': c['source_ref_ids']} for c in q['criteria']], 'local_regression_expectations': regression, 'partial_scoring_contract': '독립 의미마다 1점. 결론을 명확히 함축하는 적합한 근거·조치는 판단을 인정한다. 명시적 반대 결론이면 판단은0, 독립적으로 옳은 근거는1을 보존한다. sub2의 구체 절차만 제시한 답은 자료 관계에서 위험을 추론한 설명까지 자동 충족하지 않는다.', 'point_comparison': {'set_id': old['id'], 'subquestion_id': oldq['id'], 'existing_points': sum(c['max_points'] for c in oldq['criteria']), 'new_points': 2, 'decision_reason': item['comparison']['difference']}})
    used_ids = list(dict.fromkeys(uid for c in q['criteria'] for uid in c['source_ref_ids']))
    source_spans = '; '.join(r['source_span'] for r in set_out['source_refs'] if r['id'] in used_ids)
    review = {'set_id': spec['id'], 'subquestion_id': q['id'], 'reviewer_id': 'agent:/root/next_cases_early', 'method': 'agent_content_review', 'human_review_performed': False, 'actual_model_grading': 'not_run', 'rationale': item['points_reason'], 'point_decision': '유지: 독립 의미단위2개 각1점.', 'max_points': 2, 'fact_ids': item['facts'], 'question_style': 'case', 'topic_ids': item['topics'], 'minimal_sufficient_answer': q['model_answer'], 'checks': {k: 'pass' for k in ['source', 'answer', 'prompt', 'points', 'style', 'topics', 'edition', 'nonduplication']}, 'check_rationales': {'source': source_spans, 'answer': '모범답안·대표 부분/오답·역방향 부분·함축·반복·일반론·빈답 기대값을 본문과 직접 대조하였다. ' + item['points_reason'], 'prompt': '발문이 요구한 두 독립 명제만 채점한다. ' + q['prompt'], 'points': item['points_reason'], 'style': item['dependency'], 'topics': {'sub1': '종결 분석의 목적과 생략 제안을 판단하므로10이다.', 'sub2': '매출의 새 중요왜곡표시위험 식별06, 그 위험에 따른 추가 절차 설계08, 종결 분석에서 발견한 관계10을 실제로 요구한다.', 'sub3': '분석 결과의 경영진 설명을 증거로 평가하는520.7/A20의10이다. 외부조회 자체의 설계 절차를 묻지 않는다.'}[q['id']], 'edition': '공식2026 PDF229/450/454/455의 본문과 각주를 직접 화면 대조했다. A18 각주10은315.37이며 다른 단락의 각주7~9/3을 새 의무로 읽지 않는다. 기존2025 등록은 해당 완결 본문만 인용하며 등록 원래 판본과2026 대조 위치를 구별한다.', 'nonduplication': item['comparison']['difference']}, 'unresolved': [], 'unresolved_content_findings': [], 'question_content_sha256': sha_json(q), 'set_content_sha256': sha_json(set_out), 'source_quote_hashes': {r['id']: r['content_hash'] for r in set_out['source_refs'] if r['id'] in used_ids}, 'local_boundary_review': regression}
    reviews.append(review)

difference = ' / '.join(x['comparison']['difference'] for x in spec['questions'])
design = {'set_id': spec['id'], 'plan': {'version': 1, 'topic_id': '10', 'mode': 'adapt_existing_question', 'objective': spec['title'], 'scope': {'actors': ['해솔 재무이사', '가람회계법인 감사팀 갑·을·책임자'], 'timing': ['2026년 1월 1일 개시 보고기간의 감사, 2027년 2월 말 감사종료에 근접한 시점'], 'conditions': spec['facts'], 'exceptions': ['예상하지 못한 관계는 오류 확정과 구별하고, 기존 관련 증거를 이용할 수 있으나 경영진 설명을 무조건 받아들이지는 않는다.'], 'required_answers': [q['prompt'] for q in set_out['subquestions']], 'exclusions': ['계산·실증분석 기대치의 정밀성·표본규모·감사의견 종류·모든 관련 증거의 전수 열거는 요구하지 않는다.']}, 'question_types': ['judgment', 'descriptive'], 'source_unit_ids': all_plan_ids, 'existing_question_difference': difference, 'edition_assumption': '2026년1월1일 개시 보고기간에 적용할 KICPA2026공식전문 본문을 읽었다. 기존2025등록의 해당 본문 동일성을 직접 대조하여 인용하며 향후 시험판본 승인과 구별한다.', 'unresolved_items': [], 'status': 'ready'}, 'bank_sha256': sha_file(D / 'bank-before.json'), 'source_catalog_sha256': sha_file(D / 'source-catalog.json'), 'facts_chars': len('\n'.join(spec['facts'])), 'facts_counting': 'LF join, spaces included, Unicode code points', 'compared_existing_sets': compared, 'draft_inventory_file': (D / 'draft-inventory.json').as_posix(), 'draft_inventory_sha256': sha_file(D / 'draft-inventory.json'), 'draft_inventory_scope': '전체 제작 JSON의 위치·ID·발문 기계 목록을 검색하였다. 분석적절차로 검색된 가까운4개 옛 초안의 실제 사실·발문·답안을 따로 읽었다. 모든 draft의 전수 의미검수를 했다고 주장하지 않는다.', 'near_draft_comparisons': [{'file': row['file'], 'sha256': sha_file(row['file']), 'set_id': row['id'], 'finding': '옛10-007의 단계목록 및 실증분석 설계·일반적 차이 조사이다. 새 사례의 판매구조 변화에 연결한 종결목적·자료관계에서 매출위험 추론·기존증거 활용의 반대경계는 직접 요구하지 않는다.'} for row in near_drafts], 'source_locations': locations, 'original_question_relationships': [{'original_question_id': 'cpa_exam:2018:2:5', 'new_subquestion_id': 'sub1', 'relationship': 'partial', 'reason': '원물음은 위험평가와 종결 두 단계와 각 목적을 모두 묻는다. 신규sub1은 종결 쪽의 구체 사례 적용이며 전체 원요구를 덮지 않는다.'}, {'original_question_id': 'mock:2024:GS2-2:2', 'new_subquestion_id': 'sub3', 'relationship': 'adjacent', 'reason': '원물음은520.7의 두 조사절차 일반목록이다. 신규는A20의 이미 입수한 증거 활용이라는 경계에 적용하므로 동일요구의 직접 출제로 과장하지 않는다.'}], 'official_edition_comparison': official_comparisons, 'subquestions': q_designs, 'authoring_method': 'manual', 'human_review_performed': False, 'actual_model_grading': 'not_run'}
write(O / 'design.json', [design])
write(O / 'review.json', reviews)
write(O / 'qa.json', qa)

elements_file = Path('cpa_uploader/analysis/question-elements/question-elements.json')
element = next(e for e in read(elements_file)['elements'] if e['id'] == 'element-b78c63e8421dabdb')
q1 = set_out['subquestions'][0]
q1ids = list(dict.fromkeys(uid for c in q1['criteria'] for uid in c['source_ref_ids']))
coverage = {'element_id': element['id'], 'element_snapshot_sha256': sha_json(element), 'source_unit_ids': q1ids, 'set_id': spec['id'], 'subquestion_id': 'sub1', 'criterion_ids': ['sub1.c1', 'sub1.c2'], 'relationship': 'partial', 'reason': '2018CPA문제2물음5의 필수 두 단계·목적 중 감사종결 부분을 실제 판매구조 변화에 적용한다. 위험평가 단계까지 포괄하는 원물음 전부의 직접 대응으로 표시하지 않는다. 새 위험 추론 및 기존 증거의 활용은 이 원물음의 빈도에 추가하지 않는다.', 'original_question_ids': ['cpa_exam:2018:2:5'], 'frequency_kind': 'cpa_exam', 'reprint_treatment': '원출제1회의 기출A 해설을 확인했으며 교재 재수록이나 해설의 추가 설명을 별도 출제 빈도로 더하지 않는다.', 'source_locations': [x for x in locations if x['original'] == 'cpa_exam:2018:2:5'], 'source_hashes': {r['id']: r['content_hash'] for r in set_out['source_refs'] if r['id'] in q1ids}, 'review_status': 'needs_review', 'target': {'scope': 'draft', 'file': (O / 'sets.json').as_posix(), 'set_id': spec['id'], 'subquestion_id': 'sub1', 'criterion_ids': ['sub1.c1', 'sub1.c2']}}
write(O / 'coverage-proposals.json', [coverage])

render_rows = [{'file': (RAW / f'kga2026-page-{page}.png').as_posix(), 'sha256': sha_file(RAW / f'kga2026-page-{page}.png'), 'parent_file': PDF, 'parent_sha256': sha_file(PDF), 'pdf_page': page, 'method': 'pdftoppm -f PAGE -l PAGE -scale-to 1600 -singlefile -png', 'source_edition': 'KICPA2026 full standards', 'agent_visual_review_performed': True, 'human_review_performed': False} for page in [229, 450, 454, 455]]
write(RAW / 'render-provenance.json', {'created_for': 'case-trio-2026-09-14', 'origin': 'Existing official PDF already in repository; no new official transcription or download', 'files': render_rows})
file_roles = [(elements_file.as_posix(), 'analysis_discovery_index'), ((D / 'bank-before.json').as_posix(), 'frozen_comparison_bank'), ((D / 'catalog-before.json').as_posix(), 'frozen_learning_classification_catalog'), ((D / 'classification-before.json').as_posix(), 'frozen_classification_snapshot'), ((D / 'draft-inventory.json').as_posix(), 'draft_location_and_id_inventory'), ((D / 'source-catalog.json').as_posix(), 'registered_source_unit_catalog'), (EX, 'exam_original_prompt_context_and_solution'), (ADV, 'advanced_practice_original_prompt_context_and_solution'), (OFF, 'official2026_extracted_body_and_footnotes'), (PDF, 'official2026_original_visual_review'), ('cpa_uploader/data/official/delegated-s04-kga-2025.txt', 'exact_registered_official_citation'), ('cpa_uploader/data/official/kga315-330-2025-review06.txt', 'exact_registered_official_citation'), ('cpa_uploader/data/official/kga520-530-2025-review10.txt', 'alternative_registered_source_read_during_discovery')]
file_roles += [(row['file'], 'near_draft_semantic_comparison') for row in near_drafts]
file_roles += [(row['file'], 'derived_original_pdf_render') for row in render_rows]
file_roles += [((RAW / 'render-provenance.json').as_posix(), 'render_provenance')]
write(O / 'source-files.json', [{'file': file, 'sha256': sha_file(file), 'role': role, 'read_method': '실제 파일 내용 읽기 및 필요한 범위 대조; 원PDF와 render는229/450/454/455 본문·각주를 직접 시각 대조. 비교 스냅샷과 학습출처 역할을 구별한다.'} for file, role in file_roles])
print(json.dumps({'set_id': spec['id'], 'facts_chars': design['facts_chars'], 'questions': len(set_out['subquestions']), 'criteria': sum(len(q['criteria']) for q in set_out['subquestions']), 'qa_rows': len(qa), 'files': {name: sha_file(O / f'{name}.json') for name in ['sets', 'design', 'review', 'qa', 'coverage-proposals', 'source-files']}}, ensure_ascii=False, indent=2))
