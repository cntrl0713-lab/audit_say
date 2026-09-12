"""Build manually reviewed successor QA. Never imports grading API runners."""
import copy,hashlib,importlib.util,json,pathlib,sys
ROOT=pathlib.Path.cwd();BASE=ROOT/'cpa_uploader/drafts/delegated-authoring-2026-09-11';HERE=BASE/'n01/point-policy-v1'
read=lambda p:json.loads(pathlib.Path(p).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(p,x):pathlib.Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def load(name):
 spec=importlib.util.spec_from_file_location(name,HERE/(name.replace('_','-')+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
R=load('qa_review_spec'); B=load('boundary_spec').B; P=load('paraphrase_spec').P
V={'m':'met','n':'not_met','c':'contradicted'}
selected=set(sys.argv[1:]);inputs=read(HERE/'qa-inputs.json');all_audit={(r['plan_id'],r['case_id']):r for r in read(HERE/'qa-nonmet-manual-audit.json')}
def close(ids,graph):
 ids=set(ids)
 while True:
  nxt=ids|{v for k in ids for v in graph.get(k,[])}
  if nxt==ids:return ids
  ids=nxt
for e in inputs:
 pid=e['plan_id']
 if selected and pid not in selected:continue
 q=read(ROOT/e['question_file']);oldq=read(ROOT/e['old_question_file']);oldqa=read(ROOT/e['old_qa_file']); qa=copy.deepcopy(oldqa)
 mapping={(m['subquestion_id'],m['old_id']):m['new_ids'] for m in e['mapping']};changes=[];manual=[]
 subs={s['id']:s for s in q['subquestions']}
 affected={sid:[cid for (s,_),ids in mapping.items() if s==sid for cid in ids] for sid in subs}
 needed=[(pid,sid,cid) for sid,ids in affected.items() for cid in ids]
 missing=[k for k in needed if k not in B]
 if missing:print(json.dumps({'plan_id':pid,'waiting_boundary_specs':missing},ensure_ascii=False));continue
 for case,oldcase in zip(qa['cases'],oldqa['cases']):
  sid=case['subquestion_id'];oldvs={v['criterion_id']:v for v in oldcase['expected_verdicts']};vs={}
  for cid,v in oldvs.items():
   children=mapping.get((sid,cid),[cid])
   if len(children)==1:vs[cid]=copy.deepcopy(v);continue
   if v['verdict']=='met':codes='m'*len(children);why='원래 완전한 복합 명제를 충족하던 원답안을 하위 명제별로 대조했다. 각 요구가 답안에 있으며 같은 문장을 여러 독립 명제의 근거로 사용할 수 있다.'
   else:
    assert (pid,case['id']) in all_audit
    codes,why=R.OVERRIDES.get((pid,case['id'],cid),('n'*len(children),'원답안 전체를 읽었으나 이 하위 요구의 행동·관계·판단이 없다. 다른 명제의 설명이나 주어진 사실만으로 보충하지 않는 명시적 누락 판단이다.'))
   assert len(codes)==len(children)
   for child,code in zip(children,codes):vs[child]={'criterion_id':child,'verdict':V[code],'reason':why}
   manual.append({'case_id':case['id'],'subquestion_id':sid,'answer':case['answer'],'old_criterion_id':cid,'old_verdict':v['verdict'],
    'new_verdicts':[vs[x] for x in children],'decision_basis':why,'source_ref_ids':next(c['source_ref_ids'] for c in subs[sid]['criteria'] if c['id']==children[0]),'manual_reviewer':'plan_foundations AI; not a model API call or human approval'})
  case['expected_verdicts']=[vs[c['id']] for c in subs[sid]['criteria']]
  case['expected_points']=sum(v['verdict']=='met' for v in case['expected_verdicts'])
  assert (case['id'],case['answer'],case['subquestion_id'])==(oldcase['id'],oldcase['answer'],oldcase['subquestion_id'])
  if case['expected_verdicts']!=oldcase['expected_verdicts'] or case['expected_points']!=oldcase['expected_points']:
   changes.append({'id':case['id'],'answer':case['answer'],'subquestion_id':sid,'old_points':oldcase['expected_points'],'new_points':case['expected_points'],'old_verdicts':oldcase['expected_verdicts'],'new_verdicts':case['expected_verdicts']})
 def append_case(sid,cid,kind,answer,codes,note):
  case={'id':f'point-policy/{sid}/{cid}/{kind}','subquestion_id':sid,'kind':kind,'target_criterion_id':cid,'answer':answer,
   'expected_points':sum(v=='m' for v in codes.values()),'expected_verdicts':[{'criterion_id':c['id'],'verdict':V[codes.get(c['id'],'n')],'reason':note} for c in subs[sid]['criteria']],
   'note':note,'source_ref_ids':next(c['source_ref_ids'] for c in subs[sid]['criteria'] if c['id']==cid)}
  qa['cases'].append(case)
 for sid,ids in affected.items():
  if not ids:continue
  sub=subs[sid];graph=R.IMPLICATIONS.get(pid,{}).get(sid,{});byid={c['id']:c for c in sub['criteria']};texts={c['id']:c['claim'].split('. ')[0].rstrip('.')+'.' for c in sub['criteria']}
  full='\n'.join(sub['model_answer']);cs={c['id']:'m' for c in sub['criteria']}
  append_case(sid,ids[0],'model',full,cs,'새 저장 모범답안은 모든 독립 명제를 충족한다. 이 한 사례를 아래 target_criterion_ids 전부의 완전답안 증거로 공유하며 이름만 다른 동일 입력을 복제하지 않는다.')
  qa['cases'][-1]['target_criterion_ids']=ids
  for cid in ids:
   t=texts[cid];para=P[pid,sid,cid]
   assert para!=t and not para.startswith('이 물음의 답은 다음과 같다:'), 'Actual alternative wording required'
   got=close({cid},graph);append_case(sid,cid,'paraphrase',para,{x:'m' for x in got},'대상 독립 명제를 동의표현으로 작성했다. 범위를 같이 충족하는 명백한 함축은 인정하고 나머지 명제는 보충하지 않는다.')
   # To test a true omission, also omit propositions which necessarily imply it.
   removed={k for k in texts if cid in close({k},graph)}
   remaining=set(texts)-removed;ans='\n'.join(texts[k] for k in texts if k in remaining) or '이 사안에 관한 설명은 추가로 검토하겠다.'
   append_case(sid,cid,'omission',ans,{x:'m' for x in close(remaining,graph)},'답안 전체에서 대상 명제가 실제로 빠지도록 그 명제를 명백히 함축하는 문장도 함께 제외했다. 삭제된 명제: '+', '.join(sorted(removed)))
   opposite='\n'.join(('“'+t+'”라는 명제는 옳지 않다.' if k==cid else texts[k]) for k in texts)
   codes={k:'m' for k in texts};codes[cid]='c'
   append_case(sid,cid,'opposite',opposite,codes,'대상 명제만 인용하여 명시적으로 부정한다. 인용한 긍정 문구를 자체 주장으로 오독하지 않는다. 독립적으로 정확한 다른 명제의 점수는 보존한다.')
   ans,codes,why=B[pid,sid,cid];append_case(sid,cid,'condition_boundary',ans,codes,why)
  for kind,answer in [('reverse-order','\n'.join(reversed(sub['model_answer']))),('one-sentence','; '.join(x.rstrip('.') for x in sub['model_answer'])+'.')]:
   append_case(sid,ids[0],kind,answer,cs,'모든 명제를 순서/문장수와 무관하게 인정하는 독립 합산 경계이다.');qa['cases'][-1]['target_criterion_ids']=ids
 if pid=='T19-A':
  append_case('sub2','crit3','omission','회사의 검토업무와 관련된 문서는 업무파일에 순서대로 정리한다.',{},'서면진술의 입수 의무와 갑의 생략 제안에 대한 판단을 전혀 제시하지 않은 비어 있지 않은 누락 답안이다. 업무파일 정리라는 일반 문장은 요구된 의무를 함축하지 않는다.')
 qa['draft_sha256']=sha(ROOT/e['question_file']);qa['live_model_grading']='not_run_user_paused';qa['human_approval']=False
 qa['point_policy_lineage']={'previous_qa_file':e['old_qa_file'],'previous_qa_sha256':sha(ROOT/e['old_qa_file']),'preserved_cases':len(oldqa['cases']),'added_cases':len(qa['cases'])-len(oldqa['cases']),'api_calls':0}
 write(ROOT/e['qa_file'],qa);lineage=read(ROOT/e['lineage_file']);lineage['qa_original_answers_preserved']=True;lineage['qa_expectation_changes']=changes;lineage['qa_independent_decisions']=manual
 lineage['new_qa_cases']=[c for c in qa['cases'][len(oldqa['cases']):]];lineage['new_question_sha256']=sha(ROOT/e['question_file']);lineage['new_qa_sha256']=sha(ROOT/e['qa_file']);write(ROOT/e['lineage_file'],lineage)
 print(json.dumps({'plan_id':pid,'old_cases':len(oldqa['cases']),'new_cases':len(qa['cases']),'changed_expectations':len(changes),'new_points':sum(len(s['criteria']) for s in q['subquestions']),'api_calls':0},ensure_ascii=False))
