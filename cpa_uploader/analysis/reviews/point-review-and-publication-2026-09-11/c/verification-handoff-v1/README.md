# 다음 전수 검증 작업의 증거 상태

[전수 읽기 결과](evidence.json)는 현재 후보·실행 manifest·QA·학습 단위 준비·과거 summary/receipt/원시 chunk·raw 수집 기록을 로컬에서 대조했다. 이 조사에서 API·DB·원문·공통 코드 변경은 없다. `inspect.mjs`가 검사한 현재 실행 입력442개는 저장된 SHA와 모두 같았고, 상태 확인16개 항목은 통과했다.

| 범위 | 확인한 완료 | 남은 범위·해석 | 직접 근거 |
| --- | --- | --- | --- |
| 후보 은행 v6 | 전체153세트·350물음·1,292criterion 형상·직접 인용·학습 분류 준비 | 정식 수락·게시·DB 반영 아님. import `ready=false` | [summary](../../prepared-reviewed-v6/summary.json) |
| 실제 검증 대상 | 119세트·280물음·1,113criterion = 1,393의미단위, 전수 사전검사 오류0. 최대476,124자/명시상한500,000자 | 현재 v6의 실제 의미검수 전부 남음 | [manifest](../../execution-all-v6/manifest.json), [preflight](../../execution-all-v6/preflight.json) |
| 작성자 QA v4 | 고유6,029개, alias 포함6,573개 기대값 합산 오류0 | `applyQuestionSetJudgment`에 작성자 기대값을 넣은 로컬 재생. 모델 판정·실제 채점이 아님 | [QA manifest](../../qa-prepared-v4/manifest.json) |
| 앱 학습 단위 | 249개(기준서209·사례40) 투영 및 빈 답안249개 0점·not_met·보안none 경로 검사 | 비빈 저장 모범답안249개는 준비만 하고 모델 실행0. 실제 앱 요청과 정식 세트 검수 입력이 같다고 가정하지 않음 | [학습 단위 manifest](../../a/learning-unit-smoke-v3/manifest.json), [로컬 검사](../../a/learning-unit-smoke-v3/local-validation.json) |
| raw | 원경로471개·고유458파일·98,780,296바이트, 원본과 사본 독립 비교 오류0 | 자료 보존 완료이며 기준서 내용 승인·모델 검수와 별개 | [수집 후속 대조](../raw-source-inventory-v1/collection-followup.json) |
| v6 선행 큐 | STOP을 읽어 세트 전에 정상 중단. `recorded_sets=0`, `results=[]`, 미시작 `pilot-01-002` | receipt·chunks·grading 원시 출력0. 현재 v6에서 실제 호출된 것으로 셀 수 있는 단위0 | [중단 summary](../../execution-canary-v6/semantic-a/summary.json), [STOP](../../execution-canary-v6/STOP) |
| 정본·운영 반영 | 정본은104세트·212물음·574criterion. 후보 전체 내용 반영 미실행 | 현재 정본은 최초 snapshot과 바이트 동일하지 않음. 아래 문서경로 변경을 보존해야 함. 원격 DB는 이 조사에서 조회하지 않음 | [정본 차이](evidence.json) `canonical_preservation` |

현재 실행 은행 파일 SHA는 `e43cd491c08faebd70c02eb67bfe15198e669b66a6372b723ed539da229fd94a`다. 실행 manifest는 모델·review 모델 `gpt-5.6-luna`, 상한500,000자를 기록한다. 다음 작업은 실행 직전 최신 고정 입력과 공통 중단 상태를 다시 확인해야 한다. 이 문서는 현재 STOP을 해제하거나 실행을 허용하는 명령이 아니다.

## 과거 실제 수행 증거

`execution-canary-v2`의 다음 세트는 당시 은행·출처·코드에서 실제 의미검수 pass다. 세트별 summary의 receipt 바이트 해시, `execution.transport=model`, 모든 단위 check, 원시 chunks를 직접 대조했다.

| 세트 | 의미단위 | 원시 chunk | 실제 사례 채점 |
| --- | ---: | ---: | --- |
| pilot-08-007 | 15 | 15 | not_run |
| pilot-05-008 | 14 | 14 | not_run |
| draft-04-320-freq01 | 6 | 6 | 19 runs 모두 기대값 일치 |
| 합계 | 35 | 35 | 1세트19건 |

[draft-04-320 채점 receipt](../../execution-canary-v2/grading-c/draft-04-320-freq01/grading.json)의 19건은 **비빈 답안18건과 빈 답안1건**이다. [원시 채점 로그](../../execution-canary-v2/grading-c/draft-04-320-freq01/grading.json.grading.jsonl)에는 비빈18건에 각각 모델 response trace가 있고 빈 답안은 trace가 없다. 따라서 “실제 사례 채점19건 완료”는 맞지만 “모델 API19회”라고 쓰면 안 된다. 모델 trace18개와 빈 답안0점 분기를 구별한다. 원래 생성사례20개와 중복 답안 통합 뒤의 실행19건도 서로 다른 수치다.

3세트35단위는 과거 전체 통과 이력의 합계가 아니다. 더 이전 `execution-new-v1`에는 다음 6개의 semantic pass receipt(65단위)가 있으며 모두 grading은 not_run이다: `draft-12-570-freq01`11, `pilot-04-006`17, `draft-09-505-freq01`10, `draft-12-560-freq01`10, `draft-09-501-freq01`7, `draft-10-530-freq01`10. 이 과거 은행·요청의 pass를 현 v6 검수 완료로 승계하지 않았다.

조사 범위의 완성된 과거 의미 receipt는16개이며, 당시 verdict는 pass9·fail3·uncertain4다. grading receipt에 포함된 동일 의미검수는 다시 세지 않았다. 미완성 chunk만 있는4경로(`pilot-06-006`1, 옛 `pilot-08-007`3, `pilot-07-006`3, `pilot-02-006`3)는 최종 receipt와 구별해 보존했다. 전체 경로·파일 SHA·당시 해시·판정은 `all_history_receipts`, `partial_without_receipt`에 있다. 이 숫자는 이전 `delegated-authoring` 배치의 모든 실행까지 합친 전체 프로젝트 누적치가 아니다.

## 정본 문서경로의 별도 후속

`canonical-before.json`과 현재 편집 정본을 모든 필드로 비교하면 83세트의 `verification.notes` 문자열83개가 다르다. 최근 한국어 문서명·보관 위치로 링크가 갱신된 것이며, 발문·사실·정답·criterion·배점·출처 및 나머지 구조는 같다. 따라서 “이번 후보 내용은 정본에 반영하지 않음”과 “정본 파일 바이트는 처음부터 그대로”를 구별한다.

후속 최종 합본을 만들 때 후보 은행으로 정본 전체를 단순 덮어써 독립 문서경로 변경을 잃지 않아야 한다. [evidence.json](evidence.json)의 `canonical_preservation.differences`에 모든 전후 문자열·경로를 보존했다. 최초 바이트 동일 가정이 실패한 [초기 검사](evidence.initial-byte-assumption.json)도 남겼으며 이를 숨기거나 원 snapshot을 수정하지 않았다.

다음 필수 작업은 현행 입력의 실제 의미검수, 생성 반례·작성자 QA의 실제 채점과 불일치 조사/필요 수정·재채점, 실제 학습 단위 비빈답안 검증, 수락·게시 전제 확인, 그 뒤 별도 운영 반영이다. 로컬 사전검사·기대값 합산·자료 수집 완료를 그 단계의 완료 근거로 사용하지 않는다.
