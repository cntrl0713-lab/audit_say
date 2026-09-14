import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = 'cpa_uploader/drafts';
const out = `${root}/case-followup-2026-09-14/a`;
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const rows = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { if (p !== out && !/^(evidence|frozen|grading|semantic.*|live-grading|publication.*|author-qa.*|phase-two.*|before-peer.*|sources|execution.*|sealed.*)$/.test(entry.name)) walk(p); continue; }
    if (!/^(question|draft|sets|[a-z][0-9]{2}|draft-[^.]+)\.json$/.test(entry.name)) continue;
    const bytes=fs.readFileSync(p); let value; try {value=JSON.parse(bytes);}catch{continue;}
    for(const s of Array.isArray(value)?value:[value]) if(s?.schema_version==='3.0'&&s.subquestions&&['05','06','07','08','16'].includes(s.classification?.topic_id)) rows.push({file:p,file_sha256:sha(bytes),id:s.id,title:s.title,questions:s.subquestions.map(q=>({id:q.id,style:q.question_style,prompt:q.prompt,model_answer:q.model_answer,claims:q.criteria.map(c=>c.claim)}))});
  }
}
walk(root);
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'comparison-inventory.json'),JSON.stringify({method:'Primary draft file inventory; runtime snapshots and archived evidence excluded; current canonical compared independently',rows},null,2)+'\n');
console.log(JSON.stringify({files:new Set(rows.map(r=>r.file)).size,rows:rows.length,ids:[...new Set(rows.map(r=>r.id))]}));
