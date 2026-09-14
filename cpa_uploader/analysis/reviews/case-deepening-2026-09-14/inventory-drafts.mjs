import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const D='cpa_uploader/drafts/case-deepening-2026-09-14';
const files=spawnSync('rg',['--files','cpa_uploader/drafts','-g','*.json'],{encoding:'utf8'}).stdout.trim().split(/\r?\n/).map(f=>f.replaceAll('\\','/'));
const excluded=/(?:^|\/)(?:publication[^/]*|execution[^/]*|runtime|projections|baseline|replayed|sources|counterexamples|qa|checks)(?:\/|$)|(?:catalog|classification|bank-before|before-peer|receipt|manifest|response|observation|usage|lock|log|point-allocation)/;
const rows=[],errors=[];
for(const file of files.filter(f=>!excluded.test(f)&&!f.startsWith(D+'/'))){
 try{
  const bytes=fs.readFileSync(file),x=JSON.parse(bytes);const sets=Array.isArray(x)?x:[x];
  for(const s of sets.filter(s=>s&&typeof s.id==='string'&&Array.isArray(s.subquestions)&&s.shared_context))rows.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),id:s.id,title:s.title,status:s.status,questions:s.subquestions.map(q=>({id:q.id,question_style:q.question_style,prompt:q.prompt,topics:q.topic_ids}))});
 }catch(e){errors.push({file,error:String(e)});}
}
const bank=JSON.parse(fs.readFileSync(D+'/bank-before.json'));
const artifact={created_at:new Date().toISOString(),method:'rg로 열거한 제작 JSON의 최상위 문제 세트를 추출한다. 실행·공개·원자료·옛판 스냅샷은 제외한다. 이 기계 목록은 파일 소재와 ID를 대조하며 의미 중복을 확정하지 않는다.',scanned_json_files:files.filter(f=>!excluded.test(f)&&!f.startsWith(D+'/')).length,errors,rows:rows.map(r=>({...r,canonical_id_exists:bank.some(s=>s.id===r.id)}))};
fs.writeFileSync(D+'/draft-inventory.json',JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({scanned:artifact.scanned_json_files,sets:rows.length,unique_ids:new Set(rows.map(x=>x.id)).size,not_in_bank:artifact.rows.filter(x=>!x.canonical_id_exists).map(x=>({file:x.file,id:x.id,title:x.title})),errors},null,2));
