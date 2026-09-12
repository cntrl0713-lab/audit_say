import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';

const root='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const output=`${root}/qa-prepared-v3`;
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const identity=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
if(fs.existsSync(output))throw Error('Prior QA manifests are immutable.');
const predecessor=`${root}/qa-prepared-v2/manifest.json`,manifest=read(predecessor);
const bankFile=`${root}/prepared-reviewed-v5/candidate-authoring.json`,bank=read(bankFile);
const oldBank=read(manifest.bank_file),correctionFile=`${root}/prepared-reviewed-v5/official-source-corrections.json`,corrections=read(correctionFile);
if(identity(manifest.bank_file).sha256!==manifest.bank_sha256)throw Error('Prior QA bank identity changed.');
let checked=0;
for(const entry of manifest.entries){
    if(identity(entry.file).sha256!==entry.sha256)throw Error(`Prior QA changed: ${entry.file}`);
    const set=bank.find(set=>set.id===entry.set_id),before=structuredClone(oldBank.find(set=>set.id===entry.set_id));
    if(set.id==='pilot-03-001'){
        const scope=corrections.scope_clarification.proposal,sub=before.subquestions.find(sub=>sub.id==='sub1');
        if(sub.prompt!==scope.before_prompt)throw Error('Scope clarification predecessor mismatch.');
        sub.prompt=scope.after_prompt;
    }
    const contract=set=>({...set,source_refs:undefined,subquestions:set.subquestions.map(sub=>({...sub,requirements:undefined}))});
    if(JSON.stringify(contract(set))!==JSON.stringify(contract(before)))throw Error(`QA needs semantic reauthoring: ${set.id}`);
    for(const row of read(entry.file).cases){
        const question=set.subquestions.find(sub=>sub.id===row.subquestion_id),byId=new Map(row.expected_verdicts.map(v=>[v.criterion_id,v]));
        if(!question||byId.size!==question.criteria.length||byId.size!==row.expected_verdicts.length||question.criteria.some(c=>!byId.has(c.id)))throw Error(`QA criterion coverage: ${set.id}/${row.id}`);
        const answers=Object.fromEntries(set.subquestions.map(sub=>[sub.id,sub.id===question.id?row.answer:'']));
        const judgment={subquestions:set.subquestions.map(sub=>({subquestion_id:sub.id,verdicts:sub.criteria.map(c=>({criterion_id:c.id,
            verdict:sub.id===question.id?byId.get(c.id).verdict:'not_met',quote:sub.id===question.id&&byId.get(c.id).verdict==='met'?row.answer:undefined}))}))};
        if(applyQuestionSetJudgment(set,answers,judgment).score!==row.expected_points)throw Error(`QA replay mismatch: ${set.id}/${row.id}`);
        checked++;
    }
}
if(checked!==manifest.unique_cases)throw Error('QA total differs.');
fs.mkdirSync(output);
fs.writeFileSync(`${output}/manifest.json`,JSON.stringify({...manifest,created_at:new Date().toISOString(),
    status:'preserved_expected_judgments_replayed_against_official_source_followup_model_not_run',predecessor:identity(predecessor),
    bank_file:bankFile,bank_sha256:identity(bankFile).sha256,source_followup:identity(correctionFile),
    current_replayed_unique_cases:checked,api_calls:0,
    preservation:'All case files, original answers, expected vectors and aliases remain byte-identical. Official source changes and the independently reviewed scope clarification do not change their expected scoring. New actual model checks remain required.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,checked_unique_cases:checked,sets:manifest.entries.length,api_calls:0}));
