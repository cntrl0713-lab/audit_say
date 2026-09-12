# R4 generated grading wave 01 — 잔액 소진으로 실제 실행 전 대기

선택한 **12세트의 의미검수는 완료·pass**, 이 wave의 **generated grading과 작성자 QA 실제 실행은 모두 0**이다. worker-v3의 두 단계 dry-run이 원 manifest/run/set summary/request/receipt 및 현재 코드·은행·질문·계획·출처 신원을 통과했다. 사용자 충전 후 총괄이 재개를 지시하기 전에는 실제 실행이나 availability probe를 하지 않는다.

manifest SHA-256: `0a4a1b18244556bdcece799dc03cae8473c90603bd5b121df72e5c151ca459bd`.

대상: 01-004, 03-002, 03-004, 02-001, 04-002, 02-005, 04-004, 05-005, 04-001, 05-001, 05-002, 05-006 (`pilot-` 접두사 유지). 원 remaining 9pass, 단일 재개 05-001, pending의 05-002/05-006을 모았다. 생성 assertion 345개와 작성자 QA 329개이며, assertion 수는 실제 호출 수가 아니다. 동일 답안 합치기·빈 답안·실행 중 프로토콜 재시도로 실제 수는 달라진다.

선행 canary 3개는 이미 채점했으므로 제외했다. nonpass/부분/실행 실패는 제외했고 snapshot 이후 새 완료는 이 manifest에 자동 추가하지 않는다. 새 worker는 b지만 `semantic_provenance.worker`는 원 a/b/c를 그대로 보존한다.

## 재개 전

`handoff.json` 및 `frozen-inputs.json`의 현재 hash를 대조한다. 코드/은행/원 질문/계획/QA/출처/원 receipt가 달라졌으면 기존 잠금 hash를 바꾸어 재개하지 않는다. 실제 출력이 미사용인지 확인하고, STOP이 있으면 삭제하지 말고 새 실행 경로를 총괄과 정한다. 현재 생성된 것은 준비·dry-run 기록뿐이다.

사용자 충전과 총괄의 실제 재개 신호가 확인되면 아래 명령을 실행한다. 한 번에 B API 스트림 하나만 사용하며 A 의미검수/C smoke와 총 3개를 넘기지 않는다.

```powershell
$batch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11'
$wave = "$batch/b/r4-grading-wave-01"
$env:CPA_GRADING_MODEL = 'gpt-5.6-luna'
$env:CPA_REVIEW_MODEL = 'gpt-5.6-luna'
$env:CPA_REVIEW_INPUT_MAX_CHARS = '500000'
node --env-file=.env.local "$batch/b/validation-worker-v3.mjs" --manifest "$wave/manifest.json" --worker b --phase grading --output "$wave/grading-b" --stop-file "$wave/STOP"
```

generated grading이 전부 완료되고 `summary.json`의 `stopped_on_execution_error=false`, `recorded_sets=12`, `not_started_set_ids=[]`를 확인한 뒤 작성자 QA를 이어간다. 엄격 불일치가 있으면 원판정과 원답안을 보존해 보고한다. 명확한 전체 기대점수나 보수적 범위 증명이 없는 generated target 판정에서 전체 기대점수를 임의로 추정하지 않는다.

```powershell
$qaOutput = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v4/grading-wave-01/author-qa-b'
node --env-file=.env.local "$batch/b/validation-worker-v3.mjs" --manifest "$wave/manifest.json" --worker b --phase author-qa --output "$qaOutput" --stop-file "$wave/STOP"
```

CLI 실행 오류·429·quota·증거 저장 오류이면 자동 중단 결과를 보존하고 총괄에 보고한다. 같은 인증으로 다른 세트를 시도하지 않는다. 점수 범위 내 편차를 없애려 추가 진단 반복을 하지 않는다. 작성자 QA runner의 내장 반복은 그대로 보존한다. 원 receipt의 strict `matched=false`를 pass로 바꾸지 않는다. 별도 편차 수락·사람 확인·승급·DB 적용은 이 실행의 결과가 아니다.

## 현재 중단 근거와 산출물

총괄 `api-availability-v2/diagnosis.json`에서 `credit_balance_exhausted` / `insufficient_quota`가 확인되어 전체 API가 중지됐다. 이 wave는 그 진단 이전에도 실제 모델을 호출하지 않았다.

- `selection.json`: 12개 선택 근거·원 담당·당시 완료 시각·제외 대상·원 입력 hash.
- `grading.dry-run.stdout.json`, `author-qa.dry-run.stdout.json`: worker-v3 실제 dry-run 결과. 두 단계 모두 12대상, 모델 호출/생산 subprocess 0.
- `preflight.json`: 당시 dry-run 완료 기록. 당시 대기 사유는 transport 진단 전이므로 그대로 보존한다.
- `handoff.json`, `frozen-inputs.json`: 현재 quota 중단 상태와 재개를 위한 입력 고정.

준비기의 최초 로컬 실행은 저장소 루트 상대 깊이를 잘못 계산해 ENOENT로 종료했고 API·manifest 생성 전에 수정했다. 최종 manifest와 dry-run은 올바른 실제 경로를 사용한다. 생산 코드와 이전 입력/실행 기록은 수정하지 않았다.
