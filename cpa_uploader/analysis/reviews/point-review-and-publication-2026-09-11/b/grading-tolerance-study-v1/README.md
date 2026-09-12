# 물음별 ±1점 수락 근거 계약 검토

현재 코드를 바꾸지 않고 원 검수 receipt를 보존하는 별도 수락 기록을 추가할 수 있다. 다만 현재 승급 명령은 그 기록을 읽지 않으므로 **지금 이 파일이나 prototype만으로 승급할 수 없다**. 본 검토는 API 0회이며 정본·정책·원 receipt·승급 장부를 수정하지 않았다. 사람의 내용 확인도 수행하거나 기록하지 않았다.

## 실제 코드에서 확인한 제약

- `questionReviewGrading.ts:146`의 `validateReviewGrading`은 실행 형상, 모델·코드·사례 해시, 모든 사례·빈 답안, 답안·기대값, raw judgment 형상, 생산 합산 재현을 검사한 다음 `matches(...) && run.matched === true`를 강제한다. R4 B의 원 receipt는 실제로 이 마지막 조건 1건 때문에 거절된다.
- `questionSemanticReview.ts`의 aggregate/verdict는 의미검수 단위·사례 결과다. 점수의 경미한 오차를 별도 수락해도 의미검수 pass를 바꿀 필요가 없다. 반면 신규 `validateSemanticReviewReceipt`뿐 아니라 과거 `validateRecordedSemanticReview`도 strict grading 검사에 들어가므로 둘 다 새 명시적 계약을 이해해야 한다.
- `promote_cpa_v3.ts`는 검수 후 장부에 원 receipt를 저장하고 다시 장부를 검사한다. 명령에서만 오류를 무시하면 후속 장부 검사·컴파일에서 실패한다. `questionBankPublication.ts`의 장부 읽기와 현재/게시 상태 검사까지 동일한 수락 근거를 결속해야 한다.
- 기존 author-QA CLI는 대상 물음의 모든 criterion 기대값과 합계를 검증한다. 다른 물음 답안은 빈 문자열이다. 그러나 helper의 `matched`는 대상 verdict와 전체 합계를 대조하므로 별도 수락 검사는 다른 물음까지 각각 0점임을 확인해야 한다. `expected_by_subquestion`이 있다면 별도로 검증하며, 없으면 검증된 대상 기대표와 실제 빈 답안에서만 완전 표를 구성한다.
- 생성 사례의 `run.expected`는 같은 답안에 대한 대상 criterion 일부만 들어간다. 이를 전체 기대점수로 합산하면 안 된다. 엄격 일치 결과와 별개로, 점수 편차로 수락할 불일치에는 전체 답안·모든 물음·모든 criterion을 대조한 추가 기대 근거가 필요하다.

## 최소 production 변경안

1. `questionReviewGrading.ts`: 내부 검사 결과를 `integrity_errors`, `strict_mismatches`, `verified_runs`로 분리한다. 기존 export는 기본적으로 두 오류를 그대로 합쳐 지금과 같은 strict 결과를 반환한다. 오류 메시지 문자열을 지우거나 `run.matched`를 변경하지 않는다. raw·trace 검증 실패는 절대로 `strict_mismatches`에 넣지 않는다.
2. 신규 `questionGradingAcceptance.ts`: 선택된 정책·원 receipt·실제 raw/trace·전체 기대 근거를 읽는 production adapter와 순수 범위 검사를 둔다. 서류에 쓰인 `security_clear:true` 같은 선언을 신뢰하지 않고 실제 raw, trace, 재합산에서 확인한다. 별도 수락은 모든 비점수 검사가 통과한 `strict_mismatches`만 해소한다.
3. `questionSemanticReview.ts`: 명시적 선택 인자 `gradingAcceptance`를 추가한다. 현재 은행/내용/계획/출처·의미검수 검사 후 grading의 typed mismatch에만 적용한다. 인자가 없으면 현재 결과와 완전히 동일하다. 과거 읽기는 장부에 봉인한 수락 근거를 사용하고 현재 환경변수의 정책으로 옛 수락을 다시 해석하지 않는다.
4. `questionBankPublication.ts`: 새 verified entry에 `grading_acceptance`, `grading_acceptance_hash`를 선택 필드로 추가한다. 정책 원문·근거 표를 수락 문서에 함께 보존하고 외부 증거 파일의 바이트 해시를 연결한다. published entry도 해당 해시를 이어받는다. 원 receipt와 `review_receipt_hash`는 그대로다. 수락 문서 누락/변조/원 receipt 불일치면 장부 읽기와 게시 검사가 실패해야 한다.
5. `promote_cpa_v3.ts`: `--grading-acceptance <document.json>`를 명시적으로 받는다. 문서, 원 receipt, 정책, 입력, 모든 증거 파일을 기존 쓰기 전후 guard에 추가한다. 사람이 실제로 확인한 내용 근거는 기존의 별도 필수 절차로 유지한다. 수락 문서가 사람 확인을 대체하지 않는다.

관련 테스트는 새 validator의 단위 검사와 `questionSemanticReview`/publication/promotion CLI의 strict 호환·수락·과거 읽기 통합 검사다. 이번 로컬 prototype은 이 production adapter의 구현이 아니다.

## 수락 문서의 필요한 결속

문서에는 다음을 원문과 해시로 묶는다. JSON canonical hash와 파일 바이트 SHA-256은 별도다.

- 정책 ID·고정 정책 파일 SHA·정책 내용, 고정 119 대상 집합, 모델 Luna, 물음당 상한 1, 수락 결과 `accepted_with_grading_deviation`.
- 세트 ID·원 검토 내용 hash·source 파일 hash·은행 hash·context/plan/packet hash·실행 manifest/runtime 및 코드 파일 hash.
- 원 semantic/grading receipt의 경로·파일 SHA·receipt hash·원 cases hash. 별도 author QA는 원 QA/inputs/summary의 경로·SHA 및 실제 사례 ID를 추가한다.
- 원 run ID, 원 답안 hash, 원 기대표 hash, 원 `matched`/점수. 정상/불일치/추가 관측을 모두 담은 고정 관측 목록과 각 raw/trace/request/schema/result 해시. 실제 수행한 관측을 뒤늦게 선택적으로 빼지 못하게 summary와 실행 목록까지 대조한다.
- 기대 산출 방법 `complete_exact_expectation` 또는 `conservative_criterion_bounds`, 모든 criterion의 허용 기대 점수 집합/범위·근거, 전체 물음의 기대 합계 범위. 독립 명제의 근거 출처·claim·조건·주체·예외와 답안 구간을 함께 기록한다.
- 검토 주체는 `agent_source_review` 등 실제 수행 방식으로 표시하고 `human_confirmation:false`를 유지한다. `selected_review_evidence`는 선택된 검토 자료라는 뜻이며 사람 승인이나 자동 의미 검증이 아니다. 총괄이 실제 근거와 답안 대응을 확인한 파일의 SHA를 선택 장부에 연결한다.
- 문서의 self hash와 후속 장부의 동일 hash. 관측·근거 경로는 실제 존재하는 허용된 배치 경로로 정규화하고 경로 이탈·심볼릭 링크·미존재 파일을 거절한다. 파일 hash만으로 출처 의미의 정확성이 증명된다고 취급하지 않는다.

수락 문서는 별도 artifact이고 원 receipt schema 안에 끼워 넣지 않는다. 기존 production grader와 prompt는 수정 대상이 아니다. 따라서 내용·모델·입력·채점 코드가 그대로인 기존 유효 호출은 재사용 가능하며 새 API는 필요하지 않다. 실행용 worker의 전체 코드 guard는 현재 그대로 유지한다. 추후 validator/promotion 코드 변경이 포함된 새로운 잠금을 만들더라도 옛 manifest 자체를 고치지 않고 실행 시점의 신원과 새 수락 도구의 신원을 각각 기록한다.

## 보수적 범위 증명

각 criterion의 타당한 기대점수 범위를 원문·발문·rubric·답안 전체에서 먼저 정한다. 그 범위가 실제 기대를 포함한다는 검토 근거가 필요하다. 실제 점수를 보고 유리한 한 해석만 고르거나 범위를 좁히면 안 된다. 애매한 1점 criterion은 `[0,1]`로 두며 원 target expected는 그대로 보존한다. 여러 criterion의 상관관계를 이용해 더 좁은 합계 범위를 주장하는 방법은 이번 최소안에 포함하지 않는다.

각 물음에서 `L = Σ criterion_min`, `U = Σ criterion_max`라 하고, **모든 실제 관측**에 대해 `max(|actual−L|, |actual−U|) ≤ 1`이어야 한다. 이것은 기존 ±1 정책보다 약한 보장이 아니므로 새 허용폭을 정하는 정책 변경이 아니다. 충분한 근거가 없으면 넓은 범위로 남기고 최악 편차가 1을 넘으면 거부한다.

- A의 실제 자료: `a/resume-review-2026-09-12/r4/canary-generated-tolerance-bound-review.json` SHA `53dd0825ec000f69814d85bfdb1db57a23cfcac7550de7c7fcf07ebd32df4470`. c1은 0, c2/c3는 각각 0..1, 따라서 물음1 기대 0..2와 실제1의 최대 차이는1이다. 물음2는 빈 답안0이다. 정확 기대0을 만들 필요가 없다.
- 기대 0..3과 실제1이면 최대 차이2이므로 거부한다. 실제가 기대 범위 안에 있다는 사실만으로 수락하면 안 된다.
- B 적시 누락은 전체 기대2에 대해 실제3/2/3이다. 세 관측 모두의 차이1/0/1을 기록하고, 중간의 strict pass만 남기지 않는다.
- 한 물음 +1, 다른 물음 −1이 상쇄되어 세트 총점이 같아도 각 물음을 따로 검사한다. 빈 답안은 허용폭을 이유로 1점을 정상 처리하지 말고 기존 생산 무호출 0점 계약을 그대로 확인한다.

## 거부 경계와 후속 검사

의미검수 nonpass, 문항·모범답안·배점·직접 출처의 결함, 미완료/실패 모델 요청, 응답 형상·ID·인용 검증·보관 오류, 원시 또는 최종 보안 오탐은 점수 수락으로 해소하지 않는다. 미확인 full expectation도 actual에 맞춰 채우지 않는다. 같은 점수의 verdict 차이도 strict 결과에는 남으며 수락 문서는 그 차이를 숨기지 않는다.

미래 production 검사는 (a) 의미검수·출처·입력 정상, (b) 원 strict 결과·원시 재현 정상, (c) 관측 전체 목록 완전, (d) 검토된 완전 기대 근거, (e) 모든 물음/관측의 최악 차이, (f) 원본·정책·수락 장부의 hash 결속 순서다. 적용된 수락이 아무 의미검수 오류나 사람 확인 절차를 건너뛰지 않는 통합 반례가 필요하다.

## 이번 로컬 검사

`study.mjs`와 `bounds-prototype.mjs`는 현재 B actual receipt가 신규/과거 strict 검증에서 여전히 실패함을 확인하고, 합성 입력으로 범위·결속·전체 관측·보안/실행 배제 경계만 시험한다. 실제 A의 보수적 범위와 B 3/2/3의 산술도 대조한다. 합성 trusted adapter 입력을 실제 증거로 저장하거나 통과 receipt로 만들지 않았다.

`checks.json`에 검사별 결과와 보호한 입력 hash가 있다. 첫 로컬 실행에서 prototype의 criterion `id`→`criterion_id` 매핑 누락을 발견해 자기 prototype만 수정한 뒤 재검사했다. 공통 코드와 실제 검수·채점은 바뀌지 않았다. API 추가 0, 승급 0, 사람 확인 기록 0이다.
