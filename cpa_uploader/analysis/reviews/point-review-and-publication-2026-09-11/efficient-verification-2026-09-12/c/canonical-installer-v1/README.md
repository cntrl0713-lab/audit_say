# 이번 배치의 정본 설치기 — 실행 전 준비

`plan_completion`, 2026-09-12. [install-canonical-v1.ts](../install-canonical-v1.ts)는 총괄이 최종 봉인·staging을 독립 확인한 뒤 사용할 도구다. **현재 실제 stage completion을 받아 실행하지 않았다. 정본·승급 장부·DB 수정과 모델 API 호출은 0회다.** 준비 파일은 E/c에만 작성했다. 사람의 문항 전수 확인을 주장하지 않는다.

## 고정 입력과 실행 범위

입력은 이번 배치 `c/publication-stages/<새 실행>/completion.json`과 총괄이 확인한 그 파일의 SHA-256, **선택한 준비 잠금 파일과 SHA-256**이다. `--preparation-lock`이 가리키는 현재 canonical 5파일·후보·공통 코드·출처를 확인한다. [첫 staging 준비 잠금](../publication-workflow-v1/preparation-lock.json)은 당시 준비본으로 보존한다. 후속 core/QA 수락 계약이 달라졌으면 총괄이 변화·검사 근거를 기록한 새 잠금을 전달해야 하며, 옛 해시를 소급 갱신하지 않는다. 새로운 도구의 자기 신원만 `implementation-lock.json`에 별도로 기록한다.

root는 run-v2의 `04-007` partial 선정 기대 오류에 대해 원기대를 보존한 QA 후속과 execution003에서 불변 원응답 재사용·해당 사례 표적 실측을 준비 중이라고 전달했다. installer 준비는 이 후속 검증이 끝났다고 주장하지 않는다. 기존 stage-publication-v1 실행기는 첫 준비 잠금 경로가 고정되어 있으므로, 새 공통 consumer 계약으로 staging을 실행하기 전에는 총괄의 명시적인 후속 실행기/준비 잠금 판본이 필요하다. installer는 그 후속 stage completion 및 준비 잠금을 인자로 받는다.

대상은 기존70 재검증·신규50 검증·대상120 게시 완료 staging이며, 전체154/351을 검사 당시 파일에서 계산한다. installer는 다음을 실행 전에 검사한다.

- stage completion의 성공 상태/파일 SHA, 9개 단계 로그/exit/signal, 선택 ID와 lifecycle, stage before 사본이 현재 canonical·원 장부 바이트와 같은지.
- 최종 은행 전체 형상, 정식 core의 전체 승급 장부·효율 검증 근거, 옛 장부 prefix와 이번240개의 정확한 전이 ID/순서.
- candidate와 상태 두 필드 외 내용 불변, 공개 compile 일치, encrypted→authoring 정확한 round-trip, stage DB 로컬 readiness의 source byte hash.
- 기존 canonical 5파일과 과거 catalog가 가리키는 review 파일의 실제 해시. 과거 review는 수정하지 않는다. 이전 catalog의 source hash는 과거 원문 판본을 가리킬 수 있으므로 새 분류는 candidate-v1 원장에서 만든다.

이 검사는 해시만으로 내용 검수를 새로 승인하지 않는다. 실제 봉인된 agent 검토·대표 실측을 정식 core가 다시 수락해야 진행된다. notes의 이미 확인된 경로 교정은 staging 장부에만 명시된 exact 변화로 이어받으며, 새로운 notes drift는 허용하지 않는다.

## 실제 설치 순서

1. `withPublicationLock(canonical authoring)`을 잡고 입력을 다시 검사한다. 다른 정상 승급/compile CLI와 같은 lock이며 설치·검사·동기 롤백이 끝날 때까지 유지한다.
2. 선택한 새 출력 폴더 `E/canonical-install-v1/<새 이름>/backup`에 기존 **authoring/promotions/public/encrypted/catalog 5파일과 과거 classification review**를 byte-identical로 보존한다. `before.json`에 경로·SHA·stage completion·대상 ID를 기록한다.
3. `writePublicationFiles`로 stage의 authoring/promotions/public/encrypted 4파일을 canonical에 설치한다. 5개 현재 파일 해시를 guard로 전달하고 각 설치 결과를 확인한다.
4. 기존 rebind helper에 **canonical authoring 경로**와 candidate-v1 classification-review를 전달하여 새 review/catalog를 출력 폴더에 생성한다. 공식 catalog 생성기가 사용되며 분류 entries와 전체 내용 계약은 그대로여야 한다.
5. 공식 생성기가 만든 catalog의 정확한 UTF-8 바이트를 `writePublicationFiles`로 `cpa_uploader/data/learning-question-classifications.json`에 설치한다. 이 방식은 catalog도 같은 guarded writer로 다룬다. 그 뒤 공식 builder의 명시 경로 `--check`와 기본 `--check`를 모두 실행한다.
6. 정식 전체 canonical validator를 실행한다. 4개 파일이 stage와 byte-identical, data/catalog가 새 생성본과 byte-identical인지 최종 확인한다. `completion.json`에 5파일·새 review·백업·개수·소요 시간을 남긴다.

새 catalog의 source_file은 canonical authoring이며 새 review_file은 이번 출력의 `classification-review.json`이다. stage 경로에 묶인 catalog를 정본으로 그대로 복사하지 않는다. 기존 `question-unit-migration-2026-09-11/canonical-classification.json`은 과거 원장으로 보존한다.

subprocess마다 네 `CPA_QUESTION_V3_*_PATH`를 canonical로 명시하며 부모 환경을 바꾸지 않는다. 모델·DB 키와 `NODE_OPTIONS`는 child에 전달하지 않는다. 암호화 키만 process 환경에서 읽으며 출력하지 않는다. **DB importer·원격 조회·API·배포 명령은 installer에 없다.** 최종 DB 적용은 총괄의 별도 작업이다.

## 실패·롤백 경계

모든 CLI 로그와 exit/signal/elapsed_ms를 보존한다. 설치 후 실패하면 lock을 유지한 채 정본 5파일의 실경로·현재 바이트를 먼저 검사한다. 각 파일이 실제 백업 바이트 또는 이 설치기가 쓰려고 한 정확한 결과 중 하나인 경우에만 공통 guarded writer로 **5파일 모두 원본 바이트로 동기 롤백**한다.

한 파일이라도 다른 작업의 변경·삭제·출처를 알 수 없는 부분 바이트이면 **전체 자동 롤백을 거절**한다. 나머지를 임의로 되돌려 혼합 상태를 더 만들지 않으며 `failure.json`에 파일별 관측 해시/판정과 `refused_foreign_or_unknown_change`를 기록한다. 생성된 새 review/catalog, 백업, 단계 로그는 삭제하지 않는다. 총괄이 현재 상태를 조사하기 전에는 설치나 DB 반영을 반복하지 않는다.

일반 단계 진행 중에는 단순히 옛/새 바이트 중 하나가 아니라 **직전 성공 단계에서 기대한 정확한 현재 해시**를 요구한다. 옛/새 두 값 허용은 실패 후 복원 가능성을 판단할 때만 사용한다. core writer가 내부 실패 후 이미 원본으로 복원한 상황도 안전하게 확인할 수 있다.

이는 공통 lock을 따르는 작업 간 직렬화와 동기 실패 처리다. OS/process crash에 대한 5파일 트랜잭션은 아니며, lock을 무시하는 외부 writer가 최종 guard 이후 rename 사이에 끼는 모든 경우를 원자적으로 막는다고 주장하지 않는다. crash·강제 종료·디스크 오류·rollback 실패·lock 해제 실패가 있으면 백업과 현재 파일을 직접 조사한다. `completion.json`만 보고 성공으로 판단하지 않고 최종 프로세스 종료 0과 모든 파일 해시를 확인한다.

## 총괄 명령 — 아직 실행하지 않음

```powershell
$efficientBatch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12'
$stageCompletion = '<총괄이 최종 확인한 c/publication-stages/실행폴더/completion.json>'
$completionSha = (Get-FileHash -LiteralPath $stageCompletion -Algorithm SHA256).Hash.ToLowerInvariant()
$preparationLock = '<총괄이 후속 코드·자료 검토 후 확정한 새 준비 잠금 JSON>'
$preparationSha = (Get-FileHash -LiteralPath $preparationLock -Algorithm SHA256).Hash.ToLowerInvariant()
$installOutput = "$efficientBatch/canonical-install-v1/install-01"
$installArgs = @('--stage-completion', $stageCompletion, '--completion-sha256', $completionSha,
  '--preparation-lock', $preparationLock, '--preparation-sha256', $preparationSha, '--output', $installOutput)

node --env-file=.env.local --import tsx "$efficientBatch/c/install-canonical-v1.ts" @installArgs --dry-run
if ($LASTEXITCODE -ne 0) { throw '설치 사전 검사 실패. 정본을 바꾸지 않습니다.' }

# 실제 stage의 검토/허용 상태와 dry-run을 총괄이 확인한 뒤에만 실행
node --env-file=.env.local --import tsx "$efficientBatch/c/install-canonical-v1.ts" @installArgs --execute
if ($LASTEXITCODE -ne 0) { throw '실패·롤백 장부와 현 정본을 먼저 조사하십시오. 자동 재실행하지 않습니다.' }
```

기본은 dry-run이며 출력 폴더를 만들지 않는다. `--execute`도 기존 출력·불일치 해시·실패 stage·미수락 검증을 거절한다. 실행이 끝난 뒤 이 도구를 같은 이름으로 재실행하여 증거를 덮지 않는다.

## 로컬 검사와 미실행 범위

[fixtures.mjs](fixtures.mjs)는 **합성 JSON 5파일**에만 공통 writer/lock/rollback을 실행했다. 5개/4개 설치 후 복원, 외부 변경 시 전혀 쓰지 않음, 미확인 부분 파일/삭제/실경로 차이 거부, stale guard 거부, lock 충돌, 동기 오류 복원, 비UTF-8 거부, child 환경 범위, CLI/출력 경계 총12개가 통과했다. 실제 정본을 대상으로 설치·rollback한 테스트가 아니다.

대상 TypeScript·lint 검사와 최종 구현 해시는 `handoff.json`에 기록한다. 실제 stage completion으로 전체 installer CLI를 실행하는 검사는 아직 미실행이다. 설치 단계 소요 시간도 실제 실행 전에는 미측정이다.
