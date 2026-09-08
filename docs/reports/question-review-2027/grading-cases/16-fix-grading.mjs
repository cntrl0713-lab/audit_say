import fs from 'node:fs';
const d='docs/reports/question-review-2027/grading-cases',file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const b=JSON.parse(fs.readFileSync(file));
if(!fs.existsSync(`${d}/16-v1-bank.json`))fs.writeFileSync(`${d}/16-v1-bank.json`,JSON.stringify(b.filter(s=>s.id.startsWith('pilot-16-')),null,2)+'\n');
for(const s of b.filter(s=>['pilot-16-002','pilot-16-005'].includes(s.id))){const c=s.subquestions[0].criteria[1];c.claim='높은 추정불확실성을 가진 회계추정치를 포함하여 유의적 경영진 판단이 수반된 재무제표 분야와 관련된 유의적 감사인 판단을 고려함. 경영진 판단이 수반된 분야만 제시하고 이와 관련된 유의적 감사인 판단을 누락하면 미충족';c.critical_facts=[{id:'cf2',type:'condition',expected:'높은 추정불확실성 회계추정치를 포함한 유의적 경영진 판단 분야와 관련된 유의적 감사인 판단. 경영진 판단의 중요성을 감사인의 유의적 판단으로 대신 인정하지 않음'}];}
fs.writeFileSync(file,JSON.stringify(b,null,2)+'\n');
let t=fs.readFileSync(`${d}/16-run.mjs`,'utf8');
// Keep original run/case/metadata files immutable; v2 contains every offline case but calls changed sets only.
for(const name of ['cases','offline','public','run-metadata','live'])t=t.replaceAll(`16-${name}`,`16-v2-${name}`);
t=t.replace('const originalFetch=',`e('005','sub1','management005-without-auditor-judgment','추정불확실성이 높은 회계추정치를 포함하여 경영진의 유의적인 판단이 수반된 재무제표 분야를 고려한다.',['not_met','not_met','not_met']);
for(const c of cases)c.live=c.live&&['pilot-16-002','pilot-16-005'].includes(c.set_id);
const originalFetch=`);
t=t.replace("r.error||r.differences?.length||r.raw_differences?.length", "r.error||r.differences?.length||r.raw_differences?.length||c.id.includes('without-auditor-judgment')");
fs.writeFileSync(`${d}/16-v2-run.mjs`,t);
