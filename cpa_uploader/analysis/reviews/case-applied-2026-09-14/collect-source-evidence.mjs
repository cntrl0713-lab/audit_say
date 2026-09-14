import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const D='cpa_uploader/drafts/case-applied-2026-09-14';
const R='cpa_uploader/analysis/reviews/case-applied-2026-09-14';
const raw='cpa_uploader/raw/originals/case-applied-2026-09-14';
const collection='cpa_uploader/raw/collections/2026-09-14-case-applied';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref=file=>({file,sha256:hash(file)});
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const paths=new Set(fs.readdirSync(raw).filter(n=>fs.statSync(raw+'/'+n).isFile()).map(n=>raw+'/'+n));
for(const worker of ['a','b']) {
  const x=read(`${D}/${worker}/source-files.json`);
  const rows=Array.isArray(x)?x:x.entries??x.files;
  assert(Array.isArray(rows));
  for(const e of rows){const f=e.file??e.original_path;assert.equal(hash(f),e.sha256);paths.add(f);}
  for(const s of read(`${D}/${worker}/sets.json`)) for(const e of s.source_refs)paths.add(e.file);
}
for(const f of [
 'cpa_uploader/data/official/case-applied-2026-09-14-kga570.md',
 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf',
 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt'
])paths.add(f);
const entries=[...paths].sort().map(original_path=>({
 original_path,sha256:hash(original_path),
 category:original_path.includes('/data/official/')?'official':original_path.includes('/회계감사_통합학습자료/')?'learning':'verification',
 role:original_path.startsWith(raw+'/')?'이번 사례 제작의 공식 원본·추출본·시각 대조·취득 계보':'새 사례의 직접 대조에 사용한 기존 출처의 바이트 보존'
}));
write(R+'/source-inventory.json',{version:1,created_at:new Date().toISOString(),entries});
for(const args of [
 ['cpa_uploader/raw/collect.mjs','--input',R+'/source-inventory.json','--output',collection],
 ['cpa_uploader/raw/collect.mjs','--check','--against-originals','--output',collection]
]){const p=spawnSync(process.execPath,args,{encoding:'utf8'});process.stdout.write(p.stdout);process.stderr.write(p.stderr);assert.equal(p.status,0);}
write(R+'/source-evidence-plan.json',{
 version:1,status:'complete',raw_collection_manifests:[ref(collection+'/manifest.json')],
 source_peer_reviews:[ref(D+'/source-peer-review.json')],
 additional_files:[ref(R+'/source-inventory.json'),ref(R+'/collect-source-evidence.mjs')]
});
console.log({source_files:entries.length,collection});
