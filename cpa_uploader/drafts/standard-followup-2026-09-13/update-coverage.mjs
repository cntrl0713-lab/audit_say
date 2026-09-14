import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildSourceCatalog} from '../../questionSourceCatalog.mjs';
import {sha,questionHash,sourceUnitHash} from '../../analysis/coverage/build-coverage.mjs';
const batch='cpa_uploader/drafts/standard-followup-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const fileHash=f=>sha(fs.readFileSync(f));
const dataset=read('cpa_uploader/analysis/question-elements/question-elements.json');
const catalog=buildSourceCatalog();
const file='cpa_uploader/analysis/coverage/links.json';const before=fs.readFileSync(file,'utf8');const ledger=JSON.parse(before);
const defs=[
  [
    "fees-2023",
    "element-77f6bd1c21e50686",
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
      "src-ce0c3da27e0925dc38"
    ],
    "broader",
    "2023:1:4는 객관적 제3자 검토를 예시로 주고 이를 제외한 두 안전장치를 요구한다. 새 물음은 240.4의 네 안전장치 모두를 요구한다. 원발문·공통지문·A 131~132쪽 해설과 공식 전문 29~30쪽을 대조했다. 학습자료의 일반 허용 표현이나 다른 독립성 규정까지 출제하지 않는다."
  ],
  [
    "fees-mock-2025",
    "element-5cfa72e8d03277c5",
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
      "src-ce0c3da27e0925dc38"
    ],
    "broader",
    "2025 GS2-3:3의 비인증고객 대상 비인증업무 안전장치 두 개 요구와 대응한다. 다른 두 상황인 인증업무·인증고객 대상 비인증업무에는 연결하지 않는다. 새 물음은 240.4 네 장치를 전부 묻는다. 모의 빈도 1이며 같은 원문의 재수록을 더하지 않는다."
  ],
  [
    "statistical-definition",
    "element-484462697f12c27d",
    "s03",
    "sub1",
    [
      1,
      2
    ],
    [
      "src-cb562ec1b3841eb8d7"
    ],
    "direct",
    "2014:4:2 원발문은 무작위 추출과 확률이론 평가라는 두 특성을 요구한다. 새 물음의 기준 1·2가 직접 대응하며, 추가 충족관계·표본규모 판단 기준 3·4를 이 요소의 직접 출제빈도로 전용하지 않는다. A 원문 567쪽 발문·569쪽 해설과 KGA 530.5(g) 대조."
  ],
  [
    "haphazard-suitability",
    "element-53ff3829188eafb1",
    "s03",
    "sub3",
    [
      4
    ],
    [
      "src-8ea353a068875f3cf6"
    ],
    "direct",
    "2016:4:3의 통계적 속성표본감사에서 임의추출을 사용하는 오류에 대응한다. 원발문 475쪽·답안 479쪽에서 부적합성 이유를 확인했고 공식 530 보론4(d)로 검증했다. 이탈의 정의·투영이탈률 등 원문 다른 요구는 연결하지 않는다."
  ],
  [
    "third-party-inventory",
    "element-fd0960fab0541925",
    "s01",
    "sub1",
    [
      3,
      4,
      5
    ],
    [
      "src-04ef65747b44e066ee"
    ],
    "direct",
    "필수암기 106은 중요한 제3자 보관 재고에 수행할 절차를 묻는다. 수량·상태 조회와 상황에 맞는 검사·기타절차, 선택관계를 대응시켰다. A16 세부 예시 전체를 새 물음이 포괄한다고 주장하지 않는다. 원기출 식별 미확정이므로 기출 빈도 0을 미출제 확정으로 해석하지 않는다."
  ],
  [
    "block-suitability",
    "element-6499d819a4d7be90",
    "s03",
    "sub4",
    [
      2,
      3
    ],
    [
      "src-8ea353a068875f3cf6"
    ],
    "broader",
    "OX 123의 구획추출 적용 적합성·이유를 연결한다. OX 해설의 단정적 표현을 그대로 확장하지 않고 공식 보론4(e)에 맞춰 전체 모집단 추론에서 일반적으로 부적합함과 그 이유를 묻는다. 특정 구획의 개별 검사가 항상 금지되는 것은 아니다. 실제 기출 연도는 미확정이다."
  ]
];
const additions=defs.map(([name,elementId,set,sub,nums,units,relationship,reason])=>{
 const targetFile=`${batch}/${set}.json`;const questionSet=read(targetFile);const question=questionSet.subquestions.find(q=>q.id===sub);const element=dataset.elements.find(e=>e.id===elementId);assert(element&&question);
 const sources=units.map(id=>{const u=catalog.units.find(u=>u.id===id);assert(u);return u;});
 return {id:`standard-followup-20260913-${name}`,element_id:elementId,source_unit_ids:units,target:{scope:'draft',file:targetFile,set_id:questionSet.id,subquestion_id:sub,criterion_ids:nums.map(n=>`crit${n}`)},relationship,review_status:'reviewed',reason,provenance:{file:`${batch}/agent-review.json`,sha256:fileHash(`${batch}/agent-review.json`),reviewer_kind:'agent_content_review',official_source_record:`${batch}/sources/provenance.json`,review_date:'2026-09-13'},snapshot:{element_sha256:sha(JSON.stringify(element)),question_sha256:questionHash(questionSet,question),source_hashes:Object.fromEntries(sources.map(s=>[s.id,s.contentHash])),source_metadata_hashes:Object.fromEntries(sources.map(s=>[s.id,sourceUnitHash(s)]))}};
});
for(const link of additions){const old=ledger.links.find(l=>l.id===link.id);if(old)assert.deepEqual(old,link);else ledger.links.push(link);}
assert.equal(fs.readFileSync(file,'utf8'),before,'다른 작업의 연결 입력 변경: 재확인 필요');
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
const records=dataset.records.filter(r=>['past-056178b00bce2703a663','practice-55b862ce3a82dd95459c','past-46f7dd703e69ed4b75f4','past-ec42964a6515f809f763','ox-memory-106','ox-judgment-123'].includes(r.id));
fs.writeFileSync(`${batch}/coverage-review.json`,JSON.stringify({date:'2026-09-13',input_hash_before:sha(before),input_hash_after:fileHash(file),added_links:additions,original_question_records:records,decision:'요구 문맥·원발문·해설·공식 원문을 대조한 관계만 기록. agent 확인은 사람 승인이나 문항 정본 수록이 아니다. 단계별 요구 및 부분 대응 기준만 연결했다. 카탈로그의 옛 240.4 발췌는 불완전하므로 네 안전장치 전체를 포함한 학습자료 단위를 탐색 연결로 사용하고 공식 전문을 별도로 대조했다.'},null,2)+'\n');
console.log(JSON.stringify({links_added:additions.length}));
