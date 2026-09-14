import fs from 'node:fs';
import {buildSourceCatalog} from '../../questionSourceCatalog.mjs';
import {sha,questionHash,sourceUnitHash} from '../../analysis/coverage/build-coverage.mjs';
const batch='cpa_uploader/drafts/standard-gap-2026-09-13';
const overlayFile='cpa_uploader/analysis/coverage/links.json';
const bytes=fs.readFileSync(overlayFile); const overlay=JSON.parse(bytes);
const catalog=buildSourceCatalog();
const dataset=JSON.parse(fs.readFileSync('cpa_uploader/analysis/question-elements/question-elements.json','utf8'));
const rows=[
 ['g01','sub1','governance.communication-benefits',['src-5479ebba57d663fe2f'],'broader','원출제는 효익 중 둘을 선택하거나 정보입수 효익을 예시로 제외한다. 새 물음은 260.4의 세 효익 전체와 독립성·객관성 조건을 복습하도록 범위를 확장했다. 기존 학습자료 카탈로그 문단과 2026 공식 전문 L7003–7023의 의미를 대조했다.'],
 ['g02','sub1','sampling.full-inspection-suitable',['src-c4160d92ea3e2c4702'],'broader','원출제는 전수조사가 적합한 상황 두 가지를 요구한다. 새 물음은 500.A64의 세 상황을 모두 요구하며 세 추출방법의 명칭 물음과 구별된다. 2025 카탈로그 전사와 2026 전문 L17611–17621의 해당 조건은 같은 의미다. 특정 항목 추출 물음에 전수조사 요소의 빈도를 넘기지 않는다.'],
 ['g03','sub1','going-concern.additional-procedures',['src-53140ed862dddf7d9b'],'partial','상위 요소인 570.16의 추가절차 중 (a) 평가 요청, (b) 실행계획의 개선효과·실행가능성 평가, (e) 서면진술에 대응한다. (c)의 현금흐름 예측과 (d)의 추가 정보는 기존 은행에 있어 새 물음에서 제외했다. 2025 전사와 2026 전문에서 이 요구를 대조했다. 요소 전체의 출제횟수를 각 criterion의 개별 빈도로 쓰지 않는다.'],
 ['g04','sub1','element-b154568b8b98a3b2',['src-adba73942fcd129869','src-6d6dae09a2be422632'],'adjacent','2019년 원발문의 발행 후 사실 인지 시 절차는 560.14의 최초 대응과 연결된다. 새 물음은 그 후 경영진이 수정하는 경우의 15–16에 한정해 심화한다. 원출제 빈도 1회를 이 수정·보고 요구 자체의 직접 출제로 확정하지 않는다. 학습자료 카탈로그와 2026 전문 L23896–23917을 대조했다.'],
 ['g04','sub2','element-b154568b8b98a3b2',['src-87e99916ff2234fb52'],'adjacent','발행 후 사실 인지라는 원발문과 인접하지만, 새 물음은 수정·통보조치가 모두 없는 560.17의 사전 통보 및 의존방지에 한정한다. 이 조건부 요구 자체의 직접 기출빈도를 확정하지 않는다. 학습자료 카탈로그와 2026 전문 L23918–23925 및 A20의 법적 수단 맥락을 대조했다.']
];
const added=[];
for(const [group,subId,elementId,sourceIds,relationship,reason] of rows) {
 const id=`standard-gap-2026-09-13-${group}-${subId}`;
 if(overlay.links.some(l=>l.id===id))throw Error(`기존 관계 덮어쓰기 금지: ${id}`);
 const file=`${batch}/${group}.json`;const set=JSON.parse(fs.readFileSync(file,'utf8'));const sub=set.subquestions.find(q=>q.id===subId);
 const element=dataset.elements.find(e=>e.id===elementId);const units=sourceIds.map(id=>catalog.units.find(u=>u.id===id));
 if(!element||!sub||units.some(u=>!u))throw Error('관계 ID 오류');
 added.push({id,element_id:elementId,source_unit_ids:sourceIds,target:{scope:'draft',file,set_id:set.id,subquestion_id:subId,criterion_ids:sub.criteria.map(c=>c.id)},relationship,review_status:'reviewed',reason,provenance:{file:`${batch}/agent-review.json`,sha256:sha(fs.readFileSync(`${batch}/agent-review.json`)),reviewer_kind:'agent_content_review',official_source_record:`${batch}/sources/provenance.json`,review_date:'2026-09-13'},snapshot:{element_sha256:sha(JSON.stringify(element)),question_sha256:questionHash(set,sub),source_hashes:Object.fromEntries(units.map(u=>[u.id,u.contentHash])),source_metadata_hashes:Object.fromEntries(units.map(u=>[u.id,sourceUnitHash(u)]))}});
}
if(sha(fs.readFileSync(overlayFile))!==sha(bytes))throw Error('다른 작업이 관계 입력을 변경함');
fs.writeFileSync(`${batch}/coverage-before.json`,bytes);
overlay.links.push(...added);
fs.writeFileSync(overlayFile,JSON.stringify(overlay,null,2)+'\n');
fs.writeFileSync(`${batch}/coverage-added.json`,JSON.stringify({version:1,artifact_type:'coverage_link_evidence',links:added},null,2)+'\n');
console.log(JSON.stringify({added:added.length,scope:'draft',publication:false}));
