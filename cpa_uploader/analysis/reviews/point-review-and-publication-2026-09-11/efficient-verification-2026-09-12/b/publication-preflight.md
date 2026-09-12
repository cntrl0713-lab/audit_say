# 효율 검증 후 승급·게시·DB 반영 경로 독립 검토

2026-09-12, `plan_procedures`. 코드 읽기와 명시적 합성 임시 fixture만 사용했다. API 호출·실제 승급·정본 수정·DB 호출은 모두 0회다. 이 문서는 실제 내용 검토나 사람 확인을 대신하지 않는다. 검토 시점에는 `candidate-v1/`가 아직 생성되지 않았으므로 아래 70/50/120은 총괄의 계획값이며, 실제 `cohorts.json`과 대조해야 한다.

## 결론과 최신 보완 확인

현재 경로는 **기존 70개 재검증 → 신규 50개 검증 → 120개 게시 → 공개본·암호화본 생성 → 게시된 원문에 학습 분류 재결속 → 전체 로컬 검사 → 운영 DB 반영** 순서로 사용할 수 있다. 기존 검증·관측 파일은 보존한다. 상태 변경만으로 실제 채점을 다시 호출할 필요는 없다.

`prepare-publication.ts`의 후속 보완을 다시 읽었다. canonical·candidate·장부·target scope를 같은 Buffer로 파싱하고 해시를 구하며, before 사본도 그 Buffer를 사용한다. target scope가 입력 guard에 포함되고 쓰기 직전과 이후에 전체 입력·효율 검증 증거를 다시 확인한다. 앞서 지적한 읽기/해시 및 사전 확인/보존 사본 간 불일치는 이 보완으로 해결됐다. 마지막 검사 실패 시 남은 staging 파일을 승급 성공으로 사용해서는 안 된다. 프로세스 성공 종료와 다음 승급 CLI의 검증이 필요하다.

분리해 처리할 한 가지는 **학습 분류의 원문 해시**다. 기존 candidate 카탈로그를 그대로 게시 후 import에 전달하면 legacy 물음은 오래된 원문 해시로 거절된다. 최종 게시 원문을 가리키는 새 classification review와 새 catalog가 필요하다. 이것은 상태 변경 후 원문 판본의 재결속이며, 분류 결정·발문·답안·배점을 새로 바꾸는 작업이 아니다.

## 서로 다른 해시와 보호 범위

| 항목 | lifecycle만 변경할 때 | 필요한 처리 |
| --- | --- | --- |
| `reviewedContentHash` | `status`, `verification.review_status`만 제외하여 동일 | 원 효율 검증 batch·receipt를 그대로 검증하여 사용 |
| `verification.notes` 등 그 밖의 문항 내용 | 검수 해시에 포함 | 변경하면 기존 receipt를 그대로 사용하지 못함 |
| `contentHash(set)` 및 최종 파일 SHA-256 | lifecycle도 포함하므로 변경 | 최종 source hash·판본·파일 해시를 새로 계산 |
| 실제 `buildGradingPrompt`·response schema | lifecycle만 바뀌면 동일 | 원 실제 채점과 기대값 재사용; 재호출 불필요 |
| 공개 문항 투영 | lifecycle를 출력하지 않음 | 전체 공개본을 정식 compiler로 생성하고 일치 검사 |
| 학습 `learning_question_id`, 학습 unit ID | 같은 set/subquestion이면 동일 | 계보 유지 |
| 학습 source/classification version 및 `source_content_hash` | 전체 content hash가 달라져 변경 | 같은 분류 결정으로 최종 원문에 새 판본 결속 |

새 효율 receipt는 원 manifest·분류·투영·agent 검토·실제 응답·runtime snapshot을 참조한다. 최종 published 카탈로그를 원 batch에 덮어 넣으면 안 된다. 원 검증용 catalog와 최종 서비스용 catalog는 목적과 해시가 다르며 함께 보존한다.

## 현재 계약에서 순서가 필요한 이유

`prepare-publication.ts`는 기존 문항의 실제 이전 lifecycle만 isolated staging에 복원하고 기존 장부 전체를 보존한다. 본문은 새 candidate이므로 원 장부의 이전 content hash와 다르다. 첫 `--reverify`에서 변경된 기존 70개를 **한 번에 모두** 지정해야 pending 예외가 그 70개에만 적용되고 나머지 은행은 검증된다. 일부만 재검증하거나 신규 50개부터 승급하면 아직 처리하지 않은 기존 변경분의 장부 해시 불일치가 정상적으로 실행을 막을 수 있다.

`--reverify --to verified`는 새 efficient receipt를 붙인 장부 항목을 추가한다. 과거 published/verified 항목은 삭제하지 않는다. 신규 50개는 `needs_review`와 `needs_human_review`에서 정상 verified 전이를 사용한다. `--backfill-verified`로 새 검수를 대체하지 않는다.

게시에는 `--efficient-review`를 다시 전달하지 않는다. `--to published`는 가장 최근 verified receipt hash를 게시 항목에 연결한다. 게시 후 검사는 선택 120개뿐 아니라 **전체 은행**이 published이고 유효한 장부를 갖는지 확인한다. 기존 비변경 문항의 과거 장부도 그대로 유효해야 한다.

## 총괄 실행 명령

아래 명령은 저장소 루트 PowerShell 기준이며 **이 검토에서는 실행하지 않았다**. `sealed-results-v1` 등 새 출력 이름은 실제 선택된 경로와 맞춘다. 기존 폴더를 지우거나 같은 이름으로 덮어 재실행하지 않는다. `readiness.json`의 존재만으로 수락하지 않고 `ready=true`와 프로세스 성공을 확인한다.

```powershell
$efficientBatch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12'
$sealed = "$efficientBatch/sealed-results-v1"
$stage = "$efficientBatch/publication-staging-v1"
$tsx = 'node_modules/tsx/dist/cli.mjs'
$readiness = Get-Content -LiteralPath "$sealed/readiness.json" -Raw | ConvertFrom-Json
if ($readiness.ready -ne $true) { throw '효율 검증 봉인이 준비되지 않았습니다.' }
if (Test-Path -LiteralPath $stage) { throw '새 staging 출력 경로가 필요합니다.' }

node --env-file=.env.local $tsx "$efficientBatch/prepare-publication.ts" --batch "$sealed/batch.json" --output $stage
if ($LASTEXITCODE -ne 0) { throw 'Staging 준비 실패' }
$cohorts = Get-Content -LiteralPath "$stage/cohorts.json" -Raw | ConvertFrom-Json
if (@($cohorts.reverify_existing_ids).Count -ne 70 -or @($cohorts.verify_new_ids).Count -ne 50 -or @($cohorts.publish_ids).Count -ne 120) { throw '선택 범위가 검토 계획과 다릅니다.' }
$union = @($cohorts.reverify_existing_ids) + @($cohorts.verify_new_ids)
if (@($union | Sort-Object -Unique).Count -ne 120 -or @(Compare-Object ($union | Sort-Object) ($cohorts.publish_ids | Sort-Object)).Count -ne 0) { throw '재검증/신규/게시 ID 집합 불일치' }

$pathOverrides = @{
  CPA_QUESTION_V3_AUTHORING_PATH = "$stage/authoring.json"
  CPA_QUESTION_V3_PROMOTIONS_PATH = "$stage/promotions.json"
  CPA_QUESTION_V3_PUBLIC_PATH = "$stage/public.json"
  CPA_QUESTION_V3_ENCRYPTED_PATH = "$stage/authoring.enc.json"
}
$previousEnvironment = @{}
foreach ($name in $pathOverrides.Keys) { $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
  foreach ($name in $pathOverrides.Keys) { [Environment]::SetEnvironmentVariable($name, $pathOverrides[$name], 'Process') }
  $evidence = "$sealed/readiness.json; $sealed/batch.json; $sealed/seal-inputs.json; $efficientBatch/authorization.md"
  node --env-file=.env.local $tsx cpa_uploader/promote_cpa_v3.ts --to verified --reverify --sets ($cohorts.reverify_existing_ids -join ',') --efficient-review "$sealed/batch.json" --evidence $evidence
  if ($LASTEXITCODE -ne 0) { throw '기존 문항 재검증 승급 실패' }
  node --env-file=.env.local $tsx cpa_uploader/promote_cpa_v3.ts --to verified --sets ($cohorts.verify_new_ids -join ',') --efficient-review "$sealed/batch.json" --evidence $evidence
  if ($LASTEXITCODE -ne 0) { throw '신규 문항 검증 승급 실패' }
  node --env-file=.env.local $tsx cpa_uploader/promote_cpa_v3.ts --to published --sets ($cohorts.publish_ids -join ',') --evidence $evidence
  if ($LASTEXITCODE -ne 0) { throw '게시 승급 실패' }
  node --env-file=.env.local $tsx scripts/compile-question-bank-v3.ts
  if ($LASTEXITCODE -ne 0) { throw '공개본·암호화본 생성 실패' }
  node --env-file=.env.local $tsx cpa_uploader/validate_cpa_v3.ts
  if ($LASTEXITCODE -ne 0) { throw '전체 게시 은행 검증 실패' }

  # 다음 두 명령 전, 아래 설명대로 새 published-classification-review.json을 준비한다.
  node --env-file=.env.local $tsx scripts/build-learning-unit-catalog.ts --review "$stage/published-classification-review.json" --output "$stage/learning-question-classifications.json"
  if ($LASTEXITCODE -ne 0) { throw '최종 학습 분류 생성 실패' }
  node --env-file=.env.local $tsx scripts/build-learning-unit-catalog.ts --review "$stage/published-classification-review.json" --output "$stage/learning-question-classifications.json" --check
  if ($LASTEXITCODE -ne 0) { throw '최종 학습 분류 재현 실패' }
  node --env-file=.env.local $tsx scripts/import-question-bank-v3.ts --learning-catalog "$stage/learning-question-classifications.json" --report "$stage/db-readiness.json"
  if ($LASTEXITCODE -ne 0) { throw 'DB 반영 전 로컬 검증 실패' }
} finally {
  foreach ($name in $previousEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process') }
}
```

`published-classification-review.json`은 총괄이 별도로 생성해야 하며 위 코드가 자동 생성하지 않는다. 실제 candidate catalog의 `review_file`에서 원 분류 entries를 읽어 **그대로** 보존하고, `source_file`을 최종 staging authoring 경로로, `source_file_sha256`을 그 실제 바이트의 SHA-256으로 지정한다. 이전 candidate와 최종 authoring의 모든 set ID·`reviewedContentHash`가 같고 분류 결정 전체가 같다는 차이 장부를 먼저 남긴다. 이 단계에서 다른 내용 차이가 발견되면 lifecycle 재결속으로 취급하지 않는다. 향후 canonical 경로로 설치하면 그 최종 경로에 맞춘 후속 review/catalog도 만들어 파일 모드의 source 경로·해시 검사와 일치시킨다.

## 운영 반영 필수조건과 명령

1. 원 실제 agent 내용 검토에 미해결 문항·정답·근거·기대값 오류가 없어야 한다. ±1/95%는 채점 일관성 정책이며 내용 오류 면제가 아니다. 실행 오류·누락·보안 오류는 분모에서 빼지 않는다. 봉인 readiness와 core receipt 검증이 모두 통과해야 한다.
2. 위 staging 승급·게시·전체 validator가 통과해야 한다. compiler에는 `CPA_QUESTION_V3_ENCRYPTION_KEY`가 필요하다. 공개 JSON에 답안·criteria·직접 인용이 유출되지 않는 compiler 계약 및 전체 공개본 일치를 확인한다.
3. importer의 `--preserve-source`는 이번 경로에서 사용하지 않는다. 이 옵션은 내용·전체 proof 검증을 건너뛰므로 새 검토 은행의 실패를 우회하는 수단이 아니다. 기본 importer는 전체 validator를 60초 제한으로 실행하며 타임아웃도 ready=false다.
4. 최종 `db-readiness.json.ready=true`, source 파일 SHA, 새 학습 catalog의 전 물음 분류, 출처 원문·장부·원 receipt와 runtime 보존이 확인되어야 한다. 기존 파일의 하위 부분만 골라 import하지 않고 최종 전체 은행을 전달한다. 전체 세트/물음 수는 보고서 실측값을 사용한다.
5. 서버의 서비스 키·프로젝트 URL, 실제 적용 대상 호스트, 필요한 원자적 `cpa_import_learning_question_bank` RPC/스키마가 준비되어야 한다. 키 자체를 명령 인자나 출력에 넣지 않는다. 실제 승인·봉인 근거를 `--evidence`로 지정하며 이를 별도의 사람 확인 기록으로 꾸미지 않는다.
6. 실제 적용 직전 source·공개본·카탈로그·장부의 선택 버전을 고정하고 현재 DB snapshot을 보존한다. 정본 설치와 DB 반영은 총괄만 수행하며, 정본·장부·공개본·암호화본·catalog가 서로 다른 후보를 가리키지 않게 한다.

운영 import도 동일한 네 staging 경로 환경변수가 설정된 블록 안에서 실행하거나, 검증된 파일들을 canonical에 함께 설치한 뒤 canonical 경로로 재검사하여 실행한다. 아래 `$targetProjectHost`는 총괄이 확인한 실제 대상 호스트를 명시하고, `$finalReadiness`는 바로 앞의 최종 보고서다.

```powershell
$finalReadiness = Get-Content -LiteralPath "$stage/db-readiness.json" -Raw | ConvertFrom-Json
if ($finalReadiness.ready -ne $true) { throw '최종 DB readiness가 false입니다.' }
node --env-file=.env.local $tsx scripts/import-question-bank-v3.ts --apply --learning-catalog "$stage/learning-question-classifications.json" --expected-hash $finalReadiness.source_file_hash --project-host $targetProjectHost --evidence "$sealed/readiness.json; $sealed/batch.json; $stage/cohorts.json" --report "$stage/db-apply-readiness.json" --receipt "$stage/db-applied.json"
if ($LASTEXITCODE -ne 0) { throw 'DB 적용 또는 적용 후 검증 실패: 원격 상태를 읽어 확인하고 자동 재시도하지 않습니다.' }
```

`--expected-hash`는 검수용 reviewed hash가 아니라 **실제 최종 authoring 파일 바이트 SHA-256**이다. importer는 프로젝트 호스트 일치와 source 재읽기 해시를 확인하고, 단일 원자적 RPC로 전체 은행 및 학습 분류를 함께 적용한다. native style/topic/standalone prompt 일치와 분류 누락 검사는 SQL에서도 유지된다. 과거 immutable 판본·시도·성적을 삭제하거나 XP를 초기화하는 경로가 아니다.

적용 후 importer는 공개은행 round-trip, 학습 분류 조회/학습단위 구성, 저장된 source_document/파일 해시의 바이트 일치를 확인한다. 추가 독립 조회에서는 세트·물음·학습단위 수와 기존/신규/retired 계보, standard 부모 NULL·단독 발문·facts 0, case 전체 물음, 공개 비노출 및 시도/성적/XP 보존을 확인한다. RPC 성공 후 후속 조회가 실패할 수 있으므로 receipt가 없다는 이유로 미적용으로 단정하여 다시 쓰지 않는다.

## 로컬 합성 검증 결과

`b/seal-fixture.ts`의 명시적 합성 자료를 OS 임시 경로에 만들고 production 함수를 직접 호출했다. fixture는 실제 모델·사람 검토 근거가 아니며 종료 후 임시 파일을 정리했다. lifecycle 변경 후 원 효율 receipt 재검증, 오래된 catalog 거절, 같은 분류로 재생성한 catalog 수락, stable learning ID 유지, classification version 변경, grading prompt/schema 불변을 확인했다. notes 변경은 receipt가 거절했다. API/승급/DB 호출은 없었다.

## 읽기 검토 기준 파일 SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `E/prepare-publication.ts` | `70926e0d9e75914fdf9b0c829d1463544618904ea49db58e021dccb2c8ecc3b5` |
| `cpa_uploader/questionEfficientReview.ts` | `0aa34a6332cbc2355ff86e3ab042635d38488791bc6f325daf4c878c39ca36b0` |
| `cpa_uploader/promote_cpa_v3.ts` | `2006664df5b93291c850c62e8942a400cdce345bf7a51c3fb34033f2430021b6` |
| `cpa_uploader/questionBankPublication.ts` | `ee891792be5c735c158c2913a72e43691ddc38a8a29e1728a6a83319a1440710` |
| `cpa_uploader/questionReviewIdentity.ts` | `7d3cc754347ac15e6b07feef29c0b853856ab09f9d7512c2d18fe5753bb297ac` |
| `scripts/compile-question-bank-v3.ts` | `5ea8a54b7c50c9e1a7dabb97df02806160ba4eef7cbbc4a8d42a3d40324b9de7` |
| `scripts/build-learning-unit-catalog.ts` | `a7c5aaba3d609f39e7f567d9d9db819bfb5034fee08b1c24e047cb83e4695d8b` |
| `scripts/import-question-bank-v3.ts` | `d8a80ed992e91b627bac6419895bd5d0b286d3fd15cbeca57499a5da03b65446` |

여기서 E는 이 문서의 상위 `efficient-verification-2026-09-12` 폴더다. 이후 파일이 달라지면 이 보고서를 새 코드의 실행 근거로 자동 승계하지 않는다.
