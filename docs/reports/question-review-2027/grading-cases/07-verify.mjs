import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {compilePublicQuestionSet,validateQuestionSetV3} from '../../../../lib/questionV3.ts';
import {decryptAuthoringQuestionBankV3} from '../../../../lib/questionV3Encryption.ts';
const dir='docs/reports/question-review-2027/grading-cases',records=[],hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const commands=[
 ['typecheck','node_modules/typescript/bin/tsc',['--noEmit']],
 ['questions:v3:validate','node_modules/tsx/dist/cli.mjs',['cpa_uploader/validate_cpa_v3.ts']],
 ['related-tests',null,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','--test',...['questionV3','questionV3Grading','questionV3Deployment','questionV3Generation','questionV3Input','questionV3Review','questionV3SourceReuse','openaiStructured','v3Cutover','rateLimit'].map(n=>`tests/${n}.test.ts`)]],
 ['wiki-lint','cpa_uploader/wiki/scripts/lint-wiki.mjs',[]]
];
for(const [name,script,args]of commands){const r=spawnSync(process.execPath,script?[script,...args]:args,{encoding:'utf8'});records.push({name,at:new Date().toISOString(),exit_code:r.status,stdout:r.stdout,stderr:r.stderr});console.log(name,r.status);}
const file='cpa_uploader/data/cpa_question_sets_v3.authoring.json',bank=JSON.parse(fs.readFileSync(file)),sets=bank.filter(s=>s.classification.topic_id==='07');
const pub=JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.public.json')),dec=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY));
const deployment={public_matches:JSON.stringify(bank.map(compilePublicQuestionSet))===JSON.stringify(pub),encrypted_matches:JSON.stringify(bank)===JSON.stringify(dec),private_fields_absent:!/(source_quote|critical_facts|model_answer|requirements|content_hash)/.test(JSON.stringify(pub))};
const topic=sets.map(s=>({set_id:s.id,validation:validateQuestionSetV3(s,{verifySourceQuotes:true}),source_hashes_match:s.source_refs.every(r=>r.content_hash===crypto.createHash('sha256').update(r.source_quote).digest('hex'))}));
fs.writeFileSync(`${dir}/07-verification.json`,JSON.stringify({at:new Date().toISOString(),records,deployment,topic,hashes:Object.fromEntries([file,'cpa_uploader/data/cpa_question_sets_v3.public.json','data/cpa_question_sets_v3.authoring.enc.json','lib/questionV3Grading.ts','lib/questionV3.ts','cpa_uploader/validate_cpa_v3.ts','app/quiz/QuizClient.tsx','app/actions.ts'].map(p=>[p,hash(p)]))},null,2)+'\n');
if(records.some(r=>r.exit_code)||Object.values(deployment).includes(false)||topic.some(r=>r.validation.errors.length||!r.source_hashes_match))process.exitCode=1;
