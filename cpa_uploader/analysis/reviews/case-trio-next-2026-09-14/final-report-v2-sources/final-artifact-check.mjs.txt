import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkArtifactLinks} from './artifact-links.mjs';
import {parseReportArgs,assertFinalChecksPassed} from './final-check-paths.mjs';

const R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14',D='cpa_uploader/drafts/case-trio-next-2026-09-14';
const read=file=>JSON.parse(fs.readFileSync(file));
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const assertIdentity=row=>assert.equal(ref(row.file).sha256,row.sha256,'Frozen evidence changed: '+row.file);
const {finalChecksName}=parseReportArgs(process.argv.slice(2)),finalChecks=R+'/'+finalChecksName+'/summary.json';
assert(!fs.existsSync(R+'/completion.json'),'Preserve previous completion');
const files=[D+'/README.md',D+'/questions-and-answers.md',D+'/review-preview.md',R+'/README.md','docs/reports/case-trio-next-2026-09-14.md'];
const checked=files.map(checkArtifactLinks);assert.deepEqual(checked.flatMap(result=>result.broken),[]);
const canonical='cpa_uploader/data/cpa_question_sets_v3.authoring.json',bank=read(canonical),ids=read(R+'/changed-sets-v1.json'),sets=ids.map(id=>bank.find(set=>set.id===id));
assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
const document=fs.readFileSync(D+'/questions-and-answers.md','utf8');
for(const set of sets){
 assert.equal(set?.status,'published');assert.equal(set.verification.review_status,'verified');assert.equal(set.subquestions.length,3);
 assert([...set.shared_context.facts.map(fact=>fact.text).join('\n')].length>=400);assert(set.subquestions.every(question=>question.question_style==='case'));
 for(const text of [...set.shared_context.facts.map(fact=>fact.text),...set.subquestions.flatMap(question=>[question.prompt,...question.model_answer,...question.criteria.map(criterion=>criterion.claim)])])assert(document.includes(text),'Answer artifact differs from final canonical content');
}
const manifest=read(R+'/execution-v1/grading-manifest.json');for(const row of [...manifest.inputs,...manifest.code_files])assertIdentity(row);
const db=read(R+'/db-publication-v1/completion.json');assert.equal(db.status,'production_published_and_independently_verified');for(const row of db.files)assertIdentity(row);
assertFinalChecksPassed(read(finalChecks),assertIdentity);
const summary=read(R+'/sealed-v1/summary.json');assert.equal(summary.status,'passed');
const points=sets.reduce((sum,set)=>sum+set.subquestions.reduce((total,question)=>total+question.criteria.reduce((subtotal,criterion)=>subtotal+criterion.max_points,0),0),0);
const result={status:'complete',completed_at:new Date().toISOString(),cases:sets.length,questions:sets.reduce((sum,set)=>sum+set.subquestions.length,0),points,facts_characters:sets.map(set=>[...set.shared_context.facts.map(fact=>fact.text).join('\n')].length),canonical:ref(canonical),active_release_id:db.release_id,artifacts:files.map(ref),artifact_links_checked:checked.reduce((sum,row)=>sum+row.links,0),broken_links:[],fixed_manifest_inputs_and_runtime_unchanged:true,independent_db_verification:ref(R+'/db-publication-v1/completion.json'),grading:ref(R+'/sealed-v1/summary.json'),final_checks:ref(finalChecks),human_review_performed:false};
fs.writeFileSync(R+'/completion.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log({complete:true,cases:result.cases,questions:result.questions,points,links_checked:result.artifact_links_checked,release:db.release_id});
