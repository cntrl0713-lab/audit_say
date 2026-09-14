import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {partitionSourceInventory,fileRef} from './source-inventory.mjs';

const D='cpa_uploader/drafts/case-trio-next-2026-09-14',R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14';
const collection='cpa_uploader/raw/collections/2026-09-14-case-trio-next';
const args=process.argv.slice(2);assert(args.length===0||(args.length===2&&args[0]==='--extra-sources'),'Use optional --extra-sources <JSON array of {file,sha256}>');
const read=file=>JSON.parse(fs.readFileSync(file));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
assert(!fs.existsSync(R+'/source-inventory.json'));assert(!fs.existsSync(R+'/source-collection.json'));assert(!fs.existsSync(collection),'Existing collection is immutable; use a separately reviewed successor');
const paths=new Set(),inputs=[];
for(const worker of ['a','b','c']){
 const sourceFile=D+'/'+worker+'/source-files.json',setFile=D+'/'+worker+'/sets.json';inputs.push(fileRef(sourceFile),fileRef(setFile));
 const data=read(sourceFile),rows=Array.isArray(data)?data:data.files??data.entries;assert(Array.isArray(rows)&&rows.length);
 for(const row of rows){const file=row.file??row.original_path;assert.equal(fileRef(file).sha256,row.sha256,'Author source inventory changed: '+file);paths.add(file);}
 for(const set of read(setFile))for(const source of set.source_refs)paths.add(source.file);
}
if(args.length){
 const rows=read(args[1]);assert(Array.isArray(rows));inputs.push(fileRef(args[1]));
 for(const row of rows){assert.equal(fileRef(row.file).sha256,row.sha256,'Extra source changed: '+row.file);paths.add(row.file);}
}
const inventory=partitionSourceInventory([...paths]);assert(inventory.entries.length);
write(R+'/source-inventory.json',{version:1,created_at:new Date().toISOString(),inputs,...inventory,provenance_notes:['This inventory preserves source bytes only. Root must perform and record source review, edition comparison and source-evidence-plan decisions. No semantic pass is inferred.']});
for(const row of inputs)assert.equal(fileRef(row.file).sha256,row.sha256);
for(const args of [['cpa_uploader/raw/collect.mjs','--input',R+'/source-inventory.json','--output',collection],['cpa_uploader/raw/collect.mjs','--check','--against-originals','--output',collection]]){
 const result=spawnSync(process.execPath,args,{encoding:'utf8',shell:false,windowsHide:true});process.stdout.write(result.stdout);process.stderr.write(result.stderr);assert.equal(result.status,0,'Raw collection/check failed; preserve inventory and failed output');
}
for(const row of inputs)assert.equal(fileRef(row.file).sha256,row.sha256);
write(R+'/source-collection.json',{status:'raw_bytes_collected_and_checked',created_at:new Date().toISOString(),inventory:fileRef(R+'/source-inventory.json'),raw_manifest:fileRef(collection+'/manifest.json'),existing_raw_materials:inventory.excluded,source_review:'root_must_record_actual_review',human_review_performed:false,model_api_calls:0,canonical_writes:0,db_writes:0});
console.log({collected_source_files:inventory.entries.length,existing_raw_materials:inventory.excluded.length,collection,source_review:'not_automatically_generated'});
