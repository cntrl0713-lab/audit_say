// 운영 DB 조회 경로와 운영 앱 /curriculum·/quiz 응답에서 관찰 O1–O3 수정 10세트의 12개 학습 단위가 새 릴리스로 보이는지 확인한다. 쓰기 없음.
// O1 세트 제목, O2 답안 형식(enumeration → 퀴즈 화면 "열거형"), O3 배점(2점)을 공개 투영에서 확인한다. 비공개 채점기준은 독립 검증기의 정본 대조로 확인한다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4/verify-app.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {publicLearningSet} from '../../../../../lib/learningPublic.ts';
import {buildLearningUnits,validateLearningClassification,learningUnitId} from '../../../../../lib/learningUnits.ts';
const F='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4',W=F+'/v3',O=F+'/db-publication-v1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const done=read(O+'/completion.json'),changes=read(W+'/changes.json'),bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),verification=read(O+'/verification.json');
assert.equal(done.status,'production_published_and_independently_verified');assert.equal(verification.status,'passed');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const results=await Promise.all([client.rpc('cpa_get_active_question_bank'),client.rpc('cpa_get_learning_classifications',{p_release_id:done.release_id}),client.from('cpa_learning_topics').select('id,title,part,position').order('position')]);
for(const r of results)assert(!r.error&&Array.isArray(r.data),'앱 경로 데이터 조회 실패');
const [active,meta,topics]=results.map(r=>r.data);
const sets=active.map(publicLearningSet);assert(sets.every(s=>s.release_id===done.release_id),'활성 릴리스가 이번 등록과 다르다');
const units=buildLearningUnits(sets,meta.map(validateLearningClassification),topics);
const rows=changes.changed_sets.flatMap(id=>{const s=bank.find(x=>x.id===id),pub=sets.find(x=>x.id===id),ch=changes.changes.find(c=>c.set_id===id);assert.equal(pub.title,s.title,'공개 세트 제목 불일치: '+id);
 if(ch.observation==='O1')assert.equal(pub.title,ch.fields[0].after);
 return s.subquestions.map(q=>{const uid=learningUnitId(id,'standard',q.id),u=units.find(x=>x.id===uid);assert(u,'학습 단위 없음: '+uid);const sub=u.subquestions[0];
  assert.equal(sub.prompt,q.prompt);assert.equal(u.subquestions.length,1);assert.equal(u.shared_context.facts.length,0);assert.equal(sub.type,q.type);assert.equal(sub.max_points,q.criteria.reduce((a,c)=>a+c.max_points,0));
  if(ch.observation==='O2')assert.equal(sub.type,'enumeration');if(ch.observation==='O3')assert.equal(sub.max_points,2);
  const json=JSON.stringify(u);for(const k of ['"model_answer"','"criteria"','"requirements"'])assert(!json.includes(k));
  return{id:uid,observation:ch.observation,set_title:pub.title,type:sub.type,max_points:sub.max_points};});});
const retained=units.find(x=>x.id===learningUnitId('std-points-20260914-1cae16e579d0','standard','sub1'));assert(retained&&retained.subquestions[0].max_points===4,'분할 유지한 1cae 물음은 4점 그대로여야 한다');
const pages=[];
for(const route of ['/curriculum','/quiz']){
 const response=await fetch('https://audit-say.vercel.app'+route,{cache:'no-store'}),html=await response.text();
 assert.equal(response.status,200);assert.equal(new URL(response.url).pathname,route,'앱이 로그인 또는 오류 화면으로 이동함');
 const has=s=>html.includes(s)||html.includes(encodeURIComponent(s));
 pages.push({route,status:response.status,units_present:rows.filter(r=>has(r.id)).length,release_present:has(done.release_id),body_sha256:createHash('sha256').update(html).digest('hex')});
}
for(const p of pages)assert.equal(p.units_present,rows.length,p.route+' 누락');
const out={status:'production_app_verified',checked_at:new Date().toISOString(),release_id:done.release_id,learning_units:units.length,changed_units:rows,retained_split_unit:{id:retained.id,max_points:retained.subquestions[0].max_points},pages,public_answer_fields_excluded:true,private_criteria_verified_by:ref(O+'/verification.json'),writes:0,model_api_calls:0,database_completion:ref(O+'/completion.json'),note:'O2 물음은 공개 투영의 type이 enumeration이며 퀴즈 화면(app/quiz/QuizWorkspace.tsx)은 이 값으로 "열거형"을 표시한다. 비공개 채점기준은 독립 검증기가 정본과 대조했다. 브라우저 조작·사용자 답안 제출은 하지 않았다.'};
fs.writeFileSync(F+'/app-verification.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:out.status,release_id:out.release_id,learning_units:out.learning_units,changed:rows.map(r=>r.observation+':'+r.type+':'+r.max_points).join(' '),pages:pages.map(({body_sha256,...p})=>p)}));
