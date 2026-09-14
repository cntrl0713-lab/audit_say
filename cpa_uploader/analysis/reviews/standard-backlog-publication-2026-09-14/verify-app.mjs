// 운영 DB 조회 경로와 운영 앱 /curriculum·/quiz 응답에서 신규 43개 독립 학습 단위를 확인한다. 쓰기 없음.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14/verify-app.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {publicLearningSet} from '../../../../lib/learningPublic.ts';
import {buildLearningUnits,validateLearningClassification,learningUnitId} from '../../../../lib/learningUnits.ts';
const P='cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14',D=P+'/db-publication-v1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const done=read(D+'/completion.json'),before=read(P+'/db-baseline.json'),ids=read(P+'/preparation-completion.json').ids;
assert.equal(done.status,'production_published_and_independently_verified');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const results=await Promise.all([
 client.rpc('cpa_get_active_question_bank'),
 client.rpc('cpa_get_learning_classifications',{p_release_id:done.release_id}),
 client.from('cpa_learning_topics').select('id,title,part,position').order('position'),
 client.from('cpa_question_bank_release_items').select('set_id,set_version_id').eq('release_id',before.release.id),
 client.from('cpa_question_bank_release_items').select('set_id,set_version_id').eq('release_id',done.release_id)
]);
for(const r of results)assert(!r.error&&Array.isArray(r.data),'앱 경로 데이터 조회 실패');
const [active,meta,topics,oldItems,newItems]=results.map(r=>r.data);
const sets=active.map(publicLearningSet);assert(sets.every(s=>s.release_id===done.release_id));
const units=buildLearningUnits(sets,meta.map(validateLearningClassification),topics);
const bank=read(P+'/evidence-bank.json');
const targetIds=ids.flatMap(id=>bank.find(s=>s.id===id).subquestions.map(q=>learningUnitId(id,'standard',q.id)));
const selected=units.filter(u=>targetIds.includes(u.id));assert.equal(selected.length,43);
for(const u of selected){assert.equal(u.question_style,'standard');assert.equal(u.subquestions.length,1);assert.equal(u.shared_context.facts.length,0);assert(u.topics.length>0);const json=JSON.stringify(u);assert(!json.includes('"model_answer"'));assert(!json.includes('"criteria"'));assert(!json.includes('"requirements"'));}
const points=selected.reduce((n,u)=>n+u.subquestions[0].max_points,0);assert.equal(points,206);
for(const old of oldItems)assert(newItems.some(n=>n.set_id===old.set_id&&n.set_version_id===old.set_version_id),'기존 운영 문제 판본 변경');
const pages=[];
for(const route of ['/curriculum','/quiz']){
 const response=await fetch('https://audit-say.vercel.app'+route,{cache:'no-store'}),html=await response.text();
 const present=targetIds.filter(id=>html.includes(encodeURIComponent(id))||html.includes(id));
 assert.equal(response.status,200);assert.equal(new URL(response.url).pathname,route,'앱이 로그인 또는 오류 화면으로 이동함');
 pages.push({route,url:response.url,status:response.status,new_question_ids_present:present.length,missing:targetIds.filter(id=>!present.includes(id)),body_sha256:createHash('sha256').update(html).digest('hex')});
}
for(const p of pages)assert.equal(p.new_question_ids_present,43,'운영 화면에서 신규 물음 누락: '+p.route+' '+p.missing.join(','));
const out={status:'production_app_verified',checked_at:new Date().toISOString(),release_id:done.release_id,bank_sets:sets.length,learning_units:units.length,new_standard_questions:selected.length,new_points:points,prior_set_versions_preserved:oldItems.length,public_answer_fields_excluded:true,pages,new_api_grading_calls:0,authorization:ref(P+'/authorization.md'),database_completion:ref(D+'/completion.json'),verification_note:'운영 DB 조회 경로와 /curriculum·/quiz HTTP 응답의 신규 43개 독립 학습 ID를 확인했다. 브라우저 상호작용·사용자 풀이 제출은 수행하지 않았다.'};
fs.writeFileSync(P+'/app-verification.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...out,pages:out.pages.map(({missing,...p})=>p)}));
