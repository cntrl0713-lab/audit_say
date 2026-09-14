import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const D='cpa_uploader/drafts/case-trio-2026-09-14',R='cpa_uploader/analysis/reviews/case-trio-2026-09-14';
const raw='cpa_uploader/raw/originals/case-trio-2026-09-14',collection='cpa_uploader/raw/collections/2026-09-14-case-trio';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref=file=>({file,sha256:hash(file)});
const write=(file,x)=>fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const paths=new Set(fs.readdirSync(raw).filter(n=>fs.statSync(raw+'/'+n).isFile()).map(n=>raw+'/'+n));
for(const worker of ['a','b','c']){
 const data=read(D+'/'+worker+'/source-files.json'),rows=Array.isArray(data)?data:data.files??data.entries;
 for(const row of rows){const file=row.file??row.original_path;assert.equal(hash(file),row.sha256);paths.add(file);}
 for(const set of read(D+'/'+worker+'/sets.json'))for(const source of set.source_refs)paths.add(source.file);
}
for(const name of ['index-fetch.json','kicpa-index.html','edition-index-check.md'])paths.add('cpa_uploader/raw/originals/case-deepening-2026-09-14/'+name);
const entries=[...paths].sort().map(original_path=>({original_path,sha256:hash(original_path),category:original_path.includes('/data/official/')?'official':original_path.includes('/회계감사_통합학습자료/')?'learning':'verification',role:'2026-09-14 신규 세 사례의 원문·판본·발문·시각대조 및 기존 취득계보 바이트 보존'}));
write(R+'/source-inventory.json',{version:1,created_at:new Date().toISOString(),entries});
for(const args of [['cpa_uploader/raw/collect.mjs','--input',R+'/source-inventory.json','--output',collection],['cpa_uploader/raw/collect.mjs','--check','--against-originals','--output',collection]]){
 const run=spawnSync(process.execPath,args,{encoding:'utf8'});process.stdout.write(run.stdout);process.stderr.write(run.stderr);assert.equal(run.status,0);
}
write(D+'/source-peer-review.json',{method:'agent_source_review',reviewer_id:'Codex root',human_review_performed:false,reviewed_at:new Date().toISOString(),scope:'각 사례의 source_refs 완결본문·하위조건, 기출/ADV 원발문·예시제외·해설, 현재2026 원문과 기존2025 전사의 판본차이·각주귀속을 대조했다. 같은 날 직접 취득한 공식목록 증거를 재사용하며 새 취득으로 기록하지 않는다.',details:['520.6/7/A17~A21 및315.37: 종결분석·새 위험과 기존증거 활용. 2018문제2물음5·2024GS2문제2물음2의 실제요구 경계 구별.','620.9~11/A14~A31: 선정전과 수행후, 감사인측/경영진측 전문가 구별. 2021문제3물음3은 커뮤니케이션예시제외로 비밀유지만 부분연결. A15 판본용어차이는 득점본문으로 확장하지 않는다.','505.15/A23: 모든조건과 예금주 회신유인, 수령확인/정확성확인 구별. 2018해설 범위 마지막행14963 및ADV재수록11074까지 보완했다.'],evidence:['a/design.json','b/design.json','c/design.json','c/source-comparison.json'].map(f=>ref(D+'/'+f)),raw_manifest:ref(collection+'/manifest.json'),unresolved_findings:[],model_calls:0});
write(R+'/source-evidence-plan.json',{version:1,status:'complete',raw_collection_manifests:[ref(collection+'/manifest.json')],source_peer_reviews:[ref(D+'/source-peer-review.json')],additional_files:[ref(R+'/source-inventory.json'),ref(R+'/collect-source-evidence.mjs'),ref(R+'/c-correction.json'),ref(R+'/c-source-range-correction.json')]});
console.log({source_files:entries.length,collection});
