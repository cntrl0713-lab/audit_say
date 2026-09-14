import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildSourceCatalog} from '../../questionSourceCatalog.mjs';
import {sha,questionHash,sourceUnitHash} from '../../analysis/coverage/build-coverage.mjs';
const batch='cpa_uploader/drafts/standard-additional-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const fileHash=f=>sha(fs.readFileSync(f));
const dataset=read('cpa_uploader/analysis/question-elements/question-elements.json');
const catalog=buildSourceCatalog();
const file='cpa_uploader/analysis/coverage/links.json';const before=fs.readFileSync(file,'utf8');const ledger=JSON.parse(before);
const defs=[
  [
    "gifts-2022",
    "element-b1332d68cf38cc7a",
    "e01",
    "sub2",
    [
      1,
      2,
      3,
      4,
      5
    ],
    [
      "src-37c9db619cd59f760a"
    ],
    "broader",
    "2022:1:2의 ③은 모든 선물·접대의 예외 없는 금지 여부와 이유를 요구한다. A 176쪽 발문·178쪽 해설과 윤리 260.2–260.3을 대조했다. 새 물음은 경미성 평가와 일반 결론에 대응하며 비경미한 위협의 안전장치·거절까지 확장한다. 추가 대응의 빈도를 원기출의 직접 빈도로 전용하지 않는다."
  ],
  [
    "asset-custody",
    "element-f6cd04e1d570093e",
    "e02",
    "sub1",
    [
      1,
      2,
      3,
      4
    ],
    [
      "src-0b828a49f0a70a054f"
    ],
    "broader",
    "주제별 연습 841쪽의 자산 보관 안전장치 세 가지 요구와 해설의 네 장치를 대조했다. 새 물음은 윤리 270.2의 네 장치를 모두 요구한다. 원출제 연도·시험 식별은 미확정이므로 기출·모의 빈도로 계산하지 않는다."
  ],
  [
    "departure-documentation",
    "element-0108c2bfe8eed5d7",
    "s03",
    "sub3",
    [
      1,
      2
    ],
    [
      "src-66d73057fed2086f36"
    ],
    "direct",
    "2022:2:6의 ④는 예외적 기준 이탈의 이유 및 대체절차가 목적을 달성한 방식의 문서화에 대한 적절성을 판단한다. A 184쪽 원발문·188쪽 답안의 예 판정과 공식 230.12를 대조했다. 새 물음은 동일한 두 기록사항을 직접 서술하도록 한다. B 추출본의 열 순서 혼입 대신 완결된 A 본문을 사용했다."
  ]
];
const additions=defs.map(([name,elementId,set,sub,nums,units,relationship,reason])=>{
 const targetFile=`${batch}/${set}.json`;const questionSet=read(targetFile);const question=questionSet.subquestions.find(q=>q.id===sub);const element=dataset.elements.find(e=>e.id===elementId);assert(element&&question);
 const sources=units.map(id=>{const u=catalog.units.find(u=>u.id===id);assert(u);return u;});
 return {id:`standard-additional-20260913-${name}`,element_id:elementId,source_unit_ids:units,target:{scope:'draft',file:targetFile,set_id:questionSet.id,subquestion_id:sub,criterion_ids:nums.map(n=>`crit${n}`)},relationship,review_status:'reviewed',reason,provenance:{file:`${batch}/agent-review.json`,sha256:fileHash(`${batch}/agent-review.json`),reviewer_kind:'agent_content_review',official_source_record:`${batch}/sources/provenance.json`,review_date:'2026-09-13'},snapshot:{element_sha256:sha(JSON.stringify(element)),question_sha256:questionHash(questionSet,question),source_hashes:Object.fromEntries(sources.map(s=>[s.id,s.contentHash])),source_metadata_hashes:Object.fromEntries(sources.map(s=>[s.id,sourceUnitHash(s)]))}};
});
for(const link of additions){const old=ledger.links.find(l=>l.id===link.id);if(old)assert.deepEqual(old,link);else ledger.links.push(link);}
assert.equal(fs.readFileSync(file,'utf8'),before,'다른 작업의 연결 입력 변경: 재확인 필요');
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
const records=dataset.records.filter(r=>['past-8132ddfd37f55bb6d64d','practice-3257f96d0234d71e4cef','past-f880c1adc6fabfed70b8'].includes(r.id));
fs.writeFileSync(`${batch}/coverage-review.json`,JSON.stringify({date:'2026-09-13',input_hash_before:sha(before),input_hash_after:fileHash(file),added_links:additions,original_question_records:records,decision:'원발문·공통지문·해설·공식 원문의 요구를 대조한 세 관계를 추가했다. 재수록은 별도 출제로 합산하지 않는다. 학습자료 단위는 탐색 연결이며 직접 정답 근거는 이번 공식 전문 발췌이다. agent 확인은 사람 승인·정본 수록이 아니다.'},null,2)+'\n');
console.log(JSON.stringify({links_added:additions.length}));
