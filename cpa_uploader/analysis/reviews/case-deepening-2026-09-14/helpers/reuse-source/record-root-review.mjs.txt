import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceEvidencePlan,authorSources} from './source-evidence.mjs';
const R='cpa_uploader/analysis/reviews/case-applied-2026-09-14',D='cpa_uploader/drafts/case-applied-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const manualFiles=['root-review-notes-a.json','root-review-notes-b.json'];
const notes=manualFiles.flatMap(f=>read(R+'/'+f));
assert.equal(notes.length,18);assert.equal(new Set(notes.map(n=>n.set_id+'/'+n.subquestion_id)).size,18);
const sets=['a','b'].flatMap(agent=>read(D+'/'+agent+'/sets.json'));
assert.equal(sets.length,6);
assert.deepEqual(notes.map(n=>n.set_id+'/'+n.subquestion_id).sort(),sets.flatMap(s=>s.subquestions.map(q=>s.id+'/'+q.id)).sort(),'Manual root notes must cover exactly the current new questions');
const sourcePlan=sourceEvidencePlan();
// These are explicit recorded decisions from root's completed manual review, not inferred from shape checks.
for(const n of notes){assert(n.rationale?.trim());assert.deepEqual(Object.keys(n.checks).sort(),['source','answer','prompt','points','style','topics','edition','nonduplication'].sort());assert(Object.values(n.checks).every(v=>v==='pass'));}
const record={reviewer_id:'Codex root — 최종 원문·사실·발문·정답·배점·대표 기대값 직접 대조',reviewed_at:new Date().toISOString(),method:'agent_content_review',human_review_performed:false,
 evidence:[...['a/sets.json','a/design.json','a/review.json','a/qa.json','b/sets.json','b/design.json','b/review.json','b/qa.json','a-peer-review.json','b-peer-review.json'].map(f=>ref(D+'/'+f)),...['a','b'].flatMap(authorSources),...sourcePlan.files],
 manual_notes:manualFiles.map(f=>ref(R+'/'+f)),questions:notes,unresolved_content_findings:[]};
fs.writeFileSync(R+'/root-content-review.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log({manual_reviewed_questions:notes.length});
