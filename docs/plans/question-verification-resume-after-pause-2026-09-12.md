# 문항 검증·운영 DB 조회 복원 재개 지시서

작성일: 2026-09-12. 사용자가 “현재 하는 작업만 마무리하고 작업 중지”를 요청하여, 진행 중인 복원 코드의 로컬 검사까지만 마감한다. **이 문서는 재개 지시서이며 추가 DB 적용을 실행한 기록이 아니다. 사용자가 재개를 요청하기 전에는 후속 작업을 시작하지 않는다.**

## 1. 현재 상태와 가장 먼저 해결할 문제

문항 내용·배점 검토, 비용 통제 방식의 실제 채점, 정본 설치, analysis/wiki 갱신, 운영 DB 입력은 완료했다. 그러나 **운영 DB의 비공개 조회 함수가 채점 범위 보조조건 `critical_facts.scope` 13개를 반환하지 않는 문제는 아직 남아 있다.** 이를 고치는 신규 SQL과 로컬 검사가 준비돼 있으나 운영 DB에는 적용하지 않았다. 따라서 전체 작업을 “운영 검증 완료”로 보고하면 안 된다.

| 항목 | 상태와 확인 내용 |
| --- | --- |
| 최종 정본 | 154개 저장 묶음·351물음·1,298점. 기준서형 279, 사례형 72 |
| 학습 단위 | 기준서형 독립 물음 279 + 사례형 부모 41 = 320개. 사례 부모에 72물음 연결 |
| 배점 검토 | 이번 281물음 재검토 + 기존 검토와 내용 동일성을 확인한 70물음 = 전체 351물음 |
| 기존 운영 배점 | 212물음 중 유지 126, 상향 84, 요구를 분리하여 기존 키 점수가 낮아진 2 |
| 운영 추가 키 | 139개. 기존 묶음의 분리·추가 6개와 새 저장 묶음 50개의 133개를 포함 |
| 대표 답안 채점 | 830개 평가 답안 모두 ±1점 이내, 821개 점수 일치. 실제 새 호출 742회, Luna만 사용 |
| 이번 배치 API 비용 | 실제 토큰·고정 단가로 약 $0.84561490. 청구서 금액이나 이전 다른 배치 비용은 아님 |
| 정본/게시 파일 | 격리 9단계와 정본 설치·분류 재현·전체 검사 완료 |
| analysis/wiki | build/check 네 명령 모두 통과. wiki 154묶음·351물음·1,298기준 반영 |
| 운영 DB 입력 | 2026-09-12 14:02:25 KST 적용. 릴리스 `2fe460a1-8107-40cd-8afd-e6eb539ef997` |
| 첫 독립 DB 검사 | 원문·공개본·배점·분류·학습 단위 일치. private DTO 37묶음에서 선택 필드 332개 누락으로 실패 |
| 복원 SQL | 신규 파일 작성·격리 검사. **운영 적용 미실행** |
| 후속 DB 검사 | 복원 적용 후 전체 재대조·과거 판본 호환 확인 미실행 |

`scope` 누락 대상은 `pilot-16-011` 2개, `pilot-17-005` 2개, `pilot-10-007` 4개, `pilot-10-007-standards` 5개다. 나머지 319개는 `source_refs.source_span` 출처 위치 메타데이터다. 두 종류 모두 릴리스의 `source_document` 원문에는 보존돼 있다. `lib/questionV3Grading.ts`는 critical_facts 객체를 모델에 전달하고 scope를 판정범위로 사용하므로, 이 13개를 표시 문제나 ±1점 허용 오차로 처리하지 않는다.

## 2. 이어받을 정책

- 먼저 [AGENTS](../../AGENTS.md), [검토 스킬](../../.agents/skills/audit-question-review/SKILL.md), [비용 통제 검증 지침](../../.agents/skills/audit-question-review/references/cost-controlled-verification.md)을 읽는다. 신규 출제가 필요할 때만 제작 스킬을 추가한다.
- 2027년 CPA 적용 기준과 이미 확인한 공식 출처·판본을 이어받는다. wiki·모범답안·원문·배점·QA 기대값의 알려진 오류를 허용하지 않는다.
- **Luna만 사용**, 물음당 ±1점 및 관측 일관성 목표 95%는 채점의 일관성에만 적용한다. 통계적 신뢰수준 95%를 입증했다고 쓰지 않는다.
- 이 복원 작업에 추가 유료 API 채점은 계획하지 않는다. 검증했던 채점 입력을 운영에서도 그대로 전달하는 수정이며, DB/로컬에서 입력 내용의 일치를 검사한다. 새 의미·배점·채점 로직을 바꾸게 되면 해당 영향과 재검증 범위를 따로 판단한다.
- 동시 담당자는 최대 3명. 원문·정본·판정 지시·원답안·실측·receipt·과거 실패 결과를 보존한다. 사용자의 기존 운영 DB 적용 승인은 재개 후 이 범위에 유효하지만 이번 중지 요청을 무시해 자동 실행하지 않는다.

## 3. 경로와 소유권

아래 PowerShell 변수는 저장소 루트 `C:\Users\cntrl\Workspace\study\audit_say`에서 사용한다.

```powershell
$reviewBatch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11'
$efficientBatch = "$reviewBatch/efficient-verification-2026-09-12"
```

| 담당 | 허용 작업 |
| --- | --- |
| 총괄 | 새 재개 출력/잠금, 운영 DB 사전 확인·SQL 적용, 실제 사후 대조, 최종 보고서·완료 상태 |
| DB 복원 담당 | 신규 migration과 `E/c/private-source-metadata-v1/` 후속 검사. 원본을 고칠 필요가 있으면 새 판본·출력으로 보존 |
| 독립 검토 담당 | SQL 결속·권한·일반필드 보존·실행기 guard 검토와 로컬 증거 확인. DB 쓰기 없음 |

`E`는 위 `$efficientBatch`다. 다른 작업의 공통 코드 변경은 보존한다. 모델 검증에 사용한 `lib/questionV3Grading.ts`, `lib/questionV3.ts`, 효율 검수 consumer/runner/sealer의 기존 고정 바이트를 임의로 바꾸지 않는다. 이번 DB 수정은 새 SQL만 추가하고 정본·정규화 테이블 행·과거 migration·기존 serializer·공개 조회 함수를 바꾸지 않는 방식이다.

## 4. 주요 증거와 고정 값

- [현재 진행 보고서](../reports/question-points-and-publication-2026-09-12.md).
- [전체 운영 대비 배점표](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/a/operational-point-diff-v1.md), [주제19 상세](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/a/topic-19-point-detail.md).
- 최종 모델 실행 `question-verification-2026-09-12-efficient-004`: `E/execution-lock-v4.json`, `E/candidate-v5/grading-manifest.json`, `E/sealed-results-v4/`.
- [정본 설치·백업](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/canonical-install-v1/install-004/completion.json). 이 파일의 DB 미적용 표시는 설치 당시 단계 기록이며 실제 DB 적용은 후속 영수증에 있다.
- [원 DB 적용 영수증](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/db-publication-v4/receipt.json), [실제 첫 사후 검사 실패](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/db-publication-v4/verification.json), [전체 누락 필드 대조](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/db-publication-v4/private-projection-diagnosis-all-v1.json).
- 원 영수증은 `public_content_hash`를 출력하지 않는다. 이를 바꾸지 않고 실제 DB 릴리스에서 읽어 원 영수증·readiness·로컬 compile과 대조한 [파생 사후 검증 입력](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/db-publication-v4/verification-evidence.json)을 사용한다. 원 영수증을 쓴 첫 시도의 DB 읽기 전 실패 로그도 보존했다.
- [새 복원 SQL](../../supabase/migrations/20260912060000_cpa_private_source_metadata.sql), [실제 SQL 회귀 검사](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c/private-source-metadata-v1/migration.test.ts), 담당자의 같은 폴더 `handoff.json`/`handoff.md`에서 마지막 검사와 파일 SHA를 확인한다.
- [적용 실행기](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/private-metadata-rollout.mjs), [DB 수정 전 읽기 전용 스냅샷](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/db-private-metadata-v1/before.json). `--prepare`까지만 실행했다. `--apply`, migration receipt와 postconditions는 아직 없다.

| 파일/대상 | 확인한 SHA-256 또는 식별자 |
| --- | --- |
| 운영 프로젝트 | `xvifzicrjmbfqaepcfpp.supabase.co` |
| 정본 | `4891f97bcfc98cdeda77567b59657577da184317df199fd53c859004728acd80` |
| 학습 분류 정본 | `6db2a33c3c1bd1e3c9a4d2826f274b6644f20eb1a6c3a25233dbe1acc532c7af` |
| 최종 채점 manifest | `920e6956a0ae97903853189edc91383ecda793ed90e1b6003ed37f90e9541a04` |
| 최종 봉인 batch | `ef625af577bf4046655586243f4a2615dbeff05bedf6dfe1a5302fe08a00f4fc` |
| DB 수정 전 before.json | `90446134f72bf5ce440cf536e5604f4901367194da0869e317ded5187b1c5f63` |
| 신규 복원 SQL | `a6a6300fd1f1df32fe822f137f832f07f306ed1ada5ecb9c98c301882c35a789` |

마지막 로컬 검사·수정에 따른 최종 해시는 [중지 체크포인트](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/pause-handoff-v1/manifest.json)를 기준으로 확인한다. 과거 실행 잠금의 해시를 현 파일 값으로 덮어쓰지 않는다.

## 5. 재개 순서

### A. 상태 확인과 준비 검토

1. 중지 체크포인트의 파일 해시와 현재 정본·분류를 확인한다. 작업 트리는 다른 변경이 많으므로 전체 되돌림·일괄 삭제·자동 커밋을 하지 않는다.
2. 마지막 로컬 SQL 검사와 독립 검토를 읽는다. 최초 로컬 검사 40/40은 실제 현재 154개와 직전 운영 104개 묶음을 격리 PostgreSQL에 import하여 확인했다. 마지막 검사는 그 후 채점 payload JSON 및 JSON 밖 지시문 대조를 추가한 판본이므로 담당자 handoff에서 최종 결과를 확인한다.
3. 누락 보조조건을 단순히 비교 대상에서 빼는 방법은 금지한다. 복원 함수는 source_document SHA, release item의 set/version/position, 원 import와 같은 PostgreSQL content hash 및 applicability를 확인한다. 같은 버전에 연결된 모든 보존 원문이 일치해야 한다. 원문 없는 legacy만 기존 조회 결과로 반환한다.
4. 일반 필드·요구사항 source_span·claim·정수 배점·fact.expected/type의 불일치는 거부해야 한다. 추가 가능한 경로는 `source_refs[*].source_span`과 `subquestions[*].criteria[*].critical_facts[*].scope`뿐이다. 권한은 stable/security invoker, `search_path=pg_catalog,public`, service_role execute만 유지한다.

### B. 운영 DB 복원 적용 — 아직 수행하지 않은 단계

현재 준비 실행기는 적용 직전 DB를 다시 읽고, transaction 안에서 import advisory lock·테이블 잠금을 얻은 뒤 동일 상태 전체를 재검사한다. 활성 릴리스·원문/버전/연결 지문·기존 함수 정의와 ACL·migration 부재가 달라지면 적용하지 않는다. 다음 명령은 **사용자가 재개를 요청하고 A를 확인한 뒤에만** 실행한다.

```powershell
node "$efficientBatch/private-metadata-rollout.mjs" --apply `
  --expected-before-sha256 90446134f72bf5ce440cf536e5604f4901367194da0869e317ded5187b1c5f63 `
  --expected-migration-sha256 a6a6300fd1f1df32fe822f137f832f07f306ed1ada5ecb9c98c301882c35a789
```

`.env.local`은 실행기에서 읽으며 키를 출력하지 않는다. 적용과 migration 장부 저장은 하나의 transaction이다. `request.json`을 먼저 보존하며 응답이 불명확하면 반복하지 않는다. 실제 schema_migrations·함수 정의·릴리스 상태를 읽어 commit 여부를 확인한다. 기존 before가 낡았으면 새 판본의 실행기와 새 출력 폴더로 준비하고 원 before·request·receipt를 보존한다. 기존 `--prepare` 출력 폴더를 지워 재사용하지 않는다.

확인할 결과는 `E/db-private-metadata-v1/receipt.json`, `after.json`, `helper-function.json`, `postconditions.json`이다. migration SHA, 기존 릴리스/버전/연결 및 공개 함수 불변, 새 helper 권한을 각각 확인한다. 원 문항·범위의 의미를 바꾸지 않았으므로 기존 830개 채점을 다시 호출하지 않는다.

### C. 실제 DB 재대조 — 아직 수행하지 않은 단계

원 검사 도구를 수정하거나 첫 실패 결과를 덮지 말고 새 `verification-v2.json`을 사용한다.

```powershell
$verificationEvidence = "$efficientBatch/db-publication-v4/verification-evidence.json"
$evidenceSha = (Get-FileHash -LiteralPath $verificationEvidence -Algorithm SHA256).Hash.ToLowerInvariant()
$learningMigration = 'supabase/migrations/20260911030000_cpa_question_learning_units.sql'
$learningMigrationSha = (Get-FileHash -LiteralPath $learningMigration -Algorithm SHA256).Hash.ToLowerInvariant()
node --env-file=.env.local --import tsx "$reviewBatch/c/verify-final-learning-rollout.ts" --read-live `
  --bank cpa_uploader/data/cpa_question_sets_v3.authoring.json `
  --expected-bank-sha256 4891f97bcfc98cdeda77567b59657577da184317df199fd53c859004728acd80 `
  --learning-catalog cpa_uploader/data/learning-question-classifications.json `
  --expected-catalog-sha256 6db2a33c3c1bd1e3c9a4d2826f274b6644f20eb1a6c3a25233dbe1acc532c7af `
  --evidence $verificationEvidence --expected-evidence-sha256 $evidenceSha `
  --migration $learningMigration --expected-migration-sha256 $learningMigrationSha `
  --expected-project xvifzicrjmbfqaepcfpp `
  --output "$efficientBatch/db-publication-v4/verification-v2.json"
```

위 도구는 기본 학습 DB migration 해시를 검사한다. 새 `20260912060000` SQL의 실제 설치 해시와 helper 정의/권한은 B의 후속 증거로 추가 확인한다. 이 구분 없이 기본 migration 검사만으로 새 함수 검증까지 완료했다고 쓰지 않는다.

합격 조건은 `status=passed`, failures 0, 전체 154개 private 판본/351물음/1,298점, 기준서형 279·사례형 72, 320학습 단위·451주제 연결의 일치다. 보존 source_document와 공개·비공개 전달 내용도 대조한다. 추가로 모든 기존 sealed version을 읽는 호환 검사를 수행하여 과거 제출 조회가 깨지지 않는지 확인한다. 학습자 답안·XP를 조회하거나 초기화할 필요는 없다.

운영 DTO를 `buildGradingPrompt`에 넣어 채점 payload JSON을 파싱한 값과 검증본의 payload를 비교하고, JSON 밖 판정 지시문은 정확히 비교한다. PostgreSQL JSONB 객체의 키 순서 차이를 데이터 손실로 오인하지 않되, 배열 순서와 모든 값·조건은 보존한다. 단순 `scope` 문자열 포함 여부만으로 전체 입력 일치를 주장하지 않는다.

### D. 완료 보고 — 위 단계 통과 후에만

1. 실패와 수정 경과를 보존하고 신규 SQL 적용·사후 대조·과거 호환 결과를 후속 기록에 남긴다.
2. [현재 보고서](../reports/question-points-and-publication-2026-09-12.md), 배치 README 두 개에 실제 완료 상태와 근거 링크를 갱신한다. 배점 검토 완료와 DB 사후 검증 완료를 구분한다.
3. `E/finalize-publication-report.mjs`는 **이번 실패 발견 전에 만든 미실행 템플릿**이다. 현재 첫 실패 `verification.json`을 읽도록 되어 있어 그대로 실행하면 중단된다. 성공한 새 검사 경로·복원 SQL 증거·현 보고서 문구에 맞춘 새 판본으로 준비한 후에만 사용한다. 이전 실패 파일 이름을 성공 파일로 덮어쓰는 방법은 금지한다.
4. 최종 결과에는 기준서형/사례형 물음 수, 351물음 배점 전후표, 주제19 주요 조정, 830답안 실측, 이번 배치 약 $0.85 비용과 그 범위를 간결하게 보고한다. 통계적 95% 보장이나 사람 전수 확인을 주장하지 않는다.

## 6. 이번 중지 시 수행하지 않는 일

추가 출제·분류/배점 재설계·모델 상향·유료 API 호출·정본 재승급·문제은행 재import·학습자 답안 삭제·진도 초기화·앱 배포·자동 재개 예약은 하지 않는다. 필요한 후속은 위 private 조회 복원과 실제 전달 내용의 검증, 완료 기록이다.
