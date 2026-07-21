# v2 신규 문제 채점 검증 일반화 계획 (plan-strict)

> `verify-134-e2e.ts`(문제 134 전용 하드코딩)를 임의의 `cpa_questions_v2` 문제에 대해 시나리오를 자동 생성하는 범용 스크립트로 일반화한다. 대상은 **현행 채점 엔진**(`lib/serverUtils.ts`의 홀리스틱 `gradeBatch`)이며, 아직 미구현인 루브릭 판정 엔진은 범위 밖이다. 목표는 v2에 문제가 추가될 때마다 반복 가능한, 비용 계층화된 테스트 루틴을 확보하는 것.

---

## 1. Goal

`tests/verify-v2-quality.ts <id>`(이미 범용화됨)에 이어, `tests/verify-134-e2e.ts`도 임의의 id를 받아 rubric/model_answer로부터 시나리오를 자동 생성하는 `tests/verify-v2-e2e.ts <id>`로 일반화한다. 동시에 "무관 텍스트" 픽스처를 수동 작성 대신 **다른 `standard`를 가진 실제 v2 문제의 모범답안**으로 대체해, 이전 리뷰에서 지적된 "근접 주제라 완전히 무관하지 않다"는 약점을 구조적으로 해소한다.

## 2. Target behavior

**완료 후:**
- `npx tsx tests/verify-v2-e2e.ts <id>` 한 줄로 임의의 v2 문제에 대해 전문/물음별 부분답/샐러드/주입/반복/타 표준 무관 텍스트 시나리오를 자동 생성해 채점하고 결과를 리포트
- 신규 문제 추가 시 사람이 시나리오를 손으로 작성할 필요 없음
- 비용 계층: 경량 배터리(필수, 4콜)와 전체 배터리(선택, N콜)를 플래그로 구분 실행 가능

**변경하지 않는 것 (Non-goals):**
- `lib/serverUtils.ts` 채점 엔진 자체 — 여전히 v1 방식 홀리스틱 채점, 이번 범위에서 무변경
- 물음별 정밀 배점 기대값 검증 — 루브릭 판정 엔진 구현 후의 몫(기존 계획의 Slice 4)으로 유지
- `verify-v2-quality.ts`(데이터 계층) — 이미 완성·검증됨, 무변경

## 3. Atomic requirements

- R1. `model_answer` 배열과 `question_description`으로부터 sub별 텍스트 구간을 분리하는 함수를 `verify-v2-quality.ts`의 기존 로직에서 추출해 공유 유틸로 승격 (두 스크립트가 동일 로직을 복붙하지 않도록)
- R2. S1(전문), S_sub_k(물음 k만, sub 개수만큼 자동 생성), 샐러드(variants 평탄화), 주입(S1 + 고정 꼬리문구), 반복 3회를 rubric/model_answer만으로 자동 생성
- R3. "무관 텍스트" 시나리오: 대상 문제와 다른 `standard`를 가진 v2 문제를 DB에서 하나 조회해 그 `model_answer`를 그대로 사용. 다른 standard의 v2 문제가 아직 없으면(풀이 작을 때) 그 사실을 명시하고 스킵(에러 아님)
- R4. "항목 하나만 누락" 시나리오(선택, `--deep` 플래그): 각 rubric item에 대해, 그 item의 `variants`가 매칭되는 model_answer 배열 원소를 제외한 나머지 전체를 답안으로 구성 — item 개수만큼 생성되므로 비용이 큼
- R5. CLI 플래그: 기본(인자 없음)은 경량 배터리(R2의 S1/샐러드/주입 + R3 무관텍스트, 최대 4~5콜), `--deep`이면 R2 전체(물음별) + R4(항목별)까지 포함
- R6. 결과 리포트는 기존 134 스크립트와 동일한 형식(점수 + 판정 텍스트) 유지, 문제별 배점 구조를 함께 출력(sub 개수, mode, points)해 사람이 점수를 해석할 근거 제공
- R7. 반복 실행 시 API 비용 사전 고지: 실행 전 "이 실행은 약 N콜을 소모합니다" 출력 후 진행 (오탐 방지, `--yes` 없으면 확인 프롬프트)

## 4. Open questions and assumptions

**안전한 가정:**
- A1. R4(항목별 결측)의 "item ↔ model_answer 배열 원소" 대응은 기존 자기 커버리지 로직(해당 item의 variants 중 하나가 매칭되는 원소)으로 근사한다 — 완벽하지 않을 수 있으나(한 원소에 여러 item이 걸칠 경우 과다 제거 가능) 이번 단계에선 근사로 충분
- A2. "무관 텍스트"용 타 문제 선택 기준은 "다른 standard 중 무작위 1개" — 특정 문제를 지정하고 싶으면 `--offtopic-id` 플래그로 override 가능하게 열어둠
- A3. 경량 배터리 기본값(플래그 없을 때)이 "매 문제 추가 시 필수 게이트"라는 사용 관례는 코드가 강제하지 않음 — 실제 운영(언제 `--deep`을 돌릴지)은 사람이 결정

## 5. Domain risks and edge cases

- **sub 1개(단일 물음) 문제**: R2의 "물음 k만" 시나리오가 S1과 동일해져 무의미 — sub 개수 1이면 이 시나리오는 자동 스킵
- **타 standard 문제 부재**: 초기(v2 문제 수가 적을 때는 같은 standard뿐일 수 있음) — R3이 이 경우를 에러 없이 스킵하고 "무관 텍스트 검증 불가(타 standard 문제 없음)"로 명시해야, 나중에 이걸 "PASS"로 오인하지 않음
- **R4 근사의 오탐**: 한 model_answer 원소가 여러 item에 매칭되면(예: 짧은 문제) 그 원소 제거 시 여러 item이 동시에 사라져 "어떤 item이 감점을 유발했는지" 해석이 흐려짐 — 리포트에 "이 시나리오에서 제거된 항목: [...]"을 명시해 사람이 판단하게 함
- **비용 누적**: `--deep`을 문제 수만큼 반복 실행하면 순식간에 수백 콜 — R7의 사전 고지가 이를 막는 유일한 안전장치이므로 누락 금지

## 6. Affected boundaries

| 계층 | 파일 | 변경 |
| --- | --- | --- |
| 공유 유틸 | `tests/verify-v2-quality.ts` 또는 신규 `tests/lib/subSplit.ts` | sub 분리 함수 추출 (R1) |
| E2E 스크립트 | `tests/verify-v2-e2e.ts` (신규, `verify-134-e2e.ts` 대체) | R2~R7 |
| 기존 파일 | `tests/verify-134-e2e.ts` | 대체 후 삭제 또는 "134 심층 감사 예시"로 보존 여부는 사람 결정 |

**변경 금지**: `lib/serverUtils.ts`, `lib/rubric.ts`, `verify-v2-quality.ts`의 기존 검증 로직

## 7. Proposed implementation structure

- 신규 `tests/verify-v2-e2e.ts`: CLI 인자로 id + `--deep`/`--yes`/`--offtopic-id` 플래그
- sub 분리 로직은 `verify-v2-quality.ts`에서 함수로 추출해 두 파일이 import (중복 제거)
- 기존 134 전용 파일은 이번 슬라이스 완료 후 정리(삭제 여부는 Acceptance에서 확인)

## 8. Implementation slices

- **Slice 1 — sub 분리 로직 공유화 + 경량 배터리**
  - Goal: R1, R2(물음별 제외한 나머지: 전문/샐러드/주입/반복), R6
  - Expected file scope: `tests/verify-v2-quality.ts`(함수 추출), `tests/verify-v2-e2e.ts`(신규)
  - Why this slice is isolated: R3(타 문제 조회)·R4(deep)보다 먼저 검증 가능한 핵심 배터리
  - Coupled updates required: 없음
  - Verification: `npx tsx tests/verify-v2-e2e.ts 134`(기본 모드)를 이전 `verify-134-e2e.ts`의 S1/S6/S7(대응 없음, 3절 참고)/S8/S9 결과와 점수 비교 — 같은 입력이면 같은 점수가 나와야 함
  - Done when: 134로 재실행한 결과가 이전 하드코딩 스크립트의 대응 시나리오와 점수 일치

- **Slice 2 — 물음별 부분답 + 타 표준 무관 텍스트**
  - Goal: R2(물음별), R3
  - Expected file scope: `tests/verify-v2-e2e.ts`
  - Why this slice is isolated: sub 분리 함수(Slice 1에서 추출)와 DB 조회만 추가
  - Coupled updates required: 없음
  - Verification: 134(2-sub)와 110(3-sub)에서 각각 sub 개수만큼 시나리오가 생성되는지, standard가 다른 문제로 무관 텍스트가 채워지는지 확인. 현재 v2 풀에서 Ethics 외 standard 문제가 있는지 먼저 확인(`control`/`law`/`200` 등 이미 rubric 있는 문제가 있으면 그걸로 테스트)
  - Done when: 두 문제 모두 정상 생성, 타 standard 부재 시 스킵 메시지 정상 출력

- **Slice 3 — 항목별 결측(`--deep`) + 비용 고지**
  - Goal: R4, R5, R7
  - Expected file scope: `tests/verify-v2-e2e.ts`
  - Why this slice is isolated: 가장 비용이 크고 선택적인 기능이라 마지막 배치
  - Coupled updates required: 없음
  - Verification: 134에 `--deep` 실행 시 6개 item만큼 추가 시나리오(총 6콜)가 생성되고, 실행 전 "약 N콜 소모" 고지 후 확인을 받는지 확인
  - Done when: 비용 고지 없이 `--deep`이 실행되지 않음, 근사 오탐 시 "제거된 항목" 목록이 리포트에 표시됨

**실행 순서**: 1 → 2 → 3. Slice 1 완료 시점에 이미 기존 134 스크립트를 대체할 수 있는 최소 기능 확보.

## 9. Acceptance checklist

- [ ] `verify-v2-e2e.ts <id>` 기본 실행이 임의 id에 대해 동작 (110, 117, 134 각각 확인)
- [ ] 134 재실행 결과가 기존 `verify-134-e2e.ts` 대응 시나리오와 점수 일치
- [ ] sub 1개 문제에서 "물음 k만" 시나리오가 자동 스킵됨
- [ ] 타 standard 문제 없을 때 무관 텍스트 검증이 에러 없이 스킵되고 그 사실이 리포트에 명시됨
- [ ] `--deep` 실행 전 비용 고지가 출력됨
- [ ] 기존 `verify-134-e2e.ts` 처리 방침 결정(삭제 또는 예시로 보존)

## 10. Deferred work

- 루브릭 판정 엔진 구현 후: 물음별 정밀 배점 기대값 검증(기존 `rubric_grading_plan.md`/`q134_pilot_test_plan.md` Slice 4)
- R4 근사의 "한 원소-다중 item 매칭" 문제를 근본적으로 풀려면 모범답안-루브릭 항목 간 명시적 매핑(예: rubric item에 `answer_index` 필드 추가)이 필요 — 지금은 과설계로 판단해 보류
- 경량/심층 배터리를 "몇 번째 추가마다 자동 실행"할지의 운영 절차 문서화 (지금은 수동 판단)
