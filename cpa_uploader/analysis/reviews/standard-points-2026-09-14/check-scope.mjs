import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const inventory=JSON.parse(fs.readFileSync(path.join(dir,'inventory.json')));
const bank=JSON.parse(fs.readFileSync(path.join(dir,'bank.snapshot.json')));
const bankIds=new Set(bank.map(s=>s.id));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources=new Map();
for(const q of inventory.questions)for(const r of q.source_refs){
 const key=r.file+'\u0000'+r.source_quote;
 if(!sources.has(key)){
  const exists=fs.existsSync(r.file),bytes=exists?fs.readFileSync(r.file):null;
  sources.set(key,{file:r.file,file_sha256:bytes?sha(bytes):null,source_quote_sha256:sha(r.source_quote),page:r.page,exists,exact_quote_present:bytes?bytes.toString('utf8').includes(r.source_quote):false,whitespace_normalized_quote_present:bytes?bytes.toString('utf8').replace(/\s+/gu,' ').includes(r.source_quote.replace(/\s+/gu,' ')):false,question_keys:[]});
 }
 sources.get(key).question_keys.push(q.key);
}
const drafts=[];
function visit(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
 const p=path.join(d,e.name);if(e.isDirectory()){visit(p);continue;}if(!p.endsWith('.json'))continue;
 let raw;try{raw=JSON.parse(fs.readFileSync(p,'utf8'));}catch{continue;}
 const candidates=Array.isArray(raw)?raw:raw?.sets??[raw];if(!Array.isArray(candidates))continue;
 for(const s of candidates){if(!s?.id||!Array.isArray(s.subquestions)||!s.subquestions.length||!s.subquestions.every(q=>q.id&&q.prompt&&Array.isArray(q.criteria)))continue;
  const standards=s.subquestions.filter(q=>q.question_style==='standard');
  if(standards.length)drafts.push({file:p.replaceAll('\\','/'),set_id:s.id,status:s.status,standard_count:standards.length,in_current_bank:bankIds.has(s.id),file_sha256:sha(fs.readFileSync(p))});
 }
}}
visit('cpa_uploader/drafts');
const result={checked_at:new Date().toISOString(),meaning:'source hash/exact-string and draft inventory checks only; not semantic review',sources:[...sources.values()],drafts,unregistered_standard_drafts:drafts.filter(x=>!x.in_current_bank)};
fs.writeFileSync(path.join(dir,'source-and-scope-checks.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({sources:result.sources.length,source_files:new Set(result.sources.map(x=>x.file)).size,missing_sources:result.sources.filter(x=>!x.exists),quote_mismatches:result.sources.filter(x=>!x.exact_quote_present),unregistered:result.unregistered_standard_drafts},null,2));
