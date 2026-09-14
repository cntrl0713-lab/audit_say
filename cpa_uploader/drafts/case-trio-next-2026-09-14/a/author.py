"""Manual authoring-spec assembly. Writes only this batch's a directory. No network."""
import hashlib
import json
from pathlib import Path

D = Path('cpa_uploader/drafts/case-trio-next-2026-09-14')
O = D / 'a'
RAW = O / 'sources'
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
# Exact complete registered paragraph bodies; original registered edition is preserved.
definitions = {
    '580.10': ('src-e720e7bded286b27d5', 3, 602, 25276, 25279),
    '580.11': ('src-a88769f5ef6ef03ccf', 4, 602, 25281, 25287),
    '580.16': ('src-08b947443a445f5076', 4, 603, 25320, 25324),
    '580.17': ('src-a3f553111367732fe7', 5, 603, 25325, 25330),
    '580.18': ('src-605a9832aab53d1db7', 3, 604, 25336, 25339),
    '580.20': ('src-e23aa9f4e31b30cf97', 5, 604, 25353, 25360),
    '580.A1': ('src-424060f0b46c63d233', 5, 604, 25363, 25368),
    '580.A7': ('src-db042bc2e1e49dcf72', 7, 605, 25409, 25416),
    '580.A23': ('src-bc6e07fcbbdb61afd5', 4, 609, 25559, 25562),
    '580.A24': ('src-6c8c87099b37a43061', 6, 609, 25563, 25568),
    '580.A26': ('src-6c82931285349fa6e4', 7, 610, 25584, 25590),
    '580.A27': ('src-3c07d4c1cf9cc6ca35', 16, 610, 25591, 25608),
    '705.9': ('src-56c706b48bbd5c9e4e', 3, 771, 32188, 32191),
}
refs, official_comparisons = {}, []
footnotes = 'PDF602의 각주2·3은 210.6(b)(i)/(iii)이며 원 추출1320~1344와 PDF34 본문까지 읽었다. 604의 각주4는705이고, 610의 각주9는705.9로 PDF771 본문까지 대조했다. 609의 각주7·8은 A22/A25의260·230을 가리키므로 이번16·17의 별도 배점요구로 확장하지 않는다. 603의16·17, A1/A7/A23/A24에는 각주가 없다.'
for key, (uid, n, page, start, end) in definitions.items():
    u = units[uid]
    separator = '\r\n' if '\r\n' in u['quote'] else '\n'
    quote = separator.join(u['quote'].split(separator)[:n])
    assert quote in Path(u['file']).read_bytes().decode('utf-8-sig'), key
    stop = u['startLine'] + n - 1
    span = f'2026 KGA {key}; PDF {page}; {OFF} L{start}~{end}; 등록 {u["file"]} L{u["startLine"]}~{stop}'
    refs[key] = {'id': uid, 'file': u['file'], 'title': f'KGA {key}; 2026 전문 대조 PDF {page}쪽, 추출 L{start}~{end}; 기존 등록 전사 L{u["startLine"]}~{stop}', 'page': u['standard'], 'source_quote': quote, 'role': 'standard', 'content_hash': sha_bytes(quote.encode('utf-8')), 'source_span': span}
    official_comparisons.append({'key': key, 'source_ref_id': uid, 'official_file': OFF, 'official_file_sha256': sha_file(OFF), 'pdf_file': PDF, 'pdf_sha256': sha_file(PDF), 'pdf_page': page, 'start_line': start, 'end_line': end, 'registered_file': u['file'], 'registered_file_sha256': sha_file(u['file']), 'registered_start_line': u['startLine'], 'registered_end_line': stop, 'registered_quote_sha256': refs[key]['content_hash'], 'render_file': (RAW / f'kga2026-page-{page}.png').as_posix(), 'render_sha256': sha_file(RAW / f'kga2026-page-{page}.png'), 'visual_review_performed': True, 'review_method': 'agent original PDF visual review of body/footnotes and exact registered paragraph comparison', 'finding': '2025 등록 본문과 2026 공식 동일 문단의 의미가 일치한다. 줄바꿈·페이지 위치는 달라 등록 판본 및2026 대조 위치를 구별한다.', 'footnote_scope': footnotes})

facts = [{'id': f'fact{i+1}', 'text': t, 'scoreable': False} for i, t in enumerate(spec['facts'])]
set_out = {'schema_version': '3.0', 'id': spec['id'], 'type': 'linked_question_set', 'status': 'needs_review', 'title': spec['title'], 'classification': {'topic_id': '12', 'part': 'PART3', 'chapter': '감사종결', 'domain': 'audit', 'standards': ['KGA 580', 'KGA 705'], 'tags': ['사례형', '서면진술', '증거 불일치']}, 'source_refs': [], 'shared_context': {'facts': facts}, 'learning_order': ['sub1', 'sub2', 'sub3'], 'subquestions': [], 'verification': {'source_fidelity': 'reconstructed', 'review_status': 'needs_human_review', 'calculation_required': False, 'notes': ['2026-09-14 사용자 사례형 3개 추가 요청 중 A 담당 수동 제작 1사례·3물음이다.', '2026년1월1일 개시 보고기간을 가정해 공식2026전문과 기존 등록 본문을 대조하였다. 향후 시험 적용판본의 승인으로 표시하지 않는다.', '기출·고급연습에서 인접 요구를 참고하여 별도의 증거충돌 상황을 재구성했다. agent 의미검수·작성자 기대값과 실제 모델채점·사람확인·정본수록·DB반영은 별개이며 후자는 이 생성으로 완료되지 않는다.']}}
used = []
for item in spec['questions']:
    keys = list(dict.fromkeys(k for group in item['refs'] for k in group))
    used.extend(k for k in keys if k not in used)
    q = {'id': item['id'], 'type': item['type'], 'question_style': 'case', 'topic_ids': item['topics'], 'prompt': item['prompt'], 'selection': {'type': 'all', 'n': None}, 'constraints': {'ordered': False, 'max_entries': None, 'overflow_policy': 'none'}, 'model_answer': item['answer'], 'requirements': [], 'criteria': []}
    req_ids = {}
    for i, key in enumerate(keys, 1):
        r = refs[key]; rid = f'{q["id"]}.req{i}'; req_ids[key] = rid
        q['requirements'].append({'id': rid, 'source_ref_id': r['id'], 'source_quote': r['source_quote'], 'source_span': r['source_span']})
    for i, claim in enumerate(item['claims'], 1):
        cid = f'{q["id"]}.c{i}'
        q['criteria'].append({'id': cid, 'requirement_id': req_ids[item['refs'][i-1][0]], 'claim': claim, 'critical_facts': [{'id': f'{cid}.fact', 'type': 'conclusion' if i == 1 else 'action', 'expected': claim}], 'max_points': 1, 'scores': {'met': 1, 'not_met': 0, 'contradicted': 0}, 'source_ref_ids': [refs[k]['id'] for k in item['refs'][i-1]]})
    set_out['subquestions'].append(q)
set_out['source_refs'] = [refs[k] for k in used]
write(O / 'sets.json', [set_out])

def loc(file, start, end, page, original, role):
    return {'file': file, 'start_line': start, 'end_line': end, 'page': page, 'original': original, 'role': role, 'file_sha256': sha_file(file)}

locations = [loc(EX, 10786, 10815, 276, 'cpa_exam:2020:3:3', 'context'), loc(EX, 10828, 10862, '277~278', 'cpa_exam:2020:3:3', 'prompt_and_example_exclusion'), loc(EX, 10948, 10968, 280, 'cpa_exam:2020:3:3', 'answer_and_explanation'), loc(ADV, 6896, 6917, 210, 'mock:2023:GS2-8:2', 'context'), loc(ADV, 6918, 6924, 210, 'mock:2023:GS2-8:2', 'adjacent_questions_prompt'), loc(ADV, 6930, 6949, 211, 'mock:2023:GS2-8:2', 'answer_and_explanation')]
learning_ids = ['src-568c959b4ed84895a0', 'src-a8854fb319759add8c', 'src-2195a214336716e50d', 'src-f6ed3014d2dcf5c742', 'src-0d5a8e178e4a2146f1', 'src-fa9346494a9d0404e5']
all_plan_ids = [refs[k]['id'] for k in definitions] + learning_ids
assert all(uid in units for uid in all_plan_ids)
comparison_ids = ['pilot-12-010', 'pilot-12-003', 'draft-standard-gap-20260913-g09', 'std-points-20260914-ae160de36d94', 'std-points-20260914-e7a3730d6484', 'std-points-20260914-c82d262bd6a8', 'std-points-20260914-1cae16e579d0']
compared = []
for sid in comparison_ids:
    s = next(s for s in bank if s['id'] == sid)
    compared.append({'set_id': sid, 'title': s['title'], 'content_sha256': sha_json(s), 'facts': s['shared_context']['facts'], 'questions': [{'id': q['id'], 'question_style': q.get('question_style'), 'prompt': q['prompt'], 'model_answer': q['model_answer'], 'points': sum(c['max_points'] for c in q['criteria']), 'criteria': [{'id': c['id'], 'claim': c['claim'], 'max_points': c['max_points']} for c in q['criteria']]} for q in s['subquestions']]})
near_drafts = ['cpa_uploader/drafts/case-expansion-2026-09-13/b/sets.json', 'cpa_uploader/drafts/standard-gap-2026-09-13/g09.json', 'cpa_uploader/drafts/delegated-authoring-2026-09-11/learning-style-v2/t12-d/question.json', 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s04/point-policy-v1/t12-d/pilot-12-010.json']
topic_reasons = {'sub1': '서면진술과 외부 계약자료의 충돌에 대한 종결 판단12 및 구체 증거검증08을 요구한다.', 'sub2': '서면진술 불일치에서 출발하는 성실성·진술 신뢰성12와 다른 감사증거의 신뢰성08을 요구한다. 부정 자체의 식별이나 위험평가 수정은 묻지 않는다.', 'sub3': '핵심 책임 서면진술12의 불신을 감사의견15에 적용한다.'}
q_designs, reviews, qa = [], [], []
for item, q in zip(spec['questions'], set_out['subquestions']):
    ids = [c['id'] for c in q['criteria']]; maximum = len(ids)
    cases = [('model_answer', '\n'.join(q['model_answer']), ids), ('empty', '', []), ('partial', item['partial'], ids[:1]), ('wrong', item['wrong'], []), ('reverse_partial', item['reverse_partial'], ids[1:]), ('implicit', item['implicit'], ids), ('same_meaning_repetition', item['partial'] + ' ' + item['partial'], ids[:1]), ('general_only', item['general'], [ids[i-1] for i in item['general_met']])]
    regression = [{'kind': k, 'answer': a, 'expected_points': len(met), 'met_criterion_ids': met, 'method': 'author_content_expectation', 'actual_model_grading': False, 'rationale': '실제 발문·사실·독립 criterion에 대조한 수동 기대값이다. 명시적 반대 판단은 해당 판단만0이며 별도로 옳은 적용 근거를 보존한다. 일반론만 제시한 답은 사례 연결이 필요한 기준에 점수를 주지 않는다.'} for k, a, met in cases]
    for r in regression:
        if r['kind'] in ['partial', 'wrong']:
            qa.append({'set_id': spec['id'], 'subquestion_id': q['id'], 'kind': r['kind'], 'answer': r['answer'], 'expected_points': r['expected_points'], 'met_criterion_ids': r['met_criterion_ids'], 'reason': '첫 독립 의미만 충족하는 1점 부분정답이다.' if r['kind'] == 'partial' else '명시적인 반대 판단과 잘못된 이유·조치로 모든 독립 기준을 충족하지 않는 0점 답안이다.', 'single_point_no_partial': False})
    old = next(s for s in bank if s['id'] == item['comparison']['set_id']); oldq = next(x for x in old['subquestions'] if x['id'] == item['comparison']['subquestion_id'])
    contract = '각 독립 의미1점. 타당한 구체 근거·조치가 판단을 명확히 함축하면 판단 인정. 명시적 반대 판단은 그 판단점수만0이며 독립적 옳은 근거는 유지. sub2는 각 사례 평가와 확인조치를 중복 가점하지 않고 일반적인 목록만은0이다.'
    q_designs.append({'subquestion_id': q['id'], 'question_style': 'case', 'topic_ids': item['topics'], 'fact_ids': item['facts'], 'learning_objective': q['prompt'], 'max_points': maximum, 'minimal_sufficient_answer': q['model_answer'], 'fact_dependency_rationale': item['dependency'], 'point_rationale': item['points_reason'], 'point_decision': '유지', 'response_and_inference_burden': f'독립 의미{maximum}개의 약{maximum}문장. 사실에 근거한 적용을 요구하지만 금액계산·일반 속성 전수열거·보고서 문구는 제외한다.', 'overload_decision': '불일치 해소, 신뢰성 영향, 최종 감사의견의 시간 단계·목표를 분리했다. sub2의 성실성 판단 및 서로 다른 진술·내부자료 신뢰성은 독립 대상이다. sub3의 핵심 책임진술 불신·대체 불가·전반성은 하나의 의견 근거이므로 설명 조건을 별도 점수로 자르지 않았다.', 'criterion_mapping': [{'criterion_id': c['id'], 'points': 1, 'fact_ids': item['facts'], 'claim': c['claim'], 'direct_source_ref_ids': c['source_ref_ids']} for c in q['criteria']], 'local_regression_expectations': regression, 'partial_scoring_contract': contract, 'point_comparison': {'set_id': old['id'], 'subquestion_id': oldq['id'], 'existing_points': sum(c['max_points'] for c in oldq['criteria']), 'new_points': maximum, 'decision_reason': item['comparison']['difference']}})
    used_ids = list(dict.fromkeys(uid for c in q['criteria'] for uid in c['source_ref_ids']))
    reviews.append({'set_id': spec['id'], 'subquestion_id': q['id'], 'reviewer_id': 'agent:/root/next_cases_early', 'method': 'agent_content_review', 'human_review_performed': False, 'actual_model_grading': 'not_run', 'rationale': item['points_reason'], 'point_decision': f'유지: 독립 의미{maximum}개 각1점', 'max_points': maximum, 'fact_ids': item['facts'], 'question_style': 'case', 'topic_ids': item['topics'], 'minimal_sufficient_answer': q['model_answer'], 'checks': {k: 'pass' for k in ['source', 'answer', 'prompt', 'points', 'style', 'topics', 'edition', 'nonduplication']}, 'check_rationales': {'source': '; '.join(r['source_span'] for r in set_out['source_refs'] if r['id'] in used_ids), 'answer': '모범·부분·오답·역방향부분·함축·반복·일반론·빈답을 직접 대조하였다. ' + contract, 'prompt': '주어진 감사 단계에서 발문이 요구하는 독립 의미만 채점한다. ' + q['prompt'], 'points': item['points_reason'], 'style': item['dependency'], 'topics': topic_reasons[q['id']], 'edition': '공식2026 PDF602/603/604/605/609/610/771 및 연결 각주 문단을 직접 대조했다. ' + footnotes, 'nonduplication': item['comparison']['difference']}, 'unresolved': [], 'unresolved_content_findings': [], 'question_content_sha256': sha_json(q), 'set_content_sha256': sha_json(set_out), 'source_quote_hashes': {r['id']: r['content_hash'] for r in set_out['source_refs'] if r['id'] in used_ids}, 'local_boundary_review': regression})
difference = ' / '.join(i['comparison']['difference'] for i in spec['questions'])
design = {'set_id': spec['id'], 'plan': {'version': 1, 'topic_id': '12', 'mode': 'adapt_existing_question', 'objective': spec['title'], 'scope': {'actors': ['다온 대표이사·재무이사', '한결회계법인 업무수행이사·담당자 갑·팀원 을', '은행'], 'timing': ['2026년1월1일 개시 보고기간의 감사, 2027년3월 종결 과정의 최초 발견·추가 조사·최종 판단'], 'conditions': spec['facts'], 'exceptions': ['단순 충돌만으로 진술이 거짓 또는 의견거절이라고 단정하지 않는다.', '신뢰성의 의문과 핵심 책임진술을 신뢰할 수 없다는 최종 결론을 구별한다.'], 'required_answers': [q['prompt'] for q in set_out['subquestions']], 'exclusions': ['금액계산, 경영진 속성의 전수열거, 감사계약 해지·법규, 의견보고서 문구는 묻지 않는다.']}, 'question_types': ['judgment', 'descriptive'], 'source_unit_ids': all_plan_ids, 'existing_question_difference': difference, 'edition_assumption': '2026년1월1일 개시 보고기간에 적용할 공식2026전문을 읽고 기존2025등록 본문의 동일성을 대조해 인용한다. 향후 시험 적용판본 승인과 구별한다.', 'unresolved_items': [], 'status': 'ready'}, 'bank_sha256': sha_file(D / 'bank-before.json'), 'source_catalog_sha256': sha_file(D / 'source-catalog.json'), 'facts_chars': len('\n'.join(spec['facts'])), 'facts_counting': 'LF join, spaces included, Unicode code points', 'compared_existing_sets': compared, 'draft_inventory_file': (D / 'draft-inventory.json').as_posix(), 'draft_inventory_sha256': sha_file(D / 'draft-inventory.json'), 'draft_inventory_scope': f'기계 목록{len(inventory["rows"])}개 위치행·{len(set(r["id"] for r in inventory["rows"]))}개 고유ID에서 서면진술·580 관련 항목을 검색했다. 가까운4개 경로의 실제 사실·발문·정답·criterion을 읽었다. 모든 draft의 전수 의미검수가 아니며 같은ID의 옛 기준서형 물음과 현재 승급ID의 구분을 유지한다.', 'near_draft_comparisons': [{'file': f, 'sha256': sha_file(f), 'finding': '옛12-010은 미제공 범위와 책임진술 일반론 또는 경영진교체의 전체기간 거절이다. g09는 일반 증거상 한계·요청대상이다. 새 사례는 실제 은행계약과 제공된 진술의 충돌·누락지시 및 그 결과 다른 진술/자료와 핵심책임 확인의 신뢰성을 적용한다.'} for f in near_drafts], 'source_locations': locations, 'original_question_relationships': [{'original_question_id': 'cpa_exam:2020:3:3', 'new_subquestion_id': 'sub2', 'relationship': 'adjacent', 'reason': '기출물음3(2)는 미제공 대응 중 의견 영향 고려 예시를 제외한 토의·성실성/신뢰성 재평가를 요구한다. 신규는 제공된 서면진술과 다른 증거의 불일치라는 발동 조건에서 구체 진술과 내부자료에 적용하므로 직접 같은 출제로 보지 않는다.'}, {'original_question_id': 'mock:2023:GS2-8:2', 'new_subquestion_id': 'sub1', 'relationship': 'adjacent', 'reason': '원물음은 서면진술의 필요성과 증거상 의미에 대한 일반 설명이며 앞 물음은 수신인·왜곡표시 목록 정정이다. 신규의 실제 증거충돌 절차와 최종 의견은 새 적용 요구다.'}], 'source_discrepancies': [{'file': ADV, 'line': 6943, 'original_text': '(기준서 580-A10)', 'resolution': '해설6944~6947의 문장은 공식2026 580.A1/PDF604 L25363~25368 및 등록A1과 일치한다. 실제2026A10은 추가 서면진술의 내용이다. 원자료는 변경하지 않고 출제 참고 범위를 인접 개념으로 한정한다.', 'status': 'resolved_by_primary_source_comparison'}], 'official_edition_comparison': official_comparisons, 'subquestions': q_designs, 'authoring_method': 'manual', 'human_review_performed': False, 'actual_model_grading': 'not_run'}
write(O / 'design.json', [design]); write(O / 'review.json', reviews); write(O / 'qa.json', qa)

elements_file = Path('cpa_uploader/analysis/question-elements/question-elements.json')
element = next(e for e in read(elements_file)['elements'] if e['id'] == 'element-fca298cf50eb814f')
snapshot_file = RAW / 'coverage-element-snapshot.json'
write(snapshot_file, {'origin_file': elements_file.as_posix(), 'origin_file_sha256': sha_file(elements_file), 'read_method': 'discovery index search followed by actual original prompt and solution read', 'element': element})
q2 = set_out['subquestions'][1]; qids = list(dict.fromkeys(uid for c in q2['criteria'] for uid in c['source_ref_ids']))
coverage = {'element_id': element['id'], 'element_snapshot_sha256': sha_json(element), 'source_unit_ids': qids, 'set_id': spec['id'], 'subquestion_id': 'sub2', 'criterion_ids': [c['id'] for c in q2['criteria']], 'relationship': 'adjacent', 'reason': '2020CPA문제3물음3(2)의 서면진술 미제공 대응은 토의와 성실성·진술/감사증거 신뢰성 재평가이다. 신규는 서면진술을 제공했으나 외부증거와 충돌하고 누락 지시가 드러난 사실에서 구체 대상의 신뢰성을 재평가하므로 발동 조건·적용요구가 다른 인접 심화이다. 해당 기출의 직접 커버로 표시하지 않는다.', 'original_question_ids': [], 'adjacent_original_question_ids': ['cpa_exam:2020:3:3'], 'frequency_kind': 'cpa_exam', 'reprint_treatment': '기출A의 실제 문맥·발문·예시제외·해설을 읽었다. A/B재수록은 원출제1회이며 신뢰성 단어 공유만으로 직접 대응·추가 빈도를 만들지 않는다.', 'source_locations': [x for x in locations if x['original'] == 'cpa_exam:2020:3:3'], 'source_hashes': {r['id']: r['content_hash'] for r in set_out['source_refs'] if r['id'] in qids}, 'review_status': 'needs_review', 'target': {'scope': 'draft', 'file': (O / 'sets.json').as_posix(), 'set_id': spec['id'], 'subquestion_id': 'sub2', 'criterion_ids': [c['id'] for c in q2['criteria']]}}
write(O / 'coverage-proposals.json', [coverage])
render_rows = [{'file': (RAW / f'kga2026-page-{page}.png').as_posix(), 'sha256': sha_file(RAW / f'kga2026-page-{page}.png'), 'parent_file': PDF, 'parent_sha256': sha_file(PDF), 'pdf_page': page, 'method': 'pdftoppm -f PAGE -l PAGE -scale-to 1500 -singlefile -png', 'source_edition': 'KICPA2026 full standards', 'agent_visual_review_performed': True, 'human_review_performed': False} for page in [34, 602, 603, 604, 605, 609, 610, 771]]
write(RAW / 'render-provenance.json', {'created_for': 'case-trio-next-2026-09-14', 'origin': 'Existing official PDF already in repository; no new official transcription or download', 'files': render_rows})
file_roles = [(snapshot_file.as_posix(), 'analysis_discovery_element_snapshot'), ((D / 'bank-before.json').as_posix(), 'frozen_comparison_bank'), ((D / 'catalog-before.json').as_posix(), 'frozen_learning_classification_catalog'), ((D / 'classification-before.json').as_posix(), 'frozen_classification_snapshot'), ((D / 'draft-inventory.json').as_posix(), 'draft_location_and_id_inventory'), ((D / 'source-catalog.json').as_posix(), 'registered_source_unit_catalog'), (EX, 'exam_original_prompt_context_and_solution'), (ADV, 'advanced_practice_original_prompt_context_and_solution'), (OFF, 'official2026_extracted_body_and_footnotes'), (PDF, 'official2026_original_visual_review'), ('cpa_uploader/data/official/delegated-s04-kga-2025.txt', 'exact_registered_official_citation'), ('cpa_uploader/data/official/kga700-705-2025-review15.txt', 'exact_registered_official_citation'), ('cpa_uploader/wiki/question-generation/topics/topic-12-design.md', 'topic_specific_authoring_guidance')]
file_roles += [(f, 'near_draft_semantic_comparison') for f in near_drafts] + [(r['file'], 'derived_original_pdf_render') for r in render_rows] + [((RAW / 'render-provenance.json').as_posix(), 'render_provenance')]
write(O / 'source-files.json', [{'file': file, 'sha256': sha_file(file), 'role': role, 'read_method': '실제 파일 읽기 및 해당 범위 대조; PDF34/602/603/604/605/609/610/771은 본문·관련각주 직접 시각대조. 비교 스냅샷·탐색인덱스·학습원자료의 역할을 구별한다.'} for file, role in file_roles])
print(json.dumps({'set_id': spec['id'], 'facts_chars': design['facts_chars'], 'questions': 3, 'criteria': sum(len(q['criteria']) for q in set_out['subquestions']), 'qa_rows': len(qa), 'files': {name: sha_file(O / f'{name}.json') for name in ['sets', 'design', 'review', 'qa', 'coverage-proposals', 'source-files']}}, ensure_ascii=False, indent=2))
