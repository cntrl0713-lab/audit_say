// --stage: 격리 stage에서 수정 21세트를 재검수(verified)·재게시(published)하고 공개본·암호화본·분류 카탈로그·전체 검증·DB 준비 검사를 수행한다.
// --install: stage 결과를 정본에 원자적으로 기록하고 정본 검사를 수행한다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2/publish.mjs --stage|--install
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {publicationPaths,reviewedContentHash,withPublicationLock,writePublicationFiles} from '../../../../questionBankPublication.ts';
import {compileLearningCatalog} from '../../../../../scripts/build-learning-unit-catalog.ts';
import {compilePublicQuestionSet} from '../../../../../lib/questionV3.ts';
import {contentHash} from '../../../../../lib/learningSubmission.ts';
const F='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2',P=F+'/publication-v1',stage=P+'/stage';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const write=(file,v)=>{fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
const mode=process.argv[2];assert(['--stage','--install'].includes(mode));
const canonical={...publicationPaths(),catalog:path.resolve('cpa_uploader/data/learning-question-classifications.json')},baseline=read(F+'/baseline.json'),accepted=read(F+'/acceptance-completion.json'),changes=read(F+'/changes.json');
assert.equal(accepted.status,'accepted_for_reverification');assert.equal(ref(accepted.batch.file).sha256,accepted.batch.sha256);
const ids=changes.changed_sets;assert.equal(ids.length,21);
const env={...process.env};for(const k of Object.keys(env))if(/OPENAI|ANTHROPIC|SUPABASE/i.test(k))delete env[k];delete env.NODE_OPTIONS;
const stagedEnv={...env,CPA_QUESTION_V3_AUTHORING_PATH:path.resolve(stage+'/authoring.json'),CPA_QUESTION_V3_PROMOTIONS_PATH:path.resolve(stage+'/promotions.json'),CPA_QUESTION_V3_PUBLIC_PATH:path.resolve(stage+'/public.json'),CPA_QUESTION_V3_ENCRYPTED_PATH:path.resolve(stage+'/encrypted.json')};
const guard=()=>{for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'다른 작업의 정본 변경: '+r.file);};
function run(id,args,environment){const log=P+'/'+id+'.log',fd=fs.openSync(log,'wx'),start=Date.now();let result;try{result=spawnSync(process.execPath,['--import','tsx',...args],{cwd:process.cwd(),env:environment,shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}write(P+'/'+id+'.result.json',{exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-start,log:ref(log)});assert.equal(result.status,0,id+' 실패: '+log);console.log(id+' passed');}
function catalog(bankFile,sourceFile,prefix){const sets=read(bankFile),reviewFile=prefix+'-classification-review.json';const review={source_file:sourceFile,source_file_sha256:ref(bankFile).sha256,entries:read(F+'/classification-review.json').entries};write(reviewFile,review);const topics=read(F+'/evidence-catalog.json').topics,compiled=compileLearningCatalog(sets,review.entries,topics);const file=prefix+'-catalog.json';write(file,{schema_version:1,source_file:sourceFile,source_file_sha256:ref(bankFile).sha256,public_content_hash:contentHash(sets.map(compilePublicQuestionSet)),review_file:reviewFile,review_file_sha256:ref(reviewFile).sha256,topics,classifications:compiled.classifications});return file;}
const evidence=accepted.batch.file,note=F+'/authorization.md; '+evidence;
if(mode==='--stage'){
 guard();assert(env.CPA_QUESTION_V3_ENCRYPTION_KEY,'암호화 키 필요');fs.mkdirSync(stage,{recursive:true});
 fs.copyFileSync(F+'/evidence-bank.json',stage+'/authoring.json',fs.constants.COPYFILE_EXCL);fs.copyFileSync(canonical.ledger,stage+'/promotions.json',fs.constants.COPYFILE_EXCL);
 run('01-reverify',['cpa_uploader/promote_cpa_v3.ts','--reverify','--to','verified','--sets',ids.join(','),'--efficient-review',evidence,'--evidence',note],stagedEnv);guard();
 run('02-publish',['cpa_uploader/promote_cpa_v3.ts','--to','published','--sets',ids.join(','),'--evidence',note],stagedEnv);guard();
 run('03-compile',['scripts/compile-question-bank-v3.ts'],stagedEnv);guard();
 const stagedCatalog=catalog(stage+'/authoring.json',stage+'/authoring.json',stage+'/learning');
 run('04-validate',['cpa_uploader/validate_cpa_v3.ts'],stagedEnv);guard();
 run('05-db-readiness',['scripts/import-question-bank-v3.ts','--learning-catalog',stagedCatalog,'--report',stage+'/db-readiness.json'],stagedEnv);guard();
 const final=fs.readFileSync(stage+'/authoring.json','utf8'),original=read(F+'/baseline/authoring.json'),priorLedger=read(F+'/baseline/ledger.json'),nextLedger=read(stage+'/promotions.json');
 assert.equal(final,fs.readFileSync(F+'/evidence-bank.json','utf8'),'재검수·재게시 후 원문은 수락한 수정본과 같아야 한다');
 const sets=JSON.parse(final);assert.equal(sets.length,original.length);assert.deepEqual(sets.map(s=>s.id),original.map(s=>s.id));
 for(const [i,s] of sets.entries()){if(ids.includes(s.id)){assert.notDeepEqual(s,original[i]);assert.equal(s.status,'published');}else assert.deepEqual(s,original[i]);}
 assert.deepEqual(nextLedger.entries.slice(0,priorLedger.entries.length),priorLedger.entries);
 const added=nextLedger.entries.slice(priorLedger.entries.length);assert.equal(added.length,42);
 for(const id of ids){const rows=added.filter(e=>e.set_id===id);assert.deepEqual(rows.map(e=>[e.from_status,e.to_status]),[['published','verified'],['verified','published']]);assert(rows[0].efficient_review);assert.equal(rows[1].content_hash,reviewedContentHash(sets.find(s=>s.id===id)));}
 const canonicalCatalog=catalog(stage+'/authoring.json','cpa_uploader/data/cpa_question_sets_v3.authoring.json',P+'/canonical');
 const readiness=read(stage+'/db-readiness.json');assert.equal(readiness.ready,true);assert.deepEqual(readiness.errors,[]);
 write(P+'/stage-completion.json',{status:'staged_and_validated',files:['authoring.json','promotions.json','public.json','encrypted.json','db-readiness.json'].map(f=>ref(stage+'/'+f)),catalog:ref(canonicalCatalog),staged_catalog:ref(stagedCatalog),db_ready:readiness.ready,changed_sets:ids,unchanged_sets:sets.length-ids.length,new_ledger_entries:42,counts:{sets:sets.length,questions:sets.flatMap(s=>s.subquestions).length,points:sets.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).reduce((n,c)=>n+c.max_points,0)},model_api_calls:0});
}else{
 const done=read(P+'/stage-completion.json');assert.equal(done.status,'staged_and_validated');assert(done.db_ready);assert(!fs.existsSync(P+'/install-completion.json'));guard();
 for(const r of [...done.files,done.catalog])assert.equal(ref(r.file).sha256,r.sha256);
 const writes=Object.entries({authoring:'authoring.json',ledger:'promotions.json',public:'public.json',encrypted:'encrypted.json'}).map(([name,file])=>({file:canonical[name],content:fs.readFileSync(stage+'/'+file,'utf8')}));writes.push({file:canonical.catalog,content:fs.readFileSync(done.catalog.file,'utf8')});
 withPublicationLock(canonical.authoring,()=>{guard();writePublicationFiles(writes,baseline.map(r=>({file:r.file,hash:r.sha256})));});
 run('06-canonical-catalog-check',['scripts/build-learning-unit-catalog.ts','--check'],env);
 run('07-canonical-validate',['cpa_uploader/validate_cpa_v3.ts'],env);
 write(P+'/install-completion.json',{status:'canonical_installed_and_validated',completed_at:new Date().toISOString(),files:Object.values(canonical).map(f=>ref(path.relative(process.cwd(),f).split(path.sep).join('/'))),changed_sets:ids,counts:done.counts,new_ledger_entries:42,model_api_calls:0,db_applied:false});
}
