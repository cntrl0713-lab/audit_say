# 기존 관측 66개 재사용 계약 독립 검토

검토자: `plan_foundations`(agent, 사람 검수 아님). 최종 코드 대조 시각: 2026-09-12 12:25 KST. 실제 API 호출 0회, 공통 코드·원문·QA·기존 실행 증거 수정 0건. 이 문서만 새로 작성했다.

**결론: 이번 66개 관측의 재사용에서 판정 입력·기대값·모델·채점 코드·원응답의 변경 또는 누락을 우회 수락하는 실질적 결함은 발견하지 못했다.** 검토 중 발견한 과거 receipt 읽기 호환성 문제는 총괄에게 전달했고, 아래 최종 코드에서 보완된 경로를 다시 읽었다. 이는 준비·수락 계약에 대한 검토이며 남은 실제 채점, 전체 batch 봉인, 운영 DB 반영의 완료를 뜻하지 않는다.

## 검토 대상과 판본

| 대상 | 읽은 SHA-256 / 범위 |
| --- | --- |
| `cpa_uploader/questionEfficientReview.ts` | `142a5a6292d31188fd3bb5f8f4365705e9ed79208c1bfaa778264d7a52344ff3` |
| `tests/questionEfficientReview.test.ts` | `49db9280e2b28ba3b60bd31f52c53c6b617b24155ff7ca7b54130b584c8b4cbc` |
| `candidate-v2/grading-manifest.json` | `7324407579f6e9796c801f80988ca9510c3300ab41af5f8766f9c5afab2224f3` |
| 원 `candidate-v1/grading-manifest.json` | `5920ef24babb0fb11a83322f280da66282a33b11f02ad7f87a3d6ebce62fce99` |

여기서 `candidate-*`는 이 검토 묶음인 `efficient-verification-2026-09-12` 아래 경로다. 최종 코드는 검토 중 총괄이 반영한 과거 기록 호환성 보완을 포함한다. `candidate-v2`는 그 직전의 API 미실행 준비본으로 보존되며, 위 코드에 맞는 새 실행 잠금은 총괄의 후속 준비 대상이다. 이 문서는 기존 manifest의 코드 해시를 새 값으로 바꾸어 수락하지 않는다.

`validateReusableEfficientObservation`, `replayObservation`, `validateBatch`, 새 수락/과거 receipt 읽기 경로, 관련 테스트를 직접 읽었다. `prepare-resume-v2.ts`와 검증 context의 마지막 불변성 검사 호출 위치도 읽기 전용으로 확인했다. 이 독립 검토에서 테스트나 실행기를 다시 실행하지 않았다.

## 계약별 대조

| 경계 | 실제 확인한 수락 조건 | 판단 |
| --- | --- | --- |
| 원 실행 계보 | 명시된 reuse 항목이 원 manifest 및 observation의 파일·SHA에 연결된다. observation에 남은 manifest는 새 실행으로 덮어쓰지 않으며 원 manifest와 일치해야 한다. | 원 실행의 소속 변경을 허용하지 않는다. |
| 판정 입력·기대값 | 원/신 manifest의 선택 entry 전체를 비교한다. 답안, 평가 물음, expected 값, 대표 선택 근거까지 동일해야 한다. observation의 답안/기대값, 저장 input도 재대조한다. | 답안이나 기대표만 바꾼 기존 결과의 재사용을 거절한다. |
| 문항·출처·학습 단위 | 은행/분류 identity가 원 실행과 같아야 한다. 원 inputs와 출처 파일의 실제 SHA를 읽으며, 현 은행·분류로 학습 단위를 재구성해 저장 projection 및 prompt/schema와 대조한다. | 문항·부모 사실·분류 또는 출처 바이트 변경을 숨길 수 없다. |
| 모델·8개 채점 파일 | 원/신 모델이 같고 실제 관측·전송 모델은 Luna여야 한다. 8개 grading 파일은 원/신 identity가 같고 누락이 없어야 하며 새 수락에서는 현재 실제 파일도 검사한다. 원 실행의 전체 코드 보존 사본도 확인한다. | consumer/기록기 보완과 grading 동작 변경을 구별한다. |
| 실제 요청·원응답 | 생산 prompt/schema를 재구성하고 실제 전송의 전체 허용 파라미터와 비교한다. response ID/model/status/output 배열/output_text, trace, usage를 연결한다. raw를 schema 검증·grounding한 뒤 생산 채점 함수로 다시 합산한다. | 저장 점수·strict/허용 판정만 가져오는 수락이 아니다. |
| 재시도·보안 | 요청/응답의 순서, 최대 2번의 생산 프로토콜 시도, 앞선 오류와 trace를 확인한다. 성공한 첫 응답을 품질 재시도로 교체하거나 quota/보안 문제를 점수 허용 범위로 넘길 수 없다. | 유효 원관측 보존과 실패 은폐 방지 조건이 있다. |
| 전체 batch 누락·중복 | 고정 scope와 내용 검토 물음/criterion/source 범위, 전체 entry와 observation의 일치, reuse 중복·누락, 같은 요청의 중복, 대표 유형별 물음 coverage를 확인한다. | 일부 결과를 빼거나 같은 결과를 여러 번 세어 분모를 줄이는 경로를 발견하지 못했다. |
| 내용 검토·±1 정책 | 8개 내용 checks는 모두 pass이고 미해결 내용 결함이 없어야 한다. ±1 밖의 실제 결과에는 별도 내용 재검토 및 grading consistency 근거가 필요하고 최종 비율을 재계산한다. | ±1/95%를 내용·출처·기대값 오류 수용으로 확대하지 않는다. |

8개 grading 파일은 `lib/questionV3Grading.ts`, `lib/questionV3Evidence.ts`, `lib/questionV3.ts`, `lib/questionV3Answer.ts`, `lib/ai/openaiStructured.ts`, `lib/learningUnits.ts`, `lib/learningSubmission.ts`, `scripts/build-learning-unit-catalog.ts`다. 실제 `candidate-v1`/`candidate-v2`에서 8개 identity가 모두 같고 현재 파일 해시와도 일치했다.

전체 batch 경로의 새 수락은 `createEfficientReviewReceipt(..., newAcceptance=true)`에서 현재 manifest의 전체 code 파일까지 검사한다. 과거 기록 읽기는 보존 사본을 사용한다. context 캐시 후 파일이 달라지는 경우를 놓치지 않도록 마지막 `assertEfficientEvidenceUnchanged`가 필요하며, 확인한 preparation/runner/seal/promotion 경로에는 이 호출이 있다. 독립 helper 한 번의 성공을 전체 batch 수락으로 대체해서는 안 된다.

## 실제 66개 보존 자료 대조

- 새 준비 manifest의 전체 entry는 738개, reuse는 66개다. 기대값을 정정한 `pilot-02-007--case--partial`은 재사용 대상에 없다.
- 66개의 원/신 선택 entry가 완전히 같았고, observation의 답안과 원 expected도 66개 모두 새 선택 entry와 같았다. 은행/분류 identity도 원/신이 같다.
- 원 manifest 1개와 observation 66개, 저장 input/transport/traces 각 66개, 총 265개 서로 다른 파일의 실제 SHA를 대조해 오류 0건을 확인했다.
- 보존된 실제 요청은 66개, provider 응답은 66개, trace와 usage도 각각 66개다. provider response ID 66개는 모두 고유하고 누락이 없다. 새 API 호출이나 복제 receipt를 응답 수에 더하지 않았다.
- 과거 66개 transport JSON에는 SDK의 비열거 `_request_id`가 직렬화되지 않았고 별도 `response_metadata`도 없다. usage에는 request ID가 66개 모두 남아 있다. 따라서 **당시 누락된 header를 raw JSON과 다시 대조했다고 주장하지 않는다.** 계약은 그 header의 부재만 허용하고, 실제 response ID/model/status/usage 및 본문·trace 동일성은 계속 검사한다. 새 형식에 header metadata가 존재하면 usage와 불일치를 거절한다.

## 검토 중 발견한 문제와 보완 확인

초기 코드에서는 과거 receipt 읽기에서도 reuse helper가 8개 현재 grading 파일을 무조건 읽었다. 이 때문에 현재 코드에 바이트 변경만 생겨도 보존 사본이 있는 과거 재사용 receipt를 거절할 수 있었다. 현재 66개에 잘못된 응답을 받아들이는 결함은 아니지만, 과거 기록 보존·읽기 계약과 충돌하므로 총괄에게 알렸다.

최종 코드에는 다음 구별이 반영되어 있다: 공개 reuse helper의 기본은 새 수락, cache key에 `newAcceptance` 포함, 내부 batch의 과거 증거 검사는 보존 사본 사용, 새 receipt 수락 끝에서는 현재 전체 코드 검사 유지. 추가 테스트는 보존 receipt를 만든 뒤 grading 파일에 주석만 더한 경우 과거 읽기는 허용하고 새 수락은 거절하는 계약을 명시한다. 이 보완과 테스트 본문을 직접 다시 읽었으며, 테스트 실행 결과는 총괄의 별도 검사 기록에 따른다.

이번 읽기 검토에서 그 밖의 중대한 변경·누락 우회 수락 문제는 발견하지 못했다. 파일·응답의 해시는 저장된 계보의 무결성을 검증하는 것이며 독립된 제공자 전자서명은 아니다. 이 검토는 지정된 기존 고정 자료와 현재 준비 경로를 전제로 한다. 남은 672개 entry의 실제 결과, 기대값 정정 항목의 표적 채점, 최종 95% 집계와 봉인은 이 문서의 완료 범위에 포함하지 않는다.
