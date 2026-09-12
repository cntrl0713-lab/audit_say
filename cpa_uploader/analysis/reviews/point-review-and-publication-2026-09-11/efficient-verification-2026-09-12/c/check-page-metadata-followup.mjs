import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {buildGradingPrompt,buildGradingResponseSchema} from '../../../../../../lib/questionV3Grading.ts';
const E='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c',O=`${E}/kga800-page-metadata-v2`;
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),fh=f=>sha(fs.readFileSync(f));
const old=read(`${E}/handoff-v1-preserved/selected-files.json`).entries,now=read(`${E}/selected-files.json`).entries;
const beforeEntry=old.find(x=>x.set_id==='pilot-19-003'),afterEntry=now.find(x=>x.set_id==='pilot-19-003'),before=read(beforeEntry.file)[0],after=read(afterEntry.file)[0],afterUndo=structuredClone(after);
assert.equal(beforeEntry.plan_sha256,afterEntry.plan_sha256);assert.equal(beforeEntry.qa_sha256,afterEntry.qa_sha256);
for(const r of afterUndo.source_refs)if(['src1','src4','src-kga800-a9'].includes(r.id)){assert.equal(r.page,'KGA 800');r.page=before.source_refs.find(x=>x.id===r.id).page;}
assert.deepEqual(afterUndo,before);
for(const e of old)if(e.set_id!=='pilot-19-003')assert.deepEqual(now.find(n=>n.set_id===e.set_id),e);
const qa=read(afterEntry.qa_file),replay=[];
for(const c of qa.cases){const answers=Object.fromEntries(after.subquestions.map(q=>[q.id,q.id===c.subquestion_id?c.answer:'']));const oldPrompt=buildGradingPrompt(before,answers),newPrompt=buildGradingPrompt(after,answers),oldSchema=buildGradingResponseSchema(before,answers),newSchema=buildGradingResponseSchema(after,answers);assert.equal(oldPrompt,newPrompt);assert.deepEqual(oldSchema,newSchema);replay.push({case_id:c.id,subquestion_id:c.subquestion_id,answer_sha256:sha(c.answer),prompt_sha256:sha(newPrompt),schema_sha256:sha(JSON.stringify(newSchema)),same_actual_grading_payload:true});}
const oldRows=read(`${E}/handoff-v1-preserved/question-reviews.json`).entries,current=read(`${E}/question-reviews.json`);
for(const r of current.entries){const o=oldRows.find(o=>o.set_id===r.set_id&&o.subquestion_id===r.subquestion_id);if(r.set_id!=='pilot-19-003')r.reviewed_at=o.reviewed_at;else r.metadata_followup={before_reviewed_at:o.reviewed_at,reason:'원문·답안·기준·배점 변화 없이 source.page 분류 필드3개를 KGA 800으로 맞추고 실제 위치는 source_span에 유지했다.'};}
fs.writeFileSync(`${E}/question-reviews.json`,JSON.stringify(current,null,2)+'\n');
const output={version:2,checked_at:new Date().toISOString(),before:beforeEntry,after:afterEntry,changes_only_three_source_page_fields:true,old_question_untouched:fh(beforeEntry.file)===beforeEntry.sha256,other_selected_63_entries_exactly_unchanged:true,qa_and_plan_bytes_unchanged:true,all_qa_replays:replay,full_bank_validation:`${E}/full-bank-validation-v2.json`,api_calls:0};
fs.writeFileSync(`${O}/integrity-check.json`,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({same_payload_cases:replay.length,errors:0}));
