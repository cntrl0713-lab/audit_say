# 사례 3개 추가 제작 실행 도구

이번 입력은 작성자 a/b/c가 각각 제공하는 사례 1개·물음 3개, 합계 사례 3개·물음 9개다. facts 본문을 LF 하나로 연결한 Unicode 코드포인트 수가 400 이상이어야 한다. 2점 이상 물음에는 대표 partial/wrong 각 한 답안, 1점 물음에는 wrong 한 답안을 준비하며 모범답안은 저장 model_answer에서 읽는다. 부분점수·실측 분모를 고정 숫자로 맞추지 않는다.

기존 `case-deepening-2026-09-14/helpers`, 최종 `post-concurrent-helpers`, `incremental-db-publication-v2`를 실제 읽고 새 경로로 분리했다. `reuse-origins.json`과 `reuse-source/`는 원 코드 바이트·해시이며 `provenance.json`은 새 코드와 검사 근거다. 과거 실행·실측·검토 통과는 새 배치의 성공으로 복사하지 않는다. source catalogue 계약은 D/source-catalog-final.json이다.

아래에서 D는 `cpa_uploader/drafts/case-trio-2026-09-14`, R은 `cpa_uploader/analysis/reviews/case-trio-2026-09-14`, H는 R/helpers, N은 R/incremental-db-publication-v1이다. 모든 명령은 저장소 루트에서 실행한다. 표의 순서는 사용법이며 실제 완료 기록이 아니다.

| 순서 | 명령·입력 | 결과·경계 |
|---|---|---|
| 1 | `node --import tsx H/capture-integration-baseline.mjs` | 현재 정본·분류를 integration-baseline에 보존. D 시작 은행의 기존 문항을 전부 확인 |
| 2 | `node --import tsx H/integrate.mjs` | a/b/c sets·design·review·QA를 후보 3사례/9물음에 결속 |
| 3 | `node --import tsx scripts/build-learning-unit-catalog.ts --review R/classification-v1.json --output R/catalog-v1.json` | review.source_file이 candidate-v1을 지정하며 후보 해시·전체 분류를 확인 |
| 4 | root가 root-review-notes-a/b/c.json 각각 3행 작성 | source/answer/prompt/points/style/topics/edition/nonduplication 실제 판정과 근거. 자동 생성 통과가 아님 |
| 5 | `node --import tsx H/record-root-review.mjs`, `node --import tsx H/complete-draft-evidence.mjs` | peer·공식 원자료·raw 보존본과 실제 root 판정을 결속 |
| 6 | `node --import tsx H/build-execution.mjs` | execution-v1 manifest·대표 답안·코드 스냅샷. 예상 최대 9요청/27답안이며 1점 예외는 실제 계산 |
| 7 | 아래 dry-run 후 root가 같은 manifest로 실제 a/b/c 실행 | Luna 유지, 금액 null/not_specified, ±1점/95% 기준과 내용 오류 허용 없음 |
| 8 | `node --import tsx H/seal.mjs` | 실제 원응답·사용량·편차를 검증한 sealed-v1 |
| 9 | `node --env-file=.env.local --import tsx H/publish.mjs --stage` | env 파일·암호화키 존재를 쓰기 전에 확인. 격리 검증·full DB readiness |
| 10 | `node --env-file=.env.local --import tsx H/publish.mjs --install` | 승인 범위 내 root 실행. 백업·원본 해시·잠금·실패 롤백과 정본 검증 |
| 11 | N/README.md의 명시 prepare/apply | 전체 은행 REST 업로드 대신 기존 DB 원문+3개 append, 트랜잭션 CAS·정확한 source SHA·독립 읽기 검사 |
| 12 | `node --import tsx H/prepare-coverage.mjs` 후 root 관계 검토 | 작성자별 coverage-proposals.json 한 행. relationship 정식 필드만 허용 |
| 13 | `node --import tsx H/update-coverage.mjs` | DB 완료 확인 후 3개 연결만 추가. 쓰기 전에 전체 assembleCoverage 형상과 새 연결 current/reviewed 확인 |
| 14 | wiki/log.md 실제 이력, `node H/final-checks.mjs --output final-checks-v1` | analysis build/check/preservation, wiki build/check 총 5개 |
| 15 | `node --import tsx H/write-report.mjs --final-checks final-checks-v1` | DB·정본·3사례 보존·실제 수치·검사 확인 후 보고서와 문제·모범답안·부분점수 기준 생성 |

실측 명령은 다음 형식이다. 각각 새로운 dry-a/b/c와 actual-a/b/c 폴더를 사용하고 worker, manifest SHA, 공통 stop-file을 정확히 지정한다. H/R/해시 문자열은 실제 경로·값으로 치환한다.

```text
node --env-file=.env.local --import tsx H/run-efficient-grading.ts --manifest R/execution-v1/grading-manifest.json --manifest-sha256 MANIFEST_SHA256 --worker a --output R/execution-v1/dry-a --stop-file R/execution-v1/STOP.json --dry-run
node --env-file=.env.local --import tsx H/run-efficient-grading.ts --manifest R/execution-v1/grading-manifest.json --manifest-sha256 MANIFEST_SHA256 --worker a --output R/execution-v1/actual-a --stop-file R/execution-v1/STOP.json
```

금액 상한은 root policy-input.json을 읽으며 이전 배치의 한도를 추정하지 않는다. 제공자 한도 오류에서 새 호출을 중단한다. 같은 질문의 유효 실측을 목표 비율 때문에 반복하지 않는다. 런타임·출처·QA 입력을 고정한 후 변경이 생기면 원 manifest를 덮어쓰지 않고 새 버전·재사용 근거를 만든다.

root가 준비할 입력은 D의 bank-before/catalog-before/classification-before/source-catalog/source-catalog-final, R의 authorization.md/baseline.json/policy-input.json과 source-evidence-plan.json, D/a·b·c의 sets/design/review/qa/source-files.json, D/a·b·c-peer-review.json이다. source-evidence-plan은 `{version:1,status:"complete",raw_collection_manifests:[{file,sha256}],source_peer_reviews:[{file,sha256}],additional_files:[{file,sha256}]}` 형식이며 실제 raw manifest·보존본·verification.json·index.md를 모두 검증한다.

coverage-root-review.json은 root가 직접 확인한 `{method:"agent_relationship_review",human_review_performed:false,proposal_sha256,links:[{id,decision:"accept",reason}],unresolved_findings:[]}` 형식이다. prepare-coverage는 이를 자동 승인하지 않는다. authored proposal은 relationship, element_id, set_id, subquestion_id, criterion_ids, reason 및 원문 위치·원문항·재수록 설명을 제공한다. 과거 `relation` 오기는 새 입력에서 즉시 거부한다.

실행 실패 시 원래 로그·결과를 보존한다. 최종 검사 재실행은 `--output final-checks-v2 --prior-output final-checks-v1`처럼 새 폴더로만 수행하고 보고서도 성공한 폴더를 명시한다. DB 응답 불명확 시 apply를 반복하지 않으며 N 지침의 읽기 조사 후속 절차를 따른다. 정적 helper 검사·로컬 PGlite 모형 검사를 실제 모델·운영 DB 성공으로 보고하지 않는다.
