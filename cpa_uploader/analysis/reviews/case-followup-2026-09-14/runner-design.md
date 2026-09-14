# 후속 사례 6개 실행 준비

사용자가 확정한 신규 6사례·18물음의 비용 통제 검증 절차다. 이 문서는 실행 준비 기록이며, helper 작성과 정적 검사를 내용 검수·실제 채점·게시 완료로 표시하지 않는다.

## 입력과 책임

- 초안 폴더(D)는 `cpa_uploader/drafts/case-followup-2026-09-14`, 검토·실행 폴더(R)는 이 폴더다.
- 작성자 a/b는 각각 3사례를 `sets.json`, `design.json`, `review.json`, `qa.json`에 작성한다. root는 `candidate-v1.json`, `catalog-v1.json`, `changed-sets-v1.json`, `case-reviews.json`, `case-qa.json`, `designs.json`, `draft-evidence.json`을 통합한다. 신규 ID는 `changed-sets-v1.json`에서 읽는다.
- 제작 시 비교 입력은 D의 `bank-before.json`, `catalog-before.json`, `classification-before.json`, `source-catalog.json`이다. KGA 540의 추가 직접 근거 등록 중간 snapshot인 `source-catalog-v2.json`과 최종 제작 입력인 `source-catalog-v3.json`도 별도로 동결한다. 초기 카탈로그 snapshot을 덮어쓰지 않는다. 실제 통합의 보존 기준은 R의 `integration-baseline/bank.json`, `catalog.json`, `classification.json`과 `integration-baseline.json`이다. 각 시점의 입력을 보존한다.
- root는 전 물음의 원문·정답·발문·배점·유형·주제·판본·기존 문제 차이를 실제 읽고 `root-content-review.json`에 물음별 이유와 8개 내용 검토 항목을 기록한다. `method`는 `agent_content_review`, `human_review_performed`는 `false`이며 미해결 결함이 없어야 한다. helper가 형상 검사에서 내용 pass를 만들어 주지 않는다.
- `draft-evidence.json`에는 작성자 자료뿐 아니라 실제 대조한 기출·고급연습 원파일, 2026 기준서 원문/추출본, 수집 manifest와 원자료의 경로·해시를 등록한다. builder는 여기의 파일과 새 문항 `source_refs` 파일을 동결한다. 문서 내부에 경로를 적은 것만으로 해당 원파일이 자동 동결되지는 않는다.
- `authorization.md`는 실제 사용자 범위를, `policy-input.json`은 금액 정책을 기록한다. 이번 금액은 `budget_usd: null`, `budget_enforcement: "not_specified"`다. 과거 금액 상한을 새 승인으로 복사하지 않는다. 모델은 Luna를 유지하며 제공자 한도·잔액·429 오류에서는 후속 호출을 멈춘다.

## 실행 순서

[`build-execution.mjs`](build-execution.mjs)는 기존 은행 객체 보존, 신규 ID 6개, 사례당 3물음, 사실관계 400자 이상, 전 물음 사례형, authoring 형상·실제 인용, 후보 은행과 catalog 해시, 전수 작성자/root 검토, 대표 부분·오답의 criterion 정수 합계를 검사한다. 사실 분량은 `facts[].text`를 LF로 이은 문자열의 Unicode 코드포인트 수로 계산한다. 공백은 포함하고 제목·발문은 제외한다.

통과하면 새 `execution-v1`에 대표 기대값·모범답안 원문·사례 전체 투영·검토 장부·공통 채점 코드·배치 기록기 사본과 각 파일 해시를 보존한다. 자체 runtime snapshot index를 새 manifest에 직접 등록한다. a/b worker가 사례 3개씩 맡아 사례 전체의 모범·부분·오답을 각각 한 요청으로 통합하므로 18개 논리 요청으로 54개 물음 답안을 검증한다. 이는 전 물음에 부분정답이 존재하는 2점 이상 설계일 때의 수치다. 1점 물음에는 부분정답을 꾸며 넣지 않는다. 저장 모범답안은 `model_answer.join('\n')` 그대로 사용한다.

root가 입력 통합과 실제 내용 검토를 마친 후 실행한다.

```powershell
node --import tsx cpa_uploader/analysis/reviews/case-followup-2026-09-14/build-execution.mjs
$taskManifest = 'cpa_uploader/analysis/reviews/case-followup-2026-09-14/execution-v1/grading-manifest.json'
$taskManifestSha = (Get-FileHash -LiteralPath $taskManifest -Algorithm SHA256).Hash.ToLowerInvariant()
node --import tsx cpa_uploader/analysis/reviews/case-followup-2026-09-14/run-efficient-grading.ts --manifest $taskManifest --manifest-sha256 $taskManifestSha --worker a --output cpa_uploader/analysis/reviews/case-followup-2026-09-14/execution-v1/dry-a --stop-file cpa_uploader/analysis/reviews/case-followup-2026-09-14/execution-v1/STOP.json --dry-run
node --import tsx cpa_uploader/analysis/reviews/case-followup-2026-09-14/run-efficient-grading.ts --manifest $taskManifest --manifest-sha256 $taskManifestSha --worker b --output cpa_uploader/analysis/reviews/case-followup-2026-09-14/execution-v1/dry-b --stop-file cpa_uploader/analysis/reviews/case-followup-2026-09-14/execution-v1/STOP.json --dry-run
```

두 dry run의 `status=dry_run_complete`와 SDK 0회를 확인한다. 역할별 점수 범위·전 물음 커버·모범답안 원문·투영·실제 요청 중복·코드/출처 동결 검사도 이 단계에서 수행한다. 실제 채점은 같은 manifest SHA로 위 명령의 `--dry-run`을 빼고 `dry-a`/`dry-b`를 새 `actual-a`/`actual-b` 경로로 바꾸어 실행한다. 키는 `node --env-file=.env.local --import tsx`로 읽으며 환경 전체나 키를 출력하지 않는다. 두 worker는 병행 가능하나 동결한 파일은 실행 중 수정하지 않는다.

## 기록기 계보와 사용량

[`recorder-provenance.json`](recorder-provenance.json)은 직전 `case-additional-2026-09-14`의 실제 파일 바이트를 이번에 읽고 복사한 직접 계보다. `run-efficient-grading.ts`, `contract.ts`, `accounting.ts`는 동일 깊이 경로에서 바이트 그대로 복사했다. `seal.mjs`는 배치 경로만 바꿨다. `build-execution.mjs`는 배치 경로를 바꾸고 후속 원자료 카탈로그도 동결 대상에 추가했다. 초기 복사 기록은 `recorder-provenance-initial.json`에 보존했다. 과거 기록기의 원형이나 오래된 해시를 이번 직접 복사 원본으로 표기하지 않는다.

원요청·원응답·비열거 `_request_id` 메타데이터·사용량 이벤트·응답 모델·SDK 호출 횟수를 보존한다. 보안·ID·인용·합산 검사는 운영 채점 계약을 사용하며 기록 오류를 감점이나 추가 모델 호출로 바꾸지 않는다. 허용 편차를 없애기 위한 자동 재호출은 없다. 계산기는 2026-09-12 확인 단가 snapshot을 유지하며 현재 단가를 새로 확인했다고 주장하지 않는다. 누락된 사용량은 unknown이고, 출력 토큰에 포함된 추론 토큰을 다시 합산하지 않는다.

## 조사·재개·봉인

물음별 기대점수와 실제 점수가 ±1점 안에 드는 관측이 95% 이상인지 측정한다. 이 허용은 채점 편차에만 적용하며 원문·정답·발문·배점·기대값·보안/형상 결함을 면제하지 않는다. 허용 범위 밖 결과는 원답안·기대값·실측을 보존하고 원인과 학습 영향을 조사한다. 필요한 수정과 표적 검사만 추가하고 통과 결과만 골라 분모를 바꾸지 않는다.

실행 오류의 원출력·STOP·실패 호출 비용은 보존한다. 재개에는 새 `execution-resume-vN`을 만들고 원래 관측의 실제 호출 당시 manifest를 연결한다. 모델·원요청·기대값·행동 코드가 같은 성공 관측만 현행 consumer로 검증해 재사용한다. 새 실행은 자체 runtime index를 등록하며 옛 manifest의 해시를 고치지 않는다. 내용이 바뀌면 해당 최종 내용을 다시 검토·실측한다.

```powershell
node --import tsx cpa_uploader/analysis/reviews/case-followup-2026-09-14/seal.mjs
```

[`seal.mjs`](seal.mjs)는 완료 summary와 고정 요청 전수, 원응답 해시, 보안 오류 부재, 작성자/root 검토, 현행 `createEfficientReviewReceipt`의 source·provenance·허용률 검사를 거쳐 `sealed-v1/batch.json`, `receipts.json`, `summary.json`, `readiness.json`을 작성한다. ±1점 밖 결과가 있으면 `residual-findings-v1.json`에 관측 ID·물음 ID·delta와 실제 조사 결과를 모두 기록해야 한다.

재개가 있었다면 `--execution execution-resume-vN --output sealed-vN --prior-executions execution-v1,execution-resume-v2`처럼 실제 과거 실행을 빠짐없이 넘긴다. 수용 관측을 생성한 실행의 summary가 없으면 봉인을 거절한다. 비용은 각 실행의 `new_usage`와 `actual_sdk_calls`를 한 번씩 합산하고 재사용 비용을 다시 더하지 않는다. 미반환 사용량은 따로 기록한다.

정본·공개본·운영 DB 반영은 사용자 승인 범위를 이어받아 root가 관리한다. 봉인 이후 격리 게시·기존 내용 보존·최종 catalog/공개본 검사·운영 DB 등록과 별도 실조회 검증을 마쳐야 각 단계 완료를 보고한다. 이 helper 준비 작업은 실제 모델 호출이나 게시·DB 작업을 수행하지 않았다.
