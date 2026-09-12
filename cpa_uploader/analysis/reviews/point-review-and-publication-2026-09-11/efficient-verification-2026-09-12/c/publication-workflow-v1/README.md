# 이번 배치의 로컬 승급 staging 준비

2026-09-12, `plan_completion`. **실행 도구와 순서만 준비했다. 봉인된 실제 검증 batch를 아직 받지 않았으며 실제 승급·게시·정본 설치·모델 API·DB 호출은 모두 미실행이다.** 사람이 문항을 전수 확인했다고 기록하지 않는다.

실행기는 [stage-publication-v1.ts](../stage-publication-v1.ts), 분류 재결속기는 [rebind-final-catalog.ts](../rebind-final-catalog.ts)다. 총괄은 봉인 결과를 확인한 뒤 아래 명령으로 이 배치의 새 로컬 staging을 만들 수 있다. `--execute`가 없으면 기본값은 무쓰기 사전 검사다.

## 고정 범위와 준비 검사

현 candidate-v1은 전체 **154세트·351물음**이고, 이번 대상은 기존 재검증 **70세트**, 신규 검증 **50세트**, 게시 **120세트**다. `70/50/120`은 이번 작업의 의도된 범위를 확인하는 제한이며 전체 은행·물음·학습 단위 개수는 파일에서 읽는다. 준비한 전체 후보의 형상과 기존 승급 장부를 `pendingReverificationIds=기존70` 조건으로 메모리에서 검사하여 오류 0개를 확인했다. 이는 새 검수 수락이나 실제 승급은 아니다.

[preparation-lock.json](preparation-lock.json)은 현재 canonical·기존 장부·공개/암호화본·분류·candidate·원자료·실행 코드 등 89개 경로의 바이트/실경로를 고정한다. 후속 실행은 이 고정 입력과 봉인 batch의 모든 입력이 그대로인지 다시 확인한다. 과거 해시를 새 값으로 갱신하는 자동 경로는 없다.

[input-inspection.json](input-inspection.json)에 실제 notes 대조가 있다. 현재 canonical은 최초 스냅샷과 비교해 83세트의 문서 경로 notes만 바뀌었다. 이를 되돌리지 않는다. 비선택 34세트 중 32세트는 현 canonical과 candidate가 완전 동일하다. `pilot-17-001`, `pilot-17-002`는 아래 **이미 확정된 v7 경로 교정**만 다르다.

- 현재 canonical의 과거 표기: `docs/archive/과거-검토-증거/reports/question-review-2027/17.json`.
- candidate-v1의 실제 경로: `cpa_uploader/analysis/reviews/question-review-2027/17.json`.
- v7 notes 변경장부·독립 검사·실제 목적지 존재를 대조했다. 동일 모델답안의 전체 grading prompt/schema와 공개 compile 내용도 같다. source·발문·답안·criteria·배점은 바뀌지 않는다.

이 두 차이는 준비 잠금에 **정확한 before/after notes와 검토 내용 해시**로만 선언했다. 임의의 notes 변화를 무시하거나 검수 대상·유료 채점을 늘리지 않는다. `reviewedContentHash`에는 notes가 포함되므로 새 변경을 조용히 허용할 수 없다. 실제 과거 ledger 검사는 이 예외를 받지 않고 정식 core가 직접 검사한다. 나중에 다른 자료 이동이 생기면 현재 helper는 중단하고 총괄이 별도 계보·입력 영향을 검토해야 한다.

## 실행 순서

1. 봉인 readiness의 `ready/core_replay_passed=true`, `problems=[]`, batch SHA 및 seal-inputs의 batch/manifest/모든 원입력을 확인한다. 정식 `createEfficientReviewReceipt`로 대상120개를 다시 검증한다. 실제 모델 호출은 하지 않는다.
2. 총괄의 `prepare-publication.ts`를 실행하여 새 stage에 before-canonical/before-promotions 바이트 사본과 candidate 기반 authoring·기존 장부를 만든다. 기존70의 이전 lifecycle만 복원한다.
3. **기존70을 한 명령으로 `--reverify --to verified`** 한다. 기존 수정분이 모두 재검증되기 전에 신규 승급부터 시작하면 장부 내용 해시 검사가 실패한다.
4. **신규50을 `--to verified`** 한다. 두 검증 명령에만 실제 봉인 `--efficient-review`를 전달한다. `--backfill-verified`나 과거 model receipt 재작성은 사용하지 않는다.
5. **대상120을 `--to published`** 한다. 게시 명령에는 `--efficient-review`를 다시 전달하지 않고 가장 최근 verified 근거를 정식 장부가 연결한다.
6. 공식 compiler로 공개 JSON·암호화본을 만든다. 암호화 round-trip도 해당 compiler가 검증한다.
7. 게시된 stage authoring에 원 분류 entries를 그대로 재결속하고 공식 catalog 생성기·`--check`를 실행한다.
8. 공식 전체 validator, catalog 재현 검사, **`--apply` 없는 importer 로컬 readiness**를 실행한다. 최종 source byte hash·공개 compile·전체 장부·은행을 다시 확인한다.

모든 subprocess는 shell 문자열 대신 고정된 argv 배열로 호출한다. 환경변수는 child에만 아래 네 경로를 강제하고 부모 환경을 바꾸지 않는다.

| 환경변수 | 새 staging 경로 |
| --- | --- |
| `CPA_QUESTION_V3_AUTHORING_PATH` | `stage/authoring.json` |
| `CPA_QUESTION_V3_PROMOTIONS_PATH` | `stage/promotions.json` |
| `CPA_QUESTION_V3_PUBLIC_PATH` | `stage/public.json` |
| `CPA_QUESTION_V3_ENCRYPTED_PATH` | `stage/authoring.enc.json` |

모델/DB 환경키는 child 환경에서 제거한다. 암호화 키는 메모리 환경으로만 전달하고 값은 출력하지 않는다. importer는 `--apply`, `--preserve-source`, 원격 호스트/서비스키를 전달하지 않아 DB client 생성 분기로 가지 않는다. CLI에 임의 추가 인자를 넘길 수 없다.

## 총괄 실행 명령 — 아직 실행하지 않음

저장소 루트 PowerShell에서, `$sealed`를 실제로 확정한 봉인 디렉터리로 바꾼다. `$output`은 존재하지 않는 **E/c/publication-stages 아래 새 디렉터리**여야 한다. 이미 실패한 출력은 지우거나 덮어쓰지 않는다.

```powershell
$efficientBatch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12'
$sealed = '<총괄이 확정한 실제 봉인 디렉터리>'
$output = "$efficientBatch/c/publication-stages/production-stage-01"
$batch = "$sealed/batch.json"
$batchSha = (Get-FileHash -LiteralPath $batch -Algorithm SHA256).Hash.ToLowerInvariant()
$workflowArgs = @(
  '--batch', $batch,
  '--batch-sha256', $batchSha,
  '--readiness', "$sealed/readiness.json",
  '--seal-inputs', "$sealed/seal-inputs.json",
  '--output', $output
)

# 실제 seal의 원응답·전수 검토·허용 편차·잔여 제한을 총괄이 먼저 읽는다.
# 이 SHA를 단순히 현재 파일에서 계산했다는 사실이 별도 검토를 대신하지 않는다.
node --env-file=.env.local --import tsx "$efficientBatch/c/stage-publication-v1.ts" @workflowArgs --dry-run
if ($LASTEXITCODE -ne 0) { throw '사전 검사 실패: 승급을 시작하지 않습니다.' }

# 위 검사와 총괄 검토가 완료된 뒤 실제 로컬 stage를 만드는 명령이다.
node --env-file=.env.local --import tsx "$efficientBatch/c/stage-publication-v1.ts" @workflowArgs --execute
if ($LASTEXITCODE -ne 0) { throw '부분 staging을 보존하고 원인을 검토하십시오. 자동 재실행하지 않습니다.' }
```

성공 시 `completion.json`과 9개 CLI의 개별 로그/exit/signal 기록을 읽는다. 결과 상태는 `isolated_published_stage_validated_not_installed_not_db_applied`다. 기존 장부 prefix는 그대로이며 새 장부는 재검증70+신규검증50+게시120=240항목만 추가되어야 한다. 모든 단계에서 candidate와 status/review_status 외 내용이 같은지 확인한다.

소요 시간은 추정하지 않고 실제 실행 시 기록한다. `execution-plan.json.offline_receipt_preflight_ms`는 처음 봉인 증거 검증까지의 시간, 각 `*.result.json`의 `started_at/completed_at/elapsed_ms`는 해당 CLI 시간, `completion.json.elapsed_ms`는 전체 시간이다. importer 내부 전체 validator에는 기존 60초 timeout이 있으며, 이 도구는 timeout을 늘리거나 `--preserve-source`로 우회하지 않는다. 준비 단계에는 실제 sealed 수락 시간이 없으므로 미측정으로 남긴다.

실패·signal·입력 drift 시 다음 CLI를 실행하지 않는다. 로그와 이미 기록한 stage를 보존하며 자동 rollback·재시도는 하지 않는다. 단계별 CLI의 atomic 처리와 전체 workflow의 원자성은 다르다. `failure.json`이 있거나 `completion.json`이 없으면 최종 설치본으로 수락하지 않는다. importer 내부의 60초 전체-validator 제한 실패도 우회하지 않는다.

## staging 이후 별도 작업

이 도구는 canonical·원 장부·서비스 파일 설치, 운영 DB 적용, 배포를 **구현하거나 수행하지 않는다**. 총괄은 stage 결과·출처/검수 근거·잔여 채점 편차를 독립 확인하고 최종 파일을 함께 설치할 절차를 선택한다. stage catalog의 `source_file`은 stage를 가리킨다. canonical 경로로 설치하면 최종 canonical 바이트에 대해 새 review/catalog를 다시 재결속하고 정식 검사한 뒤 DB 입력으로 사용해야 한다. 이전 candidate 검증용 catalog를 덮어쓰지 않는다.

현재 `cpa_uploader/data/learning-question-classifications.json`의 `review_file`은 `cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/canonical-classification.json`이다. 이 과거 분류는 최초 104세트 판본의 해시를 보존하므로 현재 candidate의 351물음 분류 원장으로 재사용하거나 덮어쓰지 않는다. 새 원장은 **candidate-v1/classification-review.json의 전 entries**를 사용한다. 공식 builder는 기존 catalog가 가리키는 review를 기본으로 읽으므로 최종 새 review 경로를 명시해 재생성한 뒤에야 기본 `--check`가 새 원장을 따라간다.

아래는 **총괄의 별도 정본 설치 단계 이후** 절차다. 먼저 현재 canonical 4파일과 기존 catalog·과거 review의 바이트 사본/해시를 총괄 보존 경로에 확보하고, 검증된 stage의 authoring/promotions/public/encrypted를 일관되게 설치해야 한다. 그 설치를 아래 명령이 대신하지 않는다. API 실행 중인 입력은 변경하지 않는다.

```powershell
# 전제: 총괄이 stage 4파일 설치/일치와 이전 5파일+review 보존을 완료함.
$finalDirectory = "$efficientBatch/canonical-install-v1"
$canonicalReview = "$finalDirectory/classification-review.json"
$canonicalCatalogCopy = "$finalDirectory/learning-question-classifications.json"
if ((Test-Path -LiteralPath $canonicalReview) -or (Test-Path -LiteralPath $canonicalCatalogCopy)) { throw '새 최종 분류 출력 경로가 필요합니다.' }
$canonicalPaths = @{
  CPA_QUESTION_V3_AUTHORING_PATH = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'
  CPA_QUESTION_V3_PROMOTIONS_PATH = 'cpa_uploader/data/cpa_question_sets_v3.promotions.json'
  CPA_QUESTION_V3_PUBLIC_PATH = 'cpa_uploader/data/cpa_question_sets_v3.public.json'
  CPA_QUESTION_V3_ENCRYPTED_PATH = 'data/cpa_question_sets_v3.authoring.enc.json'
}
$oldPathEnvironment = @{}
foreach ($name in $canonicalPaths.Keys) { $oldPathEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
foreach ($name in $canonicalPaths.Keys) { [Environment]::SetEnvironmentVariable($name, $canonicalPaths[$name], 'Process') }

node --env-file=.env.local --import tsx "$efficientBatch/c/rebind-final-catalog.ts" `
  --bank 'cpa_uploader/data/cpa_question_sets_v3.authoring.json' `
  --review "$efficientBatch/candidate-v1/classification-review.json" `
  --output $canonicalReview --catalog-output $canonicalCatalogCopy
if ($LASTEXITCODE -ne 0) { throw '최종 canonical 분류 재결속 실패' }

# 이 명령은 기존 data/catalog의 공식 재생성이다. 총괄 보존 후에만 수행한다.
node --env-file=.env.local --import tsx scripts/build-learning-unit-catalog.ts `
  --review $canonicalReview --output 'cpa_uploader/data/learning-question-classifications.json'
if ($LASTEXITCODE -ne 0) { throw '정본 catalog 재생성 실패' }
node --env-file=.env.local --import tsx scripts/build-learning-unit-catalog.ts --check
if ($LASTEXITCODE -ne 0) { throw '기본 경로 catalog 검증 실패' }
node --env-file=.env.local --import tsx cpa_uploader/validate_cpa_v3.ts
if ($LASTEXITCODE -ne 0) { throw '설치 후 전체 정본 검증 실패' }
node --env-file=.env.local --import tsx scripts/import-question-bank-v3.ts `
  --learning-catalog 'cpa_uploader/data/learning-question-classifications.json' `
  --report "$finalDirectory/db-readiness.json"
if ($LASTEXITCODE -ne 0) { throw '설치 후 DB 로컬 readiness 실패' }
} finally {
  foreach ($name in $oldPathEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $oldPathEnvironment[$name], 'Process') }
}
```

별도 수동 실행의 staging 환경이 남을 수 있으므로 위 정본 검사 블록은 네 경로를 canonical로 명시하고 종료 시 이전 부모 환경을 복원한다. `rebind`의 bank와 official validator/importer의 source가 같은 canonical을 가리키는지 최종 `db-readiness.source_file_hash`로 재확인한다. 새 catalog의 source_file은 canonical이고 source_file_sha256은 최종 바이트, review_file은 새 canonical review여야 하며 staging 문자열이 남아 있으면 설치를 완료로 보고하지 않는다. 새 catalog 사본과 data/catalog의 바이트도 동일해야 한다.

원격 반영은 [B의 별도 계약 검토](../../b/publication-preflight.md)를 따른다. `--expected-hash`는 최종 **파일 바이트 SHA**이고 reviewed content hash와 다르다. 원격 적용 후 조회 실패는 미적용으로 단정할 수 없으므로 같은 쓰기를 자동 반복하지 않는다. 이 작업에서 remote/API는 0회다.

## 준비 도구 검사 범위

[fixtures.mjs](fixtures.mjs)의 **17개 합성/순수 로컬 검사**가 통과했다. 실제 70/50/120 도출, 선언된 notes만 허용, 추가 notes/본문·ID 변조 거부, lifecycle-only 수락, child 환경 범위/부모 보존, 명령 순서·DB apply 거부, 출력/해시 drift·실패 경계, sealed batch 부재 시 출력·subprocess 미생성을 검사했다. 시간 기록 보완 전 `synthetic-fixture-Hpan6e/`와 최종 후속 `synthetic-fixture-Lsh9rq/`를 구분해 보존했다. 초기 준비 잠금은 `preparation-lock-before-timing-followup.json`에 보존했고 실제 실행용 `preparation-lock.json`은 timing-only helper 변경을 명시한다. 원 데이터·core·모델 실행 잠금의 해시를 갱신한 작업이 아니다.

대상 TypeScript와 lint도 확인한다. 실제 봉인 근거로 9개 CLI를 연결 실행하는 검사는 아직 하지 않았다. 준비 검사 통과를 의미검수·실제 채점·게시·DB 완료로 해석하지 않는다.
