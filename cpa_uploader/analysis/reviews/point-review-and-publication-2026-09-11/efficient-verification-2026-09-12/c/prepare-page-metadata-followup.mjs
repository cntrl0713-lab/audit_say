import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const E='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const h=read(`${E}/handoff.json`),preserved=`${E}/handoff-v1-preserved`;assert(!fs.existsSync(preserved));fs.mkdirSync(preserved,{recursive:true});
const files=[`${E}/handoff.json`,...h.files.map(x=>x.file),`${E}/build-review.mjs`,`${E}/check-handoff.mjs`];const snapshots=[];
for(const f of [...new Set(files)]){const relative=path.relative(E,f),out=path.join(preserved,relative);assert(!relative.startsWith('..'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(f,out,fs.constants.COPYFILE_EXCL);assert.equal(sha(f),sha(out));snapshots.push({file:f,sha256:sha(f),preserved_file:out.replaceAll('\\','/')});}
write(`${preserved}/snapshot.json`,{version:1,reason:'国内800出처 page 분류 계약 오류 후속 전에 이전 동결 인계/집계 바이트 보존.',entries:snapshots});
const old=read(`${E}/selected-files.json`).entries.find(j=>j.set_id==='pilot-19-003'),O=`${E}/kga800-page-metadata-v2/pilot-19-003`;assert(!fs.existsSync(O));fs.mkdirSync(O,{recursive:true});
const before=read(old.file),after=structuredClone(before),s=after[0],changes=[];
for(const r of s.source_refs)if(['src1','src4','src-kga800-a9'].includes(r.id)){changes.push({source_ref_id:r.id,path:`source_refs[${r.id}].page`,before:r.page,after:'KGA 800',retained_locator:r.source_span});r.page='KGA 800';}
assert.equal(changes.length,3);const reverted=structuredClone(after);for(const c of changes)reverted[0].source_refs.find(r=>r.id===c.source_ref_id).page=c.before;assert.deepEqual(reverted,before);
write(`${O}/question.json`,after);fs.copyFileSync(old.plan_file,`${O}/authoring-plan.json`,fs.constants.COPYFILE_EXCL);fs.copyFileSync(old.qa_file,`${O}/qa.json`,fs.constants.COPYFILE_EXCL);
const oldDir=old.file.slice(0,old.file.lastIndexOf('/'));fs.copyFileSync(`${oldDir}/classification.json`,`${O}/classification.json`,fs.constants.COPYFILE_EXCL);
const entry={set_id:s.id,file:`${O}/question.json`,sha256:sha(`${O}/question.json`),plan_file:`${O}/authoring-plan.json`,plan_sha256:sha(`${O}/authoring-plan.json`),qa_file:`${O}/qa.json`,qa_sha256:sha(`${O}/qa.json`)};
write(`${O}/changes.json`,{version:2,reviewer:'agent',reason:read(`${oldDir}/changes.json`).reason+' source_refs.page는 출판 검증의 기준서 분류 필드이므로 세 국내800 출처에 KGA 800을 지정한다. 실제 DOCX XML/전사 위치는 기존 title·source_span에 보존한다. 문항 내용과 채점 계약은 변하지 않는다.',before:old,after:entry,changed_fields:changes,plan_byte_unchanged:sha(old.plan_file)===entry.plan_sha256,qa_byte_unchanged:sha(old.qa_file)===entry.qa_sha256,reverting_only_declared_pages_restores_old_question:true,prior_changes_file:`${oldDir}/changes.json`,api_calls:0});
write(`${E}/kga800-page-metadata-v2/index.json`,{version:2,entries:[entry]});console.log(JSON.stringify(entry));
