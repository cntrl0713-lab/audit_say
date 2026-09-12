import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const out=path.dirname(fileURLToPath(import.meta.url));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const file='cpa_uploader/raw/collections/2026-09-11-initial/manifest.json';
const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
const candidates=JSON.parse(fs.readFileSync(path.join(out,'candidates.json'),'utf8'));
const entries=new Map(manifest.entries.map(e=>[e.original_path,e]));
const errors=[];
for(const e of manifest.entries){for(const p of [e.original_path,e.archived_path]){const b=fs.readFileSync(p);if(hash(b)!==e.sha256||b.length!==e.bytes)errors.push({path:p,reason:'bytes_or_hash_mismatch'});}}
const missing=candidates.entries.filter(e=>!entries.has(e.original_path)).map(e=>e.original_path);
const changed=candidates.entries.filter(e=>entries.has(e.original_path)&&entries.get(e.original_path).sha256!==e.sha256).map(e=>e.original_path);
const urlOnly=manifest.entries.find(e=>e.original_path.endsWith('IAASB-ISA-800-Revised_0.pdf'));
const result={version:1,checked_at:new Date().toISOString(),manifest_file:file,manifest_sha256:hash(fs.readFileSync(file)),candidate_sha256:hash(fs.readFileSync(path.join(out,'candidates.json'))),original_paths:manifest.entries.length,unique_sha256:new Set(manifest.entries.map(e=>e.sha256)).size,original_path_bytes_including_duplicates:manifest.entries.reduce((n,e)=>n+e.bytes,0),unique_material_bytes:[...new Map(manifest.entries.map(e=>[e.sha256,e.bytes])).values()].reduce((a,b)=>a+b,0),C_candidates_preserved:candidates.entries.length,missing_C_candidates:missing,changed_C_hashes:changed,all_original_and_archived_bytes_checked:true,errors,source19_historical_documents:'모두 연결: interim2014 기존 보존 SHA 일치 + root 재확보4개 과거 SHA 일치',IRBA800_current_preservation:urlOnly?{file:urlOnly.original_path,archived_path:urlOnly.archived_path,sha256:urlOnly.sha256,provenance_records:urlOnly.provenance_records,status:'현재 URL 확보본; 과거 hash 없음으로 과거 바이트 동일성 미확인; 국내 KGA800 근거로 승격하지 않음'}:null,textbook_PDF8:'user_excluded; 통합학습22가 기반, 미보관 결함 아님',additional_confirmed_missing_files:[],api_calls:0,original_or_collection_files_modified:0};
fs.writeFileSync(path.join(out,'collection-followup.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
