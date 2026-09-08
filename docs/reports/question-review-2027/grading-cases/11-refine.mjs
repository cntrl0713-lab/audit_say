import fs from 'node:fs';
const dir='docs/reports/question-review-2027/grading-cases',file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const b=JSON.parse(fs.readFileSync(file)),s=b.find(s=>s.id==='pilot-11-004');
const changes=[
 [s.subquestions[0].criteria[0],'최소 포함 요건이 하나 이상, 즉 한 가지 접근방법만 선택하는 것도 허용됨을 제시함. 세 방법의 단순 열거만으로 최소 수를 밝힌 것은 아니므로 not_met. 세 방법을 반드시 전부 수행해야 한다는 답안은 최소 요건을 바꾸므로 contradicted'],
 [s.subquestions[1].criteria[0],'①의 전제에서 실증절차만으로 설계할 수 있다는 허용 판단을 제시함. 실증절차만으로 설계하되 세부테스트를 포함한다는 조치로 허용 판단이 분명해도 인정함. 단지 실증절차 전용인 경우 세부테스트가 필요하다는 조건부 요건만 적은 것은 허용 판단을 제시한 것이 아니므로 not_met. 실증절차 전용 설계를 금지하면 contradicted'],
];
for(const [c,t]of changes){c.claim=t;c.critical_facts[0].expected=t;}
s.subquestions[0].criteria[0].claim='접근방법을 최소 하나 이상 포함해야 하며, 세 방법을 반드시 모두 수행해야 하는 것은 아님을 제시함';
s.subquestions[1].criteria[0].claim='①의 전제에서 실증절차만으로 접근방법을 설계할 수 있다고 판단함';
s.verification.notes.push('주제11 v2: 최소 포함 수를 밝히지 않은 단순 열거와 세부테스트의 조건부 의무만 제시한 답안의 판단 득점 경계를 명료화. 11-live.jsonl의 불안정 사례 3회 실측에 따른 후속 계약이며 기대점수는 유지.');
fs.writeFileSync(file,JSON.stringify(b,null,2)+'\n');fs.writeFileSync(`${dir}/11-v2-after.json`,JSON.stringify(b.filter(s=>s.classification.topic_id==='11'),null,2)+'\n');
let run=fs.readFileSync(`${dir}/11-run.mjs`,'utf8');
for(const stem of ['cases','offline','public','run-metadata','live'])run=run.replaceAll(`11-${stem}`,`11-v2-${stem}`);
run=run.replace("const live=cases.filter(c=>c.live&&c.variant!=='empty');","const live=cases.filter(c=>c.live&&c.variant!=='empty'&&c.set_id==='pilot-11-004');");
run=run.replace('const metadata={at:',"const metadata={prompt_hashes:Object.fromEntries(Object.entries(prompts).map(([id,p])=>[id,hash(p.input)])),at:");
fs.writeFileSync(`${dir}/11-v2-run.mjs`,run);
