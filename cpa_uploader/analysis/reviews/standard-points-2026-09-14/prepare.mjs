import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'));
if(fs.existsSync(path.join(dir,'bank.snapshot.json'))) throw new Error('동결 증거가 이미 있습니다. 후속 검토는 별도 폴더에서 시작하세요.');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const files = ['cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'cpa_uploader/data/learning-question-classifications.json'];
const buffers = files.map(f => fs.readFileSync(f));
const [bank, catalog] = buffers.map(b => JSON.parse(b));
const map = new Map(catalog.classifications.map(c => [`${c.source_set_id}/${c.subquestion_id}`, c]));
const questions = bank.flatMap(s => s.subquestions.map(q => {
  const classification = map.get(`${s.id}/${q.id}`);
  return {key:`${s.id}/${q.id}`, set_id:s.id, subquestion_id:q.id, title:s.title, status:s.status,
    topic:s.classification.topic_id, standards:s.classification.standards, classification,
    question_style:classification?.question_style ?? q.question_style,
    prompt:classification?.standalone_prompt ?? q.prompt,
    parent_facts:s.shared_context.facts, question:q,
    source_refs:s.source_refs.filter(r => q.requirements.some(x => x.source_ref_id === r.id) || q.criteria.some(c => c.source_ref_ids?.includes(r.id))),
    points:q.criteria.reduce((n,c) => n+c.max_points,0), question_sha256:sha(JSON.stringify(q))};
}));
fs.mkdirSync(dir,{recursive:true});
for(let i=0;i<files.length;i++) fs.writeFileSync(path.join(dir, i===0?'bank.snapshot.json':'classifications.snapshot.json'),buffers[i]);
const standard = questions.filter(q => q.question_style === 'standard');
fs.writeFileSync(path.join(dir,'inventory.json'),JSON.stringify({created_at:new Date().toISOString(),inputs:files.map((file,i)=>({file,sha256:sha(buffers[i])})),bank_sets:bank.length,bank_questions:questions.length,standard_questions:standard.length,standard_points:standard.reduce((n,q)=>n+q.points,0),questions:standard},null,2)+'\n');
for(const [name,lo,hi] of [['01-05',1,5],['06-10',6,10],['11-14',11,14],['15-19',15,19]]) {
 const selected=standard.filter(q=>+q.topic>=lo&&+q.topic<=hi);
 fs.writeFileSync(path.join(dir,`input-${name}.json`),JSON.stringify(selected,null,2)+'\n');
 console.log(name,selected.length,selected.reduce((n,q)=>n+q.points,0));
}
console.log('total', standard.length, standard.reduce((n,q)=>n+q.points,0));
