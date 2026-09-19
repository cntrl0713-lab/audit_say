// r05 v1 agent 내용 검토 기록(한 번만 실행; 기존 파일이 있으면 쓰지 않는다).
//   npx tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/record-r05-review.mts
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r05-audit-documentation';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r05';
const file = `${D}/sets.json`;
const [set] = JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pass = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };
fs.mkdirSync(R, { recursive: true });
const review = {
    version: 1, method: 'agent_content_review', human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (author agent; no independent peer review)', reviewed_at: new Date().toISOString(),
    target: { file, sha256: sha(file), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
    evidence: [`${D}/design.json`, `${D}/lineage.json`, `${D}/qa.json`, `${D}/build-draft.mjs`, `${D}/sources/extract-kga230.mjs`, `${D}/sources/render-kga230-pages.py`,
        'cpa_uploader/data/official/case-review-2026-09-15-kga230.md', 'cpa_uploader/raw/originals/case-review-2026-09-15/kga230-2025-excerpts.provenance.json',
        'cpa_uploader/data/official/delegated-n01-kga200-210-230-2025.txt', 'cpa_uploader/data/official/delegated-n01-kga230-supplement-2025.txt',
        'cpa_uploader/data/official/delegated-s05-kga230-context-2025.txt',
        'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt', 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json'].map((f) => ({ file: f, sha256: sha(f) })),
    method_detail: '2025 전문 추출본(PDF 69~81쪽)에서 KGA 230 문단 1~16·A1~A24 전체를 읽고, A4·A5·A12·A13·A15·A20은 원본 PDF 74·76~79쪽을 다시 추출·렌더링한 쪽 이미지와 대조해 새로 등록했다. 2026 전문(PDF 94~105쪽)과 문단별로 대조했다(요구사항 7~16 동일, A13 첫 문장·A20 둘째 문장·품질관리 참조 문구만 다름). 원 pilot-04-006의 사실관계·발문·모범답안·criterion, 겹치는 사례 pilot-04-005·case-04-documentation-trace-20260914와 KGA 230 기준서형 7개 물음, 2025 제60회 2차 문제 2 물음 2와 고급회계감사연습 Section 2 물음 5의 형식을 비교했다. 열 항목의 적절 여부, 각 criterion의 claim·허용 범위·반대 조건과 모범답안의 충족 여부, 근거 문구·부정 표현의 분포(정답 표지 여부)를 양방향으로 대조했다.',
    questions: [
        { set_id: set.id, subquestion_id: 'sub1', checks: pass,
            rationale: '①은 문단 9(a)·A12(체계적 추출은 문서의 원천·출발점·추출 간격으로 식별), ④는 문단 9(c)·A13(조서마다 검토 증거를 남길 필요 없이 어떤 업무를 누가 언제 검토했는지 기록, 검토는 보고서일 전), ⑥은 문단 11·A4·A15(불일치 처리 경위를 기록하고 교체된 초안은 포함할 필요 없음)에 따라 적절하다. ②는 문단 7·A1에 따라 조서 작성과 검토를 보고서일 후로 미룰 수 없고, 보고서일 전에 토의·합의한 증거가 아니어서 A22의 행정적 변경에도 해당하지 않아 적절하지 않다. ③은 문단 8(c)·A5에 따라 유의적 판단의 근거를 문서화해야 하고 구두설명만으로는 근거가 되지 못해 적절하지 않다. ⑤는 문단 10에 따라 유의적 사항에 관한 경영진·지배기구와의 토의 내용을 기록해야 하므로 적절하지 않다. c1 식별과 c2~c4(이유나 보완절차 한 가지, 핵심 수준)가 독립적으로 채점된다.',
            check_rationales: {
                source: '문단 7(supplement)·9·10·11(n01)은 기존 정본 인용을 해시 그대로 재사용했고, 문단 8은 s05 등록본, A1은 n01 등록본, A4·A5·A12·A13·A15는 새 등록 발췌본의 exact 부분문자열이며 모두 KGA 230 구간 안에 있다. 초안 검증(--against-bank) 통과.',
                answer: '모범답안이 c1~c4를 충족한다. 부분정답(⑤를 적절로 판단하고 함정 ⑥ 선택, ②·③ 이유)=2점, 오답(함정 ①·④·⑥만 부적절, ②·③·⑤ 적절 명시)=0점, 보조 사례(표 형식으로 이유만·보완절차만)=4점, 판단만 쓴 답=1점을 원문으로 정했다.',
                prompt: '발문은 범위(①~⑥)와 요구(각 항목의 적절 여부, 적절하지 않은 것은 이유나 수행하였어야 할 절차를 간략히)만 적는다. 원 발문의 “최초 작성과 최종감사파일 취합의 성격을 구별하여”를 없앴고 적절하지 않은 항목 수를 밝히지 않는다.',
                points: '4점. 식별 1점 + 적절하지 않은 항목 세 개에 각 1점. 판단마다 점수를 주지 않아 추측 득점이 없고, 토의 기록의 세 요소 등 완전한 나열은 요구하지 않는다.',
                style: '조서 작성 시점·검토 방식·토의와 불일치 정보의 처리라는 사례 사실에 기준을 적용해 각 절차의 적절 여부를 판단해야 하므로 사례형이다.',
                topics: '04(KGA 230 감사문서).',
                edition: '대상 연도 2027년. 사례의 20X1년을 2026-01-01 개시 보고기간으로 보고 2025 전문(KGA 230 문단 4 시행일)을 적용했다. 2026 전문과 요구 내용이 같으며, A13 첫 문장의 차이는 개별 조서마다 검토 증거가 필요 없다는 판단 근거에 영향이 없다.',
                nonduplication: '원 sub1(갑의 제안)을 ②로 옮겼다. case-04-documentation-trace-20260914의 식별 특성·회의록·불일치 기록 보완 서술과 달리 체계적 추출의 식별 방식과 초안 제외를 적절한 항목으로 판단하게 하고, 기준서형(문단 8·9·10·11 열거)과 달리 사례 절차에 적용한다.' },
            unresolved_content_findings: [] },
        { set_id: set.id, subquestion_id: 'sub2', checks: pass,
            rationale: '⑦은 문단 14·A22(취합 중 교체된 문서의 삭제·폐기, 조서의 분류·병합·상호 참조)에 따라 적절하며 취합 완료 전이라 문단 15와 관계없다. ⑧은 A22 넷째 예(보고서일 전에 입수하여 관련 업무팀원들과 토의하고 합의한 감사증거의 문서화)에 해당해 적절하다. ⑨는 보고서일 현재 존재한 사실(A20)을 보고서일 후 알게 되어 추가 절차를 수행하고 결론을 내린 것이므로 행정적 취합이 아니며 문단 13의 사항을 문서화해야 해 적절하지 않다. ⑩은 문단 16에 따라 취합 완료 후 수정은 성격과 관계없이 이유와 수정·검토자 및 시기를 문서화해야 하므로 적절하지 않다. c1 식별과 c2·c3이 독립적으로 채점된다.',
            check_rationales: {
                source: 'A22는 원 세트 인용, 문단 16은 pilot-04-005 인용을 해시 그대로 재사용했고, 문단 13·14는 n01 등록본, A20은 새 등록 발췌본의 exact 부분문자열이다.',
                answer: '모범답안이 c1~c3를 충족한다. 부분정답(함정 ⑧ 선택, ⑨·⑩ 이유)=2점, 오답(함정 ⑦·⑧만 부적절, ⑨·⑩ 적절 명시)=0점, 보조 사례(문단 13 사항 일부만 든 보완절차, 성격과 관계없는 문서화 원칙)=3점, 판단만 쓴 답=1점을 원문으로 정했다.',
                prompt: '범위(⑦~⑩)와 요구만 적는다. 원 exp1의 “작업의 성격에 근거하여”, “추가 절차 필요성이나 감사의견의 종류는 판단하지 마시오”와 을·병의 병렬 질문을 없앴다.',
                points: '3점. 식별 1점 + ⑨·⑩ 각 1점. 함정 ⑦·⑧은 식별 기준으로만 평가한다.',
                style: '취합 기간·보고서일 후 알게 된 사실·취합 완료 후 정정이라는 사실에 기준을 적용해야 하므로 사례형이다.',
                topics: '04(KGA 230 감사문서, 최종감사파일 취합).',
                edition: 'sub1과 같은 판본·가정. A20 둘째 문장(업무수행이사의 최종책임)은 2026 전문에서 빠졌으나 채점에 쓰지 않는다.',
                nonduplication: '원 exp1의 을·병 요소를 ⑦·⑨로 옮기고 ⑧·⑩을 더했다. pilot-04-005의 문단 15(삭제 금지)는 묻지 않고, 문단 16은 단순 오기 정정의 “성격과 관계없이”를 판단하게 하여 설명 추가 사례와 구별된다. 기준서형 pilot-04-006-standards-20260913(A22 네 범주 열거)과 달리 사례 절차의 판단이다.' },
            unresolved_content_findings: [] },
    ],
    observations_not_blocking: [
        '사실관계 2,040자, 항목 10개로 원 문제(4개 사실)보다 길다. 사용자가 요청한 감사문서 종합문제 범위이며, 판단에 쓰이지 않는 현장감사 기간 문장은 뺐다.',
        '사용자 표현 “각 절차가 적절한지와 그 이유”를 기출·고급연습의 “적절한지 여부를 기재하고, 적절하지 않은 경우 그 이유” 형식으로 해석했다. 적절한 항목의 이유에 점수를 주는 형식을 원하면 배점을 다시 설계해야 한다.',
        '②와 ⑧은 같은 기준(문단 7·A22)에서 결론이 갈리는 쌍이다. ⑧의 옳음은 A22 넷째 예로 확정되지만 2025 제60회 기출 해설처럼 “적시 작성”만 기억한 수험생은 ⑧을 틀리게 고를 수 있다(의도한 함정).',
        '옳지 않은 항목 수는 물음별 3·2개이며 발문에 밝히지 않는다.',
        '작성 agent가 직접 검토했으며 독립 agent 교차검토·사람 확인은 수행하지 않았다.',
    ],
    unresolved_content_findings: [],
};
fs.writeFileSync(`${R}/root-content-review-v1.json`, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log(review.target);
