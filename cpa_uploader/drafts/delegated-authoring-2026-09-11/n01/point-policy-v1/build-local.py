"""Preserve inputs and build manual point-policy successors; no API calls."""
import copy, datetime, hashlib, importlib.util, json, pathlib, re
ROOT=pathlib.Path.cwd(); BASE=ROOT/'cpa_uploader/drafts/delegated-authoring-2026-09-11'
CONTROL=ROOT/'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11'
HERE=BASE/'n01/point-policy-v1'
def read(p):return json.loads(pathlib.Path(p).read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def rel(p):return pathlib.Path(p).resolve().relative_to(ROOT).as_posix()
def write(p,x):
 p=pathlib.Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def fact_role(claim, original):
 if any(x in claim for x in ['억원 미만','억원 이하']):return 'number'
 if any(x in claim for x in ['사람을 문서화','주체는']):return 'actor'
 if any(x in claim for x in ['제안은','주장은 부적절','적정의견을 표명','적용대상에 해당','의구심','이기적 위협']):return 'conclusion'
 if any(x in claim for x in ['시기를 문서화','대상 시점','대상 기간','경우가 위협 발생 조건','극히 드문 상황']):return 'condition'
 if any(x in claim for x in ['기록','검토','평가','투입','인지','커뮤니케이션','논의','입수','테스트','문서화','고려']):return 'action'
 if any(x in claim for x in ['아니다','없다','않아야','못한다']):return 'negation'
 return original['critical_facts'][0]['type']
spec=importlib.util.spec_from_file_location('point_spec',HERE/'review-spec.py'); S=importlib.util.module_from_spec(spec);spec.loader.exec_module(S)
manifest_path=CONTROL/'final-153-v3/manifest-plan-followup-02.json'; manifest=read(manifest_path)
overrides={r['plan_id']:r['identity'] for r in read(CONTROL/'active-qa-overrides-v3-plan-followup-02.json')['overrides']}
entries=[e for e in manifest['entries'] if e['package'] in {'N01','N06','S01','S05','S06'}]
assert len(entries)==18 and set(S.REVIEWS)=={e['plan_id'] for e in entries}
handoff=[]; qa_audit=[]; qa_inputs=[]
for e in entries:
 pid=e['plan_id']; original_file=ROOT/e['file']; original=read(original_file);assert sha(original_file)==e['sha256']
 plan_path=ROOT/e['plan_files'][0]['file'];assert sha(plan_path)==e['plan_files'][0]['sha256']
 qi=overrides.get(pid,{'file':e['qa_file'],'sha256':e['qa_sha256']});qa_path=ROOT/qi['file'];assert sha(qa_path)==qi['sha256']
 oldqa=read(qa_path);newq=copy.deepcopy(original); plan=read(plan_path)
 assert len(S.REVIEWS[pid])==len(original['subquestions'])
 nextno=max(int(re.search(r'(\d+)$',c['id']).group(1)) for s in original['subquestions'] for c in s['criteria'])+1
 used={c['id'] for s in original['subquestions'] for c in s['criteria']}; mapping={}; questions=[]
 for idx,sub in enumerate(newq['subquestions']):
  oldsub=original['subquestions'][idx]; splits=S.SPLITS.get(pid,{}).get(sub['id'],{});cs=[];ma=[]
  for c in oldsub['criteria']:
   children=[]
   for n,claim in enumerate(splits.get(c['id'],[c['claim']])):
    child=copy.deepcopy(c)
    if n:
     while 'crit'+str(nextno) in used:nextno+=1
     child['id']='crit'+str(nextno);used.add(child['id']);nextno+=1
    if c['id'] in splits:
     child['claim']=claim;child['critical_facts']=[{'id':child['id']+'.fact','type':fact_role(claim,c),'expected':claim}]
    child['max_points']=1;child['scores']={'met':1,'not_met':0,'contradicted':0};cs.append(child);children.append(child['id'])
   mapping[(sub['id'],c['id'])]=children
  sub['criteria']=cs
  if splits:
   # Keep every original model-answer sentence as historical lineage; successor is
   # the explicit independent positive propositions, with scope details in claims.
   sub['model_answer']=[c['claim'].split('. ')[0].rstrip('.')+'.' for c in cs]
  if (pid,sub['id']) in S.PROMPT_REFINEMENTS:sub['prompt']=S.PROMPT_REFINEMENTS[pid,sub['id']]
  questions.append({'id':sub['id'],'old_points':sum(c['max_points'] for c in oldsub['criteria']),
   'new_points':len(cs),'decision':'split' if splits else 'retain','rationale':S.REVIEWS[pid][idx],
   'source_ref_ids':sorted({r for c in cs for r in c['source_ref_ids']}),
   'criterion_mapping':[{'old_id':c['id'],'new_ids':mapping[sub['id'],c['id']],
    'reason':S.REVIEWS[pid][idx] if c['id'] in splits else '원문·발문에서 요구한 독립 명제와 필수조건을 유지한다: '+c['claim']} for c in oldsub['criteria']]})
 changed=newq!=original
 dest=BASE/e['package'].lower()/'point-policy-v1'/pid.lower()
 lineage={'plan_id':pid,'set_id':e['set_id'],'source_inputs':{'question':{'file':rel(original_file),'sha256':sha(original_file)},'plan':{'file':rel(plan_path),'sha256':sha(plan_path)},'qa':qi},
  'api_calls':0,'policy':'One point per independently requested proposition; original facts, sources, IDs and every previous QA answer retained.',
  'questions':questions,'old_model_answers':{s['id']:s['model_answer'] for s in original['subquestions']},
  'source_refs_identical':original['source_refs']==newq['source_refs'],'shared_context_identical':original['shared_context']==newq['shared_context'],
  'model_revalidation':'not_run_user_paused','human_approval':False}
 if changed:
  assert original['source_refs']==newq['source_refs'] and original['shared_context']==newq['shared_context']
  pp=plan['plans'][0];pp['scope']['required_answers']=[s['prompt'] for s in newq['subquestions']]
  pp['scope']['conditions'].append('2026-09-11 승인된 후속 배점: 발문이 요구한 독립 의미단위마다 1점으로 합산한다. 문장 수·순서와 무관하며 올바른 이유가 판단을 명확히 함축하면 판단을 인정한다. 주어진 사실·조건의 단순 반복은 별도 점수가 아니다. 물음별 명제: '+json.dumps({s['id']:[{'id':c['id'],'claim':c['claim']} for c in s['criteria']] for s in newq['subquestions']},ensure_ascii=False))
  newfile=dest/'question.json';newplan=dest/'authoring-plan.json';newqa=dest/('qa-cases-'+pid.lower()+'.json');lp=dest/'lineage.json'
  write(newfile,newq);write(newplan,plan);write(lp,lineage)
 else:newfile=original_file;newplan=plan_path;newqa=qa_path;lp=None
 handoff.append({'plan_id':pid,'set_id':e['set_id'],'changed':changed,'question_file':rel(newfile),'plan_file':rel(newplan),'qa_file':rel(newqa),'lineage_file':rel(lp) if lp else None,'questions':questions})
 if changed:
  qa_inputs.append({'plan_id':pid,'question_file':rel(newfile),'old_question_file':rel(original_file),'old_qa_file':rel(qa_path),'qa_file':rel(newqa),'lineage_file':rel(lp),'mapping':[{'subquestion_id':sid,'old_id':cid,'new_ids':ids} for (sid,cid),ids in mapping.items() if len(ids)>1]})
  for case in oldqa['cases']:
   ev={v['criterion_id']:v['verdict'] for v in case['expected_verdicts']}
   relevant=[{'old_id':cid,'new_ids':ids,'old_verdict':ev[cid]} for (sid,cid),ids in mapping.items() if sid==case['subquestion_id'] and len(ids)>1 and ev[cid]!='met']
   if relevant:qa_audit.append({'plan_id':pid,'case_id':case['id'],'subquestion_id':case['subquestion_id'],'kind':case['kind'],'answer':case['answer'],'targets':relevant})
result={'owner':'plan_foundations','api_calls':0,'entries':handoff,'validation':{'api_calls':0,'checks':[],'model_revalidation':'not_run_user_paused'}}
write(HERE/'handoff.json',result);write(HERE/'qa-inputs.json',qa_inputs);write(HERE/'qa-nonmet-manual-audit.json',qa_audit)
print(json.dumps({'sets':18,'questions':sum(len(e['questions']) for e in handoff),'changed_sets':sum(e['changed'] for e in handoff),'old_points':sum(q['old_points'] for e in handoff for q in e['questions']),'new_points':sum(q['new_points'] for e in handoff for q in e['questions']),'qa_nonmet_cases_to_review':len(qa_audit)},ensure_ascii=False))
