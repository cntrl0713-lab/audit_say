# 계획서: verify-adversarial/paraphrase/shuffled 동적 import 정비

> 배경: `tests/v2_grading_test_results.md` 4절 권고 순위 4번.
> 조사 완료: 3개 파일을 직접 읽고 plain `npx tsx`로 재현, 원인을 2단계로 분리 확인.

## 1. Goal

`tests/verify-adversarial.ts` / `verify-paraphrase.ts` / `verify-shuffled.ts`는 세션 초반(채점 강건화 라운드)에 작성된 스크립트로, `lib/serverUtils.ts`를 최상단에서 정적 import한다. 이 체인(`serverUtils → db → supabase`)은 모듈 로드 시점에 즉시 env 변수를 요구해 없으면 throw하는데, 이 3개 파일은 (verify-v2-e2e.ts 등 최근 스크립트들과 달리) `.env.local`을 읽어오는 `loadEnvLocal()` 폴백 자체가 아예 없다. 그 결과 `npx tsx tests/verify-adversarial.ts`처럼 이 프로젝트의 다른 모든 검증 스크립트와 동일한 방식으로 실행하면 즉시 크래시한다. 이번 계획은 이미 두 차례(`verify-v2-e2e.ts`, `verify-v2-routing.ts`) 검증된 표준 패턴(동적 import + `loadEnvLocal()`)을 이 3개 파일에도 동일하게 적용한다.

## 2. Target behavior

변경 후 관찰 가능해야 하는 것:

- `npx tsx tests/verify-adversarial.ts` / `verify-paraphrase.ts` / `verify-shuffled.ts`를 **플래그 없이** 실행했을 때, `.env.local`이 자동으로 로드되어 `lib/supabase.ts`의 env 크래시 없이 정상적으로 시나리오 실행 단계까지 도달한다.
- 세 스크립트 모두 기존 채점 방어 시나리오(적대적 답안 방어 ≤3점, 패러프레이즈/동의어 보존 ≥7점, 반복 일관성 ≤2점 편차, 순서 셔플·교차오염 방어)에서 **세션 초반과 동일한 방어 결과**를 보인다 — 이번 수정은 env 로딩 방식만 바꾸는 것이지 채점 로직 자체를 재검증하는 것이 아니다.

변경되지 않아야 하는 것 (non-goals):

- **각 스크립트의 테스트 시나리오·픽스처·통과 기준(점수 임계값)**: 무변경. 이번 계획은 순수하게 "스크립트가 실행되게 만드는" 인프라 수정이다.
- **`verify-shuffled.ts`의 `server-only` mock 워크어라운드(6~19줄)**: 아래 4절에서 직접 검증한 결과 현재 tsx 동적 import 실행 방식에서는 이 mock이 없어도 `lib/supabaseAdmin.ts`가 정상 로드됨을 확인했다. 그럼에도 기존 코드를 건드리지 않는다 — 필요 없어 보인다고 제거하는 것은 이번 계획의 범위(env 로딩 정비)를 벗어나는 별개의 정리 작업이다.
- **`lib/serverUtils.ts`, `lib/db.ts`, `lib/supabase.ts` 등 애플리케이션 코드**: 무변경. 문제는 테스트 스크립트의 import 순서에 있지 라이브러리 코드에 있지 않다.

## 3. Atomic requirements

- R1. 세 파일 각각에 `verify-v2-e2e.ts`와 동일한 `loadEnvLocal()` 함수(`.env.local` 수동 파싱 후 `process.env`에 주입)를 추가한다.
- R2. `verify-adversarial.ts`: 최상단의 `import { gradeBatch, BatchItem } from '../lib/serverUtils.ts';`(7번 줄)를 `import type { BatchItem } from '../lib/serverUtils.ts';`(정적, 타입 전용)로 축소하고, `gradeBatch`는 `runAdversarialTest()` 함수 안에서 `loadEnvLocal()` 호출 직후 `const { gradeBatch } = await import('../lib/serverUtils.ts');`로 동적 로드한다.
- R3. `verify-adversarial.ts`: 최상단(9번 줄)의 `const apiKey = process.env.GOOGLE_API_KEY;`를 `runAdversarialTest()` 함수 안, `loadEnvLocal()` 호출 이후로 옮긴다 (현재 순서상 `loadEnvLocal()`이 아직 없으니 apiKey를 읽어도 항상 비어있었던 상태였음).
- R4. `verify-paraphrase.ts`에 R2·R3과 동일한 수정을 적용한다(구조가 동일 — 최상단 import 8번 줄, 최상단 apiKey 10번 줄).
- R5. `verify-shuffled.ts`: 최상단의 `import { gradeBatch, BatchItem, GradeResult } from '../lib/serverUtils.ts';`(22번 줄)를 `import type { BatchItem, GradeResult } from '../lib/serverUtils.ts';`로 축소하고, `gradeBatch`는 `main()` 함수 안에서 `loadEnvLocal()` 호출 직후 동적 로드한다. `apiKey` 읽기(88번 줄)는 이미 `main()` 내부에 있으므로 위치 이동은 불필요 — `loadEnvLocal()` 호출만 그 앞에 추가한다.
- R6. `verify-shuffled.ts`의 `server-only` mock(6~19줄)은 그대로 둔다 — 삭제·수정하지 않는다.

## 4. Open questions and assumptions

Blocking 없음.

- **직접 검증한 사실 (가정 아님)**: `server-only` 패키지(`node_modules/server-only/index.js`)는 `react-server` 조건이 없으면 무조건 throw하도록 되어 있어, 원래는 `lib/db.ts`(→ `supabaseAdmin.ts` → `server-only`)를 Next.js 바깥에서 로드하면 깨질 것으로 예상했다. 하지만 `--env-file=.env.local` 하에서 `await import('../lib/db.ts')`를 직접 실행해본 결과 **실제로는 throw하지 않고 정상 로드됨을 확인했다** (tsx의 동적 import 처리 방식 때문으로 추정). 따라서 `verify-adversarial.ts`·`verify-paraphrase.ts`에는 `server-only` mock을 추가할 필요가 없다 — 실제로 막힌 적 없는 문제를 예방한다고 불필요한 코드를 새로 넣지 않는다.
- A1 (비차단): `verify-shuffled.ts`에 이미 존재하는 `server-only` mock이 애초에 왜 필요했는지는 불명확하다(과거 다른 실행 방식에서 필요했을 가능성). 이번 계획은 그 이유를 규명하지 않고 그대로 둔다.

## 5. Domain risks and edge cases

- **apiKey 읽기 순서 버그 재현 위험**: R3·R4를 빠뜨리고 R2만 적용하면(즉 `gradeBatch` import만 동적으로 바꾸고 `apiKey` 상수는 최상단에 그대로 두면), 크래시는 사라지지만 `apiKey`가 여전히 `loadEnvLocal()` 실행 전 시점의 `undefined`로 고정되어 "GOOGLE_API_KEY 환경변수가 설정되지 않았습니다" 오류로 새로 실패한다. 구현자가 이 순서 의존성을 놓치기 쉬우므로 명시했다.
- **비용 고지**: 세 스크립트를 실제로 끝까지 돌리면 Gemini 호출이 발생한다(대략 adversarial 7콜 + paraphrase 7콜 + shuffled 10콜 = 24콜). 이번 검증은 "크래시가 사라졌는지"뿐 아니라 "기존 방어 결과가 그대로인지"까지 확인하는 것이 목적이므로 실비용을 감수하고 전체 실행까지 포함한다.
- **타입 전용 import 분리 실수**: `BatchItem`/`GradeResult`를 `import type`으로 옮길 때 실제 런타임 값으로 쓰이는 게 하나도 없는지 재확인 필요(둘 다 인터페이스이므로 안전하지만, 혹시 `instanceof` 등으로 쓰인 곳이 있으면 깨진다 — 3개 파일 모두 타입 주석 용도로만 쓰임을 이미 확인함).

## 6. Affected boundaries

- **tests**: `tests/verify-adversarial.ts`, `tests/verify-paraphrase.ts`, `tests/verify-shuffled.ts` — 이 3개 파일만.
- domain logic / persistence / UI / API: 무변경.

## 7. Proposed implementation structure

변경 파일:

- `tests/verify-adversarial.ts` — R1·R2·R3.
- `tests/verify-paraphrase.ts` — R1·R2·R3(R4).
- `tests/verify-shuffled.ts` — R1·R5.

이유: 세 파일 모두 동일한 근본 원인(정적 import + `loadEnvLocal` 부재)을 공유하지만 서로 완전히 독립적인 실행 파일이라 상호 의존 없이 각각 수정 가능.

1차 패스에서 건드리지 말 것: 위 3절·6절에 명시한 대로 애플리케이션 코드, 테스트 시나리오/픽스처, `server-only` mock.

## 8. Implementation slices

- **Slice 1 — 3개 스크립트에 표준 env 로딩 패턴 일괄 적용**
  - Goal: R1~R6 전체 적용.
  - Expected file scope: `tests/verify-adversarial.ts`, `tests/verify-paraphrase.ts`, `tests/verify-shuffled.ts` — 3파일.
  - Why this slice is isolated: 세 파일이 서로를 import하지 않으므로 한 파일의 수정이 다른 파일에 영향을 주지 않는다. 동일한 기계적 패턴이라 하나의 슬라이스로 묶어도 "atomic goal" 원칙에 위배되지 않는다(목표가 "이 표준 패턴을 세 파일에 적용"으로 하나).
  - Coupled updates required: 없음.
  - Verification: `npm run typecheck` — `import type`으로 축소한 뒤에도 타입 에러가 없는지 확인. 이 단계에서는 아직 실행하지 않는다(Slice 2에서 실비용 실행).
  - Done when: typecheck 통과, 세 파일의 diff가 정확히 3절에 명시한 범위(loadEnvLocal 추가, import 분리, apiKey 위치 이동)만 포함.

- **Slice 2 — 실행 검증 (전체 배터리, 비용 발생)**
  - Goal: 크래시 해소 및 방어 결과 무회귀를 실측으로 확인.
  - Expected file scope: 코드 변경 없음 (실행만).
  - Why this slice is isolated: Slice 1의 typecheck가 끝난 뒤에만 실행 — 문법 오류 상태에서 API 비용을 쓰지 않기 위해 분리.
  - Coupled updates required: 없음.
  - Verification (~24콜):
    1. `npx tsx tests/verify-adversarial.ts` (플래그 없이) → 크래시 없이 "Slice 4: 적대적 답안 API 방어력 실측" 헤더까지 도달, 4개 시나리오 전부 실행되고 요약에서 방어 실패 건수 확인.
    2. `npx tsx tests/verify-paraphrase.ts` (플래그 없이) → 마찬가지로 끝까지 실행, 패러프레이즈/동의어 시나리오 점수 확인.
    3. `npx tsx tests/verify-shuffled.ts` (플래그 없이) → 셔플·교차오염 시나리오 실행, `s1Passed`/`s2Passed` 결과 확인.
  - Done when: 세 스크립트 모두 env 크래시 없이 끝까지 실행되고, 각 스크립트가 보고하는 방어 성공/실패 건수가 그 스크립트의 최초 작성 당시 결과와 동일한 수준(크게 악화되지 않음)임을 확인.

## 9. Acceptance checklist

- [ ] 세 파일 모두 `loadEnvLocal()` 보유
- [ ] 세 파일 모두 `gradeBatch`가 동적 import, `BatchItem`(`GradeResult`)은 `import type`으로 정적 유지
- [ ] `verify-adversarial.ts`·`verify-paraphrase.ts`의 `apiKey` 읽기가 `loadEnvLocal()` 이후로 이동
- [ ] `npm run typecheck` 통과
- [ ] 세 스크립트 모두 `npx tsx tests/<file>.ts` (플래그 없이) 실행 시 env 크래시 없음
- [ ] 세 스크립트의 방어 성공/실패 결과가 회귀 없이 유지됨
- [ ] `verify-shuffled.ts`의 `server-only` mock 코드가 그대로 보존됨 (diff에 등장하지 않음)

## 10. Deferred work

- `verify-shuffled.ts`의 `server-only` mock이 실제로 불필요한지 더 깊이 규명하고 제거하는 정리 작업 — 이번 계획에서 불필요함을 직접 확인했지만, 제거는 별개의 위험 평가가 필요한 작업이라 범위에서 제외.
- 세 스크립트를 `package.json`의 `scripts`에 등록해 매번 전체 경로를 타이핑하지 않도록 하는 개선 — 이번 권고에는 포함되지 않았음.
- 세 스크립트가 검증하는 시나리오 자체(적대적 답안 픽스처 등)를 v2 문항 기준으로 갱신할지 여부 — 현재는 v1 픽스처(qid 1~5)를 대상으로 하며, 이번 계획은 이를 재검토하지 않는다.
