import fs from 'node:fs';import assert from 'node:assert/strict';
const dir='docs/reports/question-review-2027/grading-cases',p='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const b=JSON.parse(fs.readFileSync(p)),s=b.filter(s=>s.id.startsWith('pilot-15')),v4=JSON.parse(fs.readFileSync(dir+'/15-v4-after.json')),v3=JSON.parse(fs.readFileSync(dir+'/15-v3-after.json'));
assert.deepEqual(s,v4);
const restored=b.map(s=>v3.find(t=>t.id===s.id)||s);fs.writeFileSync(p,JSON.stringify(restored,null,2)+'\n');
console.log('Restored exact v3 contract; v4 candidate rejected due to observed false positive. Other topics preserved.');
