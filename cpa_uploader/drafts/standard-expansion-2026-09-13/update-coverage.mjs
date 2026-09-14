import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildSourceCatalog} from '../../questionSourceCatalog.mjs';
import {sha,questionHash,sourceUnitHash} from '../../analysis/coverage/build-coverage.mjs';
const batch='cpa_uploader/drafts/standard-expansion-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const fileHash=f=>sha(fs.readFileSync(f));
const dataset=read('cpa_uploader/analysis/question-elements/question-elements.json');
const catalog=buildSourceCatalog();
const file='cpa_uploader/analysis/coverage/links.json';const before=fs.readFileSync(file,'utf8');const ledger=JSON.parse(before);
const defs=[
 ['ethics-additional','element-dad8783e877a733d','e01','sub2',[1,2,3,4,5],['src-719c90d3641aa5a91f'],'broader','2018:1:2는 팀 분리를 예시로 주고 다른 두 가지를, 2019:1:5는 세 가지를 선택 요구한다. 새 물음은 220.4의 다섯 장치 모두를 요구하므로 범위가 더 넓다. 기본적 통보·동의와 섞지 않았다. 공식 2024 전문 PDF 27쪽과 대조했다.'],
 ['rotation-listed-director','element-e57286999e611431','l01','sub1',[1,3],['src-b71aa5b491451af130'],'direct','2014:3:1 및 2023:1:5 중 주권상장법인 이사의 계속수행과 후속 참여금지 요구에 직접 대응한다. 현행 외부감사법 제9조제5항의 연속 4년 금지를 최대 3년으로, 이후 연속 3년 전 기간의 금지를 별도 기준으로 표현했다.'],
 ['rotation-large-director','element-ccf6536464d41e12','l01','sub1',[1,3],['src-b71aa5b491451af130'],'direct','대형비상장주식회사·금융회사의 이사에 관한 계속수행 한도와 후속 금지기간에 대응한다. 같은 시험의 회사유형별 요소를 새 고유 출제횟수로 합산하지 않는다. 현행 제9조제5항 직접 대조.'],
 ['rotation-other-director','element-1543e62078dbd75d','l01','sub1',[2],['src-b71aa5b491451af130'],'partial','새 물음은 기타 회사 이사의 최대 연속 5개 사업연도만 직접 요구한다. 교재 해설의 교체 후 1년 표현이나 윤리기준상 별도 장기유착 요구 전체까지 출제한 것으로 보지 않는다. 법률의 연속 6개 사업연도 수행 금지와 직접 대조.'],
 ['rotation-listed-staff','element-6a3c7641171fe7e2','l01','sub2',[1,2,3],['src-b71aa5b491451af130'],'direct','기출의 업무보조자 교체 요구에 대응하되 현행 제9조제6항의 정확한 대상인 제26조제3항 소속공인회계사로 한정했다. 연속 3개 사업연도 수행, 다음 사업연도, 해당 소속공인회계사의 3분의 2 이상 교체를 직접 대조. 이사·법인 자체 교체와 구별.'],
];
const additions=defs.map(([name,elementId,set,sub,nums,units,relationship,reason])=>{
 const targetFile=`${batch}/${set}.json`;const questionSet=read(targetFile);const question=questionSet.subquestions.find(q=>q.id===sub);const element=dataset.elements.find(e=>e.id===elementId);assert(element&&question);
 const sources=units.map(id=>{const u=catalog.units.find(u=>u.id===id);assert(u);return u;});
 return {id:`standard-expansion-20260913-${name}`,element_id:elementId,source_unit_ids:units,target:{scope:'draft',file:targetFile,set_id:questionSet.id,subquestion_id:sub,criterion_ids:nums.map(n=>`crit${n}`)},relationship,review_status:'reviewed',reason,provenance:{file:`${batch}/agent-review.json`,sha256:fileHash(`${batch}/agent-review.json`),reviewer_kind:'agent_content_review',official_source_record:`${batch}/sources/provenance.json`,review_date:'2026-09-13'},snapshot:{element_sha256:sha(JSON.stringify(element)),question_sha256:questionHash(questionSet,question),source_hashes:Object.fromEntries(sources.map(s=>[s.id,s.contentHash])),source_metadata_hashes:Object.fromEntries(sources.map(s=>[s.id,sourceUnitHash(s)]))}};
});
for(const link of additions){const old=ledger.links.find(l=>l.id===link.id);if(old)assert.deepEqual(old,link);else ledger.links.push(link);}
assert.equal(fs.readFileSync(file,'utf8'),before,'다른 작업의 연결 입력 변경: 재확인 필요');
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
const records=dataset.records.filter(r=>['past-e2ff810cb3e448eb9fcf','past-f10bb86e270c5d276665','past-e4662efcf5740ad8b60e','past-61a5bb376ab966a06a74'].includes(r.id));
fs.writeFileSync(`${batch}/coverage-review.json`,JSON.stringify({date:'2026-09-13',input_hash_before:sha(before),input_hash_after:fileHash(file),added_links:additions,original_question_records:records,decision:'요구 문맥·원발문·해설·공식 원문을 대조한 관계만 기록. agent 확인은 사람 승인이나 문항 정본 수록이 아니다. 제2의견 안전장치가 필요한 이유를 물은 2019 요구를 안전장치 목록 자체의 직접 기출로 사용하지 않았다.'},null,2)+'\n');
console.log(JSON.stringify({links_added:additions.length}));
