import fs from 'node:fs';
import {createHash} from 'node:crypto';
const batch='cpa_uploader/drafts/standard-additional-2026-09-13';
const hash=v=>createHash('sha256').update(v).digest('hex');
const variants=new Map(),skipped=[];let locations=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=`${dir}/${e.name}`;if(f===batch)continue;if(e.isDirectory()){if(/grading|frozen|actual-grading/.test(e.name)){skipped.push(f);continue;}walk(f);}else if(e.name.endsWith('.json')&&!/request|response|trace|packet|receipt|manifest|inventory/.test(e.name)){let data;try{data=JSON.parse(fs.readFileSync(f,'utf8'));}catch{continue;}for(const s of Array.isArray(data)?data:[data]){if(s?.schema_version!=='3.0'||!s.subquestions)continue;locations++;const h=hash(JSON.stringify(s)),key=`${s.id}:${h}`;if(variants.has(key)){variants.get(key).locations.push(f);continue;}variants.set(key,{file:f,id:s.id,hash:h,title:s.title,locations:[f],questions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,answers:q.model_answer,claims:q.criteria.map(c=>c.claim)}))});}}}}
walk('cpa_uploader/data');walk('cpa_uploader/drafts');
const inventory={date:'2026-09-13',scope:['cpa_uploader/data','cpa_uploader/drafts'],user_scope:'새 요구 중심의 기준서형 독립 물음 유지. 기존 사례형의 핵심 요구 재출제 제외.',locations,excluded_execution_evidence_directories:skipped,variants:[...variants.values()]};
fs.writeFileSync(`${batch}/comparison-inventory.json`,JSON.stringify(inventory,null,2)+'\n');
const seen=new Set();for(const s of inventory.variants)for(const q of s.questions)if(/선물|자산.{0,8}보관|수용가능.{0,12}요인|수행자.{0,12}종료|토의.{0,10}문서|일관성.{0,15}정보|전문가적 판단.{0,20}필요|550.*14|230.*(9|10|11|12)/.test(q.prompt)){const k=s.id+q.id+q.prompt;if(!seen.has(k)){seen.add(k);console.log(JSON.stringify({id:s.id,q:q.id,file:s.file,prompt:q.prompt}));}}
console.log(JSON.stringify({variants:variants.size,locations}));
