import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {main} from './rebind-final-catalog.ts';
const E='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12',C=`${E}/c`,O=fs.mkdtempSync(`${C}/rebind-catalog-fixture-`),read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
fs.writeFileSync(`${O}/README.md`,'합성 lifecycle fixture. 실제 candidate의 복사본을 published로 표시하여 helper 계약만 검사하며 실제 승급·게시·사람검토·모델검수·DB 반영 증거가 아니다. API/DB0.\n');
const candidateReview=read(`${E}/candidate-v1/classification-review.json`),candidateBytes=fs.readFileSync(candidateReview.source_file);assert.equal(hash(candidateBytes),candidateReview.source_file_sha256);
const originalBank=`${O}/original-bank.json`,finalBank=`${O}/synthetic-published-bank.json`,reviewFile=`${O}/original-review.json`;fs.writeFileSync(originalBank,candidateBytes);
const sets=JSON.parse(candidateBytes.toString('utf8')),published=structuredClone(sets);for(const s of published){s.status='published';s.verification.review_status='verified';}write(finalBank,published);
write(reviewFile,{...candidateReview,source_file:originalBank,source_file_sha256:hash(candidateBytes),fixture_only:true});const finalBytes=fs.readFileSync(finalBank),reviewBytes=fs.readFileSync(reviewFile);
const results=[];let index=0;
function run(name,fn){try{fn();results.push({name,status:'pass'});}catch(error){results.push({name,status:'fail',error:String(error)});throw error;}}
function args(name,bank=finalBank,review=reviewFile){const d=`${O}/${++index}-${name}`;fs.mkdirSync(d);return ['--bank',bank,'--review',review,'--output',`${d}/review.json`,'--catalog-output',`${d}/catalog.json`];}
function rejection(name,change,pattern){run(name,()=>{const bank=structuredClone(published),review=JSON.parse(reviewBytes.toString());change(bank,review);const a=args(name);write(a[1],bank);write(a[3],review);assert.throws(()=>main(a),pattern);fs.writeFileSync(finalBank,finalBytes);fs.writeFileSync(reviewFile,reviewBytes);});}
run('lifecycle-only-full-bank-and-official-check',()=>{const a=args('valid'),result=main(a);assert.equal(result.question_count,sets.reduce((n,s)=>n+s.subquestions.length,0));assert.equal(result.set_count,sets.length);const newReview=read(a[5]);assert.deepEqual(newReview.entries,candidateReview.entries);assert.equal(newReview.source_file,finalBank);assert.equal(newReview.source_file_sha256,hash(finalBytes));});
rejection('wrong-original-byte-hash',(_b,r)=>{r.source_file_sha256='0'.repeat(64);},/Buffer SHA/);
rejection('unpublished-final',b=>{b[0].status='verified';},/published\/verified/);
rejection('unverified-final',b=>{b[0].verification.review_status='needs_human_review';},/published\/verified/);
rejection('notes-content-change',b=>{b[0].verification.notes.push('synthetic unauthorized note');},/lifecycle 외/);
rejection('prompt-content-change',b=>{b[0].subquestions[0].prompt+=' changed';},/lifecycle 외/);
rejection('missing-set',b=>{b.pop();},/세트 ID/);
rejection('duplicate-set',b=>{b.push(structuredClone(b[0]));},/중복된 세트/);
rejection('set-order-change',b=>{b.reverse();},/세트 ID/);
rejection('missing-classification',(_b,r)=>{r.entries.pop();},/분류 누락/);
rejection('duplicate-classification',(_b,r)=>{r.entries.push(structuredClone(r.entries[0]));},/중복 물음/);
run('existing-output-preserved',()=>{const a=args('existing');fs.writeFileSync(a[5],'sentinel');assert.throws(()=>main(a),/덮어쓰기/);assert.equal(fs.readFileSync(a[5],'utf8'),'sentinel');});
run('identical-output-paths',()=>{const a=args('identical');a[7]=a[5];assert.throws(()=>main(a),/두 출력/);});
run('input-output-alias',()=>{const a=args('alias');a[5]=reviewFile;assert.throws(()=>main(a),/덮어쓰기/);assert.equal(hash(fs.readFileSync(reviewFile)),hash(reviewBytes));});
run('input-drift-after-review-write',()=>{const a=args('drift'),originalWrite=fs.writeFileSync;fs.writeFileSync=function(file,...rest){const result=originalWrite.call(this,file,...rest);if(path.resolve(String(file))===path.resolve(a[5]))originalWrite(finalBank,Buffer.concat([finalBytes,Buffer.from(' ')]));return result;};try{assert.throws(()=>main(a),/입력 또는 실행 코드가 변경/);}finally{fs.writeFileSync=originalWrite;fs.writeFileSync(finalBank,finalBytes);}});
run('raced-catalog-never-overwritten',()=>{const a=args('raced'),originalWrite=fs.writeFileSync;fs.writeFileSync=function(file,...rest){const result=originalWrite.call(this,file,...rest);if(path.resolve(String(file))===path.resolve(a[5]))originalWrite(a[7],'external sentinel');return result;};try{assert.throws(()=>main(a),/EEXIST/);assert.equal(fs.readFileSync(a[7],'utf8'),'external sentinel');}finally{fs.writeFileSync=originalWrite;}});
const report={fixture_only:true,model_calls:0,db_calls:0,output_directory:O,helper_file:`${C}/rebind-final-catalog.ts`,helper_sha256:hash(fs.readFileSync(`${C}/rebind-final-catalog.ts`)),source_candidate_sha256:hash(candidateBytes),results,counts:{sets:sets.length,questions:sets.reduce((n,s)=>n+s.subquestions.length,0)}};write(`${O}/results.json`,report);console.log(JSON.stringify({fixture:O,passed:results.length,failed:0,model_calls:0,db_calls:0}));
