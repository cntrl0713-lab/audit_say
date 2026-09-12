// Summarize three exact-input reuses and six new controls. No API calls.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref=file=>({file,sha256:sha(file)});
const lineageFile=path.join(dir,'lineage.json'),controlFile=path.join(dir,'phase-two-v5-control-recheck-01/summary.json');
const lineage=read(lineageFile),controls=read(controlFile);
for(const r of [...lineage.reused_original_observations,...controls.records])if(sha(r.file)!==r.sha256)throw Error('Evidence changed');
if(controls.stopped||controls.records.length!==6||controls.records.some(r=>!r.matched))throw Error('Unexpected control results');
const result={recorded_at:new Date().toISOString(),api_calls_by_this_script:0,lineage:ref(lineageFile),control_summary:ref(controlFile),followup_qa:lineage.followup_qa,original_qa:lineage.original_qa,question:lineage.question,unique_original_case_ids_changed:1,answer_unchanged:true,expectation_change:{case_id:'sub2/boundary-1',criterion_id:'sub2.crit5',before:'not_met',after:'met',before_points:0,after_points:1,other_criteria_unchanged:true},original_case:{valid_observations_reused:3,scores:lineage.reused_current_expectation_scores,matches:lineage.reused_current_expectation_matches,records:lineage.reused_original_observations},new_controls:{new_actual_model_observations:6,cases:controls.cases,records:controls.records.map(r=>({file:r.file,sha256:r.sha256,case_id:r.case_id,request_hash:r.request_hash,schema_hash:r.schema_hash,model:r.model,score:r.score,matched:r.matched}))},total_observations_for_followup:9,new_observations:6,remaining_original_case_model_mismatches:1,conclusion:'QA 기대값의 잘못은 1점으로 정정했다. 직접 회신 양성 1/1/1 및 경영진에게만 회신 반대 0/0/0은 일치한다. 원 경계 답안의 1/0/1 중 가운데 0점은 정정 후에도 유효 불일치이므로 해결로 표시하지 않는다.',bank_question_plan_source_changed:false,original_records_unchanged:true};
fs.writeFileSync(path.join(dir,'followup-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:path.join(dir,'followup-result.json'),sha256:sha(path.join(dir,'followup-result.json')),new_observations:6,reused:3,unresolved:1}));
