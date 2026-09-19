// r06 v1 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r06-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r06-materiality-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r06';
const file = `${D}/sets.json`;
const [set] = JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pass = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };
fs.mkdirSync(R, { recursive: true });
const review = {
    version: 1, method: 'agent_content_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (author agent; no independent peer review)', reviewed_at: new Date().toISOString(),
    target: { file, sha256: sha(file), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
    evidence: [`${D}/design.json`, `${D}/lineage.json`, `${D}/qa.json`, `${D}/build-draft.mjs`, `${D}/sources/extract-kga320.mjs`, `${D}/sources/render-kga320-pages.py`,
        'cpa_uploader/data/official/case-review-2026-09-15-kga320.md', 'cpa_uploader/raw/originals/case-review-2026-09-15/kga320-2025-excerpts.provenance.json',
        'cpa_uploader/data/official/delegated-s01-kga200-210-220-320-2025.txt', 'cpa_uploader/data/official/delegated-r01-kga-2025.txt',
        'cpa_uploader/data/official/point-review-c-source-followup-2026-09-11.txt',
        'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt', 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: '2025 전문 추출본(PDF 305~311쪽)에서 KGA 320 문단 1~14·A1~A14 전체를 읽고, 문단 6과 A11은 원본 PDF 306·310·311쪽을 다시 추출·렌더링한 쪽 이미지와 대조해 새로 등록했다. 2026 전문(PDF 332~337쪽)과 전체를 대조했다(각주의 KGA 315 제목 외 동일). 원 세 세트(draft-04-320-freq01, pilot-04-007, case-04-materiality-reset-20260914)의 사실관계·발문·모범답안·criterion, KGA 320 기준서형 6개 물음, 2024 제59회 문제 6 물음 3·2023 제58회 문제 2·2021 제56회 문제 2 물음 6의 쟁점과 비교했다. 여덟 항목의 옳고 그름, 각 criterion의 claim·허용 범위·반대 조건과 모범답안의 충족 여부, 원 세트 간 상반된 전제(일회성 손실과 구조적 감소)의 시간 순서 정합성, 근거 문구의 분포(정답 표지 여부)를 양방향으로 대조했다.',
    questions: [
        { set_id: set.id, subquestion_id: 'sub1', checks: pass,
            rationale: '①은 문단 A6에 따라 옳다(과거에 없었고 반복될 사정이 없는 손상차손으로 이익이 예외적으로 감소한 상황에서 과거 실적에 기초해 정상적 수준으로 조정한 법인세비용차감전계속영업이익 사용; 다온회사가 훨씬 작아 인수에 따른 조정은 논점이 아님). ②는 문단 10·A11에 따라 옳지 않다(주주들의 관심이 인수 관련 공시에 집중되어 전체 중요성보다 작은 왜곡표시도 의사결정에 영향을 줄 것으로 합리적으로 예상되므로 그 공시의 중요성 수준도 결정해야 하며, 금액이 작다거나 승인되었다는 사실은 이를 대신하지 못함). ③은 문단 11·A13에 따라 옳지 않다(수행중요성은 기계적 계산이 아닌 전문가적 판단이며 시스템 전환·수작업 연결, 전기 반품 지연 왜곡표시와 미수정, 당기 예상에 영향을 받음). c1 식별과 c2·c3(이유나 보완절차 한 가지, 핵심 수준)이 독립적으로 채점된다.',
            check_rationales: {
                source: 'A6은 draft-04-320-freq01의 인용을 해시 그대로 재사용했고, 문단 10·11·A13은 s01 등록본에서 문단 본문만 발췌했으며(원 세트 인용 끝의 쪽 머리말 제외), A11은 새 등록 발췌본의 exact 부분문자열이다. 모두 KGA 320 구간 안에 있다. 초안 검증(--against-bank) 통과.',
                answer: '모범답안이 c1~c3를 충족한다. 부분정답(함정 ① 선택, ②·③ 이유)=2점, 오답(① 선택, ②·③ 옳다고 명시)=0점, 보조 사례(②는 보완절차만, ③은 전문가적 판단이라는 이유만)=3점, 번호 없이 내용으로 특정한 답=3점을 원문으로 정했다.',
                prompt: '발문은 범위(①~③)와 요구(번호, 이유나 수행하였어야 할 절차를 간략히)만 적는다. 원 발문의 “보다 적합한 이익 수치”, “주주들의 정보수요와 공시의 성격을 고려하여”, 세 고려사항 ①~③의 나열을 없앴다.',
                points: '3점. 옳지 않은 항목 두 개에 각 1점, 식별 1점. 세 고려사항의 완전한 나열이나 비율·금액은 요구하지 않는다.',
                style: '일회성 손상차손, 주주들의 관심 집중, 전기 왜곡표시와 시스템 전환이라는 사실에 기준을 적용해 각 결정의 옳고 그름을 판단해야 하므로 사례형이다.',
                topics: '04(KGA 320 계획 단계 중요성과 수행중요성).',
                edition: '대상 연도 2027년. 사례의 20X1년을 2026-01-01 개시 보고기간으로 보고 2025 전문(KGA 320 문단 7 시행일)을 적용했다. 2026 전문과 본문이 같다.',
                nonduplication: '원 draft-04-320-freq01 q1·exp1과 pilot-04-007 sub2·exp1의 요소를 ①·②·③으로 옮겼다. 기준서형(벤치마크 요인 열거, 수행중요성 정의·고려사항 서술, 이용자의 공통 정보수요)과 달리 사례 결정의 판단이다.' },
            unresolved_content_findings: [] },
        { set_id: set.id, subquestion_id: 'sub2', checks: pass,
            rationale: '④는 문단 12·A14에 따라 옳다(주요사업의 처분결정과 계약종료로 손상차손을 제외하더라도 실제 이익이 최초에 사용한 금액과 크게 다를 것이므로 중요성을 수정; 새 예측에서도 일회성 손상차손은 제외해 ①과 모순 없음). ⑤는 문단 13에 따라 옳지 않다(전체 중요성을 낮추었으므로 수행중요성의 수정 필요성을 결정해야 함). ⑥은 문단 13에 따라 옳지 않다(추가감사절차의 성격·시기·범위가 여전히 적합한지 결정해야 하며 인력 배정은 이유가 되지 않음). ⑦은 문단 14(a)·(d)에 따라 옳지 않다(수정내용과 금액 결정 시 고려한 요소를 문서화해야 함). ⑧은 문단 6에 따라 옳다(중요성 미달 왜곡표시도 성격·상황에 따라 중요할 수 있고 크기뿐 아니라 성격을 고려). c1 식별과 c2~c4가 독립적으로 채점된다.',
            check_rationales: {
                source: '문단 12·13·14(a)·14(b)~(d)·A14는 case-04-materiality-reset-20260914의 인용을 해시 그대로 재사용했고, 문단 6은 새 등록 발췌본의 exact 부분문자열이다.',
                answer: '모범답안이 c1~c4를 충족한다. 부분정답(⑥ 누락과 함정 ⑧ 선택, ⑤·⑦ 이유)=2점, 오답(함정 ④·⑧만 선택, ⑤·⑥·⑦ 옳다고 명시)=0점, 보조 사례(⑥ 표본 규모 한 측면, ⑦ 수정 이유 기록만)=4점, 내용 특정·⑤⑥ 한 문장 답=4점을 원문으로 정했다.',
                prompt: '범위(④~⑧)와 요구만 적는다. 원 발문의 “수행중요성과 추가감사절차로 구별 … 분석 방법·수행 일정·표본범위에 각각 연결”, “보완하시오 … 구별하여”와 조건부 후속안을 없앴다.',
                points: '4점. 옳지 않은 항목 세 개에 각 1점, 식별 1점. 추가감사절차의 세 측면이나 문서화 요소의 완전한 나열은 요구하지 않는다. 함정 ④·⑧은 식별 기준으로만 평가한다.',
                style: '사업부문 처분결정과 새 예측, 중간감사 표본, 인력 배정, 중요성표의 덮어쓰기, 대표이사 관련 미수정왜곡표시라는 사실에 기준을 적용해야 하므로 사례형이다.',
                topics: '04(KGA 320 감사 진행에 따른 수정·문서화)와 12(⑧ 미수정왜곡표시의 중요성 평가에서 성격 고려).',
                edition: 'sub1과 같은 판본·가정.',
                nonduplication: '원 case-04-materiality-reset의 sub1(갑의 유지 제안)은 옳은 항목 ④로, sub2·sub3의 요소는 ⑤·⑥·⑦로 옮겼다. 기준서형 pilot-04-001 sub2(후속 조치 서술)와 pilot-04-005-standards-20260913(문서화 사항 열거)과 달리 사례 절차의 판단이다. ⑧은 새 요소다.' },
            unresolved_content_findings: [] },
    ],
    observations_not_blocking: [
        '사실관계 1,832자, 항목 8개로 원 세 세트(각 4개 사실)를 합친 범위다. 판단에 쓰이지 않는 금액·담당자 교체·전기 중요성 자료 검토 문장은 뺐다.',
        '사용자가 형식을 지정하지 않아 학습 단위 계약의 기본인 옳지 않은 것 선택형을 적용했다(r05는 사용자 지시에 따라 각 항목의 적절 여부 판단형).',
        '①(일회성 손실 정상화)과 ④(구조적 감소에 따른 수정)는 같은 기준에서 사실이 갈리는 쌍이지만 두 물음에 나누어 두었고, ④에서도 손상차손을 제외해 서로 모순되지 않는다.',
        '옳지 않은 항목 수는 물음별 2·3개이며 발문에 밝히지 않는다.',
        '작성 agent가 직접 검토했으며 독립 agent 교차검토·사람 확인은 수행하지 않았다.',
    ],
    unresolved_content_findings: [],
};
fs.writeFileSync(`${R}/root-content-review-v1.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(review.target);
