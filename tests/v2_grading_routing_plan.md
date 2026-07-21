# v2 채점 라우팅 계획 (plan-strict)

> 현재 채점 엔진(홀리스틱 `gradeBatch`)은 그대로 두고, `cpa_questions_v2`에 존재하는 문제는 v2 콘텐츠(모범답안·루브릭 파생 키워드)로 채점되도록 데이터 경로만 연결한다. 항목별 정밀 판정 엔진(S4류 문제 해결)은 별도 계획(추후)으로 명시적으로 분리한다. 이 계획이 없으면 지금까지 검증한 v2 루브릭·모범답안은 학생에게 어떤 영향도 주지 못한다.

---

## 1. Goal

`app/`·`lib/`의 채점 경로가 `cpa_questions_v2`를 인지하도록 만든다: v2 row가 존재하는 문제 id는 v2의 `model_answer`/`rubric`(평탄화한 variants를 키워드로 사용)로 채점하고, 존재하지 않는 id는 지금과 완전히 동일하게 v1(`cpa_questions`)으로 채점한다. 채점 알고리즘 자체(홀리스틱 프롬프트, 룰 필터 공식, 재시도 로직)는 무변경.

## 2. Target behavior

**변경 후:**
- v2에 있는 문제(현재 10개, 계속 증가)를 풀면, 채점이 v2의 모범답안·루브릭에서 파생한 키워드를 사용
- v2에 없는 문제(현재 102개)는 이전과 100% 동일하게 동작 (회귀 없음)
- 학생이 보는 문제 설명/제목도, v2가 있으면 v2 버전을 보여줌 (채점 기준과 화면 표시가 다른 버전을 참조하는 불일치 방지)
- 클라이언트가 더 이상 정답 관련 힌트(키워드)를 받지 않음 (필터 판단은 서버로 완전 일원화)

**변경하지 않는 것 (Non-goals):**
- 홀리스틱 채점 프롬프트, 룰 필터 공식, 재시도/지연 로직 — 무변경
- 물음별·항목별 정밀 배점 판정(S4에서 확인된 한계) — 이번 계획의 목적이 아님, 별도 계획(판정 엔진)으로 이연
- Admin 문제 편집 화면(`getAdminQuestions`/`updateQuestion` 등)의 v2 지원 — v2 저작은 여전히 Perplexity + `upload_cpa_v2.ts` 경로로만
- `r`(참고 설명) 필드가 v1 경로에서 클라이언트 제공값을 그대로 신뢰하는 기존 동작 — 이번 범위 밖(기존부터 있던 것)

## 3. Atomic requirements

- R1. `app/quiz/page.tsx`의 클라이언트 사전 필터(로컬 키워드 매칭 후 0점 조기 확정, [app/quiz/page.tsx:214-227](app/quiz/page.tsx#L214-L227))를 제거하고, 모든 답안이 서버(`gradeQuizBatch`)로 전달되게 한다
- R2. `lib/rubric.ts`에 `flattenRubricVariants(rubric: RubricSub[]): string[]` 순수 함수 추가 — 전 item의 variants를 중복 제거해 평탄화
- R3. `app/actions.ts`의 `gradeQuizBatch`에서 `qids`로 `cpa_questions_v2`도 함께 조회 (`cpa_questions` 조회와 병행, 실패해도 v1 경로에 영향 없어야 함)
- R4. `hydrateModelAnswers`(또는 신규 함수)를 확장: v2 row가 있는 qid는 `m = v2.model_answer.join('\n')`, `k = flattenRubricVariants(v2.rubric)`, `r = JSON.stringify(v2.rubric)`로 덮어쓰고, 없는 qid는 기존 v1 로직 그대로
- R5. `r` 필드 구성은 134 파일럿에서 9개 시나리오로 이미 검증된 조합(`JSON.stringify(rubric)`)을 그대로 채택 — explanation과 다른 필드이므로 이 자체가 의도된 설계 변경임을 명시
- R6. `lib/db.ts`의 `fetchAllQuestions(stripAnswers=true)`가 v2 row 존재 시 `question_title`/`question_description`을 v2 값으로 덮어쓴다 (`model_answer`/`rubric` 등 정답 관련 필드는 strip 유지, 노출 안 함)
- R7. v2 rubric이 `validateRubric` 실패 상태(비정상 데이터)인 qid는 v1로 안전하게 폴백하고 서버 로그에 경고 남김 — 채점 자체가 죽으면 안 됨
- R8. v1-only 문제의 채점 입력(`m`/`k`/`r`)과 결과가 이번 변경 전후로 완전히 동일해야 함 (회귀 없음 — 요구사항이자 검증 기준)

## 4. Open questions and assumptions

**사람 결정 필요:**

- Q4. v2 채점 시 `r`에 `explanation`을 완전히 빼고 rubric JSON만 넣는 게 맞는가, 아니면 둘 다 넣을 것인가 — 지금은 파일럿에서 검증된 rubric-only 조합을 안전한 기본값으로 채택하지만, explanation이 채점에 유의미한 맥락을 더할 수도 있음 (판정 엔진 설계 시 재검토 권장)

**안전한 가정:**

- A1. `gradeQuizBatch`의 rate limiter, 재시도/지연 로직, 응답 파싱 로직은 무변경
- A2. `lib/db.ts`의 `AuditQuestion` 타입에 `rubric?`을 추가하는 정도는 허용(타입 확장), 기존 필드 제거는 하지 않음
- A3. 클라이언트 필터 제거(R1) 후에도 서버의 룰 기반 필터는 로컬 계산이라 AI 호출 전에 여전히 즉시 반응 — 사용자 체감 지연은 네트워크 왕복 1회 추가 수준으로 미미함

## 5. Domain risks and edge cases

- **표시-채점 불일치 방지가 핵심**: R6 없이 R3~R5만 하면, 학생은 v1 문제 텍스트를 보면서 v2 모범답안/루브릭 기준으로 채점받는 상황이 생길 수 있음(향후 Perplexity가 문구를 실제로 고치는 문항에서 특히). 이번 계획은 R6을 반드시 포함해야 함
- **정답 힌트 노출 축소는 부수 효과이지 목표가 아님**: R1로 클라이언트가 `keywords`를 안 받게 되는 건 좋은 부수 효과지만, 이번 계획의 핵심 목적(v2 라우팅)과는 별개 이슈. 과도하게 확장해서 다른 보안 이슈까지 손대지 말 것
- **rubric 없는 v2 row는 없음**(v2는 rubric NOT NULL로 설계됨, `rubric_v2_table_plan.md` R4) — 따라서 "v2 row는 있는데 rubric이 없는" 케이스는 스키마상 발생하지 않음. 다만 R7의 "validateRubric 실패"는 스키마 통과 후 데이터 자체가 논리적으로 깨진 경우(수동 편집 등)를 대비한 방어
- **v2가 아직 10개뿐**: 이번 계획 완료 즉시 실제 영향받는 문제는 10개뿐이고 나머지 102개는 무변화 — 이건 의도된 것(v2 콘텐츠가 늘어날수록 자동으로 커버리지가 늘어나는 구조)이지 결함이 아님

## 6. Affected boundaries

| 계층 | 파일 | 변경 |
| --- | --- | --- |
| UI | `app/quiz/page.tsx` | 클라이언트 사전 필터 제거 (R1) |
| 서버 액션 | `app/actions.ts` | `gradeQuizBatch`에 v2 병행 조회 추가 (R3) |
| 재수화 | `lib/quizGrading.ts` | `hydrateModelAnswers` v2-aware 확장 (R4, R5) |
| 유틸 | `lib/rubric.ts` | `flattenRubricVariants` 추가 (R2) |
| 데이터 | `lib/db.ts` | `fetchAllQuestions` v2 텍스트 오버레이 (R6) |

**변경 금지**: `lib/serverUtils.ts`(채점 엔진 자체), `lib/utils.ts`(룰 필터 공식), `cpa_questions`/`cpa_questions_v2` 테이블 데이터, admin 관련 액션

## 7. Proposed implementation structure

- `lib/rubric.ts`에 함수 추가(파일 신규 생성 아님)
- `lib/quizGrading.ts`의 `hydrateModelAnswers` 확장 — 시그니처에 v2 questions 배열 추가 파라미터, 또는 내부에서 v1/v2 병합된 단일 lookup map을 받도록 변경
- `app/actions.ts`/`lib/db.ts`는 기존 함수 내부 로직만 확장, 외부 시그니처(export되는 함수명·반환 타입) 유지

## 8. Implementation slices

- **Slice 1 — 클라이언트 사전 필터 제거**
  - Goal: R1. v2 호환성의 전제조건이자, 독립적으로도 유효한 기술부채 정리(`grading_fix_plan.md`/`rubric_grading_plan.md`에서 이미 두 번 권고됨)
  - Expected file scope: `app/quiz/page.tsx` (해당 블록 삭제)
  - Why this slice is isolated: UI 레이어 단독 변경, 서버 로직 무접촉
  - Coupled updates required: 빈 답안 체크(`답안을 입력해주세요`)는 유지 — 키워드 매칭 부분만 제거
  - Verification: 브라우저에서 퀴즈 1문제 풀이 — 빈 답안 제출 시 여전히 즉시 안내, 키워드 부족 답안도 이제 서버까지 가서 AI 채점 결과를 받는지 확인 (`npm run typecheck` 포함)
  - Done when: 로컬 0점 조기 확정 로직이 완전히 사라지고, 모든 비어있지 않은 답안이 `gradeQuizBatch` 호출까지 도달함

- **Slice 2 — v2 채점 라우팅 (핵심)**
  - Goal: R2~R5, R7, R8
  - Expected file scope: `lib/rubric.ts`, `lib/quizGrading.ts`, `app/actions.ts`
  - Why this slice is isolated: 그레이딩 데이터 경로만 변경, UI/표시 레이어 무접촉(Slice 3에서 처리)
  - Coupled updates required: `hydrateModelAnswers` 시그니처가 바뀌면 호출부(`app/actions.ts`) 동시 수정 필요
  - Verification: 통합 스크립트로 ① v2 존재 qid(예: 134) 채점 시 `m`/`k`/`r`이 v2 값으로 채워지는지 ② v2 미존재 qid(예: 200번대 중 하나) 채점 결과가 변경 전과 동일한지 ③ 의도적으로 깨뜨린 rubric을 가진 가짜 v2 row로 폴백이 작동하는지
  - Done when: v2 covered 10문항 모두 정상 라우팅, v1-only 문항 회귀 없음, 깨진 rubric 폴백 확인

- **Slice 3 — 질문 표시 텍스트 v2 우선 반영**
  - Goal: R6
  - Expected file scope: `lib/db.ts`
  - Why this slice is isolated: 표시 전용, 정답 관련 필드 접근 없음(strip 유지)
  - Coupled updates required: 없음
  - Verification: `getNormalizedQuestions()` 호출 결과에서 v2 존재 id의 `question_description`이 v2 값과 일치하는지, v2 미존재 id는 무변경인지 확인
  - Done when: 134 등 v2 문항의 표시 텍스트가 v2 원문과 일치

- **Slice 4 — 통합 검증 스크립트 + 회귀 확인**
  - Goal: R8 최종 확인, Slice 1~3 종합 스모크
  - Expected file scope: `tests/verify-v2-routing.ts` (신규, 실제 서버 액션 `gradeQuizBatch`를 직접 호출)
  - Why this slice is isolated: 프로덕션 코드 무변경, 검증 전용
  - Coupled updates required: 없음
  - Verification: v2 covered 1건 + v1-only 1건을 실제 `gradeQuizBatch`로 채점 → 결과의 `model_answer` 필드로 어느 경로를 탔는지 확인. 추가로 브라우저에서 로그인 후 v2 문항(134) 1회 실제 풀이해 정상 채점되는지 수동 확인
  - Done when: 자동 스크립트 + 수동 브라우저 확인 둘 다 통과

**실행 순서**: 1 → 2 → 3 → 4. Slice 1은 v2와 무관하게 즉시 착수 가능.

## 9. Acceptance checklist

- [ ] 클라이언트 사전 필터 완전 제거, 빈 답안 체크는 유지
- [ ] v2 존재 qid(134 등 10개)가 v2 모범답안/루브릭 파생 키워드로 채점됨
- [ ] v1-only qid(102개)의 채점 결과가 변경 전과 동일 (회귀 없음)
- [ ] 문제 표시 텍스트가 v2 존재 시 v2 버전과 일치
- [ ] 깨진 rubric 데이터에 대해 v1 폴백이 에러 없이 작동
- [ ] `npm test` / `npm run typecheck` 통과
- [ ] 실제 브라우저에서 v2 문항 1회 이상 수동 풀이 확인

## 10. Deferred work

- **항목별 정밀 판정 엔진**: S4에서 확인된 "물음 하나를 통째로 빼먹어도 전체 점수 유지" 한계 해결 — `rubric_grading_plan.md` 원안(판정→인용검증→코드 산술)을 별도 계획으로 재정리 필요
- Q4(r 필드에 explanation 포함 여부) 결정 및 반영
- Admin 문제 편집 화면의 v2 지원
- `fetchAllQuestions`에서 `keywords` select 자체를 제거할지 여부(R1 이후 더 이상 클라이언트가 쓰지 않으므로 정답 힌트 노출을 줄이는 부수 개선 — 이번 계획 범위 밖으로 명시적 이연)
- v2 커버리지가 늘어남에 따른 `verify-v2-routing.ts`의 전수 확장(`v2_e2e_generalization_plan.md`와 연계)
