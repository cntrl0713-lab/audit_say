# CPA 회계감사 문제은행 (v3) 파이프라인

회계감사 문제를 공통 사실과 여러 물음으로 구성한 `linked_question_set`으로 관리합니다. 신규 제작은 **원자료 선택 → 출제 계획 → 원문 문맥 패킷 → draft → 의미검수 → 실제 사례 채점 기록 → 사람 검수 근거 → verified/published 승급** 순서입니다. 생성·형상 검증·의미검수·실제 채점·게시 승인은 서로 다른 단계입니다.

## 파일과 산출물

| 경로 | 역할 |
|---|---|
| `data/cpa_question_sets_v3.authoring.json` | 모범답안·criterion·출처를 포함한 편집 정본 |
| `data/cpa_question_sets_v3.public.json` | 비공개 채점 정보를 제거한 공개 문제본 |
| `data/cpa_question_sets_v3.promotions.json` | 상태 전환, 실제 검수 근거, 신규 검수 해시·receipt 장부 |
| `raw/` | wiki 기반 자료·제작 및 검증 출처의 원본·추출본·보존 사본과 수집 매니페스트. [안내](raw/README.md) |
| `data/official/`, `data/회계감사_통합학습자료/` | 기존 출처 계약의 등록 입력. raw 보존본과 연결하며 기존 인용 경로 유지 |
| `config/question-source-registry.json` | 주제·원자료·문맥 의존·판본 가정의 탐색 설정 |
| `wiki/_meta/source-catalog.md` | 은행 등록과 독립적인 원자료 단위 카탈로그 |
| `wiki/question-generation/` | 수동 관리하는 설계·검증 지침과 주제별 조건·예외 |
| `<draft>.authoring-plan.json` | 생성에 사용한 계획서와 `set_id` 연결 |
| `<draft>.source-packet.json` | 실제 원자료·의존 문단·해시·판본 기록과 `set_id` 연결 |
| `<review.json>` | 의미검수 receipt와 실제 사례 채점의 `grading` 기록. 문항 상태는 바꾸지 않습니다. |

저장소 루트의 `data/cpa_question_sets_v3.authoring.enc.json`은 운영 채점용 암호화 배포물입니다. `next.config.ts`는 production tracing에 이 파일을 포함하고 평문 authoring 파일을 제외합니다. 위키의 세트 색인도 정답·비공개 채점 조건을 포함하므로 공개 문제 배포물이 아닙니다. 현재 세트·물음·criterion 수는 검증 출력과 [wiki 색인](wiki/index.md)에서 확인합니다.

## 1. 원자료와 계획 준비

[원자료 카탈로그](wiki/_meta/source-catalog.md)와 [요구사항·목표 후보](wiki/_meta/requirement-coverage.md)에서 실제 단위를 선택합니다. 은행 인용 연결 없음은 미출제 확정이 아니므로 기존 세트의 발문·답안·criterion과 비교합니다. [설계 서식](wiki/question-generation/source-authoring-design.md)과 해당 `topics/topic-XX-design.md`를 읽고 주체·시점·조건·예외·답안 범위를 정합니다.

아래 명령은 저장소 루트에서 실행합니다. `UNIT_ID`와 `NEW_SET_ID`는 실제 목록·생성 결과의 값으로 바꿉니다.

```sh
# 원자료 조회와 새 계획서 준비: 모델 호출 없음
npx tsx cpa_uploader/generate_cpa_v3.ts --list-sources --topic 13
npx tsx cpa_uploader/generate_cpa_v3.ts --prepare-plan plan.json --topic 13 --source UNIT_ID --mode new_from_standard
```

`new_from_standard`는 기준서 단위에서 새 학습목표를 설계하는 경로이며 `standard` 원자료가 필요합니다. 실제 발문 재구성에는 `--mode adapt_existing_question`과 `practice` 또는 `past_exam` 단위를 선택합니다. `--source`는 반복하거나 쉼표로 여러 ID를 지정할 수 있습니다. 생략 시 선택되는 기본 단위도 사람이 목표에 맞는지 확인해야 합니다.

계획서의 목표·범위·기존 문제와 차이·판본 근거를 채우고, 출제 범위를 막는 `unresolved_items`를 해소한 뒤 `status: "ready"`로 기록합니다. 비해당 조건도 이유를 적습니다. `ready`는 생성 입력 준비 상태입니다. 학습자료를 선택할 수 있지만 공식 근거 대조 필요를 숨기지 않으며, 2027년의 2026년 시행 기준 동일 적용은 `edition_assumption`에 남기는 작업 가정입니다.

## 2. 문맥 패킷 검증과 draft 생성

```sh
# 모델 호출: OPENAI_API_KEY와 생성 기능의 모델 설정 사용
npx tsx --env-file=.env.local cpa_uploader/generate_cpa_v3.ts --plan plan.json --output cpa_uploader/data/topic13.draft.json
# 편입 전 구조·인용 실존·정수 배점·ID/동일 발문 중복 검증
npx tsx cpa_uploader/validate_draft_v3.ts --file cpa_uploader/data/topic13.draft.json --against-bank
```

생성기는 선택한 원자료와 필요한 문맥·참조 문단을 패킷으로 구성합니다. 미확보 의존이 있거나 필수 문맥이 예산을 넘으면 모델 호출 전에 거절합니다. 공통 지침 다섯 문서와 선택 주제의 지침도 입력에 포함합니다. 기존 은행의 인용만을 신규 출제 재료로 삼지 않습니다.

draft와 함께 `.authoring-plan.json`, `.source-packet.json`을 저장하며 초안은 `needs_review` / `needs_human_review`입니다. 출처 ID·파일·위치·인용·해시가 패킷과 다르거나 과거 선택·개수 제한 정책인 응답은 조용히 바꾸지 않고 거절합니다. 체크포인트는 계획·원자료·지침·생성 계약·모델이 일치할 때만 재사용합니다.

ID 탐색 범위는 정본, `cpa_uploader/data/` 및 출력 폴더 하위의 미편입 JSON·체크포인트입니다. 이 범위 밖의 초안도 발급 전에 함께 관리해야 합니다. 자동 중복 검사는 ID와 공백 정규화한 동일 발문이며, 표현이 다른 동일 학습목표는 별도 의미검수 대상입니다. 기존 생성 파일을 덮어쓰지 않고 새 출력 경로를 사용하며 sidecar를 draft와 함께 보존합니다.

## 3. 의미검수·실제 사례 채점·사람 검토

```sh
# 모델 의미검수 후 같은 실행에서 실제 사례 채점까지 진행
npx tsx --env-file=.env.local cpa_uploader/review_question_draft_v3.ts --file cpa_uploader/data/topic13.draft.json --grade-cases --output cpa_uploader/data/topic13.review.json
```

의미검수 모델은 `CPA_REVIEW_MODEL` 또는 `CPA_GENERATION_MODEL` 설정이 필요합니다. `--grade-cases`는 `CPA_GRADING_MODEL` 설정을 따르는 실제 `gradeQuestionSetV3` 경로로 추가 API 호출을 하며, 미설정 시 채점 코드의 기본 모델을 사용합니다. 두 모델 경로 모두 `OPENAI_API_KEY`가 필요합니다.

기본 편집 정본과 같은 파일의 초안 배치를 비교 대상으로 삼고, draft 옆의 생성 sidecar를 자동으로 읽습니다. 별도 입력은 `--bank <bank.json>`, `--plan <plan.json>`, `--packet <packet.json>`으로 지정합니다. 다중 세트 sidecar는 각 `set_id`에 정확히 연결되어야 합니다.

직렬화된 의미검수 입력의 기본 예산은 160,000자이며 `CPA_REVIEW_INPUT_MAX_CHARS`로 최대 200,000자까지 설정할 수 있습니다. 초과하면 본문·비교 은행을 자동으로 잘라내지 않고 실패합니다.

모든 물음·criterion에 대해 발문과 정답의 대응, 원문 지지, 조건·예외, 판본·범위, 의미 중복을 검토합니다. criterion마다 모범답안·허용 표현·명제 누락·반대 의미·조건 경계의 다섯 사례와 실제 draft/source 인용·판정 근거를 기록합니다. receipt는 문항 내용, 실제 출처 파일, 메타데이터, 계획·패킷, 비교 은행의 해시에 연결됩니다.

의미 대조를 수동으로 작성한 뒤 실제 채점을 별도로 실행할 수도 있습니다. 아래 첫 두 명령은 모델을 호출하지 않습니다.

```sh
npx tsx cpa_uploader/review_question_draft_v3.ts --file cpa_uploader/data/topic13.draft.json --manual-template --output cpa_uploader/data/topic13.review-template.json
# 사람이 모든 단위·사례·인용·판정 근거를 실제 대조하여 양식을 채운 뒤 실행
npx tsx cpa_uploader/review_question_draft_v3.ts --file cpa_uploader/data/topic13.draft.json --manual-input cpa_uploader/data/topic13.review-template.json --description "검토자와 실제 대조한 원문·조건·판본·사례 및 확인 방법" --output cpa_uploader/data/topic13.semantic-review.json
# 완료된 의미검수 receipt에 실제 채점 기록 추가: 채점 모델 API 호출 발생
npx tsx --env-file=.env.local cpa_uploader/review_question_draft_v3.ts --file cpa_uploader/data/topic13.draft.json --review-input cpa_uploader/data/topic13.semantic-review.json --grade-cases --output cpa_uploader/data/topic13.review.json
```

`--grade-cases` 없이 의미검수만 끝낸 receipt는 `verdict: pass`여도 `grading.status: not_run`이며 신규 검수 승급에 사용할 수 없습니다. 미완성 수동 양식은 uncertain입니다. 모델 의미검수를 먼저 따로 실행했을 때도 위 `--review-input ... --grade-cases` 명령으로 이어갑니다. 입력 receipt와 출력 파일은 다른 경로를 사용합니다. CLI는 의미검수 응답을 `<output>.chunks.jsonl`, 실제 사례 채점의 성공·불일치·실패를 `<output>.grading.jsonl`에 즉시 기록합니다. 중간 실패에도 앞선 기록을 보존하며, 기존 최종 출력·중간 로그를 덮어쓰지 않으므로 새 출력 이름을 사용합니다. 부분 로그는 검수 완료 receipt가 아닙니다.

모델 의미검수는 `execution.transport`, 사례 채점은 `grading.transport`로 실제 호출과 주입 응답을 각각 구분합니다. 신규 수락에는 모델 의미검수의 `execution.transport=model`도 필요합니다. 주입 응답이나 transport 미기록 모델 의미검수에 실제 채점만 붙여 수락하지 않습니다. 과거 기록은 그대로 보존하고 새 검수 근거가 필요하면 실제 의미검수를 새로 실행합니다. 실제 수동 의미검수와 사람 확인은 각각의 실행 방법·근거를 갖추는 별도 계약입니다.

실제 채점은 criterion당 다섯 의미 대조 사례와 빈 답안을 실행합니다. 같은 답안은 한 번 실행하되 각 criterion의 기대 판정을 모두 대조합니다. 빈 답안은 실제 함수의 모델 미호출 경로를 확인합니다. `grading`에는 원래 판정, 인용·보안 검증 후 점수, 기대 판정과의 일치, 사례·채점 코드 해시가 기록됩니다. 승급 검증은 `grading.status: completed`뿐 아니라 모든 사례의 일치와 원래 판정을 현재 채점 코드로 재현한 점수까지 요구합니다. 조건 경계 사례만은 기대값이 `not_met`·`contradicted`일 때 둘 중 어느 쪽이 나와도 일치로 봅니다. 명제 일부만 남긴 답안을 누락과 명시적 반대 중 어느 쪽으로 읽는지는 같은 설정에서도 실행마다 갈리고 점수는 모두 0이기 때문입니다. 반대 서술 사례는 여전히 `contradicted`여야 합니다. 실제 호출과 테스트용 주입 응답은 `transport`로 구분합니다. `injected_response`는 신규 검수 수락·승급 근거로 사용할 수 없습니다. 세트 전체뿐 아니라 물음별 보안 플래그가 있는 정상 검수 사례도 불일치로 처리합니다.

사례 문구를 바꾸더라도 원답안이 원문·발문·전체 답안 문맥상 여전히 유효하면 회귀 검사에 함께 남깁니다. 불완전 원답안의 과대채점을 별도의 명시적 반대 사례 통과로 해결했다고 기록하지 않습니다. 교체 전후의 기대값·근거·실측을 구분합니다.

의미검수 pass와 실제 사례 채점 통과도 정답·판본의 보편적 정확성 보증은 아닙니다. 사람이 원문·판본·예외·기대 판정을 확인하고 검수 근거를 남깁니다. fail·uncertain 또는 실제 채점 불일치를 임의로 pass로 고치지 않습니다. 문항·원문·계획·비교 은행·배치가 바뀌면 필요한 의미검수를 다시 수행하고, 사례나 채점 코드가 바뀌면 실제 채점을 재실행합니다.

## 4. 편입·승급·배포

검수한 초안을 정본에 반영하고 전체 편집 정본을 검사합니다. 현재 기본 경로는 [비용 통제 검증 계약](../.agents/skills/audit-question-review/references/cost-controlled-verification.md)에 따른 agent의 전수 내용·출처·배점 대조와 실제 Luna 대표 채점입니다. `--efficient-review <batch.json>`으로 별도 증거를 수락하며, 실제 사람 확인 여부와 사용자 게시 승인을 구별합니다. 아래 `--review` 명령은 기준별 API 전수검사 경로를 선택했을 때 적용합니다.

```sh
npm run questions:v3:validate:authoring
npx tsx cpa_uploader/promote_cpa_v3.ts --to verified --sets NEW_SET_ID --review cpa_uploader/data/topic13.review.json --evidence "검토자·검수일·실제 확인한 원문과 판본·조건·기대 판정 기록"
npx tsx cpa_uploader/promote_cpa_v3.ts --to published --sets NEW_SET_ID --evidence "게시 근거"
npm run questions:v3:compile
npm run questions:v3:validate
npm run wiki:build
npm run wiki:check
```

신규 `verified` 승급과 재검수는 선택한 `--efficient-review` 또는 `--review` 증거와 실제 검토 기록의 `--evidence`가 필요합니다. 두 경로의 receipt를 혼용하지 않습니다. ±1점·95%는 채점 일관성에만 적용하며 내용 오류는 허용하지 않습니다. 공개본을 먼저 만들 필요는 없습니다. `published` 승급 후 전체 정본이 게시·검수·장부 계약을 충족해야 하므로 나머지 미검수 초안은 별도 draft로 관리합니다. compile은 공개본·암호화본을 쓰며 최종 검증은 정본과 배포물의 일치까지 확인합니다.

`wiki:build`는 생성 페이지와 log를 씁니다. `wiki:check`는 파일을 쓰지 않고 링크·메타데이터·원본 목차의 탐색 연결 및 생성 내용의 동기화를 검사합니다. 형식·동기화 통과는 의미검수나 공식 시험 판본 승인이 아닙니다.

## 기존 문항 수정과 과거 장부의 한계

내용 해시와 receipt가 기록된 문항은 기록 이후의 문항 내용·출처 파일·등록 메타데이터 불일치가 검증 대상입니다. 실제 재검수 후 다음 명령으로 새로운 근거를 기록하고 다시 게시·컴파일합니다.

```sh
npx tsx cpa_uploader/promote_cpa_v3.ts --reverify --to verified --sets CHANGED_SET_ID --review revised.review.json --evidence "새 검수의 실제 근거"
```

현재 96세트의 과거 소급 장부에는 내용 해시·새 의미검수 receipt가 없는 기록이 있습니다. 읽기 호환을 유지하므로 그 기록만으로 과거 검수 내용과 현재 내용의 동일성이나 모든 변경의 탐지를 보장하지 않습니다. 기존 문항을 고칠 때도 실제 재검수와 새 receipt를 남겨야 합니다. `--backfill-verified`는 기존 소급 장부 확인만 지원하며 새 미검수 문항의 승인을 만들어 주지 않습니다. receipt가 없던 과거 문항을 새 검수 완료로 표시하지 않습니다.

격리 검증은 `CPA_QUESTION_V3_AUTHORING_PATH`, `CPA_QUESTION_V3_PUBLIC_PATH`, `CPA_QUESTION_V3_ENCRYPTED_PATH`, `CPA_QUESTION_V3_PROMOTIONS_PATH`로 대상 파일을 지정할 수 있습니다. 상태·장부 조회는 `npx tsx cpa_uploader/promote_cpa_v3.ts --status`입니다.

세부 계약은 [문제 설계](wiki/question-generation/question-design.md), [출력 형상](wiki/question-generation/question-output-schema.md), [전체 워크플로](wiki/question-generation/question-generation-workflow.md)를 따릅니다. 계산 문제·출처에 없는 기준이나 수치·숨은 채점 요구·같은 사실의 중복 배점을 만들지 않습니다.

## 분석·검토 자료의 위치

요구사항 추출·빈도는 [analysis/question-elements](analysis/question-elements/README.md), 현재 문항 대응·공백은 [analysis/coverage](analysis/coverage/), 주제·은행 단위 검토 장부와 실행 결과는 [analysis/reviews](analysis/reviews/README.md)에서 관리합니다. 제작 배치의 문항·계획·출처·의미검수 receipt는 `drafts/`에 함께 두고, 설명과 판단 근거는 `docs`의 보고서에 연결합니다.

과거 `docs/archive/과거-검토-증거/reports/question-review-2027`의 JSON·실행 근거는 [보존 장부](analysis/reviews/question-review-2027/README.md)로 이전했습니다. 당시 파일의 내용·판정·내장 경로는 그대로 보존하며, [이전 장부](analysis/reviews/question-review-2027/migration-manifest.json)에서 예전 경로를 해석합니다. 과거 검수 완료를 현재 은행의 검수 완료로 재사용하지 않습니다.
