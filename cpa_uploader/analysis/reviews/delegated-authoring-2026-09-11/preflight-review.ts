import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {prepareSemanticReview} from '../../../questionSemanticReview.ts';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
import type {QuestionSetV3} from '../../../../lib/questionV3.ts';

const [manifestFile,label]=process.argv.slice(2);
if(!manifestFile||!label||!/^[a-z0-9-]+$/.test(label))throw Error('수집 manifest와 새 실행 이름 필요');
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
interface Entry {plan_id:string;set_id:string;file?:string;sha256?:string;plan_files?:Array<{file:string;sha256:string}>}
const manifest=read(manifestFile) as {entries:Entry[];bank_file:string;bank_sha256:string};
const rows=manifest.entries.filter((entry):entry is Entry&{file:string;sha256:string;plan_files:Array<{file:string;sha256:string}>}=>Boolean(entry.file));
const sets=rows.map(entry=>{
    if(sha(entry.file)!==entry.sha256)throw Error(`${entry.plan_id}: 수집 뒤 문항 변경`);
    const raw=read(entry.file);return (Array.isArray(raw)?raw[0]:raw) as QuestionSetV3;
});
const fixedBank=path.join(path.dirname(manifestFile),'comparison-bank.json');
if(sha(manifest.bank_file)!==manifest.bank_sha256)throw Error('정본 입력 변경');
const bank:QuestionSetV3[]=fs.existsSync(fixedBank)?read(fixedBank):[
    ...(read(manifest.bank_file) as QuestionSetV3[]).filter(set=>!sets.some(candidate=>candidate.id===set.id)),...sets];
const catalog=buildSourceCatalog();
const maxInputChars=Number(process.env.CPA_REVIEW_INPUT_MAX_CHARS||500000);
const results=rows.map((entry,index)=>{
    try{
        if(entry.plan_files.length!==1)throw Error('계획 파일 연결 불명확');
        const selected=entry.plan_files[0];
        if(sha(selected.file)!==selected.sha256)throw Error('수집 뒤 계획 변경');
        const raw=read(selected.file);
        const plan=raw.plans?raw.plans.find((plan:{set_id:string})=>plan.set_id===entry.set_id):raw;
        const missingSources=(plan.source_unit_ids as string[]).filter(id=>!catalog.units.some(unit=>unit.id===id));
        if(missingSources.length)throw Error(`실제 catalog에서 계획 source ID 부재: ${missingSources.join(',')}`);
        const packetFile=entry.file+'.source-packet.json';
        const packet=fs.existsSync(packetFile)?read(packetFile):undefined;
        const prepared=prepareSemanticReview(sets[index],{bank,authoringPlan:plan,packet,maxInputChars});
        const chunks=prepared.units.map(unit=>({unit_id:unit.id,chars:JSON.stringify({...(prepared.requestContext as Record<string,unknown>),target_unit:unit.id,
            reference_catalog:{fields:unit.fields,sources:prepared.sources.filter(source=>unit.sources.includes(source.source_ref_id)).map(source=>({id:source.source_ref_id,quote:source.declared_metadata.source_quote}))}}).length}));
        return {plan_id:entry.plan_id,set_id:entry.set_id,status:chunks.some(chunk=>chunk.chars>maxInputChars)?'chunk_budget_exceeded':'prepared',
            context_chars:prepared.requestChars,max_chunk_chars:Math.max(...chunks.map(chunk=>chunk.chars)),chunks,
            bank_hash:prepared.bankHash,content_hash:prepared.contentHash,source_files:prepared.sourceFiles};
    }catch(error){return {plan_id:entry.plan_id,set_id:entry.set_id,status:'failed',error:String(error)};}
});
const output=`cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/${label}.json`;
fs.writeFileSync(output,JSON.stringify({created_at:new Date().toISOString(),manifestFile,manifest_sha256:sha(manifestFile),
    bank_mode:fs.existsSync(fixedBank)?'fixed':'current_collected_in_memory',comparison_sets:bank.length,max_input_chars:maxInputChars,
    catalog_fingerprint:catalog.fingerprint,model_calls:0,results},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sets:rows.length,errors:results.filter(result=>result.status!=='prepared'),max_chunk_chars:Math.max(...results.map(result=>result.max_chunk_chars||0))}));
if(results.some(result=>result.status!=='prepared'))process.exitCode=1;
