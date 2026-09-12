import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateQuestionSetV3} from '../../../../../../lib/questionV3.ts';
import {buildSourceCatalog} from '../../../../../questionSourceCatalog.mjs';
import type {QuestionSetV3} from '../../../../../../lib/questionV3.ts';
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11',out=`${D}/c/official-source-remediation-v1`;
const sha=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const proposalFile=`${out}/proposals.json`,proposal=JSON.parse(fs.readFileSync(proposalFile,'utf8'));
const raw=fs.readFileSync(proposal.bank_file),bank=JSON.parse(raw.toString()) as QuestionSetV3[];
const expectedHash='d8391f9bb5e2567455f63c26d401ba636dc8e8ccd570535a59ac149b1f3b4c99';
if(sha(fs.readFileSync(proposalFile))!==expectedHash||sha(raw)!==proposal.bank_sha256)throw Error('Frozen input mismatch');
const catalog=buildSourceCatalog(),errors:string[]=[],targets=new Set<string>(),observations:unknown[]=[];
function assert(ok:boolean,reason:string){if(!ok)errors.push(reason);}
const clean=(s:string)=>s.split(/\r?\n/u).filter(line=>!/^(?:## PDF page \d+|감사기준서\s+\d+\s+[‘'"]|\d+\s*\/\s*\d+|5 감사기준서 230)/iu.test(line.trim())).join('\n').replace(/\*\*|\s/gu,'');
for(const e of proposal.entries){
 const key=e.set_id+'/'+e.source_ref_id,s=bank.find(s=>s.id===e.set_id)!;targets.add(s.id);
 const old=structuredClone(s),index=s.source_refs.findIndex(r=>r.id===e.source_ref_id);
 assert(JSON.stringify(s.source_refs[index])===JSON.stringify(e.before_source_ref),'before ref '+key);
 const t=fs.readFileSync(e.after_source_ref.file,'utf8'),q=e.after_source_ref.source_quote;
 assert(t.includes(q),'exact source quote '+key);assert(sha(q)===e.after_source_ref.content_hash,'quote hash '+key);
 for(const id of e.catalog_unit_ids){const u=catalog.units.find((u:{id:string})=>u.id===id);assert(Boolean(u&&u.authority==='official_transcription'&&u.file===e.after_source_ref.file),'official actual catalog '+key+'/'+id);}
 for(const r of e.requirements){const sub=s.subquestions.find(q=>q.id===r.subquestion_id)!,ri=sub.requirements.findIndex(q=>q.id===r.requirement_id);assert(JSON.stringify(sub.requirements[ri])===JSON.stringify(r.before),'before requirement '+key+'/'+r.requirement_id);assert(q.includes(r.after.source_quote)&&t.includes(r.after.source_quote),'exact requirement '+key+'/'+r.requirement_id);sub.requirements[ri]=r.after;}
 s.source_refs[index]=e.after_source_ref;
 for(const sub of s.subquestions){const was=old.subquestions.find(q=>q.id===sub.id)!;assert(JSON.stringify({...sub,requirements:[]})===JSON.stringify({...was,requirements:[]}),'grading/prompt/answer immutable '+s.id+'/'+sub.id);}
 let newer=clean(q),older=clean(e.before_source_ref.source_quote);const allowances:string[]=[];
 if(key==='pilot-04-004/src2'){
  const repeated='(a)감사인은이전에해당감사에관여되지아니한숙련된감사인이다음사항을충분히이해할수있도록감사문서를작성해야한다.';
  assert(newer.includes(repeated),'official repeated premise detected');newer=newer.replace(repeated,'(a)');allowances.push('official 230.8(a) repeated identical introductory premise retained in quote; ignored only in lexical comparison');
 }
 if(key==='pilot-04-002/src1'){newer=newer.replace('절차를수행함1','절차를수행함').replace('준수여부를평가함2','준수여부를평가함').replace('참조)3','참조)');allowances.push('official footnote markers 1/2/3 retained');}
 if(key==='pilot-04-002/src2'){newer=newer.replace('포함하여야한다.6','포함하여야한다.');allowances.push('official footnote marker 6 retained');}
 if(key==='pilot-04-005/src2'){newer=newer.replace('포함하여야한다.5','포함하여야한다.');allowances.push('official footnote 5 marker/body retained');}
 if(key==='pilot-05-005/src2'){newer=newer.replace('결정한다.9(문단A32-A33참조)','결정한다.');allowances.push('official footnote 9 and A32-A33 reference retained after unchanged duty sentence');}
 assert(newer===older,'lexical content differs beyond documented official typography '+key);
 observations.push({key,normalized_lexical_content_equal_after_documented_editorial_differences:newer===older,allowances,new_source_file_sha256:sha(t),source_quote_sha256:sha(q),catalog_unit_ids:e.catalog_unit_ids});
}
for(const s of bank.filter(s=>targets.has(s.id))){const r=validateQuestionSetV3(s,{cwd:process.cwd(),verifySourceQuotes:true});errors.push(...r.errors.map(err=>s.id+': '+err));}
const record={version:1,method:'Frozen proposals applied to memory only; all quotes directly located in registered official files, actual catalog authority checked, explicit lexical differences and unchanged non-source subquestion fields compared, native draft validator executed',proposal_file:proposalFile,proposal_sha256:expectedHash,bank_file:proposal.bank_file,bank_sha256:proposal.bank_sha256,sets:targets.size,source_refs:proposal.entries.length,requirements:proposal.entries.reduce((n:number,e:{requirements:unknown[]})=>n+e.requirements.length,0),errors,observations,bank_or_original_writes:0,real_api_calls:0};
fs.writeFileSync(`${out}/validation-evidence-v3.json`,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sets:record.sets,source_refs:record.source_refs,requirements:record.requirements,errors},null,2));if(errors.length)process.exitCode=1;
