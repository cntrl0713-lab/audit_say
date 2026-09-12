# 명시적 후속 준비 잠금을 받는 staging v2

2026-09-12, `plan_completion`. **도구만 준비했다. final003 패치가 아직 적용·검토되지 않았으므로 실제 후속 준비 잠금은 만들지 않았고, stage·API·DB·정본 쓰기는 0회다.** 기존 v1 도구와 잠금은 바이트 그대로 보존했다.

[stage-publication-v2.ts](../stage-publication-v2.ts)는 v1에 다음만 추가한다.

- 필수 `--preparation-lock <파일>`과 `--preparation-sha256 <정확한 SHA>` 인자. 기본 동작은 여전히 무쓰기 dry-run이다.
- 선택한 준비 잠금의 바이트 해시 확인, v1 보호 경로 전체와 v2 실행기·v1 잠금 자체가 새 보호 목록에 있는지 확인. 보호 대상 삭제나 중복을 허용하지 않는다.
- dry-run, execution-plan, completion에 실제 선택한 준비 잠금 경로·SHA를 기록.

기존70 전체 재검증→신규50 검증→120 게시→compile→분류 재결속→전체 정적 검사의 **9개 명령과 argv·환경·순서가 v1과 같다**. 봉인 batch/core replay/원입력 확인, source guard, lifecycle-only 대조, 기존 장부 prefix/추가240 확인, child의 네 경로 제한, 실패 중단, 원자료 보존, DB 미호출 계약도 그대로다.

[changes.json](changes.json)과 [정확한 diff](v1-v2.diff)에 대조를 남겼다. TypeScript AST로 모든 함수 본문을 비교하여 12개 함수가 그대로이며, `parseOptions`와 `main`만 변경됨을 확인했다. 기존 v1 실행기는 `ed7eb55b9d43dff113e53884ba9d4bf7dfadb15611c4e037705096d70f0ec584`, 기존 준비 잠금은 `fd0c3dee251ce23a49db8eab97afa0e48ba3f891490f0951ce990c34c09a142f`다.

## 패치 이후 새 잠금 만드는 도구

[prepare-lock.ts](prepare-lock.ts)는 **root가 공통 패치와 검사를 끝내고 execution003 manifest를 확정한 뒤** 실행한다. 지금 실행하여 새 잠금을 만들지 않았다. 미검토 [형식 예시](change-review.template.json)는 `status=not_reviewed`이므로 실행 근거로 사용할 수 없다.

root가 실제 패치·검사 증거를 읽은 새 change-review JSON에는 다음이 필요하다.

- `artifact_type=publication_preparation_change_review`, `status=reviewed`, 실제 검토자와 검토 완료 시각.
- 기존 준비 잠금 이후 **실제로 바뀐 파일 전부**의 경로, 정확한 before/after SHA, 변경 이유. 미변경 파일이나 존재하지 않는 변경을 끼우면 거절한다.
- 실제 패치·회귀 검사·독립 검토의 증거 파일과 그 SHA를 담은 `validation_evidence`.

생성기는 기존89개 보호 경로를 유지하고, 새 manifest의 code_files·inputs와 새 도구/증거를 추가한다. 기존 경로의 모든 byte 변경이 change-review와 정확히 일치해야 하며 실경로 교체·누락·없는 파일로 변환은 거절한다. 변경이 0개인 패치 전 재해시도 거절한다. 새 manifest에 지정된 입력과 현재 실제 바이트를 각각 대조한다.

다음은 변경 선언이 있어도 고칠 수 없다: canonical 5파일, candidate-v1 은행·분류·target scope·원 grading manifest, 공식/기타 source_ref 원자료, v1 실행기/검사기. 이번 후속은 QA 선택과 검증 consumer 보완이지 문항이나 과거 증거의 재작성 경로가 아니다. QA 후속은 새 파일/새 manifest로 연결하고 원본을 보존한다.

새 잠금을 쓰기 전에 실제 전체 은행 형상과 기존70 pending 범위의 장부를 메모리에서 검사한다. 이는 새 유료 채점이나 검수 승급이 아니다. root가 지정한 새 파일에만 `wx`로 쓰며 기존 잠금을 덮어쓰지 않는다. 입력을 같은 Buffer로 파싱·해시하고 쓰기 전후 변화도 검사한다. 잠금의 `sealed_results_validated=false`는 실제 봉인 수락을 아직 하지 않았다는 뜻이다.

## root 명령 — 패치·검사 완료 이후

`$patchReview`와 `$manifest003`은 실제 후속 검토·실행 manifest 경로다. 아래 위치나 수치를 미리 통과한 증거로 만들지 않는다. snapshot-index/runner-guard 패치와 해당 회귀 검사, 737개 재사용+1개 후속 실제 채점은 각각 실제 결과대로 기록해야 한다.

```powershell
$efficientBatch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12'
$previousLock = "$efficientBatch/c/publication-workflow-v1/preparation-lock.json"
$previousSha = 'fd0c3dee251ce23a49db8eab97afa0e48ba3f891490f0951ce990c34c09a142f'
$patchReview = '<실제 패치·회귀 검사 후 작성한 reviewed change-review.json>'
$manifest003 = '<실제로 확정한 execution003 grading-manifest.json>'
$newLock = "$efficientBatch/c/publication-workflow-v2/preparation-003.json"
$patchReviewSha = (Get-FileHash -LiteralPath $patchReview -Algorithm SHA256).Hash.ToLowerInvariant()
$manifestSha = (Get-FileHash -LiteralPath $manifest003 -Algorithm SHA256).Hash.ToLowerInvariant()
$lockArgs = @(
  '--previous-lock', $previousLock, '--previous-sha256', $previousSha,
  '--change-review', $patchReview, '--change-review-sha256', $patchReviewSha,
  '--manifest', $manifest003, '--manifest-sha256', $manifestSha,
  '--output', $newLock
)

# 기본값은 검사만. 새 파일을 만들지 않는다.
node --import tsx "$efficientBatch/c/publication-workflow-v2/prepare-lock.ts" @lockArgs
if ($LASTEXITCODE -ne 0) { throw '후속 잠금 검사 실패. 원인을 검토하십시오.' }

# 위 대조 결과를 root가 확인한 뒤 새 잠금 한 파일만 생성
node --import tsx "$efficientBatch/c/publication-workflow-v2/prepare-lock.ts" @lockArgs --write
if ($LASTEXITCODE -ne 0) { throw '후속 잠금 생성 실패. 남은 파일을 수락하지 않습니다.' }
$newLockSha = (Get-FileHash -LiteralPath $newLock -Algorithm SHA256).Hash.ToLowerInvariant()
```

원 manifest를 고쳐 새 코드에 맞추지 않는다. helper는 새 manifest의 bank가 현재 candidate-v1을 그대로 가리키는지도 확인한다. 문항/분류 자체의 변경이나 다른 은행 경로가 생겼다면 이 배치 한정 도구를 임의 인자로 우회하지 말고 별도 후속 검토가 필요하다.

## final003 봉인 이후 v2 staging

```powershell
$sealed003 = '<실제 final003 봉인 디렉터리>'
$batch003 = "$sealed003/batch.json"
$batch003Sha = (Get-FileHash -LiteralPath $batch003 -Algorithm SHA256).Hash.ToLowerInvariant()
$stageOutput = "$efficientBatch/c/publication-stages/production-stage-003"
$stageArgs = @(
  '--batch', $batch003, '--batch-sha256', $batch003Sha,
  '--readiness', "$sealed003/readiness.json", '--seal-inputs', "$sealed003/seal-inputs.json",
  '--preparation-lock', $newLock, '--preparation-sha256', $newLockSha,
  '--output', $stageOutput
)
node --env-file=.env.local --import tsx "$efficientBatch/c/stage-publication-v2.ts" @stageArgs --dry-run
if ($LASTEXITCODE -ne 0) { throw '새 봉인 staging 검사 실패' }
node --env-file=.env.local --import tsx "$efficientBatch/c/stage-publication-v2.ts" @stageArgs --execute
if ($LASTEXITCODE -ne 0) { throw '부분 staging을 보존하고 조사하십시오. 자동 재실행하지 않습니다.' }
```

다음 정본 installer에도 **같은 `$newLock/$newLockSha`**를 전달한다. stage completion의 `preparation_lock`과 일치하는지 root가 확인한다. 정본 설치기 자체의 별도 구현 잠금은 도구 신원용이며 공통 runtime 변경을 승인하는 근거가 아니다. 기존 문항·반례·실행 영수증은 계속 보존한다.

## 검사와 미실행

[fixtures.mjs](fixtures.mjs)의 합성/읽기 대조 13개가 통과했다. 새 필수 인자와 SHA/얇은 잠금 거부, v1과 명령·환경 동일, 70/50/120 및 notes 보호, lifecycle/실패 경계, 실제 코드 변경의 명시 before/after·근거 필수, 원자료 변경/보호 삭제 거부, 쓰기 기본값을 확인했다. 결과의 synthetic preparation 파일은 의도적으로 무효인 테스트 입력이며 새 실행 잠금이 아니다.

대상 TypeScript·lint와 최종 해시는 handoff에 기록한다. 실제 공통 패치 이후의 새 잠금 생성, actual sealed receipt 수락, 9단계 staging 실행, 정본 설치·DB 반영은 이 준비 작업에서 미실행이다.
