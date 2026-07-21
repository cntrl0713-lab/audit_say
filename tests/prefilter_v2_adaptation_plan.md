# 계획서: 사전 필터의 v2 루브릭 적응 — 부분답안 오차단 해소

> 배경 근거: `tests/v2_grading_test_results.md` 2절 [HIGH] 결함.
> 실측 재현: `npx tsx tests/verify-v2-e2e.ts 117 --deep --yes` → S_sub_1 = 0점 (매칭 3 / 필요 10, Jaccard 0.13).

## 1. Goal

`gradeBatch`의 룰 베이스 사전 필터(`lib/serverUtils.ts:138-158`)는 키워드 배열 길이의 30%를 최소 매칭 수로 요구한다. v1에서는 키워드가 개념 단위(~10개)라 적절했으나, v2 문항은 `k`에 형태소 변형까지 펼친 variants(20~33개)가 들어와 requiredMin이 ~10까지 부풀고, 그 결과 **한 물음만 정확히 작성한 정당한 부분답안이 "무관한 답변"으로 0점 차단**된다. v2 루브릭이 있는 문항에 한해 필터를 item/sub 단위 커버리지 기준으로 교체하고, v1 문항의 기존 동작은 바이트 단위로 보존한다.

## 2. Target behavior

변경 후 관찰 가능해야 하는 것:

- v2 문항에서 특정 물음(sub) 하나만 정확히 작성한 답안은 사전 필터를 통과해 Gemini 채점까지 도달한다 (실측 기준: 117 S_sub_1이 0점 차단 → 1~3점대 부분점수).
- v2 문항에서 무관 텍스트(타 기준서 주제)는 여전히 필터에서 차단된다 (현재 32/32 차단 유지).
- 필터 차단 메시지에서 "N/M개"의 M이 '필요 최소치'임이 오독 없이 드러난다.

변경되지 않아야 하는 것 (non-goals):

- **v1 문항(rubric 없는 `r`)의 필터 수식·임계값·메시지 로직**: 기존 경로 그대로. (메시지 표기 개선은 v1 경로에도 적용하되 판정 결과는 불변)
- Jaccard 0.15 구제 게이트: 양 경로 모두 유지.
- Gemini 채점 프롬프트·systemInstruction·주입 방어: 무변경.
- 루브릭을 배점표로 파싱하는 채점(루브릭 판정 엔진): 별도 계획(`rubric_grading_plan.md` Slice 3), 이번 범위 아님.
- 데이터 정비(218/307/312 마커, 열거형 모델링 통일, 범용어 variants): 이번 범위 아님.

## 3. Atomic requirements

- R1. `RubricSub[]`와 답안 텍스트를 받아 sub별 item 커버리지를 계산하는 순수 함수를 제공한다 (item은 자기 variants 중 1개라도 매칭되면 1로 카운트).
- R2. 매칭 정규화는 기존 관례와 동일하다: `replace(/\s+/g, '').toLowerCase()` 후 substring 포함 검사.
- R3. best_n sub의 커버리지 분모는 `min(n, items.length)`, all sub는 `items.length`이며 비율은 1을 상한으로 한다.
- R4. 필터는 `item.r`이 유효한 v2 루브릭 JSON일 때만 커버리지 경로를 사용한다 (파싱 실패·형상 불일치 시 기존 v1 경로로 폴백).
- R5. 커버리지 경로의 통과 조건: 어느 한 sub라도 커버리지 ≥ `SUB_COVERAGE_THRESHOLD`(0.5) 이면 통과.
- R6. 커버리지 미달 시 기존과 동일하게 Jaccard ≥ 0.15면 구제 통과, 아니면 0점 즉시 확정.
- R7. v2 경로 차단 메시지는 물음/항목 커버리지 관점으로 서술한다 (예: "모든 물음에서 핵심 항목 커버리지가 부족합니다 (최고 물음 커버리지: X%). …").
- R8. v1 경로 차단 메시지의 `${matchedCount}/${requiredMin}개` 표기를 `${matchedCount}개 (최소 ${requiredMin}개 필요)`로 바꾼다 (판정 로직은 불변).
- R9. `lib/serverUtils.ts`가 rubric 모듈을 import할 때 `'./rubric.ts'` 확장자 표기를 쓴다 (node 네이티브 테스트 러너 호환 — `lib/quizGrading.ts` 수정과 동일 사유).

## 4. Open questions and assumptions

Blocking 없음 — 아래 가정으로 진행 가능. 단 A1·A3은 사용자 취향이 갈릴 수 있어 확인 가치 있음.

- A1 (임계값): `SUB_COVERAGE_THRESHOLD = 0.5`, named constant로 두어 조정 가능하게 한다. 근거: "최소 한 물음은 절반 이상 제대로 시도"가 부분점수 허용 취지와 부합.
- A2 (방향성): 오차단(정당 답안 0점)은 학생 성적 피해, 과통과(쓰레기 통과)는 flash-lite 1콜 비용일 뿐이며 Gemini가 32/32 실측으로 0점 처리함 → **관대한 쪽으로 설계 오차를 허용**한다.
- A3 (학생 노출 문구): R7 문구 초안은 구현 시 확정하되, 기존 문구 톤("⚠️ 부족한 점 / 👍 잘한 점" 형식)을 유지한다.
- A4 (단일 item sub): 122·209처럼 sub당 item 1개인 문항은 구절 하나 매칭으로 통과한다. A2 방향성상 허용 (Gemini가 후단 방어).
- A5 (r 필드 신뢰): `hydrateModelAnswers`가 v2일 때만 검증된 rubric JSON을 `r`에 넣으므로, 필터의 rubric 감지는 `JSON.parse` 성공 + 배열 + `sub/items` 필드 존재 확인 정도의 얕은 검사로 충분하다 (`validateRubric` 재호출은 과잉).

## 5. Domain risks and edge cases

- **비대칭 리스크**: 필터는 학생 점수를 직접 0으로 확정하는 유일한 비-LLM 경로. 회귀 시 피해가 성적으로 직결되므로 v1 경로 무변경이 최우선 안전선.
- **best_n 분모**: 분모를 `items.length`로 잘못 잡으면 best_n sub(예: 117 sub3, n=3/5)에 n개만 쓴 만점 답안이 60%로 계산되어 threshold 인상 시 차단될 수 있음 → R3 고정.
- **교차오염의 역작용**: sub 간 variants 오염 100% 문항(209·218)은 어떤 부분답안이든 여러 sub가 동시에 커버되어 필터가 사실상 무력 → 의도된 관대함(A2)이지만 인지할 것.
- **빈 답안/공백 답안**: 커버리지 0 → Jaccard ~0 → 차단 유지 확인 필요.
- **깨진 r**: v1 explanation 텍스트가 `r`에 들어있는 경우 JSON.parse 실패 → 반드시 기존 경로로 폴백 (throw 금지).
- **정규화 불일치**: 커버리지 매칭이 `calculateMatchedCount`와 다른 정규화를 쓰면 quality 스크립트(R3 자기커버리지)와 판정이 어긋남 → R2로 통일.
- **키워드 샐러드**: 전 item 커버 → 통과 (현재도 통과) → Gemini 0점. 동작 불변 확인만.

## 6. Affected boundaries

- **domain logic**: `lib/rubric.ts` (순수 커버리지 함수 추가), `lib/serverUtils.ts` (필터 분기). — 핵심 변경.
- **tests**: 신규 단위 테스트 + 기존 `keywordFilter.test.ts` 회귀 확인 + E2E 실측 재실행.
- UI / API / persistence / serialization: **무변경**. (`BatchItem` 형상, DB, 클라이언트 전송 필드 모두 그대로 — `r`은 이미 서버 내부에서만 수화됨)

## 7. Proposed implementation structure

변경 파일:

- `lib/rubric.ts` — `computeRubricCoverage(answer: string, rubric: RubricSub[])` 추가. 반환: `{ bestSubCoverage: number, bestSub: number, matchedItemIds: string[] }` 수준의 최소 정보. 이유: 순수 함수로 분리해야 API 없이 단위 테스트 가능.
- `lib/serverUtils.ts` — 필터 블록에서 `item.r` rubric 감지 → 커버리지 경로/기존 경로 분기, 메시지 표기 수정(R7·R8), `'./rubric.ts'` import. 이유: 차단 판정 지점이 여기 한 곳뿐.
- `tests/rubric.test.ts`(또는 신규 `tests/rubricCoverage.test.ts`) — 커버리지 함수 단위 테스트.

1차 패스에서 건드리지 말 것:

- `lib/quizGrading.ts`, `lib/db.ts`, `app/actions.ts` (수화·라우팅은 이미 검증 완료 상태)
- `calculateMatchedCount` / `calculateBigramJaccard` 기존 구현 (v1 경로가 사용 중)
- Gemini 프롬프트 문자열 일체
- `tests/verify-v2-e2e.ts` (직전 세션에서 수정·검증 완료 — 이번엔 실행만)

## 8. Implementation slices

- **Slice 1 — 순수 커버리지 함수 + 단위 테스트**
  - Goal: 동작 변경 없이 `computeRubricCoverage`를 lib/rubric.ts에 추가하고 단위 테스트로 고정.
  - Expected file scope: `lib/rubric.ts`, `tests/rubric.test.ts`(또는 신규 테스트 파일) — 2파일.
  - Why this slice is isolated: 어떤 호출자도 아직 없으므로 회귀 불가능. 수식(R1~R3)을 먼저 확정.
  - Coupled updates required: 없음 (export 추가만).
  - Verification: `npm run typecheck` && `npm test` 전건 통과. 테스트 케이스에 반드시 포함: ① 117 실데이터 축약 픽스처로 sub1만 답안 → sub1 커버리지 1.0, ② 무관 텍스트 → 전 sub 0, ③ best_n 분모 = min(n, items) 검증, ④ 공백 variants/빈 답안 → 0, ⑤ 조사·공백 변형 매칭(R2 정규화).
  - Done when: 신규 테스트 포함 `npm test` 통과, 기존 102개 무변화.

- **Slice 2 — 필터 분기 배선 + 메시지 수정**
  - Goal: `gradeBatch` 필터에서 유효 rubric 감지 시 커버리지 게이트(R4~R7) 사용, 실패 시 기존 경로 폴백, v1 메시지 표기만 수정(R8), import는 `'./rubric.ts'`(R9).
  - Expected file scope: `lib/serverUtils.ts` — 1파일.
  - Why this slice is isolated: 판정 지점이 단일 함수 내 단일 블록. Slice 1의 함수를 소비만 함.
  - Coupled updates required: 없음 — `BatchItem`·`GradeResult` 형상 불변이 이 슬라이스의 핵심 제약. rubric 파싱 실패 시 반드시 기존 수식으로 폴백(throw 금지).
  - Verification: `npm run typecheck` && `npm test` (기존 `keywordFilter.test.ts`가 v1 경로 불변의 회귀 방어선). 코드 리뷰 관점 확인: v1 경로의 requiredMin 수식·0.15 임계값이 문자 그대로 보존되었는지.
  - Done when: typecheck·테스트 전건 통과, v1 경로 diff가 메시지 문자열 1줄뿐임을 diff로 확인.

- **Slice 3 — E2E 실측 검증 및 결과 문서화**
  - Goal: 실제 Gemini 호출로 목표 행동(2절)을 실측 확인하고 결과를 기록.
  - Expected file scope: 코드 무변경. `tests/v2_grading_test_results.md`에 재실측 절 추가.
  - Why this slice is isolated: 검증 전용 — 코드 수정이 나오면 Slice 2로 되돌아갈 것 (이 슬라이스에서 로직 수정 금지).
  - Coupled updates required: 없음.
  - Verification (총 ~30콜):
    1. `npx tsx tests/verify-v2-e2e.ts 117 --deep --yes` → S_sub_1이 차단 해제되어 1~3점대(🟢), S4 무관은 여전히 차단(🟢), best_n 시나리오 8~10점(🟢). S_sub_3 4점(홀리스틱 한계)은 잔존 🔴로 기대.
    2. LIGHT 3문항 스팟(예: 110·209·316) → 여전히 [10, 0, 0, 0].
    3. `npx tsx tests/verify-v2-routing.ts` → 5/5 PASS (v1 회귀 없음, 실서버액션 경로 정상).
  - Done when: 위 3개 실행 로그가 기대와 일치하고 결과 문서에 반영됨. 이탈 발견 시 성공 보고 금지, Slice 2 재작업.

## 9. Acceptance checklist

- [ ] `npm run typecheck` 통과
- [ ] `npm test` 전건 통과 (기존 102 + 신규 커버리지 테스트)
- [ ] 117 DEEP: S_sub_1 차단 해제 및 부분점수 획득 (0점 차단 재현 소멸)
- [ ] 117 DEEP: S4 무관 텍스트 여전히 필터 차단 (Gemini 미호출 메시지 확인)
- [ ] LIGHT 스팟 3문항 [10, 0, 0, 0] 유지
- [ ] `verify-v2-routing.ts` 5/5 PASS
- [ ] v1 필터 경로 diff = 메시지 표기 1줄 (수식·임계값 무변경)
- [ ] 차단 메시지에 "최소 N개 필요" / 커버리지 % 표기 반영

## 10. Deferred work

- 루브릭 배점표 기반 채점(물음별 부분점수 정밀화, S_sub_3 4점 문제 해소) — `rubric_grading_plan.md` Slice 3
- 데이터 정비: 218/307/312 물음 마커, 열거형 모델링 통일(단일 sub + items), Perplexity 프롬프트 규칙 추가
- 범용어 variants 구 단위 보수 (기존 Q2)
- `verify-adversarial/paraphrase/shuffled`의 동적 import 정비
- `SUB_COVERAGE_THRESHOLD` 튜닝 (전 문항 DEEP 데이터 축적 후)
