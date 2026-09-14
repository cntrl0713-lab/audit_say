# 신규 사례 6개 실행·게시 설계

이 문서는 2026-09-14 신규 사례 6개·각 3물음의 실행 준비 기록이다. helper 작성과 정적 확인만으로 내용 검수·실제 채점·정본 게시·DB 반영을 완료했다고 표시하지 않는다.

## 입력과 소유권

- 초안 경로는 `cpa_uploader/drafts/case-additional-2026-09-14`(D), 실행 경로는 이 폴더(R)다.
- 작성자 a/b는 각각 `sets.json`, `design.json`, `review.json`, `qa.json`에 실제 대조한 내용과 기대값을 남긴다. root는 이를 읽고 `candidate-v1.json`(기존 전체 은행+신규 6개), `catalog-v1.json`, `changed-sets-v1.json`, `case-reviews.json`, `case-qa.json`, `designs.json`, `draft-evidence.json`을 통합한다.
- D의 `bank-before.json`, `catalog-before.json`, `classification-before.json`, `source-catalog.json`은 제작 당시 비교 입력이다. 원자료와 출처 계보는 작성자 장부 및 `draft-evidence.json`으로 연결한다.
- `root-content-review.json`은 18개 물음별 검토 이유와 `source`, `answer`, `prompt`, `points`, `style`, `topics`, `edition`, `nonduplication`의 명시적 pass를 포함한다. helper는 이를 대신 판단하거나 형상 검사에서 pass를 만들어내지 않는다.
- `authorization.md`는 대화의 실제 승인 범위를, `policy-input.json`은 이번 배치의 금액 정책을 기록한다. 현재 합의는 `budget_usd: null`, `budget_enforcement: "not_specified"`이다. 과거 배치의 20달러를 이번 사용자 확정값으로 복제하지 않는다. 제공자 한도·잔액·429 오류에서는 후속 호출을 중단한다.

## 실행 helper

제작 중 다른 작업이 기준서 27세트를 게시하여 정본이 213세트가 되었다. 기존 186세트의 내용은 그대로다. `capture-integration-baseline.mjs`가 실제 채점 전에 최신 은행·분류·분류 검토를 `integration-baseline/`에 별도 보존했고, `integration-baseline.json`에 출처 해시와 추가 ID를 기록했다. 통합·실행·게시의 보존 및 동시 변경 검사는 이 최신 입력을 사용한다. 제작 당시 `D/bank-before.json`과 `baseline.json` 및 이전 정적 검사 증거는 수정하지 않았다.

[`build-execution.mjs`](build-execution.mjs)는 신규 ID 6개, 사례당 물음 3개, 사실관계 400자 이상, 모든 물음 사례형, 기존 은행 객체 보존, 공식 인용을 포함한 authoring 형상, catalog의 후보 은행 해시, 전수 작성자/root 검토, 부분·오답의 독립 criterion 정수 합계를 확인한다. 사실관계 분량은 `facts[].text`를 LF 하나로 이은 문자열의 Unicode 코드포인트 수이며 공백을 포함하고 제목·발문을 제외한다.

통과하면 `execution-v1`에 입력 해시, 실제 앱의 사례 전체 투영, 대표 답안, root/작성자 내용 검토 결속, 현행 채점 코드와 기록기 사본을 보존한다. 새 실행의 runtime snapshot index도 그 manifest에 직접 등록한다. 원자료와 대표 기대값을 결과를 보기 전에 고정한다.

기본 배치는 a/b worker가 사례 3개씩 맡고 모범·부분·오답을 각 사례의 3개 물음과 함께 요청한다. 예상 논리 요청은 18개, 물음별 관측은 54개다. 모든 물음이 2점 이상인 경우의 수치이며 1점 물음에는 불가능한 부분정답을 만들지 않는다. 저장 모범답안은 반드시 `model_answer.join('\n')` 그대로 사용한다. 마지막 형상·역할 커버·중복 실제 요청 검사는 아래 dry run이 담당한다.

```powershell
node --import tsx cpa_uploader/analysis/reviews/case-additional-2026-09-14/build-execution.mjs
$taskManifest = 'cpa_uploader/analysis/reviews/case-additional-2026-09-14/execution-v1/grading-manifest.json'
$taskManifestSha = (Get-FileHash -LiteralPath $taskManifest -Algorithm SHA256).Hash.ToLowerInvariant()
node --import tsx cpa_uploader/analysis/reviews/case-additional-2026-09-14/run-efficient-grading.ts --manifest $taskManifest --manifest-sha256 $taskManifestSha --worker a --output cpa_uploader/analysis/reviews/case-additional-2026-09-14/execution-v1/dry-a --stop-file cpa_uploader/analysis/reviews/case-additional-2026-09-14/execution-v1/STOP.json --dry-run
node --import tsx cpa_uploader/analysis/reviews/case-additional-2026-09-14/run-efficient-grading.ts --manifest $taskManifest --manifest-sha256 $taskManifestSha --worker b --output cpa_uploader/analysis/reviews/case-additional-2026-09-14/execution-v1/dry-b --stop-file cpa_uploader/analysis/reviews/case-additional-2026-09-14/execution-v1/STOP.json --dry-run
```

실제 호출은 두 dry run의 `status=dry_run_complete`, 0 SDK 호출과 root의 내용 검토 완료를 확인한 뒤 같은 manifest SHA로 실행한다. 위 명령에서 `--dry-run`을 빼고 각각 새 `actual-a`·`actual-b` 출력 경로를 사용하며 `node --env-file=.env.local --import tsx`로 키를 읽는다. 키·환경 전체를 로그에 출력하지 않는다. 실행 중에는 manifest에 동결한 공통 채점·기록 코드를 수정하지 않는다.

[`run-efficient-grading.ts`](run-efficient-grading.ts), [`contract.ts`](contract.ts), [`accounting.ts`](accounting.ts)는 과거 기록기를 이 배치에 독립 복사한 파일이다. [`recorder-provenance.json`](recorder-provenance.json)에 원본·신규 해시와 변경 범위를 기록한다. 수정은 import/ROOT 깊이, 현행 예산 형상 허용, preflight의 실제 정책 표시다. 기존 원요청·원응답, 비열거 `_request_id`, 사용량 이벤트, 응답 모델, SDK 실제 호출 수, source/code freeze, 오류·STOP, 보안·ID·인용·실제 합산 확인 경로를 유지한다. 공통 코드와 과거 기록기는 수정하지 않는다.

## 불일치·재개·봉인

허용 목표는 물음별 기대점수 ±1점에 관측 95% 이상이다. 내용·원출처·발문·모범답안·배점·기대값과 보안/응답 오류는 이 허용으로 면제하지 않는다. 범위 밖 결과는 원답안·기대값·실측을 보존하고 원인 조사 후 필요한 수정·표적 검사만 수행한다. 단순 점수 편차를 없애기 위한 자동 추가 호출은 하지 않는다.

실행 오류에서는 기존 출력·STOP·실패 호출의 비용을 보존한다. 다시 실행하려면 새 `execution-resume-vN`을 만들고 원래 관측 경로와 실제 호출 당시 manifest를 연결한다. 원 요청·모델·코드·기대값의 동일성을 현행 consumer로 검증한 성공 관측만 재사용한다. 새 실행은 자체 runtime index를 등록하며 옛 manifest의 해시를 변경하지 않는다. 내용을 고치면 해당 최종 내용에 대한 새 실제 검사와 내용 검토가 필요하다.

[`seal.mjs`](seal.mjs)는 완료 summary와 고정 요청 전수, 보안 오류 부재, 관측별 원응답 해시, root/작성자 검토 및 실제 채점의 현행 consumer 검증을 거쳐 `sealed-v1/batch.json`, `receipts.json`, `summary.json`, `readiness.json`을 작성한다. ±1점 밖 결과가 있으면 `residual-findings-v1.json`에서 관측 ID·물음 ID·delta까지 모두 일치해야 한다. 코드의 `createEfficientReviewReceipt`가 직접 source/provenance·허용률과 내용을 재검증한다.

```powershell
node --import tsx cpa_uploader/analysis/reviews/case-additional-2026-09-14/seal.mjs
```

재개가 있었다면 `--execution execution-resume-vN --output sealed-vN --prior-executions execution-v1,execution-resume-v2`와 같이 실제 이전 실행을 빠짐없이 전달한다. 수용 관측을 실제 생성한 실행 summary가 없으면 봉인을 거절한다. 비용은 각 실행의 `new_usage`와 `actual_sdk_calls`만 한 번씩 합산하며 재사용 관측 비용을 다시 더하지 않는다. 미반환 사용량은 0이 아니라 unknown이다. 계산기는 2026-09-12에 확인한 단가 snapshot을 그대로 명시하며 새 현재 단가 확인을 주장하지 않는다.

## 정본·공개본·DB 반영 순서

사용자 승인은 이미 정본·공개본·운영 DB까지 반영하는 범위를 포함한다. 통과한 새 6세트만 `promote_cpa_v3.ts --to verified --sets <신규 ID 6개> --efficient-review <봉인 batch> --evidence <봉인 batch>`로 처리한 후 `--to published`로 승급한다. 신규 ID이므로 `--reverify`는 사용하지 않는다. 기존 승급 장부의 모든 entry는 보존하고 신규 승급 12개를 추가한다.

게시 전에는 최신 정본·장부·공개본·암호화본·catalog의 실제 바이트와 SHA를 보존한다. 병행 작업이 있으면 검토된 신규 6세트를 최신 은행에 병합하고 타 작업의 기존 내용과 분류를 보존한다. ID 충돌이나 미해결 원본 변경은 덮어쓰지 않고 새 격리 stage에서 해결한다.

격리 stage의 환경 경로 네 개(`CPA_QUESTION_V3_AUTHORING_PATH`, `CPA_QUESTION_V3_PROMOTIONS_PATH`, `CPA_QUESTION_V3_PUBLIC_PATH`, `CPA_QUESTION_V3_ENCRYPTED_PATH`)를 모두 명시한 상태에서 승급·compile·최종 내용에 결속한 catalog 생성·전체 validate·DB 준비 검사를 실행한다. 정본 설치는 publication lock 및 예상 바이트 guard를 사용하고, rollback은 현재 파일이 원래 바이트나 이 작업이 쓴 바이트일 때만 수행한다. 각 백업 자체의 SHA가 원래 SHA와 일치하는지도 확인해야 한다.

DB에는 확인한 프로젝트 호스트와 `--expected-hash`, 전수 learning catalog, 실제 승인/검증 증거를 넘겨 `scripts/import-question-bank-v3.ts --apply`로 등록한다. 등록 receipt 후 별도 live verifier로 활성 release, source/public/private hash, set·물음·criterion·배점, 사례/기준서 분류·주제 관계를 조회하여 대조한다. 실제 독립 검증이 끝나기 전에는 DB 반영 완료로 기록하지 않는다. 이 단계는 root가 관리하는 [`publish.mjs`](publish.mjs)·[`deploy.mjs`](deploy.mjs)에서 수행한다.

완료 후 범위에 맞는 canonical/catalog 검사, `analysis:build`·`analysis:check`, `wiki:build`·`wiki:check`와 실행 결과를 보고한다. 이 문서는 실행 설계이며 실제 검증 결과는 각 실행의 receipt를 따른다.
