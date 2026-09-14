# 동시 표기 수정 후 DB 게시 도구

이 후속본은 `incremental-db-publication-v1`의 트랜잭션·복원·응답·검증 로직을 유지하고 입력 경로만 새 게시 준비본으로 바꾼다. 같은 3개 신규 사례 ID와 `sealed-v1`을 사용한다. 기존 H/N1·실측 manifest·원응답은 바꾸지 않는다.

| 입력 | 현재 경로(R은 이 검토 배치) |
|---|---|
| 기준 은행 및 분류 | `R/integration-baseline-v2.json`, `R/integration-baseline-v2/bank.json`, `catalog.json` |
| 후보 결속 | `R/candidate-publication-v2.json` |
| 검증된 격리 게시본 | `R/publication-v2/stage/`와 `stage-completion.json` |
| 정본 설치 완료 | `R/publication-v2/install-completion.json` |
| 동일 검수·실측 | `R/sealed-v1/`, `R/changed-sets-v1.json` |
| DB 실제 실행 결과 | `R/db-publication-v1/` |

후보 문서는 preparation 입력에 해시로 결속하며 실제 전송 내용은 기존과 같이 검증된 stage에서 읽는다. root의 게시 후속 runner가 후보와 stage의 동일한 검토 내용을 확인해야 한다. 기존 stage/install 결과를 경로만 바꾸어 새 성공으로 사용하지 않는다.

`reuse-origins.json`은 N1 현재 코드의 원래 해시·N2 보존 사본·최소 diff·N2 파일 해시를 기록한다. `source-provenance.json`은 N1 보존 sources를 원래 경로에서 재사용하며 `sources/installed-functions-after.json`만 정확한 바이트로 새 경로에 복사했다. 원 roundtrip·수집 원본의 상세 경로는 source-provenance를 따른다. `README.md`는 N1 설명을 새 실행 경로로 옮긴 참고 자료이며 후속 경로 및 출처 재사용은 이 문서가 구체화한다.

독립 검토자는 `independent-review.json`에 `status: "passed_static_review"`, `human_review_performed: false`, `unresolved_findings: []`, 현재 driver·append-contract·source-provenance의 `files: [{file,sha256}]`를 기록해야 한다. 새 준비·실행은 root가 최신 active release를 확인한 다음에만 수행한다.

```text
node --import tsx R/incremental-db-publication-v2/driver.mjs --prepare --expected-active-release-id ROOT_VERIFIED_CURRENT_ACTIVE_UUID
node --env-file=.env.local --import tsx R/incremental-db-publication-v2/driver.mjs --apply --expected-preparation-sha256 PREPARATION_SHA256
```

local 검사는 문법·lint 및 동일한 로컬 PGlite 372+3 원문복원·commit/rollback fixture를 실행한다. 현재 정본은 별도 작업이 수정 중이므로 fixture와 무관한 정본 변화로 결과를 오인하지 않도록 H/N1·봉인 manifest·sealed batch·현재 N2 코드를 보호한다. 실제 기준 은행과 현재 DB의 일치는 후속 prepare/apply에서 원래의 해시·CAS로 검사한다.

이 도구 준비 작업에서 prepare/apply/verify, API, DB 조회·쓰기, 정본 설치는 수행하지 않는다. SQL 응답 불명확 시 자동 apply 재시도 금지 및 원응답 보존 원칙도 N1과 같다.
