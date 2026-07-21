# cpa_questions_v2 적재 파이프라인 구현 계획 (plan-strict)

> `cpa_uploader/rubric_extraction_prompt.md`(Perplexity가 문제별로 산출하는 JSON 스키마)를 실제 Supabase 신규 테이블에 넣기 위한 엔지니어링 작업. Perplexity로 문제 내용을 만드는 작업(사람이 수동 진행, 별도 트랙)과 이 파이프라인 구축(Gemini 구현)은 서로 다른 트랙이며 병행 가능하다 — 파이프라인은 문제 110 하나의 샘플 JSON만으로도 끝까지 개발·검증할 수 있다.

---

## 1. Goal

Perplexity Space가 산출하는 문제별 JSON(`id/part/chapter/standard/question_title/question_description/model_answer/explanation/rubric`)을 파일로 누적한 뒤, 형식을 검증하고 신규 Supabase 테이블 `cpa_questions_v2`에 적재하는 스크립트 일체를 만든다. 기존 `cpa_questions` 테이블과 채점 엔진(`lib/serverUtils.ts`)은 이번 범위에서 건드리지 않는다.

## 2. Target behavior

**완료 후 가능해지는 것:**
- 문제별 JSON을 모아둔 파일 하나를 스크립트에 넘기면, 각 행이 스키마(필드 존재/타입)와 `rubric`(배점 합계 10, best_n 범위, id 유일성, variants 비어있지 않음)을 충족하는지 행 단위로 리포트
- 검증 통과한 행만 `cpa_questions_v2`에 upsert
- 실패한 행은 어떤 문제 id가 왜 실패했는지 콘솔에 명확히 출력 (사람이 Perplexity 출력이나 JSON을 고쳐서 재시도할 수 있도록)
- `--dry-run`으로 DB 쓰기 없이 검증만 수행 가능 (`upload_cpa.py`와 동일한 관례)

**변경하지 않는 것 (Non-goals):**
- 기존 `cpa_questions` 테이블 데이터/스키마
- 채점 엔진(`lib/serverUtils.ts`, `app/actions.ts`)이 읽는 테이블 — 여전히 `cpa_questions`
- 112문항 전체를 이번 슬라이스에서 채우는 것 (Perplexity로 문제 내용을 만드는 건 사람이 계속 진행하는 별도 작업)
- UI, 퀴즈 페이지

## 3. Atomic requirements

- R1. `RubricSub`/`RubricItem` TypeScript 타입 정의
- R2. `validateRubric(rubric: RubricSub[]): string[]` 순수 함수 — 위반 사항을 에러 메시지 배열로 반환(빈 배열 = 통과): 물음 points 합계 10, `mode:"all"`은 items.points 합 = sub.points, `mode:"best_n"`은 items.length ≥ n이고 items.points가 서로 동일하며 n × item.points = sub.points, item.id가 `<sub>-<순번>` 형식이고 전체 유일, items 배열이 비어있지 않음, variants가 비어있지 않고 2글자 미만/범용 단어 없음
- R3. 문제 행 전체(스키마 레벨) 검증 함수 — id/part/chapter/standard/question_title/question_description/model_answer/explanation가 존재하고 타입이 맞는지, model_answer가 비어있지 않은 문자열 배열인지 확인
- R4. `cpa_questions_v2` 테이블 DDL 작성 (Supabase SQL Editor에서 수동 실행할 SQL 문서로 제공) — 컬럼: `id`(정수, PK), `part`, `chapter`, `standard`, `question_title`, `question_description`, `model_answer`, `explanation`(이상 텍스트/배열 계열, 기존 `cpa_questions` 컬럼 타입과 동일하게 맞춤), `rubric`(jsonb, NOT NULL — v2는 rubric 없는 행을 만들지 않으므로 nullable 불필요)
- R5. 입력 JSON 파일(문제별 객체의 배열)을 읽어 R2+R3 검증을 각 행에 적용하고 통과/실패를 리포트하는 스크립트
- R6. 통과한 행만 Supabase에 upsert하는 기능 (서비스 롤 키 사용, `lib/supabaseAdmin.ts`와 동일한 인증 경로 재사용 가능하면 재사용, 아니면 `upload_cpa.py`처럼 REST 직접 호출)
- R7. `id`가 기존 `cpa_questions`에 실제 존재하는 id와 일치하는지 교차 확인 — 불일치(오타로 잘못된 id) 시 경고하고 해당 행은 스킵
- R8. `validateRubric`/스키마 검증 함수에 대한 단위 테스트 (유효/무효 케이스 각 3종 이상)
- R9. 문제 110 실제 데이터로 스크립트를 처음부터 끝까지(검증 → 적재 → 재조회) 1건 실행해보는 스모크 테스트

## 4. Open questions and assumptions

**Blocking 질문:** 없음

**확인이 필요한 안전한 가정 (Gemini 구현 전 1회 확인 권장):**
- A1. `model_answer` 컬럼 타입은 기존 `cpa_questions`와 동일하게 맞춘다고 가정 (jsonb 또는 text[] — Supabase 대시보드에서 기존 테이블 컬럼 타입 확인 후 DDL에 반영. 확인 전에는 jsonb로 가정하고 진행)
- A2. `id`는 기존 `cpa_questions.id`와 동일한 정수를 그대로 PK로 사용 (auto-increment 아님, Perplexity 출력의 id를 그대로 삽입)
- A3. 스크립트 언어는 TypeScript(`npx tsx`) — `validateRubric`이 나중에 `rubric_grading_plan.md` Slice 3(채점 엔진)에서도 그대로 import되어야 하므로 Python(`upload_cpa.py`)과 별개로 TS로 작성
- A4. upsert는 `id` 충돌 시 덮어쓰기(merge-duplicates 또는 `ON CONFLICT (id) DO UPDATE`) — 같은 문제를 재검증 후 다시 올리는 흐름을 지원하기 위함

## 5. Domain risks and edge cases

- **rubric jsonb 형태 불일치**: Perplexity 실제 출력이 스키마 문서와 미묘하게 다를 수 있음(필드 누락, 타입 혼동) — 합성 테스트 픽스처만으로 검증하지 말고, 반드시 실제 Perplexity 출력 1건(R9)으로 끝까지 검증
- **id 오타/불일치**: 사람이 수동으로 Perplexity에 값을 채워 넣는 과정이라 문제 id를 잘못 적을 위험이 실제로 있음 — R7의 교차 확인이 이를 막는 유일한 방어선이므로 누락하면 안 됨
- **best_n 배점 나누어떨어짐**: `rubric_extraction_prompt.md` 6단계에서 Perplexity가 자체 검산하도록 지침을 줬지만, 코드 쪽 `validateRubric`이 최종 방어선 — 안 나누어떨어지는 값이 들어오면 반드시 반려하고 통과시키지 말 것
- **부분 실패 처리**: 여러 문제를 한 파일에 모아 한 번에 돌릴 때, 한 문제가 검증 실패해도 나머지 정상 문제는 계속 적재되어야 함 (전체 배치를 롤백하지 않음)
- **중복 실행 안전성**: 같은 파일을 두 번 돌려도 데이터가 중복되거나 깨지지 않아야 함 (upsert 특성상 자연히 만족되지만 명시적으로 스모크 테스트에서 확인)

## 6. Affected boundaries

| 계층 | 파일 | 비고 |
| --- | --- | --- |
| 타입/검증 | `lib/rubric.ts` (신규) | LLM 무관 순수 함수 — 나중에 채점 엔진에서도 재사용 |
| DB 스키마 | Supabase `cpa_questions_v2` (신규) | 수동 DDL |
| 적재 스크립트 | `cpa_uploader/` 또는 `scripts/` (신규 TS 파일) | 검증 리포트 + upsert |
| 테스트 | `tests/rubric.test.ts` (신규) | R2/R3 단위 테스트 |

**변경 금지**: `lib/serverUtils.ts`, `lib/db.ts`, `app/actions.ts`, 기존 `cpa_questions` 테이블, `upload_cpa.py`

## 7. Proposed implementation structure

- `lib/rubric.ts` — `RubricSub`/`RubricItem` 타입, `validateRubric()`, 행 스키마 검증 함수
- `docs/cpa_questions_v2.sql` (또는 `cpa_uploader/schema_v2.sql`) — DDL 문서, 사람이 Supabase SQL Editor에 복사해 실행
- `cpa_uploader/upload_cpa_v2.ts` (가칭) — 입력 JSON 파일 경로를 인자로 받아 검증 리포트 출력 + `--apply` 플래그 시 upsert 수행, `--dry-run` 기본
- `tests/rubric.test.ts` — 단위 테스트

## 8. Implementation slices

- **Slice 1 — validateRubric 및 타입 정의**
  - Goal: R1, R2, R8. 이후 모든 슬라이스가 의존하는 순수 검증 로직 확정
  - Expected file scope: `lib/rubric.ts`, `tests/rubric.test.ts` (신규 2개)
  - Why this slice is isolated: DB·Perplexity·네트워크 전혀 불필요, 입력→출력이 결정적
  - Coupled updates required: 없음
  - Verification: `npm test`, `npm run typecheck`
  - Done when: 유효 rubric 3종 + 무효 rubric 3종(배점 합계 오류, best_n 미달, id 중복) 이상이 테스트로 고정됨

- **Slice 2 — 행 스키마 검증 + DDL**
  - Goal: R3, R4. "문제 하나가 완결된 행인가"를 판단하는 기준 확정 + 테이블 준비
  - Expected file scope: `lib/rubric.ts`(행 검증 함수 추가), DDL 문서 1개
  - Why this slice is isolated: DDL은 문서 산출물(수동 실행), 행 검증은 여전히 순수 함수
  - Coupled updates required: 없음
  - Verification: `npm test`(행 검증 함수 케이스 추가) — DDL은 Supabase SQL Editor에서 실행 후 `\d cpa_questions_v2` 또는 대시보드에서 컬럼 확인 (**사람이 직접 실행** — Gemini가 DB에 접근해 실행하지 않음, SQL 문서만 산출)
  - Done when: DDL 문서가 명확하고, 행 검증 함수가 필드 누락/타입 오류 케이스를 잡아냄

- **Slice 3 — 검증 리포트 스크립트 (dry-run)**
  - Goal: R5, R7. DB 쓰기 없이 "이 파일의 각 행이 통과하는가"를 사람이 확인할 수 있는 단계
  - Expected file scope: `cpa_uploader/upload_cpa_v2.ts` (신규, dry-run 경로만)
  - Why this slice is isolated: 읽기 전용(교차 확인을 위한 기존 `cpa_questions` id 조회 포함), DB 쓰기 없음
  - Coupled updates required: `lib/rubric.ts`의 검증 함수 호출
  - Verification: 샘플 JSON(유효 1건 + 의도적으로 깨뜨린 1건)으로 실행 → 통과/실패가 각각 올바르게 리포트되는지 확인
  - Done when: 존재하지 않는 id를 넣으면 명확히 경고하고 스킵, 배점 합계가 틀린 rubric은 반려 사유와 함께 표시됨

- **Slice 4 — upsert 적용 + 스모크 테스트**
  - Goal: R6, R9. 실제 DB 적재까지 완결
  - Expected file scope: `cpa_uploader/upload_cpa_v2.ts`(`--apply` 플래그 추가)
  - Why this slice is isolated: Slice 3의 검증 로직 위에 쓰기 동작만 추가
  - Coupled updates required: 없음
  - Verification: 문제 110의 실제 Perplexity 출력 1건으로 `--apply` 실행 → Supabase에서 재조회해 필드가 그대로 들어갔는지(특히 `model_answer` 배열, `rubric` jsonb 구조) 확인. 같은 파일 재실행 시 중복 없이 upsert되는지 확인
  - Done when: 문제 110이 `cpa_questions_v2`에 정확히 반영되고, 재실행해도 안전함이 확인됨

**실행 순서**: 1 → 2 → 3 → 4. Slice 1~2는 Perplexity 출력 없이도 시작 가능하니 지금 바로 Gemini에게 넘겨도 됨. Slice 4는 문제 110 등 실제 Perplexity 출력이 최소 1건 있어야 하므로, 그 전에 Perplexity 트랙에서 샘플 1건을 먼저 뽑아두는 게 좋음.

## 9. Acceptance checklist

- [ ] `npm test` / `npm run typecheck` 통과
- [ ] `validateRubric`이 배점 합계 오류·best_n 위반·id 중복을 모두 잡아냄
- [ ] DDL 문서로 `cpa_questions_v2` 생성 확인
- [ ] dry-run에서 존재하지 않는 id, 깨진 rubric이 각각 명확한 사유와 함께 반려됨
- [ ] 문제 110 실제 데이터로 `--apply` 실행 후 DB 재조회 시 필드 일치
- [ ] 동일 파일 재실행이 안전함(중복 없음)
- [ ] 기존 `cpa_questions`, `lib/serverUtils.ts`, `app/actions.ts` 무변경

## 10. Deferred work

- 채점 엔진이 `cpa_questions_v2`를 읽도록 전환 (`rubric_grading_plan.md` Slice 3에서 다룰 것)
- 신구 테이블 섀도 비교 검증 (`rubric_grading_plan.md` Slice 4)
- 레거시 `cpa_questions`/`keywords` 폐기 여부
- 112문항 전체 적재 (Perplexity 트랙에서 계속 진행, 파이프라인 완성과 별개로 누적)
- `upload_cpa_v2.ts`와 `upload_cpa.py`의 통합/일원화 여부
