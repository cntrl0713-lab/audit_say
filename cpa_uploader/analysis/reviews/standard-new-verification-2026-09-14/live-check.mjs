// 운영 DB·운영 앱의 현재 상태를 읽기 전용으로 확인한다. 쓰기와 모델 호출은 없다.
// 1) 기존 독립 검증기로 활성 릴리스 전체를 현재 정본·분류 카탈로그와 대조한다.
// 2) 운영 DB 조회 경로와 /curriculum·/quiz 응답에서 대상 78개 학습 ID가 보이고 퇴역한 30개 ID가 없는지 확인한다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/live-check.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {publicLearningSet} from '../../../../lib/learningPublic.ts';
import {buildLearningUnits,validateLearningClassification,learningUnitId} from '../../../../lib/learningUnits.ts';
const R='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14';
const bank='cpa_uploader/data/cpa_question_sets_v3.authoring.json',catalog='cpa_uploader/data/learning-question-classifications.json';
const migration='supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const release='cpa_uploader/analysis/reviews/case-deepening-2026-09-14/db-publication-v2';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),ref=file=>({file,sha256:sha(file)});
const scope=read(R+'/scope.json');
const completion=read(release+'/completion.json');
assert.equal(completion.status,'production_published_and_independently_verified');
assert.equal(completion.files.find(f=>f.file===bank).sha256,sha(bank),'정본이 마지막 운영 등록 이후 바뀌었다');
assert.equal(completion.files.find(f=>f.file===catalog).sha256,sha(catalog),'분류 카탈로그가 마지막 운영 등록 이후 바뀌었다');
const evidence=release+'/verification-evidence.json';
const log=R+'/live-verifier.log',fd=fs.openSync(log,'wx'),start=Date.now();let result;
try{result=spawnSync(process.execPath,['--import','tsx','cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts','--read-live','--bank',bank,'--learning-catalog',catalog,'--evidence',evidence,'--expected-bank-sha256',sha(bank),'--expected-catalog-sha256',sha(catalog),'--expected-evidence-sha256',sha(evidence),'--migration',migration,'--expected-migration-sha256','6e45c144bf661fa10afd0d001cd0879d3d09c0b2d67d91ef45c70801e96f837b','--expected-project','xvifzicrjmbfqaepcfpp','--output',R+'/live-verification.json'],{shell:false,windowsHide:true,stdio:['ignore',fd,fd],env:process.env});}finally{fs.closeSync(fd);}
assert.equal(result.status,0,'독립 검증기 실패: '+log);
const verification=read(R+'/live-verification.json');assert.equal(verification.status,'passed');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const results=await Promise.all([
 client.rpc('cpa_get_active_question_bank'),
 client.rpc('cpa_get_learning_classifications',{p_release_id:completion.release_id}),
 client.from('cpa_learning_topics').select('id,title,part,position').order('position'),
]);
for(const r of results)assert(!r.error&&Array.isArray(r.data),'앱 경로 데이터 조회 실패');
const [active,meta,topics]=results.map(r=>r.data);
const sets=active.map(publicLearningSet);assert(sets.every(s=>s.release_id===completion.release_id),'활성 릴리스가 마지막 운영 등록과 다르다');
const units=buildLearningUnits(sets,meta.map(validateLearningClassification),topics);
const canonical=read(bank),cm=new Map(canonical.map(s=>[s.id,s]));
const targetIds=scope.targets.map(t=>learningUnitId(t.set_id,'standard',t.subquestion_id));
const retiredIds=scope.retired_origins.map(k=>learningUnitId(k.split('/')[0],'standard',k.split('/')[1]));
const perUnit=[];
for(const t of scope.targets){
 const id=learningUnitId(t.set_id,'standard',t.subquestion_id),u=units.find(x=>x.id===id);assert(u,'운영 학습 단위 없음: '+id);
 const q=cm.get(t.set_id).subquestions.find(x=>x.id===t.subquestion_id),max=q.criteria.reduce((a,c)=>a+c.max_points,0);
 assert.equal(u.question_style,'standard');assert.equal(u.subquestions.length,1);assert.equal(u.shared_context.facts.length,0);assert(u.topics.length>0);
 assert.equal(u.subquestions[0].prompt,q.prompt,'운영 발문이 정본과 다르다: '+id);assert.equal(u.subquestions[0].max_points,max,'운영 배점이 정본과 다르다: '+id);
 const json=JSON.stringify(u);for(const k of ['"model_answer"','"criteria"','"requirements"'])assert(!json.includes(k),'공개 투영에 정답 필드: '+id);
 perUnit.push({id,max_points:max,topics:u.topics.map(x=>x.id??x)});
}
for(const id of retiredIds)assert(!units.some(u=>u.id===id),'퇴역 물음이 운영 학습 단위에 남아 있다: '+id);
const pages=[];
for(const route of ['/curriculum','/quiz']){
 const response=await fetch('https://audit-say.vercel.app'+route,{cache:'no-store'}),html=await response.text();
 const has=id=>html.includes(encodeURIComponent(id))||html.includes(id);
 assert.equal(response.status,200);assert.equal(new URL(response.url).pathname,route,'앱이 로그인 또는 오류 화면으로 이동함');
 pages.push({route,status:response.status,target_ids_present:targetIds.filter(has).length,missing:targetIds.filter(id=>!has(id)),retired_ids_present:retiredIds.filter(has),body_sha256:createHash('sha256').update(html).digest('hex')});
}
for(const p of pages){assert.equal(p.missing.length,0,p.route+' 누락: '+p.missing.join(','));assert.equal(p.retired_ids_present.length,0,p.route+' 퇴역 ID 노출');}
const out={status:'production_read_only_verified',checked_at:new Date().toISOString(),release_id:completion.release_id,verifier:{output:ref(R+'/live-verification.json'),log:ref(log),elapsed_ms:Date.now()-start,counts:verification.actual,remote_write_queries:verification.remote_write_queries??0},bank:ref(bank),catalog:ref(catalog),release_completion:ref(release+'/completion.json'),target_units:perUnit.length,target_points:perUnit.reduce((a,u)=>a+u.max_points,0),retired_units_absent:retiredIds.length,pages,writes:0,model_api_calls:0,note:'브라우저 조작·사용자 답안 제출은 하지 않았다.'};
fs.writeFileSync(R+'/live-check.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...out,pages:out.pages.map(({missing,...p})=>p)}));
