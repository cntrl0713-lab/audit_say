# 계획서: "키워드 완전 포함 + 물음 귀속 역전" 적대적 테스트

> 배경: "키워드는 모두 포함하되, 논리가 완전 틀린 경우"에 대한 방어력 테스트 요청.
> 기존 대비 위치: `verify-adversarial.ts`에 이미 "정반대 결론"(부정문으로 결론 뒤집기) 시나리오가 있으나, 이번 요청은 그것과 다른 공격 축이다 — 부정어 없이, 문장 하나하나는 전부 사실이고 정확한 전문용어인데 **어느 물음에 속하는지가 뒤바뀐** 경우.

## 1. Goal

`computeRubricCoverage`(사전 필터, `lib/rubric.ts`)는 각 sub의 커버리지를 "해당 sub의 item variants가 답안 전체 어딘가에 등장하는지"로 계산한다 — **어느 위치·어느 물음 아래 등장하는지는 보지 않는다.** 즉 학생이 물음 1과 물음 2의 내용을 통째로 맞바꿔 제출해도(문장 자체는 모범답안과 동일하므로) 두 sub 모두 100% 커버리지로 계산되어 필터를 완전히 통과한다. 이 공격이 실제로 필터를 통과하는지 실측으로 확인하고, 그 뒤에 남은 유일한 방어선인 Gemini의 홀리스틱 판단(시스템 지시문 규칙 2: "인과관계의 완결성... 논리 구조가 모범 답안과 일치해야 합니다")이 이를 잡아내는지 측정한다.

## 2. Target behavior

변경 후 관찰 가능해야 하는 것:

- 200번 문항(전문가적 의구심 필요 상황 vs 전문가적 판단 필요 상황 — 상호 배타적인 두 카테고리로 구성되어 이 공격을 가장 명확하게 구성할 수 있는 문항)을 대상으로, "물음 1" 표제 아래 물음 2의 내용을, "물음 2" 표제 아래 물음 1의 내용을 그대로 옮겨 적은 답안을 만든다.
- 이 답안이 `computeRubricCoverage` 기준으로 두 sub 모두 커버리지 100%(또는 극히 높음)를 기록해, **사전 필터가 이 공격을 전혀 걸러내지 못함**을 실측으로 확인한다(이게 이 테스트의 핵심 전제이며, 틀렸다면 계획을 재검토해야 함).
- 이 답안을 실제 `gradeBatch`로 채점해 실제 점수를 기록한다. 목표 판정 기준은 기존 적대적 시나리오와 동일하게 **≤3점이면 방어 성공**으로 삼는다.
- 결과가 방어 성공이면 "found no defect" 결과를 그대로 보고한다. **방어 실패(고득점)가 나오면 이건 테스트 데이터 문제가 아니라 진짜 결함이다** — 이 답안은 rubric 자신의 정의상 객관적으로 틀렸기 때문에(물음 1의 항목을 물음 2 항목이라 주장), "동의어 선택이 나빴다"류의 반박이 성립하지 않는다.

변경되지 않아야 하는 것 (non-goals):

- **이 계획은 "발견" 전용이다.** 방어 실패가 발견되더라도 이 계획 안에서 `lib/serverUtils.ts`의 systemInstruction이나 `computeRubricCoverage`를 고치지 않는다 — 실제 결함으로 확인되면 별도 계획서로 수정한다(10절 참고). 지난 세션의 사전 필터 수정처럼, "먼저 재현해서 정말 있는 문제인지 확정 → 그 다음에 고치는 계획을 별도로 세운다"는 이 프로젝트의 기존 작업 순서를 그대로 따른다.
- **기존 v2 rubric 데이터(200번 등)**: 무변경. 이 공격은 순수하게 테스트 스크립트 안의 답안 문자열로만 구성한다.
- **`verify-adversarial.ts`의 기존 4개 시나리오**: 무변경 — 이번 계획은 새 시나리오이지 기존 시나리오의 대체가 아니다.

## 3. Atomic requirements

- R1. 신규 파일 `tests/verify-logic-inversion.ts`를 만든다. `verify-v2-e2e.ts`와 동일한 `loadEnvLocal()` + `gradeBatch` 동적 import 패턴을 **처음부터** 적용한다(이번 세션에 세 번 반복해서 고친 env 크래시를 새 파일에서 재현하지 않기 위해).
- R2. 200번 문항의 rubric을 `cpa_uploader/data/cpa_problems_v2.json`에서 런타임에 직접 읽어와(하드코딩 금지 — 데이터가 나중에 바뀌어도 자동 반영), sub1의 item 텍스트 전체와 sub2의 item 텍스트 전체를 각각 추출한다.
- R3. "물음 귀속 역전" 답안을 프로그래밍적으로 조립한다: `"1. 전문가적 의구심 필요 상황"` 표제 다음에 **sub2**의 5개 item 문장을 이어 붙이고, `"2. 전문가적 판단 필요 상황"` 표제 다음에 **sub1**의 4개 item 문장을 이어 붙인다(표제는 원문 그대로, 본문만 통째로 맞바꿈).
- R4. 조립된 답안에 대해 `computeRubricCoverage`를 직접 호출해 sub1·sub2 커버리지를 출력한다 — 두 sub 모두 매우 높은 값(항목 전부 매칭)이 나옴을 확인해 "필터가 이 공격을 못 거른다"는 전제를 실측으로 증명한다.
- R5. 조립된 답안을 실제 `gradeBatch(200번 문항 id로)`에 제출해 점수·피드백을 기록한다.
- R6. (보조, 선택) 218번 문항(sub2 안에 3개 item — 위험평가/실증절차/감사종료 단계별 "목적")을 대상으로, **같은 sub 안에서** item끼리 목적을 맞바꾸는(예: "위험평가 단계의 목적은 전반적 결론을 내리기 위함이다") 변형을 추가해, sub-간 역전과 item-간 역전 두 축을 모두 커버한다.
- R7. 결과를 `tests/logic_inversion_test_results.md`에 기록한다: 필터 통과 여부(R4), 실제 점수·피드백(R5·R6), 결론(방어 성공/결함 발견).

## 4. Open questions and assumptions

Blocking 없음.

- A1 (비차단): 200번을 1차 대상으로 선택한 이유는 "상호 배타적인 두 카테고리"라는 구조가 이 공격을 가장 명확하고 논쟁의 여지 없이 구성할 수 있기 때문이다(rubric 자신이 "의구심 상황"과 "판단 상황"을 서로 다른 sub로 명시하고 있어 귀속이 뒤바뀌면 객관적으로 틀림). 다른 후보(예: 117 — 위협/기본 안전장치/추가 안전장치 3단 구조)도 가능하나 이번 계획은 하나(+선택적으로 218)로 범위를 좁힌다.
- A2 (비차단): "≤3점 방어 성공" 기준은 `verify-adversarial.ts`의 기존 관례(정반대 결론, 프롬프트 인젝션 등)를 그대로 따른 것이다. 이 문항이 애초에 어려운 개념 구분(의구심 vs 판단)이라 홀리스틱 채점이 완벽히 못 잡고 중간 점수(4~6점)를 줄 가능성도 있다 — 그 경우 "완전 방어 성공"은 아니지만 "완전 실패"도 아닌 회색지대이므로, 결과 보고 시 점수 구간별로(≤3 / 4~6 / ≥7) 해석을 나눠 적는다.

## 5. Domain risks and edge cases

- **이 테스트의 신뢰도는 R4(필터 통과 실측)에 달려 있다.** 만약 R4에서 예상과 달리 커버리지가 낮게 나오면(예: `computeRubricCoverage`가 사실은 위치 정보를 어떤 식으로든 이미 반영하고 있다면), 이 계획의 전제 자체가 틀린 것이므로 R5(실제 채점)로 넘어가지 않고 계획을 재검토해야 한다 — Slice 1에서 이 순서를 강제한다.
- **거짓 양성 위험**: 이 답안은 문장 하나하나가 전부 사실이고 정확한 용어를 쓰지만, 전체 구조가 "1번 물음에 2번 답을 달았다"는 것이므로, Gemini가 혹시 "내용이 다 맞으니까 어느 물음 밑에 있든 상관없다"고 판단해 고득점을 줄 위험이 실제로 존재한다 — 이게 바로 이 테스트가 측정하려는 것이다.
- **비용**: 실제 Gemini 호출 1~2건(200번 + 선택적 218번)뿐이라 매우 저렴하다.

## 6. Affected boundaries

- **tests**: 신규 파일 `tests/verify-logic-inversion.ts`, 신규 결과 문서 `tests/logic_inversion_test_results.md`.
- domain logic / persistence / UI / API: 무변경 (이 계획 자체는 순수 측정 — 결함 발견 시 수정은 별도 계획).

## 7. Proposed implementation structure

변경 파일:

- `tests/verify-logic-inversion.ts` (신규) — R1~R6 전체 구현. 이유: 기존 `verify-adversarial.ts`(v1 평면 키워드 픽스처)나 `verify-v2-e2e.ts`(프로그래밍적으로 파생되는 시나리오 매트릭스, 손으로 구성하는 "귀속 역전" 같은 서사적 조작과는 성격이 다름)에 억지로 끼워 넣기보다 목적이 분명한 별도 파일로 두는 게 더 읽기 쉽다.
- `tests/logic_inversion_test_results.md` (신규) — R7. 이유: 실측 결과와 결론(결함 여부)을 다음 라운드(수정 계획 또는 "문제 없음" 종결)의 근거로 남긴다.

1차 패스에서 건드리지 말 것:

- `lib/serverUtils.ts`, `lib/rubric.ts` — 결함이 발견돼도 이 계획에서는 고치지 않는다.
- `cpa_uploader/data/cpa_problems_v2.json` — 200·218번 데이터는 읽기만 하고 수정하지 않는다.
- `verify-adversarial.ts`, `verify-v2-e2e.ts` — 기존 파일에 손대지 않고 신규 파일로 분리.

## 8. Implementation slices

- **Slice 1 — 답안 조립 및 필터 통과 여부 실측(비용 없음)**
  - Goal: R1~R4 — 스크립트 골격, 답안 조립 로직, `computeRubricCoverage` 직접 호출 결과 확인.
  - Expected file scope: `tests/verify-logic-inversion.ts` — 신규 1파일.
  - Why this slice is isolated: 아직 Gemini를 호출하지 않는다 — 전제(필터가 못 거른다)가 실제로 성립하는지부터 무료로 확인.
  - Coupled updates required: 없음.
  - Verification: `npx tsx tests/verify-logic-inversion.ts --check-only`(또는 유사 플래그)로 실행해 sub1·sub2 커버리지 수치를 콘솔에 출력, 둘 다 0.8 이상(또는 그에 준하는 높은 값)인지 확인.
  - Done when: 커버리지 실측치가 출력되고 "필터 통과 예상"이 확인됨. 만약 커버리지가 낮게 나오면 이 슬라이스에서 멈추고 5절의 "전제 재검토" 절차를 따른다.

- **Slice 2 — 실제 채점 및 결과 문서화(비용 발생, ~2콜)**
  - Goal: R5(·R6)·R7 — Gemini 실채점 및 보고서 작성.
  - Expected file scope: `tests/verify-logic-inversion.ts`(채점 호출부 추가), `tests/logic_inversion_test_results.md`(신규).
  - Why this slice is isolated: Slice 1에서 전제가 확인된 뒤에만 비용을 쓴다.
  - Coupled updates required: 없음.
  - Verification: `npx tsx tests/verify-logic-inversion.ts` 전체 실행 → 200번(및 선택적 218번) 점수·피드백 기록.
  - Done when: 결과 문서에 (a) 필터 커버리지 실측치, (b) 실제 획득 점수, (c) ≤3/4~6/≥7 구간별 해석, (d) "결함 발견" 또는 "방어 성공" 결론이 전부 기록됨.

## 9. Acceptance checklist

- [ ] `tests/verify-logic-inversion.ts` 신규 생성, 처음부터 `loadEnvLocal()` + 동적 import 패턴 적용
- [ ] 200번 문항 rubric을 런타임에 읽어와 답안을 프로그래밍적으로 조립(하드코딩 아님)
- [ ] `computeRubricCoverage` 직접 호출로 필터 통과 여부(sub1·sub2 커버리지) 실측 및 기록
- [ ] 실제 `gradeBatch` 호출로 점수·피드백 실측
- [ ] `tests/logic_inversion_test_results.md`에 결과 및 결론 기록
- [ ] `lib/` 아래 애플리케이션 코드 diff 없음(순수 측정)

## 10. Deferred work

- 방어 실패(고득점)가 발견될 경우의 수정 계획 — 이 계획의 결과에 따라 별도 plan-strict 문서로 후속 진행.
- R6(218번 item-간 역전)은 선택 사항으로 남겨뒀다 — 우선 200번 결과를 보고 결정.
- 117번(3단 안전장치) 등 다른 다중-sub 문항으로 이 공격 패턴을 일반화해 전체 v2 문항 배터리에 포함시키는 것 — 이번엔 단일 대표 사례로 결함 유무만 먼저 확인하고, 필요성이 확인되면 규모를 넓힌다.
- v1 전용 `verify-adversarial.ts` 경로(구식 평면 키워드 필터)에도 같은 공격이 통하는지 별도 확인 — 이번 계획은 실제 프로덕션이 쓰는 v2 rubric 경로에 집중.
