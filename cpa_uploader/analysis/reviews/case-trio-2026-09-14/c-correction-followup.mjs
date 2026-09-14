import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const C='cpa_uploader/drafts/case-trio-2026-09-14/c',R='cpa_uploader/analysis/reviews/case-trio-2026-09-14';
const hash=v=>createHash('sha256').update(v).digest('hex');
const files=['build.mjs','design.json','coverage-proposals.json'];
fs.mkdirSync(R+'/c-before-source-range-correction');
for(const f of files){
 fs.copyFileSync(C+'/'+f,R+'/c-before-source-range-correction/'+f,fs.constants.COPYFILE_EXCL);
 let text=fs.readFileSync(C+'/'+f,'utf8').replaceAll('14955~14962','14955~14963').replaceAll('11057~11068','11057~11074');
 if(f==='build.mjs'){
  const start=text.indexOf("write('coverage-proposals.json',");const end=text.indexOf('\nconst sourceFiles=',start);assert(start>0&&end>start);
  text=text.slice(0,start)+"write('coverage-proposals.json',[{element_id:element.id,set_id:set.id,subquestion_id:q.id,criterion_ids:['sub1.c2'],source_unit_ids:coverageUnits.map(u=>u.id),relationship:'partial',reason:'2023 GS3 문제2물음2의 예시 제외 세 조건 중 관련 통제 운영효과성 증거 요건만 개인예금 상황에 적용한다. 나머지 조건과 새로운 회신 유인 물음을 이 요소의 직접 충족으로 세지 않는다.',source_locations:sourceRows,original_question_ids:['mock:2023:GS3-2:2'],reprint_treatment:'확인된 mock1회, 기출0회는 현 요소 집계이며 2018 인접 기출과 재수록을 합산하지 않는다.'}]);"+text.slice(end);
  text=text.replace("'기출·고급연습의 소극적 조회 일반 요건과 무응답의 증거 성격을 사실 적용으로 확장하였다. 외부 금융 규제나 예금 금액 계산은 요구하지 않는다.']", "'기출·고급연습의 소극적 조회 일반 요건과 무응답의 증거 성격을 사실 적용으로 확장하였다. 외부 금융 규제나 예금 금액 계산은 요구하지 않는다.','source_fidelity는 새로 구성한 문제·사실관계의 원문 충실성 분류이다. 인용문 자체의 정확한 원문 일치는 별도로 검증한다.']");
 }
 fs.writeFileSync(C+'/'+f,text);
}
fs.writeFileSync(R+'/c-source-range-correction.json',JSON.stringify({reason:'peer의 실제 페이지 경계 대조에 따라 기출 해설 마지막 문장과 ADV 재수록의 전체 발문·예시 범위를 완결하고 builder를 최종 형상과 일치시켰다.',files:files.map(f=>({file:C+'/'+f,sha256:hash(fs.readFileSync(C+'/'+f))})),source_originals_changed:false,model_calls_before_correction:0},null,2)+'\n',{flag:'wx'});
