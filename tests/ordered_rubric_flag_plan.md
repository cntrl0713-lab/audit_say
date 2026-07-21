# 계획서: 루브릭 `ordered` 플래그 도입 — 순차 절차 문항의 순서 역전 감점

> 배경: 순차 절차 문항(307류)의 순서 역전 답안이 만점을 받는 "순서 불감" 관찰(`tests/item_reorder_test_results.md` 3번 케이스)에 대해 사용자가 감점 정책을 채택.
> 실증 근거: `tests/verify-order-rule-prototype.ts` / `tests/order_rule_prototype_results.md` (2026-07-20) — **접근 A(전역 systemInstruction 규칙)는 2회 실측 모두 무력**(307 역순 10점 유지), **접근 B(문항 전용 명시 지시 주입)는 성공**(307 역순 3점, 정순 10점 유지). 본 계획은 접근 B를 프로덕션화한다.

## 1. Goal

루브릭 스키마에 선택 필드 `ordered`(sub 단위, boolean)를 추가하고, 채점 시 `ordered: true`인 sub가 있는 문항에만 프로토타입에서 검증된 "절차 순서 감점 지시"를 채점 요청에 주입한다. 열거형 문항에는 지시 자체가 붙지 않으므로 확정 정책("열거 순서 무감점")의 회귀가 구조적으로 불가능하다. 이번 라운드에 플래그를 다는 데이터는 순차 절차임이 확정된 **307번 하나뿐**이며, 나머지 31문항의 순차성 감사와 신규 문항 저작 규칙은 별도로 다룬다.

## 2. Target behavior

변경 후 관찰 가능해야 하는 것:

- 307번에 대해 **실제 프로덕션 경로**(`gradeBatch`, 필요시 `gradeQuizBatch`까지)로 역순 답안을 채점하면 ≤8점(프로토타입 실측 3점)으로 감점되고, 피드백에 절차 순서 훼손이 언급된다.
- 307번 정순 답안(모범답안 전문)은 지시가 주입된 상태에서도 9~10점을 유지한다 (프로토타입 실측 10점 — 오발동 없음).
- `ordered` 플래그가 없는 문항(나머지 31문항 전부)의 채점 요청 프롬프트는 **바이트 단위로 이전과 동일**하다 — 지시 주입 로직이 플래그 없는 경로에 어떤 텍스트도 추가하지 않는다.
- 열거형 순서 변경 답안(200 물음 내 역순, 122 셔플)은 여전히 만점대를 유지한다 (`verify-item-reorder.ts` 시나리오 1·2 재실행으로 확인).
- `ordered` 필드가 없는 기존 루브릭 32건 전부가 `validateRubric`을 계속 통과한다 (후방 호환).

변경되지 않아야 하는 것 (non-goals):

- **systemInstruction 본문**: 접근 A가 실증 실패했으므로 전역 규칙은 추가하지 않는다. 지시는 오직 문항별 컨텐츠 채널(`contentText`)로만 주입.
- **사전 필터**(`computeRubricCoverage`, Jaccard 게이트): 무변경. 순서는 필터가 아니라 Gemini 단계에서만 다룬다 (필터의 위치 불감은 알려진 설계 특성).
- **`hydrateModelAnswers`**(lib/quizGrading.ts): 무변경 — rubric 전체를 `JSON.stringify`로 `r`에 싣는 현행 방식 그대로 `ordered` 필드가 자동으로 함께 흐른다.
- **DB 스키마**: `rubric`은 jsonb 컬럼이므로 DDL 불필요. 데이터 재업로드만.
- **307 외 문항의 데이터**: 이번 라운드에서 플래그를 달지 않는다 (섣부른 추정 금지 — 10절 참고).
- 검증된 지시 문구의 취지 변경: 프로토타입에서 실증된 문구를 그대로(또는 sub 번호 명시만 추가해) 사용한다. 문구를 새로 창작하면 실증 결과가 무효가 된다.

## 3. Atomic requirements

- R1. `lib/rubric.ts`의 `RubricSub` 타입에 선택 필드 `ordered?: boolean`을 추가한다.
- R2. `validateRubric`이 `ordered` 필드를 검증한다: 없으면 통과(후방 호환), 있으면 boolean이어야 하며 다른 타입이면 오류 메시지 반환.
- R3. `lib/rubric.ts`에 순수 함수 `buildOrderedNotice(rubric: RubricSub[]): string | null`을 추가한다: `ordered: true`인 sub가 하나도 없으면 `null`, 있으면 프로토타입 검증 문구를 기반으로 한 지시 블록을 반환한다. 전체 sub가 ordered(또는 단일 sub 문항)면 프로토타입과 동일한 문항 수준 문구, 일부 sub만 ordered면 "물음 N의 모범 답안은 …" 형태로 해당 sub 번호를 명시한다.
- R4. `lib/serverUtils.ts`의 `gradeBatch`에서, 필터 단계에서 이미 파싱한 `rubricData`가 존재할 때 `buildOrderedNotice(rubricData)`를 호출해 결과가 `null`이 아니면 `contentText`의 `[평가할 사용자 답안]` 블록 **앞에** 주입한다 (프로토타입과 동일한 위치). `rubricData`가 없는 v1 경로에서는 어떤 변화도 없어야 한다.
- R5. `cpa_uploader/data/cpa_problems_v2.json`의 307번 sub1에 `"ordered": true`를 추가한다. 다른 문항·다른 필드는 무변경.
- R6. `upload_cpa_v2.ts --apply`로 307번을 DB에 재반영한다 (dry-run 선행).
- R7. `cpa_uploader/rubric_extraction_prompt.md`에 저작 규칙을 추가한다: 3단계에 "물음의 답이 선후관계가 있는 순차 절차(앞 단계의 결과가 다음 단계의 전제, 에스컬레이션 등)면 해당 sub에 `ordered: true`를 지정하고, 순서 무관한 단순 열거에는 지정하지 마라", 7단계 출력 스키마의 sub 객체에 선택 필드 `"ordered": true`를 명시.
- R8. 단위 테스트: `validateRubric`의 ordered 검증(정상/타입오류/부재), `buildOrderedNotice`의 3분기(플래그 없음→null / 전체 ordered / 일부 ordered) 커버.
- R9. `tests/verify-item-reorder.ts` 시나리오 3(307 역순)의 판정을 '관찰(observe)'에서 엄격 기대(≤8 = 정상, ≥9 = 결함)로 갱신한다 — 정책이 확정됐으므로 관찰 밴드는 더 이상 유효하지 않다.

## 4. Open questions and assumptions

Blocking 없음 — 정책(감점 채택)과 기술 방식(접근 B)이 모두 확정된 상태.

- A1 (비차단, 이후 라운드): 나머지 31문항 중 추가로 `ordered`를 달 문항 선별은 각 문항의 모범답안을 실제로 읽고 판단해야 하므로 별도 데이터 감사 라운드로 미룬다. 이번엔 이 세션에서 텍스트를 직접 읽고 순차성("만약 그러한 위험이 있다면"으로 연결)을 확인한 307만 단다.
- A2 (비차단): 일부-sub-ordered 문구(R3의 "물음 N" 형태)는 프로토타입에서 직접 실증되지 않았다(307은 단일 sub). 현재 그런 데이터가 없으므로 이번 라운드의 E2E에서는 실행되지 않는 분기이며, 단위 테스트로 문자열 생성만 고정한다. 해당 데이터(906류)가 v2에 들어올 때 실측 검증한다.
- A3 (비차단): 감점 폭은 프로토타입 문구의 "완전 역순이면 절반 이하 점수"를 그대로 유지한다 (실측 3점). 더 정밀한 폭 제어(예: ordered sub의 배점 비례)는 루브릭 판정 엔진(Slice 3 로드맵)의 몫.

## 5. Domain risks and edge cases

- **가장 큰 회귀 리스크는 R4의 주입 조건**: 조건이 잘못되면(예: rubricData 존재만으로 주입) 열거형 문항에까지 지시가 붙어 확정 정책이 깨진다. `buildOrderedNotice`가 `null`을 반환하는 경로(플래그 없음)가 기본값이어야 하고, Slice 3의 "무플래그 문항 프롬프트 바이트 동일" 검증이 이를 방어한다.
- **v1 경로 오염 금지**: v1 문항은 `r`이 explanation 평문이라 `rubricData`가 null → 주입 로직이 아예 실행되지 않아야 한다. R4에서 `rubricData` null 가드 필수.
- **문구 드리프트**: 프로토타입 실증은 특정 문구로 이뤄졌다. 구현 시 `verify-order-rule-prototype.ts`의 `ORDER_NOTICE` 상수 취지를 그대로 옮기되, 이후 문구를 수정하면 반드시 E2E를 재실행해야 한다 (문구≠데이터이므로 조용히 바뀌기 쉬움 — 프로토타입 파일 상단에 "프로덕션 반영 후 원본은 serverUtils/rubric.ts" 주석을 남긴다).
- **validateRubric 엄격성**: 기존 32문항 루브릭에 ordered가 없으므로 "없으면 통과"가 절대 조건. 검증 추가가 실수로 필수 필드처럼 동작하면 32문항 전부 v1 폴백으로 떨어지는 대형 회귀 — R8 단위 테스트의 "부재 시 통과" 케이스가 방어선.
- **temperature 0.1의 점수 변동**: 프로토타입 3점이 프로덕션 경로에서 ±1~2 흔들릴 수 있다. E2E 기대는 "≤8"(감점 여부)로 잡지, "=3"으로 잡지 않는다.
- **JSON 필드 순서/직렬화**: `JSON.stringify(rubric)`는 필드 추가에 중립적. `flattenRubricVariants` 등 기존 소비자는 `items.variants`만 읽으므로 영향 없음 — 단, Slice 1에서 grep으로 rubric 필드를 순회하는 모든 소비자(`computeRubricCoverage`, `flattenRubricVariants`, quality 스크립트)를 확인해 ordered 추가에 깨지는 곳이 없음을 못박는다.

## 6. Affected boundaries

- **domain logic**: `lib/rubric.ts`(타입·검증·notice 빌더), `lib/serverUtils.ts`(주입 1개소) — 핵심.
- **persistence**: `cpa_uploader/data/cpa_problems_v2.json` 307번 1개 필드 + DB 재업로드 (DDL 없음).
- **문서/프로세스**: `cpa_uploader/rubric_extraction_prompt.md` (신규 문항 저작 규칙).
- **tests**: `tests/rubric.test.ts`(또는 관례에 맞는 신규 테스트 파일), `tests/verify-item-reorder.ts` 기대치 갱신.
- UI / API / 클라이언트: **무변경** (`r`은 서버 내부 전용, 클라이언트로 안 나감).

## 7. Proposed implementation structure

변경 파일:

- `lib/rubric.ts` — R1(타입)·R2(검증)·R3(notice 빌더). 빌더를 순수 함수로 여기 두는 이유: API 없이 단위 테스트 가능, serverUtils는 소비만.
- `lib/serverUtils.ts` — R4 주입 1개소 (이미 파싱된 `rubricData` 재사용, 이중 파싱 금지).
- `tests/rubric.test.ts` 또는 신규 테스트 — R8.
- `cpa_uploader/data/cpa_problems_v2.json` — R5 (307 sub1 한 줄).
- `cpa_uploader/rubric_extraction_prompt.md` — R7.
- `tests/verify-item-reorder.ts` — R9 (시나리오 3 기대치만).

1차 패스에서 건드리지 말 것:

- systemInstruction 문자열 전체 (접근 A 불채택)
- `computeRubricCoverage`, 사전 필터 수식, Jaccard 게이트
- `lib/quizGrading.ts`, `app/actions.ts`, `lib/db.ts`
- 307 외 문항 데이터, `tests/verify-order-rule-prototype.ts`(실증 기록으로 보존)

## 8. Implementation slices

- **Slice 1 — 스키마: 타입 + 검증 + notice 빌더 (동작 무변경)**
  - Goal: R1·R2·R3·R8 — 아직 아무 호출자도 없는 순수 확장.
  - Expected file scope: `lib/rubric.ts`, 단위 테스트 파일 — 2파일.
  - Why this slice is isolated: 호출자가 없어 회귀 불가능. 문자열(notice 문구)을 여기서 확정해 테스트로 고정.
  - Coupled updates required: 없음. 단, rubric 필드를 순회하는 기존 소비자 3곳(`computeRubricCoverage`/`flattenRubricVariants`/quality 스크립트)이 ordered 추가에 중립임을 grep으로 확인.
  - Verification: `npm run typecheck` && `npm test` — 신규 테스트 포함 전건 통과, 기존 테스트 무변화. 필수 케이스: ordered 부재 루브릭 32건 대표 픽스처가 여전히 validateRubric 통과.
  - Done when: 테스트 전건 통과 + notice 문구가 프로토타입 `ORDER_NOTICE`와 취지 동일함을 diff로 확인.

- **Slice 2 — 배선: gradeBatch 주입 1개소**
  - Goal: R4 — `rubricData` 존재 && `buildOrderedNotice` 비-null일 때만 `contentText`에 지시 블록 추가.
  - Expected file scope: `lib/serverUtils.ts` — 1파일.
  - Why this slice is isolated: 주입 지점이 한 곳이고 Slice 1의 순수 함수를 소비만 함. 이 시점엔 ordered 데이터가 DB/JSON에 없으므로 **프로덕션 동작이 여전히 바이트 단위로 동일**해야 한다.
  - Coupled updates required: 없음 (BatchItem 형상·필터·systemInstruction 불변).
  - Verification: typecheck + `npm test` + 무플래그 상태에서 LIGHT 스팟 1문항(`verify-v2-e2e.ts 110 --yes`) [10,0,0,0] 유지 — 지시가 실수로 전 문항에 붙지 않았음을 실측.
  - Done when: 위 검증 통과, diff가 주입 로직 외 아무것도 건드리지 않음.

- **Slice 3 — 데이터: 307 플래그 + DB 반영 + 저작 규칙**
  - Goal: R5·R6·R7.
  - Expected file scope: `cpa_problems_v2.json`(307 한 줄), `rubric_extraction_prompt.md`.
  - Why this slice is isolated: 코드가 준비된 뒤에만 데이터를 켠다 — 순서 역전 시(데이터 먼저) 지시 없는 상태와 구분 불가.
  - Coupled updates required: 없음.
  - Verification: `validateCpaQuestionV2(307)` 오류 0건 → `upload_cpa_v2.ts` dry-run에서 307 통과 확인 → `--apply` → DB 재조회로 ordered 필드 존재 확인 → `verify-v2-quality.ts 307` R1 통과.
  - Done when: 로컬 JSON·DB 양쪽에서 307 sub1의 ordered:true 확인, 다른 문항 diff 없음.

- **Slice 4 — E2E 실측 및 기대치 갱신 (~10콜)**
  - Goal: R9 + 목표 행동 전체를 실제 경로로 실증. 이 슬라이스에서 로직 수정 금지 — 이탈 시 Slice 2/3 재작업.
  - Expected file scope: `tests/verify-item-reorder.ts`(시나리오 3 기대치), 실행 로그/결과 문서 갱신.
  - Coupled updates required: 없음.
  - Verification:
    1. `verify-item-reorder.ts` 재실행 → 시나리오 3(307 역순) **≤8점**(핵심), 시나리오 1·2(200·122 열거) **≥9점 유지**(정책 회귀 방어).
    2. `verify-v2-e2e.ts 307 --yes` → [10, 0, 0, 0] — S1(정순 모범답안)이 지시 주입 상태에서도 10점(오발동 없음).
    3. 무플래그 문항 회귀 스팟: `verify-v2-e2e.ts 200 --yes` [10,0,0,0].
    4. `npm run typecheck` && `npm test`.
  - Done when: 4개 검증 전부 기대 일치, 결과가 `item_reorder_test_results.md`에 갱신 기록됨.

## 9. Acceptance checklist

- [ ] `RubricSub.ordered?: boolean` 추가, ordered 부재 루브릭 32건 전부 validateRubric 통과 (후방 호환)
- [ ] `buildOrderedNotice`: 플래그 없음→null / 전체 ordered / 일부 ordered 3분기 단위 테스트 통과
- [ ] 무플래그 문항의 채점 프롬프트에 지시 미주입 (Slice 2 시점 LIGHT 스팟 [10,0,0,0] 유지)
- [ ] 307 로컬 JSON·DB 양쪽 ordered:true 반영
- [ ] **307 역순 답안 실제 경로 채점 ≤8점** (프로토타입 3점 대비 감점 재현)
- [ ] 307 정순(S1) 10점대 유지 — 오발동 없음
- [ ] 200·122 열거형 순서 변경 ≥9점 유지 — 확정 정책 무회귀
- [ ] Perplexity 프롬프트에 ordered 저작 규칙 + 출력 스키마 반영
- [ ] `npm run typecheck` · `npm test` 전건 통과

## 10. Deferred work

- 나머지 31문항의 순차성 감사(모범답안 전수 판독 후 ordered 후보 선별) — 별도 데이터 라운드 (A1)
- 일부-sub-ordered(906류 다물음 혼합) 케이스의 E2E 실측 — 해당 데이터가 v2에 들어올 때 (A2)
- 감점 폭의 배점 비례 정밀화 — 루브릭 판정 엔진 로드맵(rubric_grading_plan.md Slice 3)과 통합 (A3)
- 메모리(`grading-policy-rulings.md`)의 "미결 정책" 항목을 구현 완료 후 "확정·반영됨"으로 갱신
