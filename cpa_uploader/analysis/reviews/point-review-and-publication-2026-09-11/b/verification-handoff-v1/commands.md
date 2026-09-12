# 전수검증 다음 작업의 명령 계약

이 문서는 명령·현재 입력·중단 상태를 독립 대조한 인계 자료다. 실제 의미검수·비빈 답안 채점·승급·사람 확인·DB 반영을 수행한 증거가 아니다. **이번 인계의 API 호출은 0회**다. 다음 작업은 총괄의 `docs/plans/문항-전수검증-재개-작업요구서-2026-09-11.md`와 고정 장부를 읽고 재개한다.

## 현재 파일과 준비 상태

`execution-runtime-v5.json`은 디렉터리가 아닌 파일이며 SHA는 `5547d8e728f56857dab95c2242711f677468fd08ffdec1c933f9bb099f23ba18`이다. `execution-all-v6/manifest.json` SHA는 `6511a119245a0e6fd80a1f361ce1f7709da112bd1b1dfb54849f84a32e1dc791`, 은행 SHA는 `e43cd491c08faebd70c02eb67bfe15198e669b66a6372b723ed539da229fd94a`다. 현재 모델은 의미검수/학생 채점 모두 `gpt-5.6-luna`, 의미검수 입력 상한은 500,000자다. 새 실행 때는 해당 manifest와 환경을 다시 대조한다.

- 전수 대상 119세트: worker a 39, b 40, c 40. 전체 동료 비교 은행은 153세트다.
- canary 3세트/30단위 + remaining 116세트/1,363단위 = 119세트/1,393단위. 두 집합의 중복·누락은 없다.
- 과거 `execution-canary-v6/semantic-a`는 `gracefully_stopped=true`, `recorded_sets=0`, `results=[]`이다. STOP·run·summary를 보존하며 재사용하지 않는다.
- root의 `execution-resumes/handoff-001/{canary,remaining}/manifest.json`이 **새 실행용 잠금**이다. 각 wave에서 semantic/grading/author-qa가 같은 manifest를 쓴다. 준비 폴더의 존재는 검수 실행·완료를 뜻하지 않는다.
- 작성자 QA 6,029개는 원답안·기대값 준비이며 실제 의미 판정 완료가 아니다. smoke-v3는 249개 빈 답안의 `gradeQuestionSetV3` 실행/모델 API 0만 확인했고 비빈 모범답안은 미실측이다.

이 검토에서 `check-command-contracts.mjs`로 443개 고정 파일을 대조하고 worker semantic 3개와 smoke 3개 dry-run을 실행했다. 9/9 검사 통과, API 0이다. 별도 `checks.json`과 출력 기록을 보존했다. dry-run에 API 키를 전달하지 않았다. smoke dry-run은 로컬 preflight/summary를 쓰고, worker semantic dry-run은 생산 자식 프로세스와 출력 파일을 만들지 않는 차이가 있다.

## 새 실행의 실제 CLI

아래는 **다음 작업에서 실행할 명령**이다. 이 문서 작성 과정에서는 dry-run 이외에 실행하지 않았다. PowerShell 작업 디렉터리는 저장소 루트다. a/b/c 합계 최대 3개의 실제 스트림만 허용한다.

```powershell
$batch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11'
$run = "$batch/execution-resumes/handoff-001"
$wave = "$run/canary"
$worker = 'a'
$env:CPA_GRADING_MODEL = 'gpt-5.6-luna'
$env:CPA_REVIEW_MODEL = 'gpt-5.6-luna'
$env:CPA_REVIEW_INPUT_MAX_CHARS = '500000'
node --env-file=.env.local "$batch/b/validation-worker-v3.mjs" --manifest "$wave/manifest.json" --worker $worker --phase semantic --output "$wave/semantic-$worker" --stop-file "$wave/STOP" --dry-run
```

handoff-001의 해당 출력이 이미 사용됐으면 과거 STOP/폴더를 지우지 않는다. 아직 사용하지 않은 새 이름으로 `node "$batch/prepare-verification-resume.mjs" --run-name resume-002`를 실행해 새 잠금을 만든다. 이 준비 도구는 기존 입력·출처·코드 해시가 다르면 거절한다. 새 이름을 발급받는 것은 이전 완료를 자동 승계하거나 새 내용을 승인하는 행위가 아니다.

사전검사 후 실제 의미검수는 위 worker 명령에서 `--dry-run`만 제거한다. `.env.local`을 읽되 키·토큰을 출력하지 않는다. a/b/c는 worker와 출력 경로를 함께 바꾼다. 처음 세트들에서 API 동작·원문 대조 계약을 확인한 뒤 나머지를 실행한다.

같은 wave/worker의 의미검수가 완료되어 모든 단위가 pass인 receipt를 **정식 생성 사례 채점**에 연결한다.

```powershell
node --env-file=.env.local "$batch/b/validation-worker-v3.mjs" --manifest "$wave/manifest.json" --worker $worker --phase grading --semantic-directory "$wave/semantic-$worker" --output "$wave/grading-$worker" --stop-file "$wave/STOP"
```

내부 생산 CLI는 `review_question_draft_v3.ts --file … --bank … --plan … --review-input … --grade-cases --output …`다. 원 의미검수 파일을 덮어쓰지 않는다. `execution.transport=model`만으로 채점 완료가 아니며 별도로 `grading.status=completed`, `grading.transport=model`, 유효 실제 원시 결과와 각 사례의 일치를 확인한다.

canary의 검수·채점 문제를 해결한 후 `$wave = "$run/remaining"`으로 바꾸어 같은 명령을 실행한다. **semantic과 grading에 서로 다른 manifest를 쓰면** `--semantic-directory`의 같은 manifest SHA 계약을 충족하지 못한다. 여러 재개 실행에서 나온 receipt를 모아야 할 때는 총괄이 새로운 grading manifest에 각 job의 `semantic_provenance`를 고정한다. 그 필드는 원 manifest/worker/run/summary/request/receipt와 세트·계획·출처·비교 은행·원 코드 해시를 모두 검증한다. 임의 receipt 경로, 부분 chunks, 주입 응답, 내용 변경은 대체 근거가 아니다. 원 런타임과 현 코드의 호환성 예외는 구현되어 있지 않다.

작성자 QA는 두 wave 전체를 별도 실행한다.

```powershell
$qaRoot = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/handoff-001'
node --env-file=.env.local "$batch/b/validation-worker-v3.mjs" --manifest "$run/canary/manifest.json" --worker $worker --phase author-qa --output "$qaRoot/canary/author-qa-$worker" --stop-file "$run/canary/STOP"
node --env-file=.env.local "$batch/b/validation-worker-v3.mjs" --manifest "$run/remaining/manifest.json" --worker $worker --phase author-qa --output "$qaRoot/remaining/author-qa-$worker" --stop-file "$run/remaining/STOP"
```

`run-author-qa.ts`는 해당 draft 루트 하위만 출력으로 허용한다. 두 wave/세 worker 합계의 고유 QA ID·원답안·모든 criterion 기대값을 확인한다. 최초 불일치의 동일 입력 총 3회 결과와 형상·전송 실패를 구분한다. 마지막 성공으로 앞선 불일치를 지우지 않는다. standalone/사례 전체 앱 투영은 이 원 source 세트의 물음별 QA와 별도로 남아 있다.

## 실제 학습 단위 249개

```powershell
node --env-file=.env.local --import tsx "$batch/a/run-learning-unit-smoke-v3.ts" --manifest "$batch/a/learning-unit-smoke-v3/manifest.json" --worker $worker --output "$run/learning-smoke-$worker" --stop-file "$run/learning-smoke-STOP" --dry-run
```

실측은 새 출력으로 `--dry-run`을 제거한다. **smoke dry-run이 쓴 출력 폴더를 실측에 재사용하지 않는다.** 현재 manifest SHA는 `33b03f712e8fea314318fd1b75851dafcdef02fabf0b014aa059c0089b77b273`이며 실행기에 고정되어 있다. a/b/c는 각각 83단위다. 237단위는 formal source 입력과 실제 채점 prompt/schema가 달라지고, 사례 21단위는 여러 물음에 동시에 답한다. source 세트 QA 통과만으로 대신하지 않는다.

저장 모범답안의 전 criterion met/만점, 총점, 원시·최종 보안 오탐, 실제 모델/요청/스키마/학습 ID/선택 IDs를 확인한다. 현재 실행기에는 완료 단위를 자동 재사용하는 resume 옵션이 없다. 중단 뒤 같은 worker 83개를 무조건 다시 실행하지 말고 이미 완료한 실제 입력·원시 결과와 남은 범위를 총괄이 새 후속 계획으로 고정한다.

## 오류·중단·결과 해석

- worker exit 0이어도 STOP으로 0개 실행한 상태일 수 있다. summary의 `gracefully_stopped`, `recorded_sets`, `not_started_set_ids`, 세트 결과와 실제 receipt를 함께 읽는다.
- worker exit 2는 내용 비통과/불일치/선행 의미검수 비통과 차단이며 전송 오류와 다르다. exit 1은 실행 오류/중단이다. 유효 fail/uncertain을 폐기하지 않고 원문·지문·배점·요구와 대조한다.
- worker STOP은 **새 세트** 시작을 멈춘다. 현재 세트의 CLI 완료를 기다리는 정상 경계 중단이다. 즉시 전송 중지가 필요한 사용자 지시·잔액 부족이면 현재 프로세스도 제어하고 중단 원시 로그를 보존한다. smoke는 요청 전 STOP 확인 및 신호에 의한 SDK 요청 중단을 지원한다.
- `credit_balance_exhausted`/`insufficient_quota`는 중첩 cause까지 읽고 다른 worker의 새 요청도 중지한다. 오류를 0점으로 세거나 같은 키로 다른 세트를 계속 시험하지 않는다.
- 해시 guard/기록 실패는 API 반복으로 해결하지 않는다. 옛 해시만 최신값으로 바꾸거나 필수 source/context/동료를 잘라 넣지 않는다.

## 승급·게시·DB 전제

현재 후보가 실제 검수 완료가 아니므로 운영 쓰기 명령을 지금 실행하지 않는다. 사람 확인이 없는데 `--evidence` 문자열을 만들어 주거나, 모델 검토를 실제 사람 확인으로 기록하지 않는다. 사용자의 운영 반영 승인과 정답·판본을 확인한 사람의 근거는 서로 다른 정보다.

모든 필수 검증과 승인 근거가 갖춰진 뒤, 총괄이 서로 다른 새 staging authoring/promotions/public/encrypted 경로를 `CPA_QUESTION_V3_AUTHORING_PATH`, `CPA_QUESTION_V3_PROMOTIONS_PATH`, `CPA_QUESTION_V3_PUBLIC_PATH`, `CPA_QUESTION_V3_ENCRYPTED_PATH`에 지정한다. CLI 자체에는 `--file` staging 인자가 없고 환경 경로를 사용한다.

`promote_cpa_v3.ts --status`는 조회, `--to verified --sets … --review … --evidence …`는 실제 새 승급, 기존 verified/published의 수정은 `--reverify --to verified …`다. 현재 70개 수정본이 `needs_review`인 반면 원 장부가 존재하므로 바로 승급하면 전체 장부가 실패한다. 별도 `b/publication-sequence-study-v1/README.md`의 실제 계약을 먼저 해결한다. 옛 장부 삭제·needs_review 재분류로 첫 승급인 척 처리하거나 미통과 항목을 승인하는 해결은 안 된다. 신규 수락 receipt의 비교 은행 결속을 지켜야 한다.

최종 전체 장부·상태 일치 뒤 게시/컴파일/분류 갱신을 한다. `promote_cpa_v3.ts --to published …`, `scripts/compile-question-bank-v3.ts`는 쓰기 명령이며 후자는 암호화 키와 전체 published 장부 검증이 필요하다. 상태 변경을 마친 실제 정본으로 카탈로그를 다시 만든다. 옛 review 입력·카탈로그를 덮어쓰지 않고 최종 원문 해시와 연결한 새 분류 review/output을 사용한다.

로컬 전제검사 명령은 다음과 같다. 이 문서에서는 실행하지 않았으며 `$finalCatalog`, `$newReadinessReport` 등은 실제 최종 파일을 준비한 뒤 지정한다.

```powershell
node --import tsx cpa_uploader/validate_cpa_v3.ts
node --import tsx scripts/build-learning-unit-catalog.ts --review $finalClassificationReview --output $finalCatalog --check
node --import tsx scripts/import-question-bank-v3.ts --learning-catalog $finalCatalog --applicability-file $finalApplicability --report $newReadinessReport
```

import에 `--apply`가 없으면 DB를 쓰지 않지만 readiness 보고서는 쓰므로 기존 보고서 경로를 재사용하지 않는다. 이번 내용 변경 검증을 `--preserve-source`로 우회하지 않는다. 실제 적용에는 최종 hash/host/검수 근거가 모두 필요하며 값을 추측해 지금 채우지 않는다. 적용 후 `$batch/c/verify-final-learning-rollout.ts`는 `--bank`, `--learning-catalog`, `--evidence`와 각 `--expected-…-sha256`, `--output`을 요구한다. 실제 DB 대조에는 추가로 `--read-live`, `--migration`, `--expected-migration-sha256`, `--expected-project`가 필요하다. `--applicability`를 넘기면 그 SHA도 함께 넘긴다. 이전 배치에 고정된 `scripts/verify-learning-unit-rollout.ts`를 새 내용의 최종 검증처럼 그대로 실행하지 않는다.

최종 완료는 문항·물음·criterion 전체 상태, 정식 생성 사례/작성자 QA/앱 학습 단위 각 결과, 실제 API와 빈 답안 무호출 수, 미해결 불일치, 사람 확인, 정본·게시·DB 상태 및 해시를 분리하여 보고한다.
