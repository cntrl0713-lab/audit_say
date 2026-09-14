import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/case-expansion-2026-09-13';
const original=R+'/'+(process.argv[2]??'execution-v1'),out=R+'/'+(process.argv[3]??'execution-resume-v2');
assert(/^execution-(?:v1|resume-v[2-9])$/.test(original.split('/').at(-1)));
assert(/^execution-resume-v[2-9]$/.test(out.split('/').at(-1)));
const read=f=>JSON.parse(fs.readFileSync(f));
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const write=(f,x)=>fs.writeFileSync(out+'/'+f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
assert(!fs.existsSync(out));const origin=ref(original+'/grading-manifest.json'),manifest=read(origin.file),reuse=[],summaries=[];
for(const worker of ['a','b','c']){
 const file=original+'/actual-'+worker+'/summary.json',s=read(file);assert.equal(s.status,'stopped');assert.equal(s.frozen_input_error,null);
 summaries.push(ref(file));for(const row of s.rows){if(!row.observation)continue;assert(!row.error);assert.equal(ref(row.observation.file).sha256,row.observation.sha256);
  reuse.push({entry_id:row.id,worker,observation:row.observation,origin_manifest:read(row.observation.file).manifest});}
}
assert.equal(new Set(reuse.map(r=>r.entry_id)).size,reuse.length);
fs.mkdirSync(out);
write('recovery.json',{created_at:new Date().toISOString(),reason:'DNS ENOTFOUND api.openai.com으로 한 작업이 중단되어 공통 중단 신호가 다른 작업을 멈춤. DNS 조회 정상 복구 확인 후 동일 입력·모델·기대값·런타임으로 미완료 요청만 재개한다.',origin_manifest:origin,stop:ref(original+'/STOP.json'),summaries,reused_observations:reuse.length,remaining_requests:manifest.entries.length-reuse.length,content_or_runtime_changes:false,scope_reduced:false,grade_outliers_reused_without_rerun:true,accounting:'첫 실행의 미반환 사용량과 모든 실제 SDK 호출을 보존하고 재사용 관측은 비용을 중복 합산하지 않는다.'});
manifest.reused_observations=reuse;
manifest.inputs.push(ref(out+'/recovery.json'),...summaries,ref(original+'/STOP.json'));
if(process.argv.includes('--refresh-recorder')){
 const allowed='cpa_uploader/questionEfficientReview.ts';
 const current=manifest.code_files.map(c=>{const now=ref(c.file);assert(c.file===allowed||now.sha256===c.sha256,'A grading behavior file changed: '+c.file);return now;});
 fs.mkdirSync(out+'/runtime');
 const snapshots=current.map((c,i)=>{const copied=out+'/runtime/'+String(i).padStart(2,'0')+'-'+path.basename(c.file);fs.copyFileSync(c.file,copied,fs.constants.COPYFILE_EXCL);return{...ref(copied),runtime_file:c.file};});
 write('runtime-snapshots.json',snapshots);
 write('recorder-revision.json',{file:allowed,before:manifest.code_files.find(c=>c.file===allowed),after:current.find(c=>c.file===allowed),reason:'원 실행이 정확히 동일한 채점 코드의 조상 snapshot index를 계승했을 때 두 번째 재개의 유효 관측도 보존·재사용할 수 있게 소비자 검증을 보완했다. 8개 실제 채점 동작 파일과 답안·모델·기대값은 변경하지 않았다.',grading_behavior_changed:false,original_manifests_unchanged:true});
 manifest.code_files=current;
 manifest.inputs.push(ref(out+'/runtime-snapshots.json'),...snapshots.map(({file,sha256})=>({file,sha256})),ref(out+'/recorder-revision.json'),ref(R+'/execution-resume-v3/preflight-failure.json'));
}
write('grading-manifest.json',manifest);
console.log({manifest:ref(out+'/grading-manifest.json'),reused:reuse.length,remaining:manifest.entries.length-reuse.length});
