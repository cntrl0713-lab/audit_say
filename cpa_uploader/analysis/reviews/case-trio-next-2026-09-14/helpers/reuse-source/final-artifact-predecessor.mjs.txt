import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/case-trio-2026-09-14',D='cpa_uploader/drafts/case-trio-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f)),ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const files=[D+'/README.md',D+'/questions-and-answers.md',D+'/review-preview.md',R+'/README.md','docs/reports/case-trio-2026-09-14.md'];
const broken=[];let links=0;
for(const file of files){
 const text=fs.readFileSync(file,'utf8');
 for(const match of text.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g)){
  let target=match[1];if(target.startsWith('<')&&target.endsWith('>'))target=target.slice(1,-1);
  if(/^(https?:|#|mailto:)/.test(target))continue;
  target=target.split('#')[0];links++;
  if(!fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(target))))broken.push({file,target});
 }
}
assert.deepEqual(broken,[]);
const canonical='cpa_uploader/data/cpa_question_sets_v3.authoring.json',bank=read(canonical),ids=read(R+'/changed-sets-v1.json'),sets=ids.map(id=>bank.find(s=>s.id===id));
const document=fs.readFileSync(D+'/questions-and-answers.md','utf8');
for(const set of sets){assert.equal(set.status,'published');for(const text of [...set.shared_context.facts.map(f=>f.text),...set.subquestions.flatMap(q=>[q.prompt,...q.model_answer,...q.criteria.map(c=>c.claim)])])assert(document.includes(text));}
const manifest=read(R+'/execution-v1/grading-manifest.json');
for(const row of [...manifest.inputs,...manifest.code_files])assert.equal(ref(row.file).sha256,row.sha256,'Frozen evidence changed: '+row.file);
const db=read(R+'/db-publication-v1/completion.json');
for(const row of db.files)assert.equal(ref(row.file).sha256,row.sha256);
assert.equal(read(R+'/final-checks-v2/summary.json').status,'passed');
fs.writeFileSync(R+'/completion.json',JSON.stringify({status:'complete',completed_at:new Date().toISOString(),cases:3,questions:9,points:20,facts_characters:sets.map(s=>[...s.shared_context.facts.map(f=>f.text).join('\n')].length),canonical:ref(canonical),active_release_id:db.release_id,artifacts:files.map(ref),artifact_links_checked:links,broken_links:[],fixed_manifest_inputs_and_runtime_unchanged:true,independent_db_verification:ref(R+'/db-publication-v1/completion.json'),grading:ref(R+'/sealed-v1/summary.json'),final_checks:ref(R+'/final-checks-v2/summary.json'),human_review_performed:false,link_checker_followup:'최초 간이검사의 angle-bracket 절대경로 해석 오류를 수정했다. 해당 문서 링크 자체는 유효하므로 원문을 변경하지 않았다.'},null,2)+'\n',{flag:'wx'});
console.log({complete:true,cases:3,questions:9,points:20,links_checked:links,frozen_files:manifest.inputs.length+manifest.code_files.length,release:db.release_id});
