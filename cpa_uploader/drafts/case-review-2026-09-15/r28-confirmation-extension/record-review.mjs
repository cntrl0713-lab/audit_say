// r28 초안의 agent 내용검토 장부 기록기. 실제 대조를 마친 뒤 한 번만 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r28-confirmation-extension/record-review.mjs
//
// 출력: cpa_uploader/analysis/reviews/case-review-2026-09-15/r28/root-content-review-v1.json

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const DRAFT_DIR = 'cpa_uploader/drafts/case-review-2026-09-15/r28-confirmation-extension';
const OUT_DIR = path.join(root, 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r28');
const SET_ID = 'case-09-confirmation-20260921';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = (file) => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) });
const [draft] = JSON.parse(fs.readFileSync(path.join(root, DRAFT_DIR, 'sets.json'), 'utf8'));
if (draft.id !== SET_ID) throw new Error('set id 불일치');

const PASS = {
    source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass',
    style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass',
};

const review = {
    version: 1,
    method: 'agent_content_review',
    human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (author agent; no independent peer review)',
    reviewed_at: new Date().toISOString(),
    target: {
        file: `${DRAFT_DIR}/sets.json`,
        sha256: ref(`${DRAFT_DIR}/sets.json`).sha256,
        set_id: SET_ID,
        reviewed_content_sha256: reviewedContentHash(draft),
    },
    evidence: [
        `${DRAFT_DIR}/design.json`,
        `${DRAFT_DIR}/lineage.json`,
        `${DRAFT_DIR}/qa.json`,
        `${DRAFT_DIR}/build-draft.mjs`,
        'cpa_uploader/data/official/kga501-505-510-2025-review09.txt',
        'cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt',
        'cpa_uploader/data/official/delegated-n01-kga200-210-230-2025.txt',
        'cpa_uploader/data/official/delegated-s01-kga200-210-220-320-2025.txt',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
        'docs/물음별-학습-단위와-분류-계약.md',
        'docs/사례형-병합-종합문제-설계.md',
        'docs/case-question-edit-notes-2026-09-14.md',
    ].map(ref),
    method_detail:
        'KGA 505의 등록 전문 두 파일을 직접 읽었다. kga501-505-510-2025-review09.txt의 505 구간(L186-L424)에서 문단 4~16 전부와 적용자료 A19~A23을, point-review-b-source-followup-2026-09-11.txt의 505 구간(L109-L200)에서 문단 9~16과 15(a)~(d), 적용자료 A1~A4를 읽고 열네 항목의 옳고 그름을 문단 단위로 확정했다. 인용 열여섯 개 가운데 열다섯 개는 두 원 세트(case-09-confirmation-skepticism-20260918, case-09-negative-confirmation-conditions-20260914)의 정본 인용을 바이트와 content_hash 그대로 재사용했고, KGA 505 문단 7만 kga501-505-510-2025-review09.txt L238-L245에서 새로 발췌해 SHA-256을 계산했다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했고, 현재 정본 346세트와 같은 배치의 초안 30개 파일(합계 557개 발문)을 공백 정규화 기준으로 대조해 바이트 동일 발문이 없음을 확인했다(퇴역 예정인 대상 갱신본과도 충돌하지 않는다). 현재 정본에서 source_ref의 page가 "KGA 505"인 세트 열두 개의 발문·모범답안·criterion을 모두 읽고 중복을 대조했다. 판본은 두 원 세트가 남긴 2026 전문 대조 기록을 재사용했고 새 원자료 수집은 하지 않았다.',
    questions: [
        {
            subquestion_id: 'sub1',
            checks: { ...PASS },
            rationale:
                'source: ①은 KGA 505 문단 15 본문과 15(a)(감사인은 중요왜곡표시위험이 낮다고 평가하였고, 경영진주장과 관련된 통제의 운영효과성에 대하여 충분하고 적합한 감사증거를 입수하였음), ②는 문단 15 본문과 15(b)(모집단이 다수의 동질적이며 소액인 계정잔액이나 거래 또는 조건들로 구성), ③은 문단 7(c)·(d), ④는 문단 A23 전단(회신을 받지 못하는 것이 수령이나 정보의 정확성 검증을 명시적으로 나타내는 것은 아니며 적극적 조회에 대한 회신보다 유의적으로 설득력이 더 낮은 감사증거를 제공), ⑤는 문단 A23 후단(조회처는 조회서의 정보가 자신에게 유리하지 않은 경우 의견차이가 있다는 회신을 더 많이 하고 반대의 경우에는 덜 할 수 있음)에서 확정했다. 문단 15의 네 조건을 사실과 하나씩 대조해 각 항목의 잘못을 하나로 한정했다. 15(c)(불일치사항의 발생률이 매우 낮을 것으로 예상)와 15(d)(수신자가 요청을 무시할 상황이나 조건을 알고 있지 아니함)는 두 모집단에 공통으로 충족시켰고, ①에서는 15(b)를 충족시키고 15(a)만, ②에서는 15(a)를 충족시키고 15(b)만 불충족하게 두었다. ⑤의 방향은 원문 예시(은행 예금주)와 반대이므로 조회처의 이해관계를 직접 대조했다. 매출채권 조회의 조회처는 채무자인 소매점이고 청구액의 과대표시는 소매점에게 유리하지 않으므로 회신 유인이 크다. 사실관계에 "소매점은 청구액이 자신의 거래기록보다 많으면 곧바로 이의를 제기해 왔고 적으면 따로 알리지 않는 경우가 많다"를 두어 A23 후단의 명제가 이 사례에서 성립함을 확정했다. ③이 다투어지지 않도록 문단 7이 조회 방식을 구분하지 않는 요구사항임을 확인했고 소극적 조회에도 그대로 적용된다. answer: 모범답안 네 문장이 식별·①·②·④ criterion과 1대1로 대응하고 옳은 항목 ③·⑤의 근거도 함께 제시한다. prompt: 발문은 단계 이름과 항목 범위, 요구 형식만 밝히고 옳지 않은 항목의 수·내용을 알려 주지 않는다. "유일한 실증감사절차"라는 기준서의 조건 문구는 발문에 쓰지 않았다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이다. 원 70번의 같은 내용 6점에서 세 물음의 판단 3점을 식별 1점으로 합치고(-2점), A23 후단의 회신 유인 요구를 옳은 항목 ⑤로 옮겼다(-1점). 남은 세 요구는 15(a)·15(b)·A23 전단으로 서로 독립이어서 합치지 않았다. style: 다섯 항목의 옳고 그름이 소매점 매출의 기록 통제에 운영 테스트가 없다는 점, 대형 유통업체 채권이 12개 업체의 거액이고 업체마다 조건이 다르다는 점, 소매점이 청구액이 많을 때만 이의를 제기해 왔다는 사실에 달려 있으므로 사례형이다. topics: 09(재고·소송·부문정보·외부조회·기초잔액)를 실제 요구에서 정했다. 이 물음은 KGA 505만 쓰고 KGA 200을 쓰지 않는다. edition: 20X1 표기이며 KGA 505의 2025 개정 전문(문단 4에 따라 2026년 1월 1일 이후 개시 보고기간 시행)을 기준으로 판단했다. nonduplication: pilot-09-008이 문단 15의 네 조건을, std-points-20260914-f5d37b0c8b8a가 A23 전단을, pilot-09-007 sub1이 문단 7의 네 절차를 모두 사실 없이 재현하게 하는 기준서형이다. 이 물음은 같은 문단을 하람회사의 두 모집단과 무응답 처리 결정에 적용해 어느 결정이 요구를 충족하지 못하는지 가리게 하는 의도된 심화이며, 옳은 항목으로만 쓰인 문단 7과 A23 후단에는 득점 요건이 없다.',
        },
        {
            subquestion_id: 'sub2',
            checks: { ...PASS },
            rationale:
                'source: 대상 갱신본 case-09-confirmation-skepticism-20260918 sub1의 다섯 항목과 네 criterion을 명제·인정 기준 그대로 승계했다. ⑥은 KGA 505 문단 8(a), ⑦은 KGA 200 문단 A23·A24·A25, ⑧은 KGA 505 문단 8(b)와 KGA 200 문단 A21·A24, ⑨는 KGA 505 문단 13·A20, ⑩은 KGA 200 문단 A53·A54에서 확정했다. 새 전제(소매점·대형 유통업체 모집단의 추가)에서 다섯 항목의 옳고 그름을 다시 확정했다. ⑥·⑦·⑨의 잘못은 모두 가온상사 특별약정에 관한 사실(원본을 가온상사만 보관, 요약파일의 관리자 계정 반복 수정, 상반된 설명, 발송 거부)에서 나오고 새 모집단과 무관하다. ⑧도 같은 사실에서 성립한다. ⑩만 대상 표현을 "일반 판매"에서 "소매점 매출거래와 대형 유통업체 매출거래"로 바꾸었고, 물음 1의 소극적 조회는 매출채권 잔액에 대한 실증절차, ⑩은 매출거래에 대한 표본 테스트여서 대상이 겹치지 않는다. 문단 12(각각의 미회신에 대한 대체적 감사절차)는 문단 13과 결론이 갈리는 축이므로 갱신본과 같이 인용·항목에서 제외했다. answer: 모범답안 네 문장이 식별·⑥·⑦·⑨ criterion과 대응하고 옳은 항목 ⑧·⑩의 근거도 제시한다. prompt: 단계 이름과 항목 범위, 요구 형식만 밝힌다. 갱신본의 원 발문("기말감사 중 감사팀의 절차와 판단 ①~⑤ 중 …")은 발문 도입 규칙에 따라 조회 절차의 단계 이름으로 다시 썼다. points: 4점 유지. 갱신본 sub1의 식별 1점 + 세 항목 각 1점을 그대로 보존했고 criterion 명제와 인정·불인정 기준을 바꾸지 않았다. style: 다섯 항목의 옳고 그름이 가온상사 약정의 사실에 달려 있으므로 사례형이다. topics: 09·02·08을 갱신본에서 그대로 유지했다(09: 문단 8·13·A20, 02: 전문가적 의구심, 08: 감사증거의 충분성과 감사노력의 배분). edition: 20X1·20X2 표기이며 2025 개정 전문을 기준으로 판단했다. nonduplication: std-points-20260914-a0ae425fd0b3(문단 8(a))·c2f71f331a7b(문단 8(b))와 draft-09-505-freq01 q2(문단 13)가 사실 없이 재현하게 하는 기준서형이다. pilot-09-007 sub2는 "미회신은 대체적 감사절차로 필요한 감사증거를 얻을 수 있는 상황을 전제로 한다"고 밝혀 두어 이 물음의 ⑨(회신 자체가 필요한 문단 13의 상황)와 전제가 다르다.',
        },
        {
            subquestion_id: 'sub3',
            checks: { ...PASS },
            rationale:
                'source: 대상 갱신본 sub2의 네 항목과 네 criterion을 명제·인정 기준 그대로 승계했다. ⑪은 KGA 505 문단 9, ⑫는 KGA 200 문단 A53과 KGA 505 문단 13, ⑬은 KGA 200 문단 A57 전단, ⑭는 A57 후단에서 확정했다. ⑪이 성립하려면 지배기구가 경영진과 구별되어야 하므로 "하람회사의 지배기구에는 경영에 참여하지 않는 구성원이 있다"는 사실을 그대로 두었다. ⑬과 ⑭는 같은 문단 A57의 서로 다른 명제이며, ⑬(사후 발견 사실만으로는 미준수라고 볼 수 없음)은 ⑭(조작이 정교했다는 사실만으로 준수했다고 결론)의 판단 기준을 알려 주지 않는다. answer: 모범답안 네 문장이 식별·⑪·⑫·⑭ criterion과 대응하고 옳은 항목 ⑬의 근거도 제시한다. prompt: 조회 절차에서 입수한 증거의 평가와 종결·발행 후 검토라는 단계 이름, 항목 범위, 요구 형식만 밝힌다. points: 4점 유지. 갱신본 sub2의 배점과 인정·불인정 기준을 그대로 보존했다. style: 네 항목의 옳고 그름이 지배기구 구성, 회신 미입수, 나래상사 회신의 조작이라는 사실에 달려 있으므로 사례형이다. topics: 09·02·08을 갱신본에서 그대로 유지했다. edition: 20X1·20X2 표기이며 2025 개정 전문을 기준으로 판단했다. nonduplication: std-points-20260914-a2dcdc9faa17이 문단 8(c)·9의 절차와 커뮤니케이션 상대를 사실 없이 제시하게 하는 기준서형이다. 이 물음은 경영진에게만 통보한 실제 조치와 지배기구 구성이라는 사실을 연결해야 한다.',
        },
    ],
    observations_not_blocking: [
        '옳지 않은 항목의 수가 세 물음 모두 3개다. 확장 재료 70번의 독립 요구가 정확히 세 개(문단 15(a)·15(b)·A23 전단)이고, 줄이면 검증된 요구를 버리게 되며 늘리려면 두 원 세트에 없는 새 요구를 만들어야 한다. 대상 갱신본의 두 물음은 이미 게시된 판본이라 항목 구성을 바꾸지 않았다. 발문에는 수를 밝히지 않고 물음별 전체 항목 수는 5·5·4로 다르다. 정본에도 물음별 옳지 않은 항목 수가 같은 선택형 세트가 있다(case-16-kam-emphasis-20260919는 3·3·3, case-12-report-date-subsequent-20260919는 2·2·2). 배정 지시는 "물음마다 다르게 둔다"였으므로 이 점은 보고에 적는다.',
        'KGA 505 문단 15의 네 조건 가운데 15(c)·15(d)는 사실관계에서 충족시켜 쟁점에서 뺐다. 조건을 하나씩 불충족시키는 항목을 더 두면 소극적 조회의 조건 목록을 사실상 열거하게 되어 한 항목이 다른 항목의 판단 기준을 알려 준다. 두 조건은 pilot-09-008 sub2가 기준서형으로 계속 다룬다.',
        '옳은 항목 ⑤(회신 유인의 방향)는 KGA 505 문단 A23 후단의 예시가 은행 예금주(채권자)를 대상으로 서술되어 있어, 예시 문장을 그대로 외운 답안은 옳지 않다고 고를 수 있다. 매출채권의 조회처는 채무자이므로 방향이 반대이며 사실관계의 소매점 대응 양상으로 확정했다. 이 함정을 잘못 고르면 식별 1점만 잃고 다른 항목의 이유·절차 점수는 유지된다.',
        '옳은 항목 ③은 KGA 505 문단 7을 근거로 하며 이 초안에서 유일하게 새로 발췌한 인용이다. 문단 7은 옳은 항목의 근거로만 쓰이고 득점 요건이 없으므로, 이 인용이 없어도 물음 1의 네 criterion은 문단 15·15(a)·15(b)·A23만으로 확정된다.',
        'fact5의 나래상사는 소매점·대형 유통업체·특별약정 가운데 어느 쪽인지 적지 않았다. 대상 갱신본의 표현("기존 거래처인 나래상사")을 그대로 두었고 이 구분은 어느 criterion에도 쓰이지 않는다. 20X1년 감사에서 나래상사에 적극적 조회를 수행하였다는 사실은 물음 1의 ①·②(소매점·대형 유통업체에 대한 소극적 조회 결정)와 대상이 다르므로 모순이 아니다.',
        '70번 fact4의 전자 열람기록은 이 초안의 사실에서 뺐다. 문단 A23 전단이 수령과 정확성 검증을 모두 부정하므로 열람 기록이 없어도 ④의 판단이 성립하고, 열람 기록을 남기면 항목의 잘못이 "검증 여부" 하나로 좁혀져 criterion의 인정 범위(수령 또는 검증 어느 쪽을 들어도 인정)와 어긋난다.',
        '대상 갱신본의 태그에 있던 "전문가적 의구심"은 물음 2 ⑦의 근거를 가리킬 수 있어 새 태그에서 뺐다. 제목도 특정 약정이 아니라 매출채권 외부조회의 단계로 바꾸었다.',
    ],
    unresolved_content_findings: [],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, 'root-content-review-v1.json');
fs.writeFileSync(outPath, `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' });
console.log('written', path.relative(root, outPath));
