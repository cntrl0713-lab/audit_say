import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {publicationPaths,reviewedContentHash,withPublicationLock,writePublicationFiles} from '../../../questionBankPublication.ts';
import {compileLearningCatalog} from '../../../../scripts/build-learning-unit-catalog.ts';
import {compilePublicQuestionSet} from '../../../../lib/questionV3.ts';
import {contentHash} from '../../../../lib/learningSubmission.ts';
const P='cpa_uploader/drafts/standard-additional-2026-09-13/publication-v2',stage=P+'/stage';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const write=(file,v)=>fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const mode=process.argv[2];assert(['--stage','--install'].includes(mode));
const canonical={...publicationPaths(),catalog:path.resolve('cpa_uploader/data/learning-question-classifications.json')},baseline=read(P+'/baseline.json'),prep=read(P+'/preparation-completion.json');
assert.equal(prep.status,'evidence_reprocessed_and_validated');
const env={...process.env};for(const k of Object.keys(env))if(/OPENAI|ANTHROPIC|SUPABASE/i.test(k))delete env[k];delete env.NODE_OPTIONS;
const stagedEnv={...env,CPA_QUESTION_V3_AUTHORING_PATH:path.resolve(stage+'/authoring.json'),CPA_QUESTION_V3_PROMOTIONS_PATH:path.resolve(stage+'/promotions.json'),CPA_QUESTION_V3_PUBLIC_PATH:path.resolve(stage+'/public.json'),CPA_QUESTION_V3_ENCRYPTED_PATH:path.resolve(stage+'/encrypted.json')};
const guard=()=>{for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'다른 작업의 정본 변경: '+r.file);};
function run(id,args,environment){const log=P+'/'+id+'.log',fd=fs.openSync(log,'wx');let result;try{result=spawnSync(process.execPath,['--import','tsx',...args],{cwd:process.cwd(),env:environment,shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}write(P+'/'+id+'.result.json',{exit_code:result.status,signal:result.signal,log:ref(log)});assert.equal(result.status,0,id+' 실패: '+log);console.log(id+' passed');}
function catalog(bankFile,sourceFile,prefix){const sets=read(bankFile),evidence=read(P+'/classification-review.json'),reviewFile=prefix+'-classification-review.json';const review={source_file:sourceFile,source_file_sha256:ref(bankFile).sha256,entries:evidence.entries};write(reviewFile,review);const topics=read(P+'/evidence-catalog.json').topics,compiled=compileLearningCatalog(sets,review.entries,topics);const file=prefix+'-catalog.json';write(file,{schema_version:1,source_file:sourceFile,source_file_sha256:ref(bankFile).sha256,public_content_hash:contentHash(sets.map(compilePublicQuestionSet)),review_file:reviewFile,review_file_sha256:ref(reviewFile).sha256,topics,classifications:compiled.classifications});return file;}
if(mode==='--stage'){
 guard();fs.mkdirSync(stage);fs.copyFileSync(P+'/evidence-bank.json',stage+'/authoring.json',fs.constants.COPYFILE_EXCL);fs.copyFileSync(canonical.ledger,stage+'/promotions.json',fs.constants.COPYFILE_EXCL);
 const evidence=P+'/batch.json',ids=prep.ids.join(',');
 run('01-verify',['cpa_uploader/promote_cpa_v3.ts','--to','verified','--sets',ids,'--efficient-review',evidence,'--evidence',P+'/authorization.md; '+evidence],stagedEnv);guard();
 run('02-publish',['cpa_uploader/promote_cpa_v3.ts','--to','published','--sets',ids,'--evidence',P+'/authorization.md; '+evidence],stagedEnv);guard();
 run('03-compile',['scripts/compile-question-bank-v3.ts'],stagedEnv);guard();
 const stagedCatalog=catalog(stage+'/authoring.json',stage+'/authoring.json',stage+'/learning');
 run('04-validate',['cpa_uploader/validate_cpa_v3.ts'],stagedEnv);guard();
 run('05-db-readiness',['scripts/import-question-bank-v3.ts','--learning-catalog',stagedCatalog,'--report',stage+'/db-readiness.json'],stagedEnv);guard();
 const final=read(stage+'/authoring.json'),original=read(P+'/baseline/authoring.json'),priorLedger=read(P+'/baseline/ledger.json'),nextLedger=read(stage+'/promotions.json');
 assert.deepEqual(final.slice(0,original.length),original);assert.equal(final.length,original.length+6);assert.equal(final.flatMap(s=>s.subquestions).length,377);
 assert.deepEqual(final.map(reviewedContentHash),read(P+'/evidence-bank.json').map(reviewedContentHash));assert(final.every(s=>s.status==='published'));
 assert.deepEqual(nextLedger.entries.slice(0,priorLedger.entries.length),priorLedger.entries);assert.equal(nextLedger.entries.length-priorLedger.entries.length,12);
 const canonicalCatalog=catalog(stage+'/authoring.json','cpa_uploader/data/cpa_question_sets_v3.authoring.json',P+'/canonical');
 write(P+'/stage-completion.json',{status:'staged_and_validated',files:['authoring.json','promotions.json','public.json','encrypted.json'].map(f=>ref(stage+'/'+f)),catalog:ref(canonicalCatalog),db_ready:read(stage+'/db-readiness.json').ready,old_sets_preserved:original.length,new_sets:6,new_questions:13,new_points:62,model_api_calls:0});
}else{
 const done=read(P+'/stage-completion.json');assert.equal(done.status,'staged_and_validated');assert(done.db_ready);assert(!fs.existsSync(P+'/install-completion.json'));guard();
 for(const r of [...done.files,done.catalog])assert.equal(ref(r.file).sha256,r.sha256);
 const writes=Object.entries({authoring:'authoring.json',ledger:'promotions.json',public:'public.json',encrypted:'encrypted.json'}).map(([name,file])=>({file:canonical[name],content:fs.readFileSync(stage+'/'+file,'utf8')}));writes.push({file:canonical.catalog,content:fs.readFileSync(done.catalog.file,'utf8')});
 withPublicationLock(canonical.authoring,()=>{guard();writePublicationFiles(writes,baseline.map(r=>({file:r.file,hash:r.sha256})));});
 run('06-canonical-catalog-check',['scripts/build-learning-unit-catalog.ts','--check'],env);
 run('07-canonical-validate',['cpa_uploader/validate_cpa_v3.ts'],env);
 write(P+'/install-completion.json',{status:'canonical_installed_and_validated',completed_at:new Date().toISOString(),files:Object.values(canonical).map(ref),new_sets:6,new_questions:13,new_points:62,old_sets_preserved:155,new_ledger_entries:12,model_api_calls:0,db_applied:false});
}
