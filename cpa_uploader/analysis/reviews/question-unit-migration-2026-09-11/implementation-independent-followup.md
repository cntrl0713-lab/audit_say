# 학습 단위 구현 독립 후속 검증

[최초 검토](implementation-independent-review.md)의 반례를 수정된 입력으로 다시 실행했다. **이전 SQL 반례 네 가지와 신규 원본·분류 정보 불일치가 모두 차단됐으며, 구형 로컬 답안 폐기는 사용자·키 범위를 지켰다.** 이번 제한된 재검증에서 추가로 수정을 요구할 확정 결함은 발견하지 못했다. 최초 보고서는 변경하지 않았다.

API 호출과 원격 DB 읽기·쓰기는 0회다. 격리 PGlite 및 메모리 저장소만 사용했으며 구현 파일·문항·이관 입력을 수정하지 않았다. 이는 실제 운영 적용이나 배포 승인 기록이 아니다.

## SQL 반례의 수정 확인

기준 SQL SHA-256은 `6e45c144bf661fa10afd0d001cd0879d3d09c0b2d67d91ef45c70801e96f837b`다. 실제 마이그레이션을 적용한 메모리 DB에 기존 정상 은행·분류를 먼저 넣고, 별도 새 원본을 잘못된 상태로 추가했다.

| 원래 반례 | 수정 후 실제 오류 |
|---|---|
| case인데 부모 facts가 비어 있음 | Authored question style and shared facts mismatch |
| standard인데 공통 facts가 있음 | Authored question style and shared facts mismatch |
| 같은 원본에 case·standard 혼합 | Authored source cannot mix learning styles |
| question_style만 있고 topic_ids 없음 | Every authored question requires style and topics |

네 호출 모두 거부됐다. 매 호출 뒤 active 공개 은행 전체, release 수, 논리 set 수, source version 수, classification version 수를 직전 snapshot과 비교했고 전부 동일했다. 실패한 새 원본을 게시하거나 빈 분류의 active 릴리스를 남기지 않았다. 메타데이터가 없는 과거 원본은 정상 입력으로 사용해 소급 거부하지 않는 것도 확인했다.

## 신규 원본과 분류를 함께 가져오는 경로

service_role로 `cpa_import_learning_question_bank`를 호출하여, 기존 원본 하나와 authored standard 물음 하나의 새 은행을 대상으로 별도 검증했다.

- 전체 분류 중 새 물음 하나 누락: 거부.
- 새 authored standard를 분류에서 case로 위장: 거부.
- 새 authored topic_ids 두 개를 분류에서 한 개로 축소: 거부.
- 새 authored 독립 발문을 분류에서 다른 질문으로 교체: 거부.

불일치 세 건은 `Learning catalog differs from authored question metadata`, 누락은 `Complete release classification coverage required`로 실패했다. 각각 기존 active 공개 은행·네 테이블 집계가 snapshot과 같았다. 실제 정상 입력은 2세트·3개 분류로 성공했고 같은 입력 재호출은 `reused=true`였다. 이 검증은 새 atomic 게시 함수의 범위다. 과거 원본의 편집용 분류 revision을 따로 등록하는 metadata-only 경로와 혼동하지 않는다.

추가 조회 당시 기존 CLI가 예전 source-only RPC를 호출하는 연결 누락을 총괄에 전달했다. 총괄 수정 뒤 `scripts/import-question-bank-v3.ts`를 다시 읽었고, 현재는 `cpa_import_learning_question_bank` 한 호출에 source와 learning catalog를 전달한다. 이어 공개 원문 round trip, 분류 조회·단위 구성, 보존 source_document를 확인한다. 예전 RPC 직접 호출은 현 CLI에서 제거됐다.

CLI를 원격 실행하지 않고 `learningCatalogForBank`만 직접 호출한 결과:

- 현재 정본의 212개 legacy 물음을 기존 원본 해시와 대조하여 준비했다.
- legacy 발문을 바꾸고 기존 분류를 그대로 쓰면 거부했다.
- 새 native standard의 발문·주제는 authored 원본에서 가져왔다.
- 등록되지 않은 새 native 주제는 거부했다.

## 구형 로컬 제출 폐기 범위

`retireLegacySubmissionSessions`는 전체 sessionStorage를 열거하지 않고 `submissionSessionKey(currentOwner, knownSourceId)`만 조회한다. QuizClient의 사용자 effect는 로그인한 현재 owner와 제공된 학습 단위의 source_set_id만 넘긴다. 원 토큰을 새 단위의 토큰처럼 사용하거나 일부 답안을 새 범위로 옮기는 처리는 없다.

실제 함수에 메모리 저장소를 넣어 확인했다. 현재 owner의 알려진 legacy 키 하나와 손상된 legacy 키 하나만 제거했다. 중복 source ID는 한 번만 처리했고 다음 호출의 제거 수는 0이었다. 아래 값은 바이트 그대로 남았다.

- 다른 owner의 동일 source 키.
- 현재 owner의 미등록 source 키.
- 현재 owner의 새 standard·case 단위 키. 만료된 v2 단위 키도 이 폐기 함수에서는 건드리지 않는다.
- 알려진 source 키에 있더라도 유효한 learning_unit_id를 가진 v2 세션.
- 다른 앱의 저장값.

사용자가 허용한 구 세트 전체 답안 폐기 정책과 일치한다. 유효기간·형상 검사에 실패한 값은 알려진 현재 owner의 source 키 안에서만 제거된다. 실제 브라우저 저장소를 삭제하거나 브라우저 E2E를 수행한 것은 아니다.

## 제출·보안 회귀와 한계

`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/learningUnits.test.ts tests/learningSubmission.test.ts tests/cpaLearningUnitsDatabase.test.ts`를 수정된 SQL로 실행해 **29개 통과·실패 0개**를 확인했다. 위 독립 반례와 저장소·CLI builder 검증은 임시 inline Node 실행이며 영구 테스트를 추가하지 않았다.

기존 서명된 v1·v2의 판본/답안 범위를 교체하는 새 경로는 발견하지 못했다. 새 준비 요청의 전체 사례 ID 대조는 유지되며, 구 서명 범위를 처리하는 내부 서비스의 부분 선택 허용과 구분된다. 공개 질문 projection은 답안·criterion·원문 인용을 포함하지 않고, 완료 결과는 owner 확인 뒤 반환한다. 신규 CLI의 service-role 키와 채점 키는 서버 환경에서만 읽고 공개 payload나 출력 receipt에 넣지 않는다. API 키 값을 읽거나 출력하지 않았다.

실제 Supabase 권한·데이터에 대한 이관, 원격 서비스 적용, API 모델 호출, 브라우저 E2E는 실행하지 않았다. 검증 범위 밖의 운영 상태가 준비됐다고 표시하지 않는다.

## 후속 입력 SHA-256

```text
supabase/migrations/20260911030000_cpa_question_learning_units.sql 6e45c144bf661fa10afd0d001cd0879d3d09c0b2d67d91ef45c70801e96f837b
app/quiz/submissionSession.ts 1391b64fa84479933981e609e7567e6b576549e087685931a3633a5a6dbfa940
app/quiz/QuizClient.tsx e66757998ded0e509ed07a10236d4a6a48656e77eae11d62b1c7e4506bf28ff3
scripts/import-question-bank-v3.ts d8a80ed992e91b627bac6419895bd5d0b286d3fd15cbeca57499a5da03b65446
tests/cpaLearningUnitsDatabase.test.ts 1fbd7f1b639136498eae763bc9fb8b4c37000407ae504c64e829ea90cd7342ed
lib/learningUnits.ts c29d7660aa0b56a8fe21a10ad3adf8cfe5efe0cc57b1b119ecd2ad70fce957b8
lib/learningSubmission.ts a444a49360343b65538a0a1097487fd775396a48438191bd701266a3833337ef
lib/learningService.ts da6a4f7107b8f55c704ee53426b1f9d5802d48b3442f2ad374ede42b99f7f5da
lib/questionV3Repository.ts eaceb96404095c6e71c1e492d662da0c909e04cdf24d0f656215d233731ce893
app/actions.ts 6ef275b83fa42d5dc6f4df1f7ff0d3642c16e4ddcf1d7492e78b0002d5f24b55
```
