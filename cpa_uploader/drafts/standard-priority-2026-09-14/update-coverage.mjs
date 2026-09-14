// 원발문·공식 원문을 대조한 요소↔초안 물음 관계를 coverage 수동 장부에 초안 대상으로 추가한다.
//   node cpa_uploader/drafts/standard-priority-2026-09-14/update-coverage.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildSourceCatalog} from '../../questionSourceCatalog.mjs';
import {sha,questionHash,sourceUnitHash} from '../../analysis/coverage/build-coverage.mjs';
const batch='cpa_uploader/drafts/standard-priority-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const fileHash=f=>sha(fs.readFileSync(f));
const dataset=read('cpa_uploader/analysis/question-elements/question-elements.json');
const catalog=buildSourceCatalog();
const file='cpa_uploader/analysis/coverage/links.json';const before=fs.readFileSync(file,'utf8');const ledger=JSON.parse(before);
const L01=['src-a2094e84c22fdafc30'],L02=['src-8a4152cc2f72c053f8'],S01B=['src-31cc9a2643cfe6546d','src-a7adab453c1728047d'],S02A=['src-fa96b0b7deb0e4c3b3','src-565c45de2cf0414036'],S02B=['src-3b703b519d8f2c7326','src-470b90789e293bb2e7','src-150123f8ed45c46843','src-7ad9b092202f76974e','src-de22d3603c62562f4c'],S03A=['src-87e04f2bb7ea4647e1'],S03B=['src-aee81e8ff7088ffd37'];
const all=n=>Array.from({length:n},(_,i)=>i+1);
const defs=[
 ['selection-2019-table','element-05ed2f54bdab5186','l01','sub2',[1,2,3],L01,'direct','2019:3:2는 주권상장법인·대형비상장·금융회사와 그 밖의 회사를 감사위원회 설치 여부로 나눈 선정주체 표를 요구한다. 새 물음 기준 1–3이 직접 대응한다. 직전 감사인 재선임과 감사 없는 유한회사(기준 4–6)는 원발문에 없어 이 요소의 빈도로 전용하지 않는다.'],
 ['selection-2024-listed-committee','element-7622b7a72bd33bed','l01','sub2',[1],L01,'partial','2024:4:1 ①의 감사위원회 의무설치 상장법인 선정주체에 대응한다. 원발문은 회사별 사례에 적용하고 선임기한도 함께 묻는다. 새 물음은 일반 규정만 묻는다.'],
 ['deadline-2024-listed-committee','element-7622b7a72bd33bed','l01','sub1',[2],L01,'partial','2024:4:1 ①의 선임기한(사업연도 개시일 이전)에 대응한다. 회사 사실의 적용은 원발문에만 있다.'],
 ['selection-2024-first-audit','element-47de5773f6ac8e42','l01','sub2',[3],L01,'partial','2024:4:1 ②의 감사위원회 없는 비상장회사 선정주체(감사)에 대응한다. 새 물음 기준 3은 감사 또는 감사위원회라는 일반 규정이다.'],
 ['deadline-2024-first-audit','element-47de5773f6ac8e42','l01','sub1',[3],L01,'partial','2024:4:1 ②의 처음 외부감사 대상이 된 회사의 선임기한(개시일부터 4개월)에 대응한다.'],
 ['selection-2024-large-unlisted','element-9e7c67bc03519fc9','l01','sub2',[2],L01,'partial','2024:4:1 ④의 감사위원회 없는 대형비상장주식회사 선정주체에 대응한다. 자산 7천억원의 대형비상장 해당 여부는 대통령령 금액 기준이 필요하며 새 물음은 이를 묻지 않는다.'],
 ['deadline-2024-large-unlisted','element-9e7c67bc03519fc9','l01','sub1',[1],L01,'partial','2024:4:1 ④의 원칙 선임기한(개시일부터 45일)에 대응한다.'],
 ['selection-2024-limited-company','element-7821f1040a81e7d1','l01','sub2',[5,6],L01,'partial','2024:4:1 ③의 감사 없는 유한회사 선정주체에 대응한다. 일정규모 해당 여부는 대통령령 기준이어서 새 물음은 두 경우의 규정만 묻는다.'],
 ['deadline-2024-limited-company','element-7821f1040a81e7d1','l01','sub1',[1],L01,'partial','2024:4:1 ③의 선임기한(개시일부터 45일)에 대응한다.'],
 ['deadline-2020-listed-committee','element-fd8194037807040a','l01','sub1',[2],L01,'partial','2020:9:1 (1)의 감사위원회 있는 자산 5조원 상장회사 2020사업연도 선임기한에 대응한다. 원발문의 특정 날짜 적용과 (2)의 개정 취지는 새 물음에 없다.'],
 ['liability-2022-third-party','element-3b7b18a94d352fd9','l02','sub1',[2],L02,'direct','2022:1:5 (1)의 제3자에 대한 책임사유와 직접 대응한다. 회사에 대한 책임·연대책임(기준 1·3–5)은 원발문에 없어 빈도로 전용하지 않는다.'],
 ['defense-2022-third-party','element-dcb28d05a0fb78e6','l02','sub2',[1],L02,'direct','2022:1:5 (2)의 면책사유(임무를 게을리하지 않았음의 증명)와 직접 대응한다. 증명책임 전환 원고(기준 2·3)는 추가 요구다.'],
 ['limitation-2022-third-party','element-794e1b674f05b63a','l02','sub2',[5,6],L02,'direct','2022:1:5 (3)의 계약 연장이 없는 경우 소멸시효(안 날부터 1년, 감사보고서 제출일부터 8년)와 직접 대응한다. 계약 연장(기준 7)은 원발문이 제외한 부분이다.'],
 ['fund-2022-adjacent','element-da6b55d682477a4e','l02','sub2',[4],L02,'adjacent','2022:1:6은 손해배상공동기금과 공인회계사법상 손해배상준비금의 차이를 묻는다. 새 기준 4는 공동기금 적립 또는 보험가입이라는 보장 조치만 묻고 준비금은 원문 범위 밖이다.'],
 ['limitation-2014-comparison','element-db2ee56addd212eb','l02','sub2',[5,6,7],L02,'partial','2014:3:4는 민법·자본시장법·외부감사법의 소멸시효 비교를 요구한다. 새 물음은 외부감사법 부분만 다룬다.'],
 ['plaintiff-2014-comparison','element-05d21a6d8390b21d','l02','sub1',[1,2],L02,'partial','2014:3:4의 원고(청구권자) 비교 중 외부감사법의 회사·제3자에 대응한다.'],
 ['burden-2014-comparison','element-ffa5ade74a6f2f36','l02','sub2',[1,2,3],L02,'partial','2014:3:4의 입증책임 비교 중 외부감사법의 증명책임 전환과 그 예외에 대응한다.'],
 ['scope-limit-2018-opinion-stage','element-48532e6be05c1b44','s01','sub1',[4,5,6],[],'partial','2018:2:3은 증거를 입수하지 못한 경우의 조치를 업무조건 합의 단계와 의견형성 단계로 나누어 묻는다. 새 기준 4–6은 의견형성 단계의 한정·해지·의견거절에 대응한다. 업무조건 합의 단계(210.7)는 기존 pilot-03-002가 다룬다. 705.11–14의 카탈로그 단위가 없어 공식 원문 발췌로 대조했다.'],
 ['scope-limit-2024-implication','element-5a13329569147315','s01','sub2',[5,6],S01B,'direct','2024:10:2의 경영진 제한이 시사하는 점(부정위험 평가, 감사 계속 여부)과 직접 대응한다.'],
 ['scope-limit-2024-entity-examples','element-f7b9de0504a49bb1','s01','sub2',[1],S01B,'adjacent','2024:10:1은 보기로 원인을 주고 원인별 예시를 요구한다. 새 물음은 원인 자체를 묻고 예시는 채점하지 않으므로 인접 관계다.'],
 ['scope-limit-2024-work-examples','element-41aa232a99c00949','s01','sub2',[2],S01B,'adjacent','2024:10:1의 업무 성격·시기 원인의 예시 요구와 인접한다. 새 물음은 원인만 묻는다.'],
 ['scope-limit-2024-management-examples','element-1f5e9e81044d8f8e','s01','sub2',[3],S01B,'adjacent','2024:10:1의 경영진 제한 원인의 예시 요구와 인접한다. 새 물음은 원인만 묻는다.'],
 ['governance-2019-other-matters','element-c5c0040a2c05d070','s02','sub1',[1,2,3,4],S02A,'partial','2019:6:1 [B]는 유의적 발견사항 외 커뮤니케이션 사항 두 가지를 고르게 한다. 새 물음은 그중 감사인의 책임(14)과 계획된 범위·시기(15)를 모두 요구한다. 독립성(17)은 기존 pilot-05-008/sub2가 다룬다.'],
 ['governance-2018-timing','element-46f765c4b70d766d','s02','sub2',[4],S02B,'partial','2018:7:3은 사례의 커뮤니케이션 시기 적절성을 판단한다. 새 기준 4는 적시성 요구의 일반 규정이다.'],
 ['governance-2018-form','element-b1e3165b217ad2dc','s02','sub2',[2,3],S02B,'partial','2018:7:3의 구두·서면 방식 적절성 판단에 대응한다. 새 기준 2·3은 유의적 사항과 독립성 문제의 형태 규정이다.'],
 ['component-2015-planning','element-721ef1cf0cbca346','s03','sub1',all(7),S03A,'partial','2015:6:3은 계획단계에 부문감사인과 커뮤니케이션할 사항 네 가지를 요구한다. 새 물음은 600.40 중 기존 pilot-14-002/sub2가 다루지 않은 사항을 모두 묻는다.'],
 ['component-2015-completion','element-22a8c686ef7913d3','s03','sub2',all(10),S03B,'broader','2015:6:3은 종결단계 커뮤니케이션 사항 네 가지를 고르게 한다. 새 물음은 600.41의 열 항목을 모두 요구한다.'],
 ['component-2025-instruction','element-2d1d3050048a120f','s03','sub1',[2,3,4],S03A,'partial','2025:9:1은 지침서한 초안에서 누락된 감사계획 관련 커뮤니케이션 세 가지를 식별한다. 초안에는 협조·일정·방문·업무용도·특수관계자 목록이 있어 윤리적 요구사항, 중요성·한도기준, 유의적 위험이 누락 후보다. 새 기준 2–4가 대응하며 부문중요성과 그룹업무팀 식별 위험은 pilot-14-002/sub2가 다룬다.'],
 ['component-2025-confirmation','element-c17a7201d38ef9ab','s03','sub2',all(10),S03B,'broader','2025:9:2는 부문감사인 확인서의 누락 사항 세 가지를 식별한다. 새 물음은 600.41의 열 항목을 모두 요구하여 그 판단의 전제가 되는 목록을 포괄한다.'],
];
const additions=defs.map(([name,elementId,set,sub,nums,units,relationship,reason])=>{
 const targetFile=`${batch}/${set}.json`;const questionSet=read(targetFile);const question=questionSet.subquestions.find(q=>q.id===sub);const element=dataset.elements.find(e=>e.id===elementId);assert(element&&question,`${name}`);
 for(const n of nums)assert(question.criteria.some(c=>c.id===`crit${n}`),`${name}: crit${n} 없음`);
 const sources=units.map(id=>{const u=catalog.units.find(u=>u.id===id);assert(u,id);return u;});
 return {id:`standard-priority-20260914-${name}`,element_id:elementId,source_unit_ids:units,target:{scope:'draft',file:targetFile,set_id:questionSet.id,subquestion_id:sub,criterion_ids:nums.map(n=>`crit${n}`)},relationship,review_status:'reviewed',reason,provenance:{file:`${batch}/agent-review.json`,sha256:fileHash(`${batch}/agent-review.json`),reviewer_kind:'agent_content_review',official_source_record:`${batch}/sources/provenance.json`,review_date:'2026-09-14'},snapshot:{element_sha256:sha(JSON.stringify(element)),question_sha256:questionHash(questionSet,question),source_hashes:Object.fromEntries(sources.map(s=>[s.id,s.contentHash])),source_metadata_hashes:Object.fromEntries(sources.map(s=>[s.id,sourceUnitHash(s)]))}};
});
for(const link of additions){const old=ledger.links.find(l=>l.id===link.id);if(old)assert.deepEqual(old,link);else ledger.links.push(link);}
assert.equal(fs.readFileSync(file,'utf8'),before,'다른 작업의 연결 입력 변경: 재확인 필요');
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
const recordIds=[...new Set(defs.map(d=>dataset.elements.find(e=>e.id===d[1]).confirmed_question_records[0]))];
const records=dataset.records.filter(r=>recordIds.includes(r.id)).map(r=>({id:r.id,source:r.source,text:r.text}));
fs.writeFileSync(`${batch}/coverage-review.json`,JSON.stringify({date:'2026-09-14',input_hash_before:sha(before),input_hash_after:fileHash(file),added_links:additions,original_question_records:records,decision:'원발문과 공식 원문을 대조한 관계만 기록했다. 사례 적용형 원발문은 일반 규정을 묻는 새 물음과 partial로, 원인 예시를 요구한 원발문은 adjacent로 구분했다. adjacent 관계는 새 물음의 직접 빈도로 쓰지 않는다. agent 확인은 사람 승인이나 정본 수록이 아니다.'},null,2)+'\n');
console.log(JSON.stringify({links_added:additions.length,records:records.length}));
