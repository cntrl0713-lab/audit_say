# 학습 단위 구현 독립 검토

신규 학습 단위 SQL과 제출·조회 코드를 읽고 로컬 격리 검증을 수행했다. **초기 입력에서 구체적인 경계 2건을 확인했다.** 아래 후속 정책에 따라 구형 로컬 답안 복구 지적은 유지 대상에서 제외했다. 검토자가 구현·문항·DB 이관 입력을 수정하지는 않았다. API 및 원격 DB 호출은 0회다.

## 후속 상태

보고서 작성 중 총괄이 사용자의 새 지시인 “예전에 세트 전체로 제출한 답안은 삭제해도 돼”를 전달했다. 따라서 두 번째 지적은 원래 재시도 호환 요구에 따른 발견 기록으로 보존하되, **새 UI에서 현재 사용자의 구형 로컬 토큰·답안을 명시적으로 폐기하는 정책으로 해소하는 항목**이다. 구 v1 서버 검증·보안 계약은 배포 전 클라이언트 호환을 위해 유지한다. 이 검토자가 로컬/원격 답안을 삭제하지 않았고, 정리 UI의 후속 구현을 재검증했다고 주장하지 않는다.

첫 SQL 지적은 DB 담당자가 수정 중이라고 전달받았다. 끝의 해시는 최초 반례가 확인된 입력이며, 작성 말미 SQL·actions·DB 테스트·QuizClient가 변경된 것을 확인했다. 후속 수정의 통과 여부는 별도 재검증 전까지 이 보고서의 초기 27개 통과와 혼합하지 않는다.

## P2 — SQL 게시 함수가 신규 유형의 교차 계약을 강제하지 않음

대상: `supabase/migrations/20260911030000_cpa_question_learning_units.sql:875`의 `cpa_import_question_bank`. 신규 `question_style`은 enum, `topic_ids`는 존재할 때 형식만 검사한다. 유형과 부모 사실의 관계, 학습 메타데이터가 있는 물음의 두 필드 동반 의무, 세트 내 유형 일치 검사가 없다. 이후 944행에서 릴리스를 active로 전환한다.

실제 마이그레이션을 적용한 메모리 PGlite에서 `sampleQuestionSet()`을 아래처럼 바꾸어 `importQuestionBank()`로 넣었다. 각 실험은 별도 트랜잭션으로 시작하고 rollback했다. 동일 입력을 `validateQuestionSetV3(..., { verifySourceQuotes: false })`에도 넣었다.

| 입력 변경 | TypeScript 검증 | 실제 SQL 결과 |
|---|---|---|
| 두 물음 모두 case·topic_ids를 주고 `shared_context.facts=[]` | 사례형 부모 사실 필요 오류 2개 | import 성공, release status active |
| 한 물음 standard·topic_ids를 주고 공통사실 유지 | 기준서형 단독 풀이 계약 오류 | import 성공, active |
| 한 물음 case, 다른 물음 standard, 공통사실 유지 | 혼합 유형 및 standard 사실관계 오류 | import 성공, active |
| 한 물음 standard, facts=[], topic_ids 생략 | topic_ids 필요 오류 | import 성공, active |

이 상태는 공개 함수에서도 그대로 조회된다. 후속 학습 분류나 private 조회의 TypeScript 검증에서 거절될 수 있지만 이미 새 릴리스가 active가 된 뒤이므로 학습 목록/채점이 실패할 수 있다. 신규 authored 필드를 도입했으므로 해당 필드가 하나라도 존재하는 입력에 한해 현재 TypeScript와 같은 교차 계약을 SQL 게시 전에 확인해야 한다. 과거 필드 없는 원본을 소급 수정하거나 거부할 필요는 없다.

이는 브라우저가 SQL을 직접 호출할 수 있다는 지적은 아니다. 해당 경로는 service_role의 신뢰된 게시 경로이고, 정상 CLI에서 TypeScript 검증을 선행하면 방어된다. 다만 DB가 허용하는 active 상태와 앱이 허용하는 문항 상태가 실제로 다르다는 게시 경계 결함이다.

## 최초 P2, 새 정책으로 복구 요구 제외 — 구형 v1 로컬 제출 복원

대상: `app/quiz/QuizClient.tsx:174–175`의 구 source ID 별칭 처리와 120–129행의 제출 저장소 조회. 새 목록의 학습 단위 ID는 `source--sub--standard` 또는 `source--case`다. 구 실패 이력의 `question_set_id`는 기존 source ID이며, 별칭 처리는 이를 첫 새 학습 단위로 연다. 그러나 `startSet()`은 새 학습 단위 ID의 sessionStorage 키만 조회한다.

현재 함수들을 이용한 무호출 재현 결과:

```text
요청 ID: pilot-01-001
선택된 새 단위: pilot-01-001--sub1--standard
기존 저장 키: cpa-v3-submission:<owner>:pilot-01-001
실제 조회 키: cpa-v3-submission:<owner>:pilot-01-001--sub1--standard
기존 키에 토큰·두 답안 존재: true
startSet의 조회 결과: null
```

따라서 이관 전에 같은 브라우저에서 작성·제출한 답안과 v1 토큰은 저장소에 남아 있어도 복원 UI에 도달하지 않는다. `startSet()`은 빈 답안으로 시작하고, 이후 제출은 새 v2 토큰을 발급한다. 이는 기존 저장 결과의 DB 손실이나 중복 XP 트랜잭션 결함은 아니지만, 구 실패/대기 제출의 같은 제출 재시도를 막는다. `gradeLearningSubmission` 및 DB의 v1 호환 테스트만으로는 이 UI 경계를 확인하지 못한다.

해결 시 구 키의 존재를 확인하고 당시 source 판본·답안·서명된 v1 범위로 복구할 수 있는 별도 경로가 필요하다. 구 토큰을 새 단일 물음에 붙이거나 답안을 첫 물음으로 임의 축소하면 안 된다. 새 UI의 사례 전체 선택 정책과도 구분해야 한다. 브라우저 E2E는 이번에 실행하지 않았으며, 위 결과는 실제 순수 ID/키 함수와 현재 UI 제어 흐름을 대조한 재현이다.

## 확인한 정상 경계와 검증 범위

- `learningUnits.ts`, `learningSubmission.ts`, `learningService.ts`, `questionV3Repository.ts`, `app/actions.ts`, 신규 SQL 전체와 관련 DB 테스트를 읽었다. 재시도 연결을 확인하려고 QuizClient·submissionSession·학습 repository/public parser와 실제 membership wrapper도 확인했다.
- 준비 액션은 `findDatabaseLearningUnit(..., true)`로 현재 단위의 전체 classification ID 집합을 대조한다. 주제 검색은 사례의 모든 물음을 유지한다. 내부 DB 부분 사례 선택은 과거 서명 범위 보존을 위한 경로이며 그 자체를 결함으로 보지 않았다.
- v2 토큰은 단위 ID·선택 물음 순서·분류 판본을 답안 해시와 함께 서명한다. 완료 재시도는 저장 결과를 반환하며 XP·오답 처리 반복을 피한다. v1 full-set과 membership wrapper는 그대로 유지된다.
- 공개 목록의 필드 allowlist 및 SQL projection에 모범답안·criterion·원문 인용을 새로 노출하는 경로는 발견하지 못했다. 선택된 물음의 답안/점수만 저장·합산하며, historical result는 해당 분류 판본의 발문을 사용한다. sealed 분류와 주제 연결, 시도 선택의 변경 방지는 관련 실제 DB 테스트가 통과했다.
- 실행 명령: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/learningUnits.test.ts tests/learningSubmission.test.ts tests/cpaLearningUnitsDatabase.test.ts` — **27개 통과, 실패 0개**. 추가 SQL 반례 4종과 구 저장소 키 재현은 임시 inline Node 코드이며 영구 테스트를 새로 쓰지 않았다.
- 원격 PostgreSQL 적용, 실제 모델 채점, 전체 브라우저 E2E, 운영 배포는 검증하지 않았다. 테스트와 로컬 검토를 배포 승인으로 표시하지 않는다.

## 검토 입력 SHA-256

검토 중 다른 담당자의 변경이 가능하므로 아래 입력 바이트를 기준으로 한 결과다.

```text
supabase/migrations/20260911030000_cpa_question_learning_units.sql 4c1cb25c6cf188572ffd7971fc6fd6343f207403c23bfdcffe20ccdbf606f95f
lib/learningUnits.ts c29d7660aa0b56a8fe21a10ad3adf8cfe5efe0cc57b1b119ecd2ad70fce957b8
lib/learningSubmission.ts a444a49360343b65538a0a1097487fd775396a48438191bd701266a3833337ef
lib/learningService.ts da6a4f7107b8f55c704ee53426b1f9d5802d48b3442f2ad374ede42b99f7f5da
lib/questionV3Repository.ts eaceb96404095c6e71c1e492d662da0c909e04cdf24d0f656215d233731ce893
app/actions.ts 6ef275b83fa42d5dc6f4df1f7ff0d3642c16e4ddcf1d7492e78b0002d5f24b55
tests/cpaLearningUnitsDatabase.test.ts 450876948f0cb232a6ae0b6db994a163a83b2fef1f024fc224562d6e59132ed8
app/quiz/QuizClient.tsx ce843d331ca394146156c29c35787e8df643a6d490c12728448307105109a91f
app/quiz/submissionSession.ts 16c3ec9fc0912ea6cfd826e8af8f4dc50d5b482f70c9d32a877d95dbfc737827
```
