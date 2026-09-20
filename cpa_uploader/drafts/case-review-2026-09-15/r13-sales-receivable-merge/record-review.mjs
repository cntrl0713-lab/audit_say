// r13 초안의 agent 내용검토 장부 기록기. 실제 대조를 마친 뒤 한 번만 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r13-sales-receivable-merge/record-review.mjs
//
// 출력: cpa_uploader/analysis/reviews/case-review-2026-09-15/r13/root-content-review-v1.json

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const DRAFT_DIR = 'cpa_uploader/drafts/case-review-2026-09-15/r13-sales-receivable-merge';
const OUT_DIR = path.join(root, 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r13');
const SET_ID = 'case-08-sales-receivable-20260920';

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
        'cpa_uploader/data/official/delegated-n03-kga330-2025.txt',
        'cpa_uploader/data/official/delegated-s02-kga330-2025.txt',
        'cpa_uploader/data/official/kga500-2025-review08.txt',
        'cpa_uploader/data/official/delegated-n02-kga315-2025.txt',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
        'cpa_uploader/drafts/case-review-2026-09-15/r12-analytical-procedures-merge/sets.json',
        'docs/물음별-학습-단위와-분류-계약.md',
        'docs/case-question-edit-notes-2026-09-14.md',
    ].map(ref),
    method_detail:
        'KGA 330 문단 6~12·16~18과 적용자료 A4~A19·A20~A22, KGA 500 문단 6~11과 적용자료 A30~A35·A59~A62, KGA 315 문단 A190을 등록 전문에서 직접 읽고 열다섯 항목의 옳고 그름을 문단 단위로 확정했다. 인용 스물네 개 가운데 스물세 개는 병합 대상 세 원 세트(pilot-08-006, pilot-08-007, pilot-07-008)의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 함정 ③의 근거인 KGA 330 문단 8만 같은 등록 전문(delegated-n03-kga330-2025.txt L73-L82)에서 발췌해 SHA-256을 계산했다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했다. 현재 정본에서 이 문단들을 인용한 세트를 모두 찾아 대조했으며(KGA 500 문단 9·A60·A61·A62는 pilot-08-006과 pilot-07-008, A31·A32와 KGA 315 A190은 pilot-08-007, KGA 330 A11·A15·A19는 pilot-07-008뿐이고 KGA 330 문단 8·16·17·A4를 인용한 세트는 없었다), 문단 인용이 없어도 요구가 겹칠 수 있는 pilot-08-003·case-07-control-evidence-20260914·case-10-control-sample-frame-20260914·case-09-unrecorded-liabilities-20260914·pilot-09-007의 발문과 criterion을 함께 읽었다. 같은 날 만든 r12 초안(case-10-analytical-procedures-20260920)의 sets.json도 읽어 항목 ②의 득점 요건과 이 초안의 요구를 분리했다. 판본은 세 원 세트가 남긴 2026 전문 대조 기록을 재사용했고 새 원자료 수집은 하지 않았다.',
    questions: [
        {
            subquestion_id: 'sub1',
            checks: { ...PASS },
            rationale:
                'source: ①은 문단 17(a)~(c)(이탈이 발견되었을 때의 구체적 질문과 세 가지 결정), ②는 문단 16(실증절차에서 왜곡표시가 발견되지 않았다고 하여 관련 통제가 효과적이라는 감사증거를 제공하는 것은 아님), ③은 문단 8(a)·(b)와 A4(b), ④는 문단 7(a)·A10에서 확정했다. ③에 대하여 문단 8의 두 요건을 사실과 하나씩 대조했다. (a)는 감사팀이 매출·매출채권 관련 통제에 계획한 정도로 의존할 수 없다고 판단하여 더는 통제의 운영효과성을 테스트하려는 경우가 아니고, (b)는 위험평가 단계에서 실증절차만으로는 충분하고 적합한 감사증거를 제공할 수 없는 위험을 식별하지 않았다는 자료의 사실로 배제된다. 문단 9(통제에 크게 의존할수록 더 설득력 있는 증거)와 문단 18(평가된 위험과 관계없이 유의적 항목에 실증절차를 수행)도 함께 읽어 ③의 판단을 다투게 하지 않음을 확인했다. answer: 모범답안 두 문장이 식별·② criterion과 1대1로 대응하고 옳은 항목 ①·③·④의 근거도 함께 제시한다. prompt: 발문은 자료 범위와 요구 형식만 밝히고 옳지 않은 항목의 수·내용을 알려 주지 않는다. points: 식별 1점 + 옳지 않은 항목 한 개 1점으로 2점이며, 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓰면 인정한다. 구체적 후속절차의 나열은 요구하지 않는다. style: 네 항목의 옳고 그름이 세림에서 확인된 이탈의 내용, 실증절차만으로 충분한 증거를 얻을 수 있는지에 관한 위험평가 결과, 위험을 낮게 평가한 이유라는 사실에 달려 있으므로 사례형이다. topics: 07(평가위험 대응·통제테스트·실증절차)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: 현재 정본에서 KGA 330 문단 16·17·8·A4를 source_ref로 인용해 득점 요건으로 삼은 세트는 없다. case-07-control-evidence-20260914 sub3은 같은 청구서를 조사한 이중목적테스트에서 금액 대조 결과와 승인서명 검사 결과를 구별하도록 요구하는 것이고, 이 물음의 ②는 별개의 실증절차 결과를 통제 의존의 근거로 삼은 결정을 다룬다.',
        },
        {
            subquestion_id: 'sub2',
            checks: { ...PASS },
            rationale:
                'source: ⑤는 문단 A6(시기의 정의)·A11(위험이 높을수록 보고기간말 또는 근접 시기가 더 효과적)·A14(시기에 영향을 미치는 요인), ⑥은 문단 7(b)(위험평가 수준이 높을수록 더욱 설득력 있는 감사증거)·A15(위험이 증가할수록 범위도 증가)·A19(증거의 양 증가 또는 제3자·다수의 독립적 원천), ⑦은 문단 A7(범위의 정의)·A15와 KGA 315 문단 A190(a)(iv)(기간귀속), ⑧은 문단 A13(재무제표 작성과정에서 발생된 조정사항의 검토는 보고기간말 또는 그 이후에만 수행될 수 있는 절차로 예시), ⑨는 KGA 500 문단 6(상황에 적합한 절차)·A35(신뢰성 일반화에 중요한 예외가 있음)에서 확정했다. 문단 A12(기중 수행의 이점)를 함께 읽고, ⑤와 결론이 갈리는 옳은 항목을 두지 않았음을 확인했다. answer: 모범답안 네 문장이 식별·⑤·⑥·⑦ criterion과 대응하고 옳은 항목 ⑧·⑨의 근거도 제시한다. prompt: 자료 범위와 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이며, ⑤(시기)와 ⑥(범위)은 독립된 잘못이어서 항목을 나누었다. 구체적인 조회 수량이나 추가 일수는 요구하지 않는다. style: 다섯 항목의 옳고 그름이 통제테스트 결과, 보고기간말 기준 조회의 실행가능성, 중요성·확신수준에 변화가 없다는 사정, 국내 5일·국외 20~30일의 인수기간과 계약상 인식 시점이라는 사실에 달려 있으므로 사례형이다. topics: 07(시기·범위의 재결정), 09(매출채권 외부조회 계획), 08(기간귀속 주장의 증거)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: 현재 정본에서 KGA 330 A11·A15·A19를 사례에 적용한 세트는 병합 대상 pilot-07-008뿐이다. pilot-09-007은 KGA 505 문단 7의 조회 통제 유지 절차를 열거하게 하는 기준서형이고, case-09-unrecorded-liabilities-20260914 sub3은 매입 쪽 후속지급 검사의 기간귀속 확인이어서 이 물음의 대상기간 조정과 다르다.',
        },
        {
            subquestion_id: 'sub3',
            checks: { ...PASS },
            rationale:
                'source: ⑩은 문단 A31(정보의 관련성은 테스트의 방향에 영향을 받음)·A32(특정 주장에 관련성 있는 절차가 다른 주장에는 그렇지 않을 수 있음)와 KGA 315 문단 A190(a)(ii)(완전성), ⑪은 문단 9(b)·A62(감사목적에 충분히 정확하고 세부적인지), ⑫는 문단 9(a)·A60(모집단이 완전하지 않으면 테스트 결과의 신뢰성이 낮음), ⑬은 문단 A61 첫 문장(증거의 수집은 해당 정보에 적용되는 실제 감사절차와 동시에 수행될 것), ⑭는 문단 9(a)·A61 두 번째 문장과 A35(내부생성 증거는 관련 통제가 효과적일 때 신뢰성이 증가), ⑮는 문단 11에서 확정했다. ⑬과 ⑭는 같은 A61을 쓰지만 근거 문장이 서로 다르고(수집 시기 / 통제테스트로 증거를 얻을 수 있는 상황), 한쪽의 결론이 다른 쪽의 판단 기준을 알려 주지 않음을 확인했다. ⑭가 옳다고 다투어지지 않도록 연령분석표를 생성하는 프로그램이 무승인 변경·접근이 확인된 프로그램이라는 사실을 자료에 두었고, A61이 같은 문장에서 "감사인이 추가적인 감사절차가 필요하다고 결정하게 되는 상황도" 있다고 밝히는 점을 대조했다. answer: 모범답안 다섯 문장이 식별·⑩·⑪·⑫·⑭ criterion과 대응하고 옳은 항목 ⑬·⑮의 근거도 제시한다. prompt: 자료 범위와 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 네 개 각 1점으로 5점이다. ⑪(문단 9(b) 목적 적합성)과 ⑫·⑭(문단 9(a) 정확성·완전성 증거)는 같은 문단의 서로 다른 하위 요구여서 합치지 않았다. style: 여섯 항목의 옳고 그름이 매출원장과 별도로 관리되는 출고·인도 자료의 존재, 연령분석표가 반올림한 총액만 표시한다는 점, 모듈이 같은 원천자료를 공유한다는 점, 그 보고서를 생성하는 프로그램에서 무승인 변경·접근이 확인되었다는 사실에 달려 있으므로 사례형이다. topics: 08(감사증거와 경영진주장)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: pilot-08-003 sub1은 KGA 500 문단 9의 네 요구를 사실 없이 재현하게 하는 기준서형이고 이 물음은 같은 문단을 세림의 연령분석표에 적용해 어느 절차가 요구를 충족하지 못하는지 가리게 한다(원 pilot-08-006도 이 관계를 의도된 심화로 기록했다). 같은 날 만든 r12 초안 case-10-analytical-procedures-20260920의 항목 ②는 실증적인 분석적절차의 기대치를 도출할 데이터의 신뢰성 평가(KGA 520 문단 5(b)·A12·A13)를 득점 요건으로 두는데, 이 물음은 KGA 520을 인용하지 않고 세부테스트·대손충당금 검토 대상 선정에 이용하는 자료의 목적 적합성(⑪)과 기초자료·추출조건의 정확성·완전성(⑫·⑭)만 다루므로 득점 요건이 겹치지 않는다. case-10-control-sample-frame-20260914 sub1은 통제테스트 표본의 모집단 문제(KGA 530)이고 ⑩은 실증절차의 테스트 방향 문제다.',
        },
    ],
    observations_not_blocking: [
        'KGA 330 문단 8(b)가 참조하는 적용자료 A23·A24는 등록된 발췌(delegated-s02-kga330-2025.txt, A22까지)에 들어 있지 않다. ③의 판단은 문단 8 본문의 두 요건과 자료의 위험평가 사실, 문단 A4(b)로 확정했으며 A23·A24의 내용이 필요한 요구는 이 세트에 없다.',
        '원 pilot-08-007 sub2가 요구하던 기초자료의 관련성·신뢰성 확인(crit11·crit12)은 별도 항목으로 두면 ⑩의 정답을 알려 주므로 목록에 두지 않았다. 그 취지는 ⑩의 보완절차 득점 요건과 ⑮(옳은 항목, KGA 500 문단 11)에 남아 있다.',
        '물음 1은 옳지 않은 항목이 하나뿐이어서 2점이다. 옳지 않은 항목을 더 넣으려면 함정 ③과 같은 기준에서 결론이 갈리는 항목을 두어야 하므로 늘리지 않았고, 세 물음의 옳지 않은 항목 수를 1·3·4로 달리 두었다.',
        '득점 요건에서 빠진 함정 ③·⑨·⑬의 판단은 식별 criterion에서만 평가된다. 함정을 옳지 않다고 고른 답은 식별 점수만 잃고 다른 항목의 이유·절차 점수는 유지된다.',
        '⑨는 국외 거래의 인수 시점을 확인한다는 사실을 담고 있어 ⑦의 판단에 필요한 배경을 다시 드러낸다. 다만 계약상 인수 시점이 인식 시점이고 국외 운송·인수가 20~30일이라는 점은 자료 2의 배경 사실로 이미 주어져 있어 ⑨가 새로운 판단 기준을 알려 주지는 않는다.',
    ],
    unresolved_content_findings: [],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'root-content-review-v1.json'), `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' });
console.log('root-content-review-v1.json 기록:', review.target.reviewed_content_sha256);
