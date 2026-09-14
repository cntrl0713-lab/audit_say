// 대상 78물음의 기계 검사: 형상·배점 계약, 인용문의 파일·공식 전문 실재, 원행 범위, 분류 카탈로그 일치,
// 그리고 실제 Luna 관측(대표 모범·부분·오답)이 현재 앱 투영과 같은 본문을 채점했는지 확인한다. 모델 호출 없음.
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/mechanical-checks.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {selectLearningQuestionSet,learningUnitId} from '../../../../lib/learningUnits.ts';
import {contentHash} from '../../../../lib/learningSubmission.ts';
const R='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),ref=file=>({file,sha256:sha(file)});
const strip=t=>String(t).replace(/\s+/g,'');
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json',catalogFile='cpa_uploader/data/learning-question-classifications.json';
const scope=read(R+'/scope.json'),bank=read(bankFile),catalog=read(catalogFile),cm=new Map(bank.map(s=>[s.id,s]));
assert.equal(scope.inputs.current_bank.sha256,sha(bankFile),'범위 고정 후 정본이 바뀌었다');
const FULL={KGA:'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',ETHICS:'cpa_uploader/raw/originals/standard-expansion-2026-09-13/ethics-2024-complete.txt',LAW9:'cpa_uploader/raw/originals/standard-expansion-2026-09-13/external-audit-act-article9.txt',LAW22:'cpa_uploader/raw/originals/standard-followup-2026-09-13/external-audit-act-article22.txt',LAWFULL:'cpa_uploader/drafts/delegated-authoring-2026-09-11/s06/sources/external-audit-law-text.txt'};
const text=Object.fromEntries(Object.entries(FULL).map(([k,f])=>[k,fs.readFileSync(f,'utf8')])),flat=Object.fromEntries(Object.entries(text).map(([k,t])=>[k,strip(t)])),kgaLines=text.KGA.split(/\r?\n/);
const kindOf=r=>r.page.startsWith('KGA')?'KGA':r.page.startsWith('공인회계사윤리기준')?'ETHICS':r.page.includes('제9조')?'LAW9':r.page.includes('제22조')?'LAW22':'LAWFULL';
const batches=['cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/sealed-v4/batch.json','cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14/batch.json','cpa_uploader/drafts/standard-priority-2026-09-14/publication-v1/batch.json'];
const observations=[];
for(const b of batches)for(const r of read(b).observations){assert.equal(sha(r.file),r.sha256,'관측 파일 변경: '+r.file);observations.push({batch:b,file:r.file,o:read(r.file)});}
const fileCache=new Map(),questions=[],issues=[];
const norm=x=>{const y=structuredClone(x);delete y.status;if(y.verification)delete y.verification.review_status;return y;};
for(const t of scope.targets){
 const key=`${t.set_id}/${t.subquestion_id}`,s=cm.get(t.set_id),q=s.subquestions.find(x=>x.id===t.subquestion_id),points=q.criteria.reduce((a,c)=>a+c.max_points,0);
 const add=m=>issues.push({question:key,issue:m});
 if((s.shared_context?.facts??[]).length)add('기준서형 세트에 사실관계가 있다');
 if(q.question_style!=='standard')add('question_style '+q.question_style);
 if(!q.topic_ids?.length)add('topic_ids 없음');
 if(JSON.stringify(q.selection)!==JSON.stringify({type:'all',n:null}))add('selection 계약 불일치');
 if(JSON.stringify(q.constraints)!==JSON.stringify({ordered:false,max_entries:null,overflow_policy:'none'}))add('constraints 계약 불일치');
 for(const c of q.criteria){
  if(!Number.isInteger(c.max_points)||c.max_points<1)add(c.id+' 정수 배점 아님');
  if(c.scores.met!==c.max_points||c.scores.not_met!==0||c.scores.contradicted!==0)add(c.id+' scores 계약 불일치');
  if(!q.requirements.some(r=>r.id===c.requirement_id))add(c.id+' requirement 없음');
  for(const id of c.source_ref_ids??[])if(!s.source_refs.some(r=>r.id===id))add(c.id+' source_ref 없음');
 }
 const refs=[];
 for(const r of s.source_refs){
  if(!fileCache.has(r.file))fileCache.set(r.file,fs.readFileSync(r.file,'utf8'));
  const kind=kindOf(r),inFile=fileCache.get(r.file).includes(r.source_quote),inOfficial=flat[kind].includes(strip(r.source_quote))||(kind.startsWith('LAW')&&flat.LAWFULL.includes(strip(r.source_quote)));
  let lineRange=null;const m=r.title.match(/L(\d+)[–-]L?(\d+)/);
  if(m&&kind==='KGA'){const seg=strip(kgaLines.slice(+m[1]-1,+m[2]).join('\n')),quote=strip(r.source_quote);lineRange=seg===quote||seg.includes(quote)||quote.includes(seg);}
  if(!inFile)add(r.id+' 인용이 출처 파일에 없음');if(!inOfficial)add(r.id+' 인용이 공식 전문에 없음');if(lineRange===false)add(r.id+' 원행 범위 불일치');
  refs.push({id:r.id,page:r.page,kind,quote_sha256:createHash('sha256').update(r.source_quote).digest('hex'),in_file:inFile,in_official_text:inOfficial,kga_line_range_match:lineRange});
 }
 const meta=catalog.classifications.filter(m=>m.source_set_id===s.id&&m.subquestion_id===q.id);
 if(meta.length!==1)add('분류 행 '+meta.length);
 const unit=learningUnitId(s.id,'standard',q.id),projected=meta.length===1?selectLearningQuestionSet(s,meta,unit):null;
 if(meta[0]&&meta[0].standalone_prompt!==q.prompt)add('standalone_prompt가 발문과 다르다');
 if(meta[0]&&JSON.stringify(meta[0].topic_ids)!==JSON.stringify(q.topic_ids))add('분류 주제가 발문 주제와 다르다');
 if(meta[0]&&meta[0].source_content_hash!==contentHash(s))add('분류 카탈로그의 원문 해시가 다르다');
 const obs=observations.filter(x=>x.o.source_set_id===s.id&&x.o.evaluated_subquestion_ids.includes(q.id)).map(({batch,file,o})=>{
  const graded=read(o.files.input.file),set=graded.set??graded.projected_set;assert(set,'관측 입력에 채점 투영이 없다: '+file);
  const bound=contentHash(set)===o.projected_body_hash&&JSON.stringify(norm(set))===JSON.stringify(norm(projected));
  if(!bound)add(o.entry_id+' 관측 투영이 현재 앱 투영과 다르다');
  if(o.transport!=='model'||o.response_injection)add(o.entry_id+' 실제 모델 응답이 아니다');
  const sq=o.subquestions.find(x=>x.subquestion_id===q.id);
  return{entry_id:o.entry_id,kind:o.kind,batch:batch.split('/').slice(-3,-1).join('/'),file,model:o.model,transport:o.transport,response_injection:o.response_injection,expected:sq.expected_points,actual:sq.actual_points,delta:sq.delta,within_tolerance:Math.abs(sq.delta)<=1,bound_to_current_projection:bound,differs_only_in_status_fields:bound&&o.projected_body_hash!==contentHash(projected),security_findings:o.security_findings?.length??0,response_ids:(o.usage??[]).map(u=>u.provider?.response_id).filter(Boolean)};
 });
 for(const k of ['model','partial','wrong'])if(!obs.some(o=>o.kind===k))add(k+' 대표 관측 없음');
 questions.push({question:key,kind:t.kind,origin:t.origin,points,criteria:q.criteria.map(c=>({id:c.id,points:c.max_points,requirement_id:c.requirement_id,source_ref_ids:c.source_ref_ids})),source_refs:refs,learning_unit_id:unit,observations:obs});
}
const all=questions.flatMap(q=>q.observations);
const summary={questions:questions.length,criteria:questions.reduce((a,q)=>a+q.criteria.length,0),points:questions.reduce((a,q)=>a+q.points,0),source_refs:questions.reduce((a,q)=>a+q.source_refs.length,0),kga_line_ranges_checked:questions.flatMap(q=>q.source_refs).filter(r=>r.kga_line_range_match!==null).length,observations:all.length,observations_exact:all.filter(o=>o.delta===0).length,observations_within_1:all.filter(o=>o.within_tolerance).length,observations_bound:all.filter(o=>o.bound_to_current_projection).length,models:[...new Set(all.map(o=>o.model))],model_answer_full_marks:questions.filter(q=>q.observations.some(o=>o.kind==='model'&&o.actual===q.points)).length,wrong_answer_zero:questions.filter(q=>q.observations.some(o=>o.kind==='wrong'&&o.actual===0)).length,issues:issues.length,new_model_calls:0};
fs.writeFileSync(R+'/mechanical-checks.json',JSON.stringify({version:1,created_at:new Date().toISOString(),inputs:{scope:ref(R+'/scope.json'),bank:ref(bankFile),catalog:ref(catalogFile),official_texts:Object.values(FULL).map(ref),batches:batches.map(ref)},summary,issues,questions},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(summary));
