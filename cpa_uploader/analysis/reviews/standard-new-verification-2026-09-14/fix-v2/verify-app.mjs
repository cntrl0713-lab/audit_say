// 운영 DB 조회 경로와 운영 앱 /curriculum·/quiz 응답에서 수정 21물음의 새 발문이 보이고 옛 약칭 발문이 사라졌는지 확인한다. 쓰기 없음.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2/verify-app.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {publicLearningSet} from '../../../../../lib/learningPublic.ts';
import {buildLearningUnits,validateLearningClassification,learningUnitId} from '../../../../../lib/learningUnits.ts';
const F='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2',O=F+'/db-publication-v1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const done=read(O+'/completion.json'),changes=read(F+'/changes.json'),bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
assert.equal(done.status,'production_published_and_independently_verified');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const results=await Promise.all([client.rpc('cpa_get_active_question_bank'),client.rpc('cpa_get_learning_classifications',{p_release_id:done.release_id}),client.from('cpa_learning_topics').select('id,title,part,position').order('position')]);
for(const r of results)assert(!r.error&&Array.isArray(r.data),'앱 경로 데이터 조회 실패');
const [active,meta,topics]=results.map(r=>r.data);
const sets=active.map(publicLearningSet);assert(sets.every(s=>s.release_id===done.release_id),'활성 릴리스가 이번 등록과 다르다');
const units=buildLearningUnits(sets,meta.map(validateLearningClassification),topics);
const rows=changes.changed_sets.map(id=>{const s=bank.find(x=>x.id===id),q=s.subquestions[0],uid=learningUnitId(id,'standard',q.id),u=units.find(x=>x.id===uid);assert(u,'학습 단위 없음: '+uid);
 assert.equal(u.subquestions[0].prompt,q.prompt);assert.equal(u.title,q.prompt);assert(!/\bKGA\b/.test(u.subquestions[0].prompt));assert.equal(u.subquestions.length,1);assert.equal(u.shared_context.facts.length,0);
 const json=JSON.stringify(u);for(const k of ['"model_answer"','"criteria"','"requirements"'])assert(!json.includes(k));
 // 옛 발문의 첫 KGA 위치부터 24자, 새 발문의 첫 감사기준서 위치부터 24자를 화면 확인 표지로 쓴다(출처 라벨 'KGA NNN'과 겹치지 않게 뒤 문구를 포함).
 const p=changes.changes.find(c=>c.set_id===id).fields.find(f=>f.field==='subquestions[0].prompt');assert.equal(p.after,q.prompt);
 return{id:uid,prompt_sha256:createHash('sha256').update(q.prompt).digest('hex'),new_marker:q.prompt.slice(q.prompt.indexOf('감사기준서'),q.prompt.indexOf('감사기준서')+24),old_marker:p.before.slice(p.before.indexOf('KGA'),p.before.indexOf('KGA')+24)};});
const pages=[];
for(const route of ['/curriculum','/quiz']){
 const response=await fetch('https://audit-say.vercel.app'+route,{cache:'no-store'}),html=await response.text();
 assert.equal(response.status,200);assert.equal(new URL(response.url).pathname,route,'앱이 로그인 또는 오류 화면으로 이동함');
 const has=s=>html.includes(s)||html.includes(encodeURIComponent(s));
 pages.push({route,status:response.status,changed_ids_present:rows.filter(r=>has(r.id)).length,new_prompt_markers_present:rows.filter(r=>r.new_marker&&has(r.new_marker)).length,old_prompt_markers_present:rows.filter(r=>r.old_marker&&has(r.old_marker)).map(r=>r.old_marker),body_sha256:createHash('sha256').update(html).digest('hex')});
}
for(const p of pages){assert.equal(p.changed_ids_present,rows.length,p.route+' 누락');assert.deepEqual(p.old_prompt_markers_present,[],p.route+' 옛 약칭 발문 노출');}
const out={status:'production_app_verified',checked_at:new Date().toISOString(),release_id:done.release_id,learning_units:units.length,changed_units:rows,pages,public_answer_fields_excluded:true,writes:0,model_api_calls:0,database_completion:ref(O+'/completion.json'),note:'pilot-18-001·003의 모범답안·채점기준은 공개 응답에 없으며 비공개 내용은 독립 검증기(verification.json)가 정본과 대조했다. 브라우저 조작·사용자 답안 제출은 하지 않았다.'};
fs.writeFileSync(F+'/app-verification.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:out.status,release_id:out.release_id,learning_units:out.learning_units,pages:pages.map(({body_sha256,...p})=>p)}));
