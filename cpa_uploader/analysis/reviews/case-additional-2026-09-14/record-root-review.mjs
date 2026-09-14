import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/case-additional-2026-09-14',D='cpa_uploader/drafts/case-additional-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const ref=f=>({file:f,sha256:createHash('sha256').update(fs.readFileSync(f)).digest('hex')});
const notes=['root-review-notes-a.json','root-review-notes-materiality.json','root-review-notes-b.json'].flatMap(f=>read(R+'/'+f));
assert.equal(notes.length,18);assert.equal(new Set(notes.map(n=>n.set_id+'/'+n.subquestion_id)).size,18);
// The pass decisions below record root's completed manual comparison, described in each note.
// No schema, score, hash or other automated result is used to infer these content decisions.
const checks={source:'pass',answer:'pass',prompt:'pass',points:'pass',style:'pass',topics:'pass',edition:'pass',nonduplication:'pass'};
const record={reviewer_id:'Codex root — 원문·최종 발문·정답·criterion·대표 기대값 직접 대조',reviewed_at:new Date().toISOString(),method:'agent_content_review',human_review_performed:false,
 evidence:['a/sets.json','a/design.json','a/review.json','a/qa.json','b/sets.json','b/design.json','b/review.json','b/qa.json','b-peer-review.json'].map(f=>ref(D+'/'+f)),
 manual_notes:['root-review-notes-a.json','root-review-notes-materiality.json','root-review-notes-b.json'].map(f=>ref(R+'/'+f)),
 questions:notes.map(n=>({...n,checks:{...checks}})),unresolved_content_findings:[]};
fs.writeFileSync(R+'/root-content-review.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log({manual_reviewed_questions:notes.length});
