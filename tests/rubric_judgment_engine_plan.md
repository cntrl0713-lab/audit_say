# 계획서: 루브릭 판정 엔진 도입 (rubric_grading_plan.md Slice 3·4 현행화)

> 원계획 대비 위치: `rubric_grading_plan.md`의 Slice 1(스키마)·2(추출)는 **v2 테이블 + Perplexity 워크플로우로 대체 완료**, R15(클라이언트 필터 제거)는 라우팅 라운드에서 완료. 이 문서는 남은 Slice 3(판정 엔진)·4(섀도 검증)를 현재 코드베이스와 이 세션에서 확정된 정책·실측에 맞게 재작성한 것이며, 해당 범위에서 원계획을 대체한다.
> 해소 대상 실측 결함: ① 물음별 부분답안 과소평가 (117 S_sub_3: 6점 배점 완벽 작성 → 4점), ② 물음 통째 누락에도 점수 유지 (초기 134 파일럿 S4: 물음 하나 빼도 6점) — 둘 다 홀리스틱 엔진의 알려진 한계.

## 1. Goal

v2 루브릭 보유 문항의 채점을 "LLM이 0~10점을 직접 매기는" 홀리스틱 방식에서 "LLM은 **항목(item)별 포함/부분/누락 판정 + 답안 원문 인용**만 하고, 점수는 **코드가 루브릭 배점표로 산술**하는" 방식으로 교체한다. 판정 경로는 유효한 rubric(`item.r`)이 있는 문항에서만 활성화되고, v1 문항·깨진 rubric은 기존 홀리스틱 경로를 그대로 탄다. 전환 전에 이 세션에서 구축된 전체 테스트 배터리(적대·부분답안·순서·미세변조·일관성)를 두 엔진에 병렬 실행하는 섀도 검증을 통과해야 하며, 최종 전환은 사용자 승인 게이트 뒤에서만 일어난다.

## 2. Target behavior

전환 후 (rubric 보유 문항):

- **물음별 부분점수가 배점표와 일치**: 117 물음 3(6점 배점)만 완벽 작성 → ~6점 (현행 4점), 물음 하나 통째 누락 → 그 물음 배점만큼 정확히 감점 (현행: 유지되던 결함 해소).
- **물음별 피드백**: evaluation에 "물음 1 ✓ / 물음 2 △(누락: …)" 형태가 기존 ⚠️/👍 마크다운 형식 안에서 제공됨.
- **확정 정책 전부 보존** (이 계획의 합격 조건): 주입 답안 0점 · 키워드 샐러드 0점 · 무관 답안 필터 차단 · 열거 순서 무감점 · ordered 문항 순서 역전 감점 · 미세 변조(부정·수치·주체)는 해당 항목 누락/부분 처리로 감점 · **무관 서술 감점은 판정 경로에서 `irrelevant_severity` 플래그 → 산술 감점(-1/-3, 캡 -3)으로 승계** (Q1 확정 — 홀리스틱 실측 -3과 정합).
- 최종 점수는 0~10, 0.5 단위, `GradeResult` 형태 불변 → 저장·UI 호환.

변경되지 않아야 하는 것 (non-goals):

- **v1 문항·rubric 무효 문항의 홀리스틱 경로**: systemInstruction·필터·Jaccard 포함 diff 0.
- **사전 필터**(`computeRubricCoverage` 게이트): 판정 경로 앞단에서도 그대로 작동 (무관 답안의 API 비용 0 차단 유지).
- **`BatchItem`·`GradeResult` 형상, DB 스키마, UI, 저장 API**: 무변경.
- **v2 데이터**: 루브릭 내용·배점 수정 없음 (섀도에서 데이터 결함이 드러나면 별도 라운드).
- **`gemini-3.1-flash-lite` 모델·재시도·지연 구조**: 유지 (판정 품질 미달 실측 시에만 상위 모델 검토 — 이연).

## 3. Atomic requirements

판정·산술 (순수 로직):

- R1. verdict 타입 정의: `ItemVerdict { id, verdict: '포함'|'부분'|'누락', quote?: string }` + 문항 수준 플래그 `{ injection_detected?: boolean, salad_detected?: boolean, irrelevant_severity?: 'none'|'minor'|'major', order_ok?: { [sub: number]: boolean } }`.
- R2. 인용 검증 순수 함수: `포함/부분` verdict의 quote가 정규화(공백 제거·소문자) 기준 사용자 답안의 substring이 아니면 `누락`으로 강등. quote 부재도 강등.
- R3. 중복 인용 차단 순수 함수: 정규화 quote가 완전 동일한 두 item이 모두 득점 시 배점 높은 쪽만 인정 (부분 겹침 허용).
- R4. 산술 순수 함수 `scoreFromVerdicts(rubric, verdicts, flags)`: `all` sub = Σ(포함=배점, 부분=½배점, 누락=0) / `best_n` sub = `sub.points × min(n, 포함수+0.5×부분수) / n` / `ordered: true`인 sub는 `order_ok=false`면 해당 sub 점수 ×0.5 (실증된 "완전 역순이면 절반 이하" 정책의 산술화) / `injection_detected 또는 salad_detected`면 최종 0점 / `irrelevant_severity`: `minor`(한두 문장) = -1, `major`(상당 분량 또는 오류 서술 혼입) = -3, 캡 -3 — sub 합산 후 차감. 마지막에 0.5 단위 반올림, 0~10 클램프 (감점으로 음수가 되면 0).
- R5. R1~R4 전부 `lib/rubric.ts`(또는 신규 `lib/rubricJudge.ts` — 파일 분리는 구현 재량, lib/ 내 순수 모듈)에 두고 API 없이 단위 테스트로 고정.

판정 프롬프트·호출:

- R6. 판정 systemInstruction: 항목별 판정 규칙(포함=완결된 서술로 항목 충족+원문 인용 필수 / 단어 파편·나열은 누락 / 부분=핵심은 있으나 불완전), 기존 주입 방어 규칙(구분자·조작 문구 감지 시 `injection_detected: true`) 승계, 루브릭 외 추가 서술의 무관도 판정 지시(`irrelevant_severity`: none/minor/major — 무관하거나 틀린 서술의 분량·심각도 기준), ordered sub에 대한 순서 판정 지시(해당 sub 존재 시만), 출력은 순수 JSON(verdict 배열+플래그).
- R7. 판정 응답 파서: 기존 균형 스캔 파서(`extractFirstJson`) 재사용/확장, 파싱 실패 시 재시도(기존 3회 구조), 최종 실패 시 홀리스틱 경로 폴백(채점 중단 금지).
- R8. `gradeWithRubric(item, apiKey)` 함수로 캡슐화하되 **Slice 3까지는 gradeBatch에 배선하지 않는다** (섀도 스크립트만 직접 호출).

섀도 검증·전환:

- R9. 섀도 스크립트 `tests/verify-rubric-shadow.ts`: 동일 답안 세트를 홀리스틱(현행 gradeBatch)과 판정(gradeWithRubric) 두 경로로 채점해 비교표 산출. 시나리오 세트는 기존 배터리 재사용: S1 전문/샐러드/주입/무관(필터)/117 S_sub 1·2·3/307 역순·정순/200·122 열거 셔플/미세변조 3종(314 부정·122 수치·316 주체)/무관 패딩/반복 3회 일관성.
- R10. 섀도 합격 기준(정량): ① 확정 정책 시나리오 전부 기대 범위 내 ② 개선 목표 실측 — 117 S_sub_3 ≥5점, 물음 누락 시나리오에서 누락 물음 배점만큼 감점(±1) ③ S1 전문 ≥9 ④ 반복 편차 ≤1(산술화로 홀리스틱 ≤2보다 강화) ⑤ 하락 문항 원인 분류에서 "오폐기(정당 답안 부당 감점)" 0건.
- R11. **전환 승인 게이트**: R10 결과 보고 후 사용자 승인 시에만 Slice 5 진행.
- R12. 전환 배선: `gradeBatch`에서 유효 `rubricData` 문항은 판정 경로, 그 외 홀리스틱 (기존 rubricData 감지 로직 재사용). 판정 경로 내부 오류 시 홀리스틱 폴백 + `console.warn`.
- R13. 전환 후 회귀: verify-v2-routing 5종 / LIGHT 스팟 3문항 / verify-item-reorder / verify-ordered-probe 재실행 + 기존 검증 스크립트들의 기대치 중 판정 엔진으로 결과가 **정당하게 달라지는 것**(예: 117 S_sub_3 🔴→🟢)의 기대치 갱신.

## 4. Open questions and assumptions

Blocking: **없음 — 두 결정 모두 확정됨 (2026-07-20 사용자 결정):**

- **Q1 확정 — 판정 출력의 `irrelevant_severity` 플래그를 산술 감점으로 변환한다**: `minor`(한두 문장) = -1, `major`(상당 분량 또는 오류 서술 혼입) = -3, 캡 -3. 홀리스틱 실측(-3)과 정합해 "무관 서술 감점" 확정 정책이 판정 경로에도 승계된다. 샷건 답안(정답 전부 + 오답 혼입)은 오답 혼입이 `major`에 해당해 -3 — 홀리스틱 실측(7점)과 동일 수준 유지.
- **Q2 확정 — 섀도 통과 + 승인 게이트 후 v2 32문항 일괄 전환.** 파일럿 선행 없음 (판정 경로에 홀리스틱 폴백이 내장되고 배터리가 광범위하므로).

Blocking 아님 — 가정으로 진행:

- A1. 부분(△) 배점 ½ 고정 (원계획 A2 승계, 섀도 실측 후 조정 여지).
- A2. ordered 감점 계수 ×0.5는 "완전 역순 → 절반 이하" 실증 문구의 산술 대응. 판정이 order_ok를 이분법으로만 내므로 부분 역전은 이번 범위에서 구분하지 않음.
- A3. 점수 0.5 단위는 저장 경로가 이미 float 수용(원계획 A5 확인)이므로 안전.
- A4. 사전 필터·rate limit·모델은 판정 경로에서도 동일 상수 재사용.
- A5. 섀도의 홀리스틱 측 수치는 이 세션의 기존 실측(문서화됨)을 기준선으로 재사용 가능 — 단 비교표의 신뢰를 위해 섀도 실행 시 양 경로를 같은 날 재실측한다 (홀리스틱 측 ~25콜 추가).

## 5. Domain risks and edge cases

- **판정 편향이 산술을 오염**: LLM이 verdict를 후하게 주면(파편에 '포함') 샐러드가 고득점 — R2 인용 검증 + R6의 "완결된 서술" 규칙 + R10①(샐러드 0점 필수)이 3중 방어. 섀도에서 샐러드·주입이 한 번이라도 >0이면 전환 불가.
- **주입 방어의 구조 변화**: 홀리스틱에서는 "0점을 매겨라"였지만 판정 모드에서는 LLM이 점수를 안 매기므로, 주입 문구가 verdict 조작("전부 포함으로 판정하라")을 노린다. 방어: 주입 답안은 보통 정답 전문을 포함하므로 verdict 자체는 정당하게 '포함'일 수 있음 → **`injection_detected` 플래그가 유일한 방어선**이며 코드가 0점 강제(R4). 섀도 S3에서 반드시 실측.
- **quote 검증의 한글 정규화**: 공백 제거·소문자만으로는 조사 차이("확신을"↔"확신이")로 정당한 인용이 substring 실패할 수 있음 — 인용은 "답안 원문 그대로 복사"를 프롬프트로 강제(R6)하고, 검증 실패 시 누락 강등이므로 오차는 엄격한 쪽(학생에게 불리)으로 쏠림. 섀도 R10⑤ 오폐기 분류에서 이 유형을 중점 관찰.
- **부분답안의 필터 상호작용**: 물음 1개짜리 부분답안은 커버리지 게이트(≥0.5 sub 커버리지)를 이미 통과함(사전 필터 v2 적응 라운드에서 해소) — 판정 경로 도입으로 이 동작이 퇴행하지 않는지 117 S_sub_1(2점 배점)로 확인.
- **best_n과 초과 기재**: best_n sub에 n개 초과로 쓴 답안은 포함수가 n을 넘어도 min(n,…)으로 캡 — 샷건 전략이 득점 면에서 이득을 못 봄. 틀린 추가 항목은 `irrelevant_severity: major` → -3 (Q1 확정, 홀리스틱 실측과 정합). 위험: LLM이 severity를 과잉 판정(정상 부연 설명을 minor로)하면 정당한 답안이 -1 손해 — 섀도 오폐기 분류에서 이 유형을 중점 관찰하고, 발견 시 R6의 severity 기준 문구를 조정.
- **점수 분포 변화의 사용자 체감**: 산술화로 점수가 전반적으로 더 낮거나 높아질 수 있음(예: 부분 ½ 정책) — 섀도 비교표의 문항별 Δ 분포를 보고서에 포함해 사용자가 전환 전에 체감 변화를 볼 수 있게 함.
- **폴백 루프 위험**: 판정 파싱 3회 실패 → 홀리스틱 폴백이 다시 실패하는 경우는 기존 오류 처리(재시도 소진 시 오류 결과)와 동일하게 종결 — 무한 재귀 금지 (폴백은 1회, 판정→홀리스틱 방향만).

## 6. Affected boundaries

- **domain logic**: `lib/rubric.ts`(또는 `lib/rubricJudge.ts` 신규) — verdict 타입·인용검증·중복차단·산술 (순수). `lib/serverUtils.ts` — 판정 프롬프트·`gradeWithRubric`·(Slice 5에서) 경로 분기.
- **tests**: 단위 테스트(산술·인용검증·플래그 산술), `tests/verify-rubric-shadow.ts`(신규), 기존 verify-* 기대치 갱신(Slice 5).
- UI / API / persistence / 클라이언트: **무변경** (evaluation 문자열 형식 호환 유지).

## 7. Proposed implementation structure

신규/수정 파일:

- `lib/rubricJudge.ts` (신규 권장) — R1~R4 순수 로직 격리. 이유: rubric.ts가 이미 검증·커버리지·notice로 비대해지는 중, 판정·산술은 응집된 별도 모듈이 테스트·리뷰 모두 쉬움. import는 `'./rubric.ts'` 확장자 관례 준수.
- `lib/serverUtils.ts` — R6 판정 프롬프트 상수 + R8 `gradeWithRubric` (Slice 5 전까지 export만, gradeBatch 무변경).
- `tests/rubricJudge.test.ts` (신규) — 산술·인용검증·중복차단·플래그 단위 테스트.
- `tests/verify-rubric-shadow.ts` (신규) — R9·R10. 관례 준수(loadEnvLocal·동적 import·`r: JSON.stringify(rubric)`), 기존 시나리오 조립 헬퍼(verify-item-reorder 등) 재사용 가능.

1차 패스에서 건드리지 말 것:

- 홀리스틱 systemInstruction·사전 필터·Jaccard·`buildOrderedNotice`(홀리스틱 경로가 폴백으로 계속 사용)
- `lib/quizGrading.ts`·`app/actions.ts`·`lib/db.ts`·클라이언트 (수화·라우팅 이미 완비)
- v2 데이터·DB
- Slice 5 전까지 `gradeBatch` 본문

## 8. Implementation slices

- **Slice 1 — 판정·산술 순수 로직 + 단위 테스트 (API 0콜)**
  - Goal: R1~R5. 산술 규칙을 코드·테스트로 고정 (Q1 결정 반영).
  - Expected file scope: `lib/rubricJudge.ts`, `tests/rubricJudge.test.ts` — 2파일.
  - Why this slice is isolated: 호출자 없음, LLM 무관 — 회귀 불가능.
  - Coupled updates required: 없음.
  - Verification: `npm run typecheck` && `npm test`. 필수 케이스: all/best_n/ordered 산술 각 3종+, 부분 ½, 0.5 반올림·클램프 경계, quote 미검증 강등, 완전 동일 quote 차단(부분 겹침 허용), injection/salad 플래그 → 0점, irrelevant_severity 감점(minor -1 / major -3 / 캡 -3 / 감점 후 음수 → 0), 미지 id verdict 무시, 117·307·134 실데이터 루브릭 픽스처로 만점 검산(=10.0).
  - Done when: 전건 통과 + 기존 112 테스트 무변화.

- **Slice 2 — 판정 프롬프트·파서·gradeWithRubric (미배선)**
  - Goal: R6~R8. LLM 판정 호출부 완성, gradeBatch는 무변경.
  - Expected file scope: `lib/serverUtils.ts` — 1파일 (export 추가만, 기존 함수 diff 0 원칙).
  - Why this slice is isolated: 아무도 호출하지 않는 신규 export — 프로덕션 채점 결과가 바이트 단위로 동일해야 함.
  - Coupled updates required: 없음.
  - Verification: typecheck + 스모크 수동 2콜 — 307 정순(기대 ~10)과 117 S_sub_2(기대 ~2)를 gradeWithRubric로 직접 채점해 verdict 배열·인용·산술 점수가 나오는지 확인. LIGHT 스팟 1문항으로 기존 경로 무변화 확인.
  - Done when: 스모크 2건에서 구조화된 verdict + 산술 점수 산출, 기존 경로 diff 0.

- **Slice 3 — 섀도 배터리 실행 (~50콜: 판정 ~25 + 홀리스틱 기준선 ~25)**
  - Goal: R9·R10 — 두 엔진 병렬 실측 비교표와 합격/불합격 판정 산출. **이 슬라이스에서 코드 수정 금지** — 이탈 발견 시 원인 기록 후 Slice 1/2 재작업.
  - Expected file scope: `tests/verify-rubric-shadow.ts`(신규), 결과 문서 `tests/rubric_shadow_results.md`(신규).
  - Why this slice is isolated: 검증 전용, 프로덕션 무접촉.
  - Coupled updates required: 없음.
  - Verification: R10 ①~⑤ 전 항목 자동 판정 + 문항별 Δ 분포표. 특히 개선 목표(117 S_sub_3 ≥5, 물음 누락 감점 정합)와 정책 보존(샐러드·주입 0점, 열거 셔플 ≥9, 307 역순 ≤5)을 표에 명시. 무관 패딩·샷건은 Q1 확정 기준으로 판정: 감점 작동(≤9) 그리고 정답 가치 과반 보존(≥5) — 홀리스틱 실측(각 7점)과 ±1 수준 정합이면 이상적.
  - Done when: 결과 문서 완성 → **사용자에게 보고하고 승인 대기 (R11 게이트 — 여기서 중단)**.

- **Slice 4 — 전환 배선 + 전체 회귀 (승인 후, ~20콜)**
  - Goal: R12·R13 — gradeBatch 분기 전환과 전 하네스 회귀.
  - Expected file scope: `lib/serverUtils.ts`(분기 1개소), 기대치 갱신이 필요한 기존 verify-* 스크립트, `tests/v2_grading_test_results.md` 갱신.
  - Why this slice is isolated: 승인 게이트 뒤의 유일한 프로덕션 행동 변경 — 문제가 생기면 이 슬라이스만 되돌리면 됨(분기 1개소).
  - Coupled updates required: 판정 엔진으로 결과가 정당하게 달라지는 기존 테스트 기대치(117 S_sub_3 등)의 갱신 — 어떤 기대치를 왜 바꿨는지 결과 문서에 목록화.
  - Verification: verify-v2-routing 5종 / LIGHT 스팟 3문항 / verify-item-reorder / verify-ordered-probe / npm test·typecheck 전건 + 실제 화면에서 1문항 채점해 물음별 피드백 렌더링 육안 확인.
  - Done when: 전 회귀 통과, v1 문항 채점 결과 불변 확인, 결과 문서에 전환 완료 기록.

## 9. Acceptance checklist

- [ ] Q1(irrelevant_severity 플래그 감점 -1/-3, 캡 -3)·Q2(v2 일괄 전환) 결정이 산술·섀도 기대치에 반영됨
- [ ] 산술·인용검증·중복차단·플래그 단위 테스트 전건 통과 (실데이터 픽스처 만점 검산 포함)
- [ ] Slice 2 시점 프로덕션 채점 경로 diff 0 (미배선 확인)
- [ ] 섀도: 샐러드·주입 0점 / 무관 필터 차단 / 열거 셔플 ≥9 / 307 역순 감점 / 미세변조 3종 감점 — 확정 정책 보존
- [ ] 섀도: 무관 패딩·샷건 — 감점 작동(≤9) & 정답 가치 과반 보존(≥5), 홀리스틱 실측(7점)과 ±1 정합
- [ ] 섀도: 117 S_sub_3 ≥5점, 물음 통째 누락 = 해당 배점 감점(±1) — 개선 목표 달성
- [ ] 섀도: 반복 3회 편차 ≤1, 오폐기 분류 0건
- [ ] 사용자 승인 후에만 gradeBatch 전환 (게이트 준수)
- [ ] 전환 후 routing 5종·LIGHT 스팟·reorder·ordered-probe·npm test 전건 통과, v1 경로 무변화
- [ ] 섀도·전환 결과 문서 산출

## 10. Deferred work

- 레거시 키워드·홀리스틱 경로 제거 (전 문항 판정 엔진 안정 운영 확인 후 — 원계획 이연 승계)
- 부분(△) ½ 고정의 항목별 가중 조정, ordered 부분 역전의 세분 감점 (A1·A2)
- 판정 모델 상위 승급 검토 (섀도에서 verdict 품질 미달 실측 시)
- 물음별 답안 입력칸 분리 UI, few-shot 예시 보강 (원계획 이연 승계)
- 나머지 v1 80문항의 v2 이관 (판정 엔진 커버리지 확대는 데이터 이관 속도에 종속)
- `saveQuizNoteAction` 서버 채점-저장 원자화 (기존 이연 승계)
