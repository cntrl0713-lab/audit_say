# 루브릭 기반 채점 재설계 계획 (plan-strict)

> `walkthrough.md`(강건화 1차 완료) 이후의 구조 개선. 문제·모범답안은 그대로 두고, 키워드를 **물음(sub) → 채점 항목(item) 2단계 루브릭**으로 재추출하여 LLM을 "채점자"에서 "검증 가능한 판정자"로 격하시킨다. 슬라이스 순서: 스키마 → 추출 → 채점 로직 → 섀도 검증.

---

## 1. Goal

`cpa_questions`에 루브릭(jsonb) 컬럼을 추가하고, 112개 문항 전체에 대해 LLM 배치 추출 + 사람 검수로 루브릭을 생성한 뒤, 채점 엔진을 "항목별 포함/부분/누락 판정 + 인용 검증 + 코드 산술" 구조로 교체한다. 다항목 문제("1…2…3…을 각각 서술")는 물음 단위로 배점·판정·피드백이 분리된다. 기존 키워드 경로는 루브릭이 없는 문항의 폴백으로 유지한다(점진 전환).

## 2. Target behavior

**전환 후 (루브릭 보유 문항):**

- 키워드 샐러드·프롬프트 주입 답안이 프롬프트 순응이 아닌 **구조적으로**(인용 검증 + 코드 산술) 차단됨
- 동의어/어형 변형 정답이 variants 데이터로 구제됨 (Jaccard 밴드에이드 의존 제거)
- 다항목 문제에서 물음별 부분 점수와 물음별 피드백("물음 1 ✓ · 물음 2 △ · 물음 3 ✗ — 누락: …") 제공
- 한 답안 구간이 두 항목에 중복 득점 불가 (물음 간 교차 오염 차단)
- 최종 점수는 0~10 스케일 유지 → 저장(`saveQuizNoteAction`)·통계·UI 호환

**변경하지 않는 것 (Non-goals):**

- `cpa_questions`의 `question_*`, `model_answer`, `explanation`, 기존 `keywords` 컬럼 (읽기 전용 유지)
- `GradeResult` 형태(`{ score, evaluation, model_answer? }`) — evaluation은 마크다운 문자열 그대로
- 루브릭이 없는 문항의 기존 채점 경로(키워드 필터 + Jaccard + 홀리스틱 LLM) — 폴백으로 무변경 보존
- 재시도/500ms 지연/개별 호출 구조, 답안 입력 UI(단일 텍스트박스)

## 3. Atomic requirements

- R1. `cpa_questions`에 `rubric jsonb` 컬럼 추가 (nullable, 기본 null)
- R2. 루브릭 TS 타입 정의: `RubricSub { sub, label, points, mode: 'all' | 'best_n', n?, items: RubricItem[] }`, `RubricItem { id, item, points, variants? }`
- R3. 루브릭 검증 함수: 물음 배점 합계 = 10, 항목 배점 합계 = 물음 배점(`all`) 또는 `n × 항목배점`(`best_n`), `best_n`은 `n ≥ 1 && n ≤ items.length`, 빈 items 금지 — 순수 함수 + 단위 테스트
- R4. 추출 스크립트(generate): DB에서 문항을 읽어 LLM으로 루브릭 초안 생성 → `cpa_uploader/data/rubrics.draft.json` + 검수용 md 뷰 출력. DB 쓰기 없음
- R5. 추출 프롬프트 규칙: 문제 텍스트의 번호(1., 2., 3.)와 model_answer 배열 원소의 접두사("1.", "(1)")를 기준으로 물음을 분해하고, "N가지 이상" 문구 감지 시 `mode: 'best_n'` 지정, variants에는 조사 변형·동의어·약어 포함
- R6. 적용 스크립트(apply): 검수 완료된 `rubrics.reviewed.json`을 R3 검증 통과 시에만 DB에 업로드. 검증 실패 문항은 id 목록으로 리포트하고 스킵
- R7. 판정 프롬프트: systemInstruction에 판정 규칙(항목별 포함/부분/누락 + 답안 원문 인용 필수, 주입 방어 규칙 승계), contents에 물음·항목 목록 + 구분자로 감싼 사용자 답안
- R8. 판정 결과 파싱: `[{ id, verdict, quote }]` 배열 — 기존 균형 스캔 파서 재사용 또는 확장
- R9. 인용 검증: `포함/부분` 판정의 quote가 정규화(공백 제거) 기준 사용자 답안의 substring이 아니면 `누락`으로 강등
- R10. 중복 인용 차단: 정규화된 quote가 **완전 동일**한 두 항목이 모두 득점하려 하면 배점 높은 쪽만 인정 (부분 겹침은 허용)
- R11. 점수 산술(코드): `all` = 항목별 포함=배점·부분=½·누락=0 합산 / `best_n` = `물음배점 × min(n, 포함수 + 0.5×부분수) / n`. 최종 = 물음 합계, 0.5 단위 반올림, 0~10 클램프
- R12. 사전 필터(루브릭 경로): 전체 항목의 variants 중 1개도 매칭되지 않고 모범답안 Jaccard도 임계 미만이면 로컬 0점 (비용 절감 게이트, 기존 상수 재사용)
- R13. 서버 수화: `gradeQuizBatch`의 select에 `rubric` 추가, `m`·`k`처럼 서버에서 주입. 루브릭 유효(R3) 시 루브릭 경로, 아니면 레거시 경로
- R14. 물음별 피드백 문자열 생성: 기존 evaluation 마크다운 형식(⚠️/👍)과 호환되는 템플릿
- R15. 클라이언트 사전 필터(`app/quiz/page.tsx:219` 부근) 제거: 빈 답안 체크만 남기고 키워드 로컬 0점 로직 삭제 — 필터 판단을 서버로 단일화
- R16. 섀도 비교 스크립트: 동일 답안 세트를 레거시 경로와 루브릭 경로로 각각 채점해 점수 차이 표 출력
- R17. 기존 하네스(verify-adversarial / verify-paraphrase / verify-shuffled) 루브릭 경로 재실행 + 다항목 신규 시나리오 추가

## 4. Open questions and assumptions

**Blocking 질문:** 없음 (아래 가정으로 진행 가능, 검수 단계는 사용자 작업 필요)

**안전한 가정:**

- A1. 추출은 Perplexity Space 수동 워크플로로 대체됨(`cpa_uploader/rubric_extraction_prompt.md`). 판정용 모델은 `gemini-3.1-flash-lite`. 판정 품질 미달 시 상위 모델 승급 검토
- A2. 부분(△) 배점은 항목 배점의 ½ 고정. 실측 후 조정 여지
- A3. 검수 워크플로: draft JSON을 사람이 직접 수정해 `rubrics.reviewed.json`으로 저장(파일명 변경이 검수 완료 신호). md 뷰는 읽기 보조용이며 apply는 JSON만 읽음
- A4. DDL은 Supabase SQL Editor에서 수동 실행 (프로젝트에 마이그레이션 도구 부재). 실행할 SQL은 슬라이스 1 산출물에 문서로 포함
- A5. `review_notes.score` 등 저장 경로는 이미 float를 수용(클라이언트가 0.0 전달 중)하므로 0.5 단위 점수 저장에 문제 없음
- A6. ID 640(키워드 0개 문항)도 추출 대상에 포함 — 루브릭 생성으로 기존 결함이 자연 해소됨

## 5. Domain risks and edge cases

- **배점 배분의 타당성은 자동 검증 불가**: 합계 10 검증(R3)은 형식 검증일 뿐, "물음 1에 2점이 적정한가"는 회계감사 도메인 판단 → **검수 필수**, needs accounting verification 표기
- **"~등" 처리**: 모범답안 목록형 항목의 "정기적 검토 등"에서 variants가 과소 추출되면 정당한 다른 예시 답안이 누락 판정될 위험 — 검수 시 목록형 물음의 variants를 중점 확인
- **중복 인용 규칙의 과차단**: 한 문장이 실제로 두 물음을 동시에 충족하는 경우가 존재할 수 있음 — 완전 동일 span만 차단하고 부분 겹침은 허용(R10), 섀도 검증에서 과차단 사례 관찰 후 조정
- **다물음 문항에서 물음 번호 없이 서술한 답안**: 수험생이 "1. 2. 3." 표기 없이 이어 쓴 경우 — 판정은 항목 단위 의미 매칭이므로 원리상 무관하나, 섀도 시나리오에 포함해 실측
- **루브릭 jsonb 손상/불일치**: 수화 시 R3 검증 실패 → 레거시 경로 폴백 + `console.error` (채점 중단 금지)
- **판정 LLM의 verdict 편향**: 홀리스틱 점수보다 분산이 작다는 가설 자체를 R17 반복 일관성 시나리오로 실측 (가설 반증 시 temperature·프롬프트 조정)

## 6. Affected boundaries

| 계층 | 파일 | 변경 |
| --- | --- | --- |
| DB 스키마 | Supabase `cpa_questions` | `rubric jsonb` 추가 (수동 DDL) |
| 타입/검증 | `lib/rubric.ts` (신규) | 타입 + validateRubric + 산술/인용검증 순수 함수 |
| 데이터 파이프라인 | `cpa_uploader/` 또는 `scripts/` (신규 TS 2개) | generate / apply |
| 채점 엔진 | `lib/serverUtils.ts` | gradeItem에 루브릭 경로 분기 추가 (레거시 경로 무변경) |
| 수화 | `lib/quizGrading.ts`, `app/actions.ts` | select + 수화에 rubric 추가 |
| 클라이언트 | `app/quiz/page.tsx` | 로컬 키워드 사전 필터 제거 (R15) |
| 테스트 | `tests/` | rubric 단위 테스트, 섀도 스크립트, 하네스 재실행 |

## 7. Proposed implementation structure

**신규**: `lib/rubric.ts`(타입·검증·산술·인용검증 — LLM 무관 순수 로직 전부 여기 격리), `scripts/rubric-generate.ts`, `scripts/rubric-apply.ts`, `tests/rubric.test.ts`, `tests/verify-rubric-shadow.ts`, `docs/rubric-ddl.sql`(또는 README 병기)

**수정**: `lib/serverUtils.ts`(분기 1개 + 판정 프롬프트), `lib/quizGrading.ts`·`app/actions.ts`(수화 확장), `lib/db.ts`(AuditQuestion에 `rubric?`), `app/quiz/page.tsx`(사전 필터 제거)

**변경 금지**: 레거시 필터·Jaccard·홀리스틱 프롬프트(폴백 경로), `cpa_problems.json` 원본, 점수 저장 API 시그니처

## 8. Implementation slices

- **Slice 1 — 스키마·타입·검증 기반**
  - Goal: R1~R3. 이후 슬라이스가 의존할 데이터 계약을 먼저 고정
  - Expected file scope: `lib/rubric.ts`, `lib/db.ts`(타입 1줄), `tests/rubric.test.ts`, DDL 문서
  - Why this slice is isolated: 순수 타입·함수 + nullable 컬럼 추가라 기존 동작에 영향 0
  - Coupled updates required: 없음 (rubric 미사용 상태로 배포 가능)
  - Verification: `npm test`(검증 함수: 배점 합계 위반·best_n 범위 위반·빈 items 거부 케이스), `npm run typecheck`, Supabase에서 DDL 실행 후 select 확인
  - Done when: 유효/무효 루브릭 픽스처 각 3종 이상이 단위 테스트로 고정됨

- **Slice 2 — 추출 파이프라인 (generate → 검수 → apply)**
  - Goal: R4~R6. 112문항 루브릭 초안 생성과 검수본 업로드
  - Expected file scope: `scripts/rubric-generate.ts`, `scripts/rubric-apply.ts`
  - Why this slice is isolated: DB 쓰기는 apply의 rubric 컬럼 한정, 채점 코드 무접촉
  - Coupled updates required: 없음
  - Verification: generate 실행 → draft JSON 전 문항 생성 + R3 검증 통과율 리포트, 다물음 대표 문항(110·117·121)과 단일 물음 문항의 분해 결과 육안 확인 → **[사용자 검수]** → apply 실행 → DB에서 무작위 5건 재조회 대조
  - Done when: 검수 완료된 루브릭이 전 문항(ID 640 포함) 업로드되고 apply 리포트에 검증 실패 0건

- **Slice 3 — 채점 로직 교체 (루브릭 경로 추가)**
  - Goal: R7~R15. 판정→검증→산술 파이프라인 가동, 클라이언트 필터 단일화
  - Expected file scope: `lib/serverUtils.ts`, `lib/rubric.ts`(산술·인용검증은 Slice 1에서 기완성 — 여기선 호출만), `lib/quizGrading.ts`, `app/actions.ts`, `app/quiz/page.tsx`
  - Why this slice is isolated: 신규 경로는 rubric 보유 문항에서만 활성, 레거시 경로는 diff 0
  - Coupled updates required: `BatchItem`에 `rubric?` 추가 시 이를 참조하는 테스트 하네스 타입 통과 확인, R15(클라 필터 제거)는 이 슬라이스에 포함 — 서버 필터가 이미 강화되어 있어 제거해도 방어 공백 없음
  - Verification: `npm test` + `npm run typecheck` → 수동 1회: 루브릭 보유 문항 채점 시 물음별 피드백 출력, 루브릭 없는 문항은 기존과 동일 동작
  - Done when: 동일 세션에서 루브릭/레거시 문항이 혼재해도 각자 올바른 경로로 채점됨

- **Slice 4 — 섀도 검증 및 회귀 게이트**
  - Goal: R16~R17. 전환 안전성의 정량 입증
  - Expected file scope: `tests/verify-rubric-shadow.ts`, 기존 verify-* 하네스에 루브릭 경로 실행 옵션 추가
  - Why this slice is isolated: 검증 전용, 프로덕션 코드 무변경
  - Coupled updates required: 없음
  - Verification: ① 적대 4종(샐러드·주입·반대결론·필터우회) 전부 ≤3점 ② 패러프레이즈·동의어 정답 ≥7점 ③ 동일 답안 3회 편차 ≤2 ④ **신규**: 다물음 문항에서 물음 2 내용만 작성 → 물음 2 배점만 획득 ⑤ 물음 번호 표기 없는 이어쓰기 정답 → 감점 없음 ⑥ 섀도 비교표에서 레거시 대비 점수 하락 문항의 원인 분류(정당한 엄격화 vs 오폐기)
  - Done when: ①~⑤ 전부 PASS + ⑥의 오폐기 분류 0건(발견 시 variants 보수 후 재실행), 결과 보고서 작성 가능 상태

**실행 순서**: 1 → 2 → 3 → 4. Slice 2의 검수는 사용자 작업이므로, 대기 중 Slice 3을 선행 가능(루브릭 경로는 rubric 컬럼이 비어 있는 동안 비활성 — 순서 교차에 안전).

## 9. Acceptance checklist

- [ ] DDL 적용 및 `rubric` 컬럼 존재 확인
- [ ] 112문항 전체 루브릭 업로드, R3 검증 실패 0건 (ID 640 포함)
- [ ] `npm test` / `npm run typecheck` 통과
- [ ] 적대 시나리오 4종 ≤3점 (루브릭 경로)
- [ ] 패러프레이즈·동의어 정답 ≥7점 (루브릭 경로, Jaccard 구제 아닌 variants 매칭으로)
- [ ] 다물음 부분 점수: 물음 2만 작성 시 해당 배점만 획득
- [ ] 인용 검증: 조작된 quote(답안에 없는 문장)가 포함 판정을 받지 못함 (단위 테스트)
- [ ] 클라이언트 사전 필터 제거 후 동의어 정답이 서버까지 도달함
- [ ] 루브릭 없는 문항의 채점 결과가 교체 전과 동일 (레거시 회귀 0)
- [ ] 섀도 비교 보고서 산출

## 10. Deferred work

- 레거시 키워드 경로 완전 제거 및 `keywords` 컬럼 폐기 (전 문항 루브릭 안정 운영 확인 후)
- 물음별 답안 입력칸 분리 UI (채점 정밀도 추가 향상 옵션)
- `saveQuizNoteAction`의 클라이언트 score 무검증 저장 → 서버 채점-저장 원자화 (기존 이연 항목)
- 부분(△) 배점 ½ 고정의 항목별 가중 조정
- 판정 프롬프트의 few-shot 예시 보강 (섀도 실측에서 verdict 편향 관찰 시)
- 추출 파이프라인의 신규 문항 등록 플로우 통합 (cpa_uploader에 루브릭 생성 단계 편입)
