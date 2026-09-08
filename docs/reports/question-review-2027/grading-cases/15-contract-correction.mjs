import fs from 'node:fs';import assert from 'node:assert/strict';
const dir='docs/reports/question-review-2027/grading-cases',file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(file)),sets=bank.filter(s=>s.id.startsWith('pilot-15'));
assert.deepEqual(sets,JSON.parse(fs.readFileSync(`${dir}/15-after.json`)));
function clarify(c,t){c.claim=t;c.critical_facts[0].expected=t;}
clarify(sets[0].subquestions[0].criteria[1],'감사의견을 담는 단락의 제목이 감사의견임을 제시함. 제목 명칭을 평가하는 독립 요소로서 첫 번째 배치 여부는 crit1에서만 평가함');
for(const c of sets[2].subquestions[0].criteria){clarify(c,c.claim+' 발문에서 중요성과 증거 상태를 이미 부여했으므로 그 조건을 답안에서 반복하지 않아도 왜곡표시/증거부족 및 전반성에 따른 의견의 대응이 분명하면 인정함. 한정·부적정은 각각 한정의견·부적정의견의 명확한 약칭으로 인정하되 부정의견은 부적정의견과 구별함');}
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');fs.writeFileSync(`${dir}/15-v2-after.json`,JSON.stringify(sets,null,2)+'\n');
let runner=fs.readFileSync(`${dir}/15-run.mjs`,'utf8');
for(const suffix of ['cases','offline','public','run-metadata','live'])runner=runner.replaceAll(`15-${suffix}.`, `15-v2-${suffix}.`).replaceAll(`'15-${suffix}'`,`'15-v2-${suffix}'`);
runner=runner.replace("const live=cases.filter(c=>c.live&&c.variant!=='empty');","const live=cases.filter(c=>c.live&&c.variant!=='empty'&&['pilot-15-001','pilot-15-003'].includes(c.set_id));");
runner=runner.replace('const repeat=live.filter',"const prior=['pilot-15-001-omission','pilot-15-001-subq1-omit-crit1','pilot-15-003-paraphrase','15-mapped-conclusions-only'];for(const c of live.filter(c=>prior.includes(c.id)))for(const a of [2,3])await run(c,a);\nconst repeat=live.filter");
fs.writeFileSync(`${dir}/15-v2-run.mjs`,runner);
