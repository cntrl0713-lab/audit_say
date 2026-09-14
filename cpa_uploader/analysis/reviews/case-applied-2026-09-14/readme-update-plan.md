# README 최종 갱신안

작성: agent:/root/followup_sources_b. 사람 확인: false. 2026-09-14 05:13:08 UTC에 실행·설치·배포 산출물 존재 여부를 확인하고, 이어 봉인 결과의 실제 값을 읽었다. 이 문서는 수정안이며 제작·검토 README는 수정하지 않았다.

## 읽은 README와 작업 경계

| 대상 | 읽은 SHA-256 | 현재 설명 |
| --- | --- | --- |
| `cpa_uploader/drafts/case-applied-2026-09-14/README.md` | `f573a57bf133965498fc4c60debe942104ef8ff5ca58d89d6c822bcd2a62b32d` | 사용자 확정 범위, 시작 비교본, a/b 담당, 검토 배치 연결 |
| `cpa_uploader/analysis/reviews/case-applied-2026-09-14/README.md` | `48225668242208b5aed9201375eb6044ab3f833787eb01bc0b357118a6451256` | 6사례·18물음의 제작·검증·정본·운영 반영 목적과 단계 구별 |

실제 실행 manifest는 `execution-v1/grading-manifest.json`, SHA-256 `46bd89e7689cdcea72e421960ad22aaf164f6deaf9fec183a22345d175db2743`이다. 이 작업에서 manifest·helpers·문항·QA·채점 코드를 변경하지 않는다. 원자료·실행 증거의 과거 바이트를 새 상태로 덮어쓰지 않는다. README의 수동 설명만 최종 완료 증거를 읽은 후 갱신한다.

## 지금 확인된 상태와 이후 갱신 조건

아래 경로에서 D는 `cpa_uploader/drafts/case-applied-2026-09-14`, R은 이 검토 배치다. 표의 현재 상태는 위 관찰시점 기록이며 이후 완료 상태를 대신하지 않는다.

| 단계 | 현재 확인 | 최종 README에 쓸 근거·조건 |
| --- | --- | --- |
| 제작 형상 | 6사례·각 3물음. `shape-check.json`의 사실관계는 851–1,047자, 총 18물음 | `shape-check.json.rows`를 최종 정본의 해당 ID와 대조. 제목·물음을 제외한 facts를 LF 하나로 연결한 Unicode 코드포인트 수이며 공백 포함임을 명시 |
| 원자료 수집 | raw 수집 manifest 34개 원래 경로, 고유 바이트 파일 33개, 중복 경로 1개. 원본 대조 오류·누락 0 | `source-evidence-plan.json` → `cpa_uploader/raw/collections/2026-09-14-case-applied/manifest.json` 및 `verification.json`. 34를 출처의 독립 요구사항 수·고유 문서 수로 표현하지 않음 |
| 공식 출처 검토 | D의 최종 카탈로그 및 source peer 기록 확보. 570 A16/A19 전사와 공식 PDF를 대조했고 720 FAQ의 비권위성을 구별 | `D/source-catalog-final.json`, `D/source-peer-review.json`, `D/a/source-files.json`, `D/b/source-files.json`, `R/draft-evidence.json`. 카탈로그·해시 일치가 판본·내용 검수를 대신한다는 표현 금지 |
| 내용 검토 | `root-content-review.json`의 18개 물음, 각각 8개 검사 pass, 미해결 내용 결함 빈 배열, `human_review_performed:false` | 작성자 review·교차검토·root 장부를 링크. agent 내용 대조와 별도 API 의미검수·사람 확인을 구별 |
| 실제 채점 | `actual-a`와 `actual-b`가 각각 completed·9 SDK calls·잔여 0. `sealed-v1/summary.json` passed, readiness true | 최종 봉인 summary의 실제 값 사용. 현재는 요청 18개·SDK 18회·평가 답안 54개·정확 일치 54개·±1점 이내 54개·밖 0개. 고정 대표 답안의 관측 결과로만 설명 |
| 금액·모델 | Luna 유지, 예산 null / not_specified. 현재 known_cost true, 추정액 약 $0.040199 | `sealed-v1/summary.json`의 `known_cost`, `estimated_cost_usd`, `accounting`, `budget_usd`, `budget_enforcement`. 토큰 미반환·단가 미확인·범위만 산출되는 경우를 0원으로 처리하지 않음. 고정 단가에 실제 사용량을 곱한 추정액이며 청구액으로 쓰지 않음 |
| 정본·공개본 | 관찰시점 `publication-v1/install-completion.json` 없음 | stage 완료만으로 정본 반영 완료라고 하지 않음. `install-completion.json.status === canonical_installed_and_validated`, 파일 해시 및 정본·공개본 검증을 확인한 후 완료 표현 사용 |
| 운영 DB | 관찰시점 `db-publication-v1/completion.json` 없음 | `completion.json.status === production_published_and_independently_verified`, `release_id`, `verification.json.status`, 독립 조회 실제 집계를 읽은 후 운영 반영 완료로 기록 |
| 대표 coverage 관계 | 6개 draft/needs_review/current: direct 3, adjacent 2, partial 1. root acceptance·공통 장부 갱신은 관찰시점 미생성 | `coverage-root-review.json`의 새 제안 해시와 각 accept, `coverage-update.json`, 공통 registry 최신성 확인 후 reviewed/bank 적용으로 기록. 기출·모의 빈도 입력은 변경하지 않음 |
| 최종 분석·wiki 검사 | 관찰시점 `final-checks-v1/summary.json` 없음 | 최종 summary의 passed와 각 `checks[].exit_code === 0` 및 로그 해시를 확인. 예정 명령 목록만으로 검사 통과라고 하지 않음 |

## 제작 README의 제안 본문

아래는 D/README.md에 적용할 수 있는 본문이다. 대괄호의 내부 링크는 해당 README 위치를 기준으로 작성했다. 최종 보고서·문제 모음 링크는 파일 생성 후에만 추가한다.

```markdown
# 사례형 적용 확장 6개

사용자가 확정한 6개 사례·18개 물음의 제작·출처·검토 입력이다. 기출문제와 고급회계감사연습의 발문·해설을 참고해 새 사례를 구성하고 공식 기준서와 대조했다. 각 사례는 3개 물음이며, 모든 물음은 부모 사실을 적용해야 답할 수 있도록 설계했다.

[시작 정본](bank-before.json)과 [시작 분류](classification-before.json)를 보존했다. 작성자별 [A 초안](a/sets.json)·[B 초안](b/sets.json), 설계·내용 검토·부분정답과 오답은 각 a/b 폴더에서 확인한다. [부분점수 예시](partial-credit-examples.md)는 문장 수가 아닌 독립 의미 단위의 정수 배점을 설명한다.

[최종 출처 카탈로그](source-catalog-final.json), [공식 원문 교차검토](source-peer-review.json), [raw 수집·원본 대조](../../raw/collections/2026-09-14-case-applied/manifest.json)에 출처 계보를 남겼다. 교재 재수록을 새 출제로 세거나 GS 모의를 기출로 합산하지 않는다. 720 FAQ는 기준서 본문과 구별한 비권위성 참고자료다.

실제 채점·정본·공개본·운영 DB 상태는 [검토 배치](../../analysis/reviews/case-applied-2026-09-14/README.md)를 따른다. 초안 파일의 존재나 출처 해시 일치를 게시 완료로 해석하지 않는다.
```

최종 보고 생성 후 마지막에 `[전체 문제와 모범답안](questions-and-answers.md) · [제작 결과 보고서](../../../docs/reports/case-applied-2026-09-14.md)`를 추가한다. 사실관계 문자 수를 본문에 넣을 경우 최종 `shape-check.rows`와 정본 재계산값을 확인한다. 물음별 주제는 `subquestions[].topic_ids`, 부모 대표주제는 `classification.topic_id`를 따른다.

## 검토 README의 제안 구조

최종 완료 전에는 위 현재 상태와 그 시각을 쓰고, 완료 후에는 다음 항목에 실제 최종 결과를 넣는다. `{{…}}`는 적용 전에 실제 산출물에서 채우는 자리이며 숫자를 예상해 넣지 않는다.

```markdown
# 사례형 적용 확장 검토

[사용자 범위](authorization.md)에 따른 6개 사례·18개 물음의 검토 배치다. [제작 배치](../../../drafts/case-applied-2026-09-14/README.md)의 원자료·설계·QA 및 시작 비교본을 보존했다. 최종 상태는 {{실제로 확인한 완료 단계}}이다.

[형상 검사](shape-check.json)에서 각 사례 3물음·사실관계 {{최소}}–{{최대}}자를 확인했다. 문자 수는 facts 본문을 LF 하나로 연결한 Unicode 코드포인트 수이며 공백을 포함한다. [root 내용 검토](root-content-review.json)와 제작 배치의 교차검토에서 18물음의 사실 의존성·발문·정답·부분점수·출처를 대조했다. 검토자는 agent이며 사람의 직접 내용 확인이나 별도 API 의미검수로 기록하지 않았다.

[봉인 결과](sealed-v1/summary.json)에 실제 Luna {{SDK 호출 수}}회, 고정 대표 답안 {{분모}}개 중 정확 일치 {{정확 일치}}개, ±1점 이내 {{허용 이내}}개({{비율}}%)를 기록했다. {{허용 범위 밖 수 및 필요한 조사 링크}}. 이 값은 대표 답안의 실측 결과이며 모든 답안의 정확도를 보장하는 비율이 아니다. 비용은 {{known_cost와 accounting에 따른 추정액 또는 미확인 범위}}이며 예산 {{budget_usd/budget_enforcement}}를 유지했다.

[정본 설치 기록](publication-v1/install-completion.json)과 [운영 DB 완료 기록](db-publication-v1/completion.json)을 구별한다. 운영 릴리스는 {{release_id}}이며 [독립 조회 검사](db-publication-v1/verification.json)에서 실제 내용·분류·집계를 대조했다. {{기존 정본·승급 이력 보존 확인 결과}}.

[대표 관계 제안](coverage-proposals.json)과 [관계 검토](coverage-root-review.json), [공통 연결 반영](coverage-update.json)을 보존했다. 관계는 direct {{수}}, adjacent {{수}}, partial {{수}}이며 원출제 빈도 입력은 바꾸지 않았다. [최종 분석·보존·wiki 검사](final-checks-v1/summary.json)의 실제 결과를 확인한다.

[전체 결과 보고서](../../../../docs/reports/case-applied-2026-09-14.md) · [전체 문제와 모범답안](../../../drafts/case-applied-2026-09-14/questions-and-answers.md)
```

존재하지 않거나 실패한 완료 파일의 링크·완료 문장은 먼저 넣지 않는다. 일부 단계가 완료되지 않으면 해당 단계의 현재 상태와 남은 조치를 그대로 기록한다. 원래 README에 있는 사용자 범위와 제작 배치 링크는 유지한다.

## 최종 수치의 조회 위치

| 보고 내용 | 실제로 읽을 위치·필드 |
| --- | --- |
| 추가 사례·물음·문자 수·배점 | `shape-check.json`의 `new_cases`, `new_questions`, `minimum_facts_characters`, `rows`; 해당 신규 ID의 최종 정본 재계산값 |
| 전체 은행 전후 | `integration-baseline/bank.json`과 최종 `cpa_question_sets_v3.authoring.json`; 배열 길이와 `subquestions` 합계. 예상 증가분을 결과로 쓰지 않음 |
| 사례형 전후 | `integration-baseline/catalog.json`과 최종 `learning-question-classifications.json`에서 `question_style === case`, `source_set_id` 고유 수 및 물음 수 |
| 실제 호출·평가·정확도 | `sealed-v1/summary.json`: `requests`, `actual_sdk_calls`, `fixed_evaluated_answers`, `exact_score_matches`, `within_tolerance`, `within_tolerance_ratio`, `outside_tolerance`. `dry-*`의 0회와 실제 실행 호출 수를 혼동하지 않음 |
| 토큰·비용 | 같은 summary의 `usage`, `accounting.provider_token_totals`, `known_cost`, `estimated_cost_usd`, 미확인·범위 응답 수. 입력·출력·캐시 세부량은 원 usage를 확인 |
| 정본·공개본·분류 설치 | `publication-v1/install-completion.json`: `status`, `files`, `preserved_history`, `new_ledger_entries`; stage 완료는 설치 완료와 별개 |
| 운영 릴리스·집계 | `db-publication-v1/completion.json`: `status`, `release_id`, `counts`; `verification.json.actual`과 실제 검증 판정 |
| coverage | `coverage-update.json.added_link_ids` 및 현재 `coverage/registry.json`의 해당 ID. 제안 개수와 reviewed/bank 적용 개수를 구별 |
| 최종 검사 | `final-checks-v1/summary.json.status`와 `checks[]`; 개수와 명령·exit_code는 생성 결과에서 읽음 |

## coverage 주제 문구 정정 기록

초기 대표 관계 설명은 “원요소 topic_id 07과 새 물음의 주제09를 임의 통합하지 않는다”라고 썼으나, 최종 초안에서 부모 대표주제는 09이고 첫 물음의 실제 주제는 07·08이다. 원요소 자체의 주제는 07이다. 정확한 문구는 다음과 같다.

> 원요소 주제07, 새 물음의 주제07·08, 부모 대표주제09를 구별한다.

root가 별도로 허용한 generator와 세 산출물에서 정정을 완료했다. 문항·배점·대상 criterion·관계·6개 snapshot은 변경하지 않았다. README에서는 이 구별을 이어받고 부모 대표주제로 물음별 주제를 대신 설명하지 않는다.

| 정정 후 산출물 | SHA-256 |
| --- | --- |
| `coverage-proposals.json` | `cc3906579612ff543293ce0c7f9cc684b85f4075761c36907661a2394b86ac9e` |
| `coverage-proposal-review.md` | `bbd3b5b1c102b13db70d9d8751fdf1eae500587b75caead7d6dbf843e789ebe2` |
| `coverage-proposal-validation.json` | `75957189625e12ae3b7250d682f8395828741f974958c837bfa1e5f86b34c4f7` |

`editorial_correction`에 정정 전 세 파일의 해시·문구와 정정 사유를 보존했다. root acceptance는 위 새 제안 해시에 작성한다. 이 문구 보정은 문항 변경이나 실제 채점 재실행 사유가 아니다.
