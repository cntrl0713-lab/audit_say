// Preserve the first unfinalized proposals; correct only their document envelope.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readSemanticReviewDocument} from '../../../../../cpa_uploader/questionSemanticReview.ts';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/phase-two-followup';
const sha=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for(const folder of ['t09-a-manual-bank-v3','t10-a-manual-bank-v3']){
 const changes=[];
 for(const stem of ['manual-template','manual-input-proposal']){
  const original=path.join(base,folder,stem+'.json'),followup=path.join(base,folder,stem+'.schema-fixed.json');
  const doc=JSON.parse(fs.readFileSync(original,'utf8'));
  if(doc.schema_version!==1)throw Error('Unexpected old envelope');
  doc.schema_version='1.0';
  const serialized=JSON.stringify(doc,null,2)+'\n';
  if(fs.existsSync(followup)){if(fs.readFileSync(followup,'utf8')!==serialized)throw Error('Prior shape-fixed copy differs');}
  else fs.writeFileSync(followup,serialized,{flag:'wx'});
  if(stem==='manual-input-proposal')readSemanticReviewDocument(followup);
  changes.push({original:{file:original,sha256:sha(original)},followup:{file:followup,sha256:sha(followup)},changed_field:'document.schema_version: number 1 → string 1.0',review_content_unchanged:true});
 }
 const file=path.join(base,folder,'schema-envelope-followup.json');
 fs.writeFileSync(file,JSON.stringify({recorded_at:new Date().toISOString(),api_calls:0,finalized:false,reason:'未확정 제안의 문서외피 형상 오류를 발견해 원파일 보존 후 현 readSemanticReviewDocument 계약에 맞는 사본을 작성했다. 의미 내용·원답안·기대판정·실측/receipt는 변경하지 않았다.',changes},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({folder,changes}));
}
