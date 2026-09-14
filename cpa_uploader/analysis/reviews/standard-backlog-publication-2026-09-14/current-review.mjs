// 게시 전 담당 agent 재검토 장부 생성기. 모델 호출 없음.
// 세 배치의 제작 이후 정본에 새로 들어오거나 바뀐 세트 중 같은 기준서·법규를 다루는 물음을 모두 찾고,
// 아래 NOTES의 수동 판정이 빠짐없이 붙었는지 검사한다. 내용 확인은 담당 agent가 모범답안·배점 문서와
// 보존 원문을 직접 대조한 결과이며 사람 확인이 아니다.
//   node cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14/current-review.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const P='cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),ref=file=>({file,sha256:sha(file)});
const BATCHES=['standard-gap-2026-09-13','standard-expansion-2026-09-13','standard-followup-2026-09-13'];
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
// 세 배치 중 가장 늦게 조사한 followup의 비교 기준(155세트)과 같은 판본. 이후 추가·변경분을 재대조한다.
const researchBaseline='cpa_uploader/drafts/standard-additional-2026-09-13/publication-v2/baseline/authoring.json';
const bank=read(bankFile),base=read(researchBaseline);
const baseById=new Map(base.map(s=>[s.id,JSON.stringify(s.subquestions)]));
const newer=bank.filter(s=>!baseById.has(s.id)||baseById.get(s.id)!==JSON.stringify(s.subquestions));
const standardsOf=s=>[...new Set(s.source_refs.map(r=>r.page))];
const ETHICS_ADDITIONAL={'draft-standard-additional-20260913-e01':'선물·접대 일반 규정(윤리 260)이다. 이 물음의 문단과 다르며 standard-additional 조사가 이 43물음과 비교해 선정했다.','draft-standard-additional-20260913-e02':'의뢰인 자산 보관(윤리 270)이다. 이 물음의 문단과 다르며 standard-additional 조사가 이 43물음과 비교해 선정했다.'};
const NOTES={
 'draft-standard-gap-20260913-g02/sub1':{'pilot-08-008-standards-20260913':'경영진측 전문가(500.8)와 정보 불일치 대응(500.11)이다. 전수조사 선택 상황(500.A64)과 다르다.','pilot-08-008':'경영진측 전문가 적격성·불일치 대응의 사례형이다.'},
 'draft-standard-gap-20260913-g02/sub2':{'pilot-08-008-standards-20260913':'경영진측 전문가(500.8)와 정보 불일치 대응(500.11)이다. 특정 항목 추출 범주(500.A65)와 다르다.','pilot-08-008':'경영진측 전문가 적격성·불일치 대응의 사례형이다.'},
 'draft-standard-gap-20260913-g03/sub1':{'pilot-12-001':'exp1은 570.16(b)·(c)를 사례의 차입 연장·신규 매출 계획에 적용하는 사례형이고 subq2는 평가기간이다. G03은 570.16(a)(b)(e)의 일반 요구를 묻는다. (b)의 두 기준은 학습 유형이 다른 의도된 복습으로 유지한다.'},
 'draft-standard-gap-20260913-g05/sub1':{'pilot-06-008':'고유위험요소·위험평가 사례이다. 경영진주장 범주(315.A190)를 묻지 않는다.','pilot-06-008-standards-20260913':'315.22(b)·37이다. 경영진주장 범주와 다르다.','pilot-10-007-standards-20260913':'분석적절차(315·520)이다. 경영진주장 범주와 다르다.'},
 'draft-standard-gap-20260913-g05/sub2':{'pilot-06-008':'고유위험요소·위험평가 사례이다. 경영진주장 범주(315.A190)를 묻지 않는다.','pilot-06-008-standards-20260913':'315.22(b)·37이다. 경영진주장 범주와 다르다.','pilot-10-007-standards-20260913':'분석적절차(315·520)이다. 경영진주장 범주와 다르다.'},
 'draft-standard-gap-20260913-g06/sub1':{'pilot-07-007-standards-20260913':'결산절차 관련 실증절차(330.20)이다. 전기 통제증거 재사용 요인(330.13)과 다르다.','pilot-07-007':'실증절차 생략 계획의 사례 평가(330.18·20)이다. 330.13과 다르다.','pilot-06-008-standards-20260913':'315.22(b)와 새 정보에 따른 위험평가·추가감사절차 재검토(315.37·330)이다. 330.13과 다르다.'},
 'draft-standard-gap-20260913-g07/sub1':{'pilot-07-007-standards-20260913':'결산절차 관련 실증절차(330.20)이다. 기중 실증절차 후 잔여기간(330.22–23)과 다르다.','pilot-07-007':'실증절차 생략의 사례 평가이다. 잔여기간 감사와 다르다.','pilot-06-008-standards-20260913':'새 정보에 따른 위험평가·추가감사절차 재검토이다. 잔여기간 감사방법과 다르다.'},
 'draft-standard-gap-20260913-g08/sub1':{'pilot-04-005-standards-20260913':'중요성 문서화(320.14)이다.','draft-04-320-freq01-standards-20260913':'이용자 범위와 정보수요(320.4)이다. 벤치마크 식별 요인(320.A4)과 다르다.','pilot-04-007-standards-20260913':'수행중요성의 정의·결정 요인·중요성 하향 조정(320.9·11·12)이다.','draft-04-320-freq01':'일시적 이익 급감 시 대체 이익수치를 적용하는 사례형이다. 요인 목록 자체를 묻지 않는다.','pilot-04-007':'수행중요성 결정 방식의 사례형이다.'},
 'draft-standard-gap-20260913-g09/sub1':{'pilot-12-010-standards-20260913':'필수 책임진술과 의견거절(580.10–11·20)이다. 증거상 한계(580.3–4)와 다르다.','pilot-12-010':'진술 미제공 사례(580.19–20)이다.'},
 'draft-standard-gap-20260913-g09/sub2':{'pilot-12-010-standards-20260913':'필수 책임진술과 의견거절(580.10–11·20)이다. 요청 대상의 조건(580.9)과 다르다.','pilot-12-010':'진술 미제공 사례이다.'},
 'draft-standard-expansion-20260913-e01/sub1':ETHICS_ADDITIONAL,
 'draft-standard-expansion-20260913-e01/sub2':ETHICS_ADDITIONAL,
 'draft-standard-expansion-20260913-e01/sub3':ETHICS_ADDITIONAL,
 'draft-standard-expansion-20260913-e01/sub4':ETHICS_ADDITIONAL,
 'draft-standard-expansion-20260913-s01/sub1':{'pilot-04-006-standards-20260913':'sub2는 취합 중 행정적 변경(230.A22), sub3은 취합 후 변경의 문서화(230.16)이며 발문이 230.13을 명시적으로 제외한다.','pilot-04-006':'최종감사파일 취합 사례(230.14–15)이다.','pilot-04-005':'감사문서 삭제·보충 설명 사례(230.15–16)이다.','draft-standard-additional-20260913-s03':'230.9–12의 식별·토의·불일치·이탈 문서화이다. standard-additional 조사가 230.13인 이 물음과 구별해 선정했다.'},
 'draft-standard-expansion-20260913-s03/sub1':{'case-05-management-override-20260913':'통제무력화 대응 사례(240.32–33)이다. 재무제표 수준 부정위험의 전반적 대응(240.30)과 다르다.'},
 'draft-standard-expansion-20260913-s06/sub1':{'pilot-06-008-standards-20260913':'기업 위험평가절차의 평가(315.22(b))와 새 정보에 따른 재평가(315.37)이다. 통제환경의 이해(315.21(a))와 다르다.','pilot-06-008':'고유위험요소·위험평가 사례이다.','pilot-10-007-standards-20260913':'분석적절차(315·520)이다. 통제환경과 다르다.'},
 'draft-standard-expansion-20260913-s06/sub2':{'pilot-06-008-standards-20260913':'315.22(b)·37이다. 통제환경의 평가(315.21(b))와 다르다.','pilot-06-008':'고유위험요소·위험평가 사례이다.','pilot-10-007-standards-20260913':'분석적절차(315·520)이다. 통제환경과 다르다.'},
 'draft-standard-expansion-20260913-s07/sub1':{'pilot-12-010-standards-20260913':'필수 책임진술과 의견거절(580.10–11·20)이다. 다른 증거와의 불일치(580.17)와 다르다.','pilot-12-010':'진술 미제공 사례이다.'},
 'draft-standard-followup-20260913-e01/sub1':ETHICS_ADDITIONAL,
 'draft-standard-followup-20260913-e01/sub2':ETHICS_ADDITIONAL,
 'draft-standard-followup-20260913-e02/sub1':ETHICS_ADDITIONAL,
 'draft-standard-followup-20260913-s01/sub1':{'draft-09-501-freq01-standards-20260913':'다른 날짜 실사의 재고변동 통제(501.A?)이다. 제3자 보관 재고(501.8)와 다르다.','draft-09-501-freq01':'다른 날짜 실사 사례이다.'},
 'draft-standard-followup-20260913-s03/sub1':{'pilot-10-006-standards-20260913':'표본결과가 합리적 근거가 되지 못할 때의 후속 대응(530.14)이다.','pilot-10-006':'표본위험 유형의 사례형이다.'},
 'draft-standard-followup-20260913-s03/sub2':{'pilot-10-006-standards-20260913':'530.14이다. 체계적 추출(보론4)과 다르다.','pilot-10-006':'표본위험 유형의 사례형이다.'},
 'draft-standard-followup-20260913-s03/sub3':{'pilot-10-006-standards-20260913':'530.14이다. 임의추출(보론4)과 다르다.','pilot-10-006':'표본위험 유형의 사례형이다.'},
 'draft-standard-followup-20260913-s03/sub4':{'pilot-10-006-standards-20260913':'530.14이다. 구획추출(보론4)과 다르다.','pilot-10-006':'표본위험 유형의 사례형이다.'},
 'draft-standard-followup-20260913-s04/sub1':{'pilot-15-006':'의견거절 문구 수정 사례(700·705)이다. 보충적 정보(700.53–54)를 묻지 않는다.'},
};
const questions=[],missing=[],unused=[];
for(const batch of BATCHES){
 const index=read(`cpa_uploader/drafts/${batch}/index.json`);
 for(const row of index.sets){
  const set=read(row.file);assert(!bank.some(s=>s.id===set.id),'이미 정본에 있는 초안');
  const stds=standardsOf(set);
  for(const q of set.subquestions){
   const key=`${set.id}/${q.id}`,notes=NOTES[key]??{};
   const neighbors=newer.filter(s=>standardsOf(s).some(p=>stds.includes(p))).map(s=>{const note=notes[s.id];if(!note)missing.push(`${key} ↔ ${s.id}`);return{set_id:s.id,standards:standardsOf(s),question_ids:s.subquestions.map(x=>x.id),decision:'distinct_requirement',reason:note??null};});
   for(const id of Object.keys(notes))if(!neighbors.some(n=>n.set_id===id))unused.push(`${key} ↔ ${id}`);
   questions.push({question:key,batch,standards:stds,points:q.criteria.reduce((n,c)=>n+c.max_points,0),criteria:q.criteria.length,newer_bank_neighbors:neighbors,
    content_recheck:'모범답안-배점 문서의 발문·모범답안·배점 이유를 읽고, 원 agent 검토의 criterion별 직접 근거와 보존 원문 문단을 대조했다. 정답·조건·배점에서 결함을 찾지 못했다.',
    decision:'publish'});
  }
 }
}
assert.deepEqual({missing,unused},{missing:[],unused:[]},'판정 누락 또는 대상 아닌 판정:\n'+JSON.stringify({missing,unused},null,1));
assert.equal(questions.length,43);
const out={version:1,artifact_type:'publication_agent_rereview',reviewed_at:'2026-09-14',reviewer:'Claude Code agent',human_review_performed:false,model_api_calls:0,
 bank:ref(bankFile),research_baseline:ref(researchBaseline),newer_bank_sets:newer.map(s=>s.id),
 validator:'npx tsx cpa_uploader/validate_draft_v3.ts --file <각 초안> --against-bank — 2026-09-14 현재 정본 기준 27개 파일 통과(형상·인용 실존·ID/발문 충돌 없음)',
 sources_rechecked:[
  {file:'cpa_uploader/raw/materials/verification/1303e54860a58770/ethics-2024-complete.txt',paragraphs:'윤리기준 140.8, 220.3–220.6, 230.2–230.3, 240.3–240.4',result:'발문·모범답안과 일치'},
  {file:'cpa_uploader/raw/materials/verification/dd662b5464e1e9d5/external-audit-law-text.txt',paragraphs:'외부감사법 제9조제5항·제6항, 제22조제1항–제7항',result:'발문·모범답안과 일치. 제7항에 정관 위반이 없음을 확인'},
  {file:'cpa_uploader/raw/materials/verification/f0914795b909ea38/kga-2026-pymupdf-pages.txt',paragraphs:'KGA 230·240·260·265·300·315·320·330·500·501·510·530·560·570·580·700·706·1100 해당 문단',result:'원 agent 검토의 criterion별 직접 근거를 대조했고 결함을 찾지 못함'},
 ],
 edition:{kga:'KICPA 2026년 7월 개정 감사기준서 전문. 시험 적용연도는 따로 확정하지 않음.',ethics:'2024-12-19 의결 윤리기준 전문(현행). 2026-09-02 공개초안이 2027-01-01 시행으로 확정되면 윤리 7물음(expansion e01 4, followup e01 2·e02 1)의 문단 번호·용어 재검토가 필요하다.',law:'외부감사법 2025-04-01 개정 반영본(2026-09-11 수집, expansion 배치가 2026-09-13 국가법령정보센터 현행 조문과 대조).'},
 questions};
fs.writeFileSync(P+'/current-review.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({questions:questions.length,newer_bank_sets:newer.length,annotated_neighbors:questions.reduce((n,q)=>n+q.newer_bank_neighbors.length,0)}));
