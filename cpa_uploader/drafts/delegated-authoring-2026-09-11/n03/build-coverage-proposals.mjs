import fs from 'node:fs';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
const base = 'cpa_uploader/drafts/delegated-authoring-2026-09-11';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const catalog = buildSourceCatalog();
const elementsFile = 'cpa_uploader/analysis/question-elements/question-elements.json';
const elements = read(elementsFile);
// Root explicitly authorized these three proposals; all other N02/R02 files stay unchanged.
const packages = {
  n03: [
    ['element-edc1f6b71281768e', 'pilot-07-006', 'sub1', 'adjacent', '2023:5:3의 A147쪽 공통지문은 유의적 위험과 통제의존을 전제한다. 비유의적 위험의 일반 재사용 절차·주기 전체는 원요구와 달라 직접 빈도를 이전하지 않는다.', ['src-0e7ae72c569fb376df', 'src-dc4efc5926493cc52d']],
    ['element-edc1f6b71281768e', 'pilot-07-006', 'sub2', 'direct', '공통지문의 유의적 위험과 통제의존을 유지하면 전기 결과만의 이용 불가 및 당기 테스트 요구가 직접 일치한다. 2024 요소와 의미상 통합 여부는 총괄이 검토한다.', ['src-0e7ae72c569fb376df', 'src-dc4efc5926493cc52d']],
    ['element-c9dfa1eadd596205', 'pilot-07-006', 'sub2', 'direct', '매출채권 회수가능성의 유의적 위험에 대응하는 통제에 의존하면서 전기 결과만 이용하려는 계획을 보완하는 요구다.', ['src-f3304ffcc0063092e3']],
    ['element-bbbd311ee3f504ad', 'pilot-07-006', 'sub3', 'partial', '원기출은 잔여기간 추가 증거 결정요소 중3개를 요구했으나 새 물음은330.A34의6개를 모두 요구한다. 원물음1회를6개별 직접 빈도로 확대하지 않는다.', ['src-0e7ae72c569fb376df']],
    ['element-155f4440175b820d', 'pilot-07-007', 'sub1', 'direct', '낮은 평가위험과 관계없이 중요한 항목에 절차가 필요한 두 이유를 직접 연결한다. 원발문의 세부테스트라는 표현은 공식330.18/.A43/.A45에 따라 실증절차로 한정하며 모든 세부테스트 의무로 확대하지 않는다.', ['src-855fae5999ef280f1d']],
    ['element-db271df4ab09aa40', 'pilot-07-007', 'sub1', 'direct', '효과적인 통제를 이유로 실증절차를 생략하고 종결 분석만 수행하는 계획의 오류 판단이 직접 일치한다.', ['src-0cb71a127a3e580f7e']],
    ['element-db271df4ab09aa40', 'pilot-07-007', 'sub2', 'adjacent', '실증절차 생략 판단은 관련 맥락이나330.20 결산 실증절차 두 항목의 완전 열거는 원발문이 직접 요구하지 않는다.', ['src-0cb71a127a3e580f7e']],
    ['element-673cef00049bd81c', 'pilot-05-009', 'sub1', 'direct', '부정·오류 예방발견의 주된 책임을 감사인에게도 동일하게 두는 오해를 판단한다. 감사인의 합리적 확신 책임은 공식240.5로 명확히 대조한 확장이다.', ['src-16f0eeb4dcd6484206']],
    ['fraud.management-detection-risk', 'pilot-05-009', 'sub2', 'direct', '종업원 부정과 경영진 부정의 미발견위험 비교 및 지위에 따른 기록·정보 조작 또는 무력화 이유를 묻는다.', ['src-aedf50f2dc438d3dfc', 'src-16f0eeb4dcd6484206', 'src-e4c6a8847fcd517da2']],
    ['fraud.override-unconditional', 'pilot-05-009', 'sub3', 'direct', '위험평가와 무관한 경영진 무력화 대응 의무와 예측불가능성에 따른 유의적 위험 이유가 직접 일치한다.', ['src-48d918076083b19b13', 'src-16f0eeb4dcd6484206']],
  ],
  n02: [
    ['evidence.entity-produced-information', 'pilot-08-006', 'sub1', 'direct', '기업생성정보의 정확성·완전성 증거를 구체 사례에 적용한다. 기존08-003 범주의 의도된 심화이며 새 범주로 세지 않는다.', ['src-f3906bccdb6c4ec743']],
    ['evidence.entity-produced-information', 'pilot-08-006', 'sub2', 'direct', '목적상 정밀도·상세도 평가를 사례에 적용한 의도된 심화다.', ['src-f3906bccdb6c4ec743']],
    ['element-30f4619eb8cf3215', 'pilot-08-006', 'sub3', 'partial', '내부 총액 일치의 한계만 다루며 원물음의 내부통제평가 생략 등 넓은 부분은 제외한다.', ['src-86c5de02b55d8d76d8']],
    ['element-ba405af190995a5d', 'pilot-08-007', 'sub1', 'direct', '기록에서 증빙으로의 검사방향, 발생사실·과대계상 및 완전성 증거의 한계를 연결한다.', ['src-86c5de02b55d8d76d8']],
    ['element-ba405af190995a5d', 'pilot-08-007', 'sub2', 'partial', '완전성 방향을 독립 모집단·자료→장부 추적으로 확장하므로 원기출 전체와 동일 요구가 아니다.', ['src-86c5de02b55d8d76d8']],
    ['element-28cfd73c262d1eb8', 'pilot-08-007', 'sub3', 'direct', '배송기간·계약상 인수일을 반영한 기간귀속 대상기간 재검토다. 이후S02 T07-C-Q1은 이 요구의 적용복습으로 별도 신규 커버리지가 아니다.', ['src-f3304ffcc0063092e3']],
    ['element-cccd100274b787ed', 'pilot-06-006', 'sub1', 'partial', '원구매 흐름에서 권한집중과 견제 상실의 두 조합을 선택해 위험·은폐를 분석한다.', ['src-9e0bdffe5941ba81fe']],
    ['element-cccd100274b787ed', 'pilot-06-006', 'sub2', 'partial', '선정 위험에 대응하는 통제와 증적을 요구하며 원물음의 전체 흐름을 복제하지 않는다.', ['src-9e0bdffe5941ba81fe']],
    ['element-199c160e8733208c', 'pilot-06-006', 'sub1', 'adjacent', '원기출의 용의자 지목은 제외하고 단독 오용 가능성의 상황만 참고했다.', ['src-e1e498ce227d4875a5']],
    ['element-5ad131a1d5035c81', 'pilot-06-007', 'sub1', 'direct', 'IT 접근권한·프로그램 변경·이관 분리의 결함과 위험을 구체적으로 적용한다.', ['src-2ec10ed12b238383da', 'src-e3877e829168d84392']],
    ['element-5ad131a1d5035c81', 'pilot-06-007', 'sub2', 'adjacent', '원IT결함 사례를 배경으로 삼되 자동통제부터IT환경·위험·일반통제를 식별하는 연결은 별도의 공식315 요구다.', ['src-2ec10ed12b238383da', 'src-e3877e829168d84392']],
    ['element-5ad131a1d5035c81', 'pilot-06-007', 'sub3', 'adjacent', 'IT결함 목록 자체와 설계·실행 확인 및 기간운영효과성 증거 구별은 다르다. 기존06-003 개념의 적용복습이다.', ['src-2ec10ed12b238383da', 'src-e3877e829168d84392']],
  ],
  r02: [
    ['element-b09df1c3d2cc54b3', 'pilot-05-008', 'sub1', 'partial', '원모의는 예시 제외 두 가지만 요구하나 후속초안은260.16 유의적 발견사항 전체를 요구한다. 모의1회를 전체 독립기준 직접 빈도로 확대하지 않는다.', ['src-7c2bb8ae4edc367f78', 'src-1c1ca36a9325219b86']],
    ['element-c5c0040a2c05d070', 'pilot-05-008', 'sub2', 'partial', '원기출은 유의적 발견사항 외 추가 커뮤니케이션 사항 중2개이며 독립성은 그 일부다. 후속초안의260.17 세부 전체 요구와 부분적으로 연결한다.', ['src-cfff47c9de850e2bcb']],
    ['governance.communication-benefits', 'pilot-05-008', 'sub1', 'adjacent', '효과적인 양방향 커뮤니케이션의 효익을 묻는 원요구와 유의적 발견사항 목록은 다르다. 효익의 기출2회를 본 물음 직접 빈도로 쓰지 않는다.', ['src-c4a1f75ec283a0442e', 'src-cfff47c9de850e2bcb']],
  ],
};
for (const [pkg, definitions] of Object.entries(packages)) {
  const folder = `${base}/${pkg}`;
  const entries = definitions.map(([element_id, set_id, subquestion_id, relationship, reason, source_unit_ids]) => {
    if (!elements.elements.some(e => e.id === element_id)) throw new Error(`요소 없음 ${element_id}`);
    if (source_unit_ids.some(id => !catalog.units.some(u => u.id === id))) throw new Error(`출처 없음 ${element_id}`);
    const file = `${folder}/${set_id}.json`, set = read(file)[0], q = set.subquestions.find(q => q.id === subquestion_id);
    if (!q) throw new Error(`대상 물음 없음 ${set_id}/${subquestion_id}`);
    return { element_id, source_unit_ids, target: { scope: 'draft', file, set_id, subquestion_id, criterion_ids: q.criteria.map(c => c.id) }, relationship, reason, review_status: 'needs_review' };
  });
  const proposal = { version: 1, artifact_type: 'coverage_proposal', package: pkg.toUpperCase(), created_at: new Date().toISOString(), entries,
    evidence_paths: [`${folder}/scope-and-sources.md`, elementsFile, 'cpa_uploader/analysis/question-elements/frequency.md'],
    policy: '제안만 작성함. 관계 승인·snapshot·공통links 통합은 최종 내용 확정 후 총괄이 수행한다. 원자료 원문이나 빈도표를 복제하지 않는다. direct 관계도 새 요구 또는 게시완료를 뜻하지 않는다.',
    intentional_review: ['S02 T07-C-Q1은 N02 T08-B-Q3의 기간귀속 적용복습이며 신규 요구로 세지 않는다.', 'S02 T07-C-Q3은 N02 T08-A의 기업생성정보 품질 적용복습이며 신규 요구로 세지 않는다. 아직 작성되지 않은S02 target ID를 임의로 만들지 않는다.'] };
  if (pkg !== 'r02') proposal.evidence_paths.push(`${folder}/evidence/phase1/frequency-and-prior-evidence.json`);
  fs.writeFileSync(`${folder}/coverage-proposal.json`, JSON.stringify(proposal, null, 2) + '\n');
  console.log(`${pkg}: ${entries.length}개 제안`);
}
