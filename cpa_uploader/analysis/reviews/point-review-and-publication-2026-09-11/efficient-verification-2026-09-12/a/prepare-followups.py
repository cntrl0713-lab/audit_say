"""Local approved content followups; no API, no canonical writes."""
import copy
import datetime
import hashlib
import json
from pathlib import Path

D = Path('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11')
E = D / 'efficient-verification-2026-09-12/a'
read = lambda p: json.loads(Path(p).read_text(encoding='utf8'))
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
write = lambda p, x: Path(p).write_text(json.dumps(x, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
m = read(D / 'a/execution-all-v9/manifest.json')
for sid in ['pilot-03-004', 'pilot-04-006', 'pilot-04-007']:
    j = next(j for j in m['jobs'] if j['set_id'] == sid)
    old = read(j['file'])
    s = copy.deepcopy(old)
    qa = read(j['qa_file'])
    old_qa = copy.deepcopy(qa)
    plan = read(j['plan_file'])
    target = E / 'content-followups-v1' / sid
    target.mkdir(parents=True, exist_ok=True)
    changes = []
    qchanges = []
    if sid == 'pilot-03-004':
        q = next(q for q in s['subquestions'] if q['id'] == 'sub2')
        oldword = '이 예외가 적용되지 않는다'
        newword = '이 수임 금지가 적용되지 않는다'
        assert oldword in q['model_answer'][-1]
        q['model_answer'][-1] = q['model_answer'][-1].replace(oldword, newword)
        changes.append({'path': 'subquestions[sub2].model_answer[2]', 'before': old['subquestions'][1]['model_answer'][2], 'after': q['model_answer'][2], 'reason': '210.8과 crit5의 법규상 수임금지 예외를 정확하게 지칭한다. 법규 예외 자체를 부정하지 않는다.'})
        for c in qa['cases']:
            if oldword in c['answer']:
                before = copy.deepcopy(c)
                c['answer'] = c['answer'].replace(oldword, newword)
                qchanges.append({'case_id': c['id'], 'before': before, 'after': copy.deepcopy(c), 'reason': '저장 모범답안의 같은 모호한 지시어를 명료화; 올바른 목표명제와 기대점수는 유지.'})
        scope = 'sub2의 법규상 예외는 수임 금지가 적용되지 않는다는 의미이다. 모범답안의 이 예외라는 모호한 지시어를 이 수임 금지로 정정했으며 3점/criterion/공식 출처는 그대로이다.'
    elif sid == 'pilot-04-006':
        q = next(q for q in s['subquestions'] if q['id'] == 'sub3')
        before = q['prompt']
        q['prompt'] = '감사보고서일 후 새로운·추가적인 감사절차를 수행하거나 새로운 결론을 도출하는 경우는 제외한다. ' + before
        changes.append({'path': 'subquestions[sub3].prompt', 'before': before, 'after': q['prompt'], 'reason': '230.16의 문단13 외의 상황을 기준서형 독립 발문에 복원한다. 종전 부모f4와 계획에 있던 범위이므로 새 요구가 아니다.'})
        scope = 'sub3은 기준서형으로 부모사실을 받지 않으므로 230.13에 해당하는 새·추가 감사절차 또는 새 결론 상황을 제외한다는 일반조건을 발문 자체에 명시했다. 답안·criterion·5점·QA 원답안/기대값은 유지한다.'
    else:
        q = next(q for q in s['subquestions'] if q['id'] == 'sub3')
        c = next(c for c in q['criteria'] if c['id'] == 'crit9')
        before = copy.deepcopy(c)
        ids = ['crit9', 'crit11', 'crit12']
        labels = ['성격', '시기', '범위']
        assert not any(z['id'] in ids[1:] for sq in s['subquestions'] for z in sq['criteria'])
        q['criteria'] = [z for z in q['criteria'] if z['id'] != 'crit9']
        for cid, label in zip(ids, labels):
            particle = '이' if label == '성격' else '가'
            nc = copy.deepcopy(c)
            nc['id'] = cid
            nc['claim'] = f'추가감사절차의 {label}{particle} 여전히 적합한지 결정함을 설명한다. 전체 중요성 인하 전 절차를 아무 재평가 없이 그대로 유지하지 않는다.'
            nc['critical_facts'] = [{'id': f'{cid}-fact', 'type': 'action', 'expected': f'추가감사절차의 {label} 적합성 재평가'}]
            nc['max_points'] = 1
            nc['scores'] = {'met': 1, 'not_met': 0, 'contradicted': 0}
            q['criteria'].append(nc)
        changes.append({'path': 'subquestions[sub3].criteria[crit9]', 'before': before, 'after_ids': ids, 'reason': '동일320.13 및 pilot-04-001/sub2와 같은 수준의 독립 성격·시기·범위 요구를 각각1점으로 분리. 원crit9는 성격에 유지하고 새11/12를 추가한다.'})
        for c in qa['cases']:
            if c['subquestion_id'] != 'sub3':
                continue
            prior = copy.deepcopy(c)
            cv = next(v for v in c['expected_verdicts'] if v['criterion_id'] == 'crit9')
            # All thirteen old answers were read individually. Only the old
            # incomplete timing+extent answer changes a formerly zero bundle.
            verdicts = [cv['verdict']] * 3
            if c['id'] == 'sub3/boundary-crit9':
                verdicts = ['not_met', 'met', 'met']
            c['expected_verdicts'] = [v for v in c['expected_verdicts'] if v['criterion_id'] != 'crit9'] + [{'criterion_id': cid, 'verdict': v, 'reason': f'원답안 전체에서 추가절차 {label} 재평가의 작성 여부를 독립 대조했다.'} for cid, label, v in zip(ids, labels, verdicts)]
            c['expected_points'] = sum(v['verdict'] == 'met' for v in c['expected_verdicts'])
            qchanges.append({'case_id': c['id'], 'before': prior, 'after': copy.deepcopy(c), 'reason': '원답안 바이트 보존. 성격·시기·범위별 실제 의미를 대조; 특히 시점·범위만 확인 답안은0→2점으로 복원.'})
        for cid, label in zip(ids, labels):
            particle = '이' if label == '성격' else '가'
            qa['cases'].append({'id': f'efficient/sub3/only-{cid}', 'subquestion_id': 'sub3', 'target_criterion_id': cid, 'kind': 'independent_partial', 'answer': f'추가감사절차의 {label}{particle} 여전히 적합한지 결정한다.', 'expected_points': 1, 'expected_verdicts': [{'criterion_id': z['id'], 'verdict': 'met' if z['id'] == cid else 'not_met', 'reason': '해당 특성 한 가지의 재평가만 기술하며 다른 특성이나 수행중요성 수정 판단은 기술하지 않는다.'} for z in q['criteria']], 'note': '분리된 독립요구의 부분점수 검증용; 명칭만 아니라 적합성 결정 행위를 포함한다.'})
        scope = 'sub3은320.13의 기존 요청 범위를 유지하고 추가절차 성격·시기·범위 재평가를 각각1점으로 분리한다. crit8 유지, 기존crit9는성격,새crit11시기/crit12범위; sub3 2→4점. 모델답안의 한 문장은 세 독립 요구를 모두 충족하므로 바꿀 필요가 없다. 원QA 답안은 전부 보존하고 각 특성 실제 작성 여부로 기대값을 다시 정했다.'
    p = plan['plans'][0] if 'plans' in plan else plan
    p['scope']['conditions'] = [v.split('물음별 명제: ')[0] + '물음별 명제: ' + json.dumps({q['id']: [{'id': c['id'], 'claim': c['claim']} for c in q['criteria']] for q in s['subquestions']}, ensure_ascii=False) if '물음별 명제: ' in v else v for v in p['scope'].get('conditions', [])]
    p['scope'].setdefault('conditions', []).append(scope)
    p['scope']['required_answers'] = [f"{q['id']} ({sum(c['max_points'] for c in q['criteria'])}점): {q['prompt']}\n" + ' / '.join(c['id'] + ': ' + c['claim'] for c in q['criteria']) for q in s['subquestions']]
    p['existing_question_difference'] = p.get('existing_question_difference', '') + '\n2026-09-12 후속: ' + scope
    write(target / 'question.json', s)
    write(target / 'qa.json', qa)
    write(target / 'authoring-plan.json', plan)
    write(target / 'original-qa.json', old_qa)
    if sid == 'pilot-04-006':
        write(target / 'classification-proposal.json', {'set_id': sid, 'subquestion_id': 'sub3', 'question_style': 'standard', 'standalone_prompt': next(q for q in s['subquestions'] if q['id'] == 'sub3')['prompt'], 'reason': scope})
    lineage = {'version': 1, 'set_id': sid, 'reviewer': 'agent', 'agent': 'plan_foundations', 'reviewed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'api_calls': 0, 'status': 'local_candidate_pending_root_selection', 'predecessor': {k: j[k] for k in ['file', 'sha256', 'plan_file', 'plan_sha256', 'qa_file', 'qa_sha256']}, 'changes': changes, 'qa_changes': qchanges, 'summary': scope, 'after': {name: {'file': str(target / name).replace('\\', '/'), 'sha256': sha(target / name)} for name in ['question.json', 'qa.json', 'authoring-plan.json', 'original-qa.json']}, 'source_refs_unchanged': s['source_refs'] == old['source_refs'], 'new_qa_count': len(qa['cases']), 'prior_qa_count': len(old_qa['cases'])}
    write(target / 'remediation.json', lineage)
    print(sid, 'QA', len(qa['cases']), 'source_unchanged', lineage['source_refs_unchanged'])
