import json
import sys
from pathlib import Path

D = Path('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11')
read = lambda p: json.loads(Path(p).read_text(encoding='utf8'))
m = read(D / 'a/execution-all-v9/manifest.json')
cl = {(x['set_id'], x['subquestion_id']): x for x in read(m['classification_contract']['review']['file'])['entries']}
for j in m['jobs']:
    s = read(j['file'])
    if s['classification']['topic_id'] != sys.argv[1]:
        continue
    if len(sys.argv) > 2 and s['id'] != sys.argv[2]:
        continue
    print('\nSET', s['id'], s['title'], 'FACTS', s['shared_context']['facts'])
    p = read(j['plan_file'])
    if 'plans' in p:
        p = next(z for z in p['plans'] if z.get('set_id', s['id']) == s['id'])
    print('PLAN', {k: [z for z in v if not z.startswith(('조건·부정', '새 물음', '계획 ready'))] for k, v in p.get('scope', {}).items() if k in ['exceptions', 'exclusions']})
    direct = {r for q in s['subquestions'] for c in q['criteria'] for r in c['source_ref_ids']}
    for r in s['source_refs']:
        if r['id'] not in direct:
            continue
        print('SOURCE', r['id'], r.get('title'), r.get('source_span'), ' '.join(r['source_quote'].split()))
    qa = read(j['qa_file'])['cases']
    for q in s['subquestions']:
        c = cl[(s['id'], q['id'])]
        print('Q', q['id'], c['question_style'], c['topic_ids'], q['prompt'], '\nSTANDALONE', c.get('standalone_prompt'), '\nANSWER', q['model_answer'])
        print('CRITERIA', [(c['id'], c['claim'], [f['expected'] for f in c['critical_facts'] if f['expected'] != c['claim']], c['source_ref_ids']) for c in q['criteria']])
        mx = sum(c['max_points'] for c in q['criteria'])
        cases = [x for x in qa if x['subquestion_id'] == q['id']]
        chosen = [next((x for x in cases if 'stored-model' in x['id']), next((x for x in cases if x['expected_points'] == mx), None)), next((x for x in cases if 0 < x['expected_points'] < mx), None), next((x for x in cases if x['answer'].strip() and x['expected_points'] == 0), None)]
        print('CANDIDATE_QA', [(x['id'], x['answer'], x['expected_points']) if x else None for x in chosen])
