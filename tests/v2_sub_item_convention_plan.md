# 계획서: v2 물음(sub)/항목(item) 모델링 컨벤션 통일

> 배경: `tests/v2_grading_test_results.md` 4절 권고 순위 2번.
> 실측 근거: `cpa_uploader/data/cpa_problems_v2.json` 218·307·312·122·209번 문항 직접 판독 + `tests/lib/subSplit.ts` 로직 대조.

## 1. Goal

v2 루브릭 스키마는 `sub`(물음)를 실제 시험 물음 단위로, `item`을 그 물음 안의 채점 세부 항목으로 구분하도록 설계됐다. 그런데 일부 문항은 "~을 모두/N가지 이상 서술하시오" 형태의 **단일 물음**을 답안의 열거 번호("1." "2." ...)에 이끌려 **여러 개의 sub**로 잘못 쪼개 저장했다. 이 오분류는 두 가지 증상으로 나타난다: (A) `splitModelAnswerBySub`가 실제로 텍스트를 찾지 못해 물음별 답안이 빈 문자열이 되는 **결측 결함** (218·307·312), (B) 텍스트는 찾아지지만 sub 경계가 시험의 실제 물음과 무관해 R4 교차오염 100%를 유발하는 **컨벤션 드리프트** (122·209, 채점 자체는 정상 작동). 이번 작업은 5개 문항의 `rubric`/`model_answer` 구조를 재정렬하고, 향후 Perplexity 워크플로우가 같은 오분류를 반복하지 않도록 프롬프트에 판별 규칙을 명시한다.

## 2. Target behavior

변경 후 관찰 가능해야 하는 것:

- 218·307·312·122·209 각 문항에서 `tests/lib/subSplit.ts`의 `splitModelAnswerBySub`가 루브릭이 선언한 모든 sub 번호에 대해 **비어 있지 않은** 텍스트를 반환한다.
- 각 문항의 sub 개수가 **문제 설명(question_description)에 실제로 존재하는 물음 번호 개수**와 일치한다 (`verify-v2-quality.ts` R2 통과).
- 5개 문항 모두 `validateCpaQuestionV2` 통과 (배점 합 10, item id `<sub>-<순번>` 형식, 배점 합치 등 기존 스키마 규칙 그대로 적용).
- 각 문항의 실채점 결과(LIGHT E2E `[S1,S2,S3,S4] = [10,0,0,0]`)가 재정렬 전후로 **동일하게 유지**된다 — 이번 작업은 채점 결과를 바꾸는 것이 아니라 sub/item 경계라는 메타데이터만 바로잡는다.
- `cpa_uploader/rubric_extraction_prompt.md`의 3단계(물음 분해) 지침에 "문제 설명에 물음 번호가 없는 단일 물음은, 모범 답안에 등장하는 열거 번호와 무관하게 sub 1개로 취급한다"는 판별 기준이 명시된다.

변경되지 않아야 하는 것 (non-goals):

- **모범답안·해설의 실질적 문장 내용**: 이번 작업은 sub/item 버킷 경계와 item id 재번호를 조정할 뿐, 리서치로 검증된 문장 자체를 다시 쓰지 않는다 (기존 "기존 모범답안 과도 변형 금지" 원칙 유지). 312에 한해 마커 접두사("1." "2.")를 추가하는 것은 예외적으로 허용 — 이는 다른 모든 다물음 문항이 이미 쓰는 표기 관례를 적용하는 것이지 문장 변형이 아니다.
- **채점 로직(`lib/serverUtils.ts`, `lib/rubric.ts`)**: 사전 필터·`computeRubricCoverage`·Gemini 프롬프트는 무변경. 5개 문항의 배점 합계나 항목 variants 내용도 바꾸지 않는다 (218 sub2의 3항목은 기존 sub2/3/4의 항목을 그대로 재배치).
- **다른 27개 v2 문항**: 이번 계획은 텍스트로 직접 확인한 5개 문항에 한정한다. 217·121·301 등 구조상 의심스러웠으나 실제 질문 텍스트를 아직 읽지 않은 문항은 범위 밖(10절 참고).
- v1 `cpa_questions` 테이블: 무변경.

## 3. Atomic requirements

- R1. `cpa_uploader/data/cpa_problems_v2.json`의 218번 문항 `rubric`을 2개 sub로 재구성한다: sub1(4pt, 기존 그대로, items 1-1/1-2), sub2(6pt, mode='all', items 2-1/2-2/2-3 — 기존 sub2/sub3/sub4의 item 내용·배점·variants를 그대로 재배치하고 id만 `2-1`/`2-2`/`2-3`으로 재번호). `model_answer` 텍스트는 무변경 (이미 "1." "2." "(1)(2)(3)" 마커가 올바르게 존재).
- R2. 307번 문항 `rubric`을 sub1 1개(10pt, mode='all', items 1-1/1-2/1-3 — 기존 sub1/sub2/sub3의 item 내용·배점·variants를 그대로 재배치하고 id만 재번호)로 재구성한다. `model_answer` 텍스트는 무변경.
- R3. 312번 문항 `model_answer[0]`에 `"1. "` 접두사, `model_answer[1]`에 `"2. "` 접두사를 추가한다 (다른 모든 다물음 문항과 동일한 표기 관례 적용). `rubric` 구조(sub1/sub2, 각 5pt)는 이미 올바르므로 무변경.
- R4. 122번 문항 `rubric`을 sub1 1개(10pt, mode='all', items 1-1~1-6 — 기존 sub1~sub6의 item 내용·배점·variants를 그대로 재배치하고 id만 재번호)로 재구성한다. `model_answer` 텍스트는 무변경 (이미 "1."~"6." 마커 존재, 단일 sub이므로 item 열거 마커로 재해석됨 — 313번 문항의 기존 선례와 동일 패턴).
- R5. 209번 문항 `rubric`을 sub1 1개(10pt, items 1-1~1-4 — 기존 sub1~sub4의 item 내용·배점·variants를 그대로 재배치하고 id만 재번호)로 재구성한다. mode는 4절 열린 질문 A1의 답에 따라 'all' 또는 'best_n'(n=3)으로 결정한다. `model_answer` 텍스트는 무변경.
- R6. `cpa_uploader/rubric_extraction_prompt.md` 3단계("물음(sub) 분해")에 다음 판별 기준을 추가한다: sub 개수는 **문제 설명에 실제로 존재하는 물음 번호**를 기준으로 정하며, 모범 답안 배열의 "1." "2." 같은 접두사가 문제 설명의 물음 번호와 대응되지 않으면(즉 문제 설명이 단일 문장인데 답안만 번호로 나열된 경우) 이는 물음이 아니라 **단일 물음 안의 열거형 항목(item) 구분**으로 취급한다.
- R7. 같은 문서 6단계("출력 전 자체 검산")에 "모든 sub 번호에 대해 모범 답안 배열에서 해당 sub로 분류될 텍스트가 최소 1개 이상 존재하는지 확인하라"는 체크리스트 항목을 추가한다 (312류 결측 마커 재발 방지).
- R8. 재구성된 5개 문항 각각에 대해 `validateCpaQuestionV2`를 재실행해 통과를 확인한다.
- R9. 5개 문항에 대해 `npx tsx cpa_uploader/upload_cpa_v2.ts --apply`로 DB(`cpa_questions_v2`)를 갱신한다 (기존 `--dry-run` 기본값을 명시적으로 `--apply`로 전환).

## 4. Open questions and assumptions

Blocking:

- **A1 — 209번 문항의 mode 정책 결정 필요.** 문제 설명이 "적절한 벤치마크 **3가지 이상**을 제시하고"라고 명시한다. 현재(그리고 R5 초안)는 mode='all'(4개 전부 요구)인데, 문면 그대로라면 3개만 맞혀도 만점이 정당할 수 있어 mode='best_n', n=3이 더 충실한 해석일 수 있다. 이는 **채점 관대함의 정도를 바꾸는 정책 결정**이므로 구현 전 확인이 필요하다. (참고: n=3일 때 item당 배점이 10/3=3.33...으로 나누어떨어지지 않아 `validateRubric`의 best_n 배점 검증을 통과하려면 item 배점을 3.33/3.33/3.34 또는 유사하게 조정해야 함 — 이 경우 5R를 그에 맞게 갱신)
- **A2 — 122·209(컨벤션 드리프트, 결측 없음)를 이번 라운드에 포함할지.** 권고 2번 원문은 "218·307·312 마커 정비 포함"이라 표현해 이 3건을 명시했다. 122·209는 실제로 깨져 있지 않고(현재도 LIGHT E2E 정상 통과), 컨벤션만 어긋난 상태다. 포함 시 "통일"이라는 목표에 더 부합하지만 범위가 커진다. 아래 슬라이스는 A(218·307·312, 필수)와 B(122·209, 선택)로 분리해뒀으니 B를 이번에 뺄지 결정하면 된다.

Blocking 아님 — 아래 가정으로 진행 가능:

- A3: 재구성은 콘텐츠(용어·근거·배점 총합)를 바꾸지 않고 버킷 경계만 재배열하는 순수 구조 변경이므로, Perplexity 재입력 없이 로컬 JSON을 직접 수정 후 곧바로 재업로드해도 안전하다고 가정한다. (근거: 213단계 "리서치 및 사실 검증"이 요구하는 것은 문장의 사실관계이지 sub/item 버킷 구조가 아니며, 5개 문항의 문장 내용은 이번 계획에서 전혀 수정하지 않는다.)
- A4: 218 sub2의 item 순서(2-1=위험평가, 2-2=실증절차, 2-3=감사종료)는 기존 sub2→2-1, sub3→2-2, sub4→2-3 순서를 그대로 따른다 (model_answer의 "(1)(2)(3)" 순서와 일치).
- A5: 312에 추가하는 "1. "/"2. " 접두사는 콜론(`:`) 앞의 용어명(`내부통제시스템:`, `내부회계관리제도:`) 바로 앞에 붙인다 (`"1. 내부통제시스템: ..."`).

## 5. Domain risks and edge cases

- **item id 재번호 실수**: `validateRubric`은 `<sub>-<순번>` 형식과 전역 유일성을 강제하므로, sub를 병합/재배열하면서 id 접두사를 갱신하지 않으면(예: 218에서 옛 `3-1`을 `2-3`으로 안 바꾸고 그대로 둠) 검증에서 즉시 걸린다 — R8이 이 안전망이지만, 슬라이스 내 각 문항 수정 직후 개별로 실행해야 뭉쳐서 디버깅하는 상황을 피한다.
- **best_n 배점 나누어떨어짐 (A1이 best_n으로 결정될 경우)**: `validateRubric`은 best_n 모드에서 모든 item의 배점이 동일해야 하고 `n × item.points = sub.points`를 요구한다. n=3, sub.points=10이면 10/3이 정수가 아니므로 item 배점을 3.33/3.33/3.34처럼 비균등하게 맞추거나(`validateRubric`이 "모든 item 배점 동일" 조건을 요구하므로 실제로는 sub.points를 10이 아닌 값으로 두는 게 아니라 **item 배점을 10/3=3.333...으로 통일**해야 함 — 정확히 나누어떨어지지 않으므로 반올림 오차가 검증 epsilon(1e-9) 안에 들도록 소수점 처리 필요). 이건 A1 답변 이후 실제로 부딪힐 문제이므로 미리 사람이 인지하고 있어야 한다.
- **UI 표시 회귀**: 312에 번호 접두사를 추가하면 학생에게 보이는 모범답안 텍스트가 `"1. 내부통제시스템: ..."`로 바뀐다. 다른 다물음 문항(110 등)은 이미 이 표기이므로 회귀가 아니라 통일이지만, 실제 퀴즈 화면에서 렌더링이 깨지지 않는지 육안 확인이 필요하다 (Slice 5).
- **교차오염 재계산**: 122·209(포함 시)가 단일 sub가 되면 R4 "물음 간 교차오염" 분석 대상에서 자연히 제외된다 (sub가 1개면 "다른 sub"가 없음) — 이건 버그 수정의 부작용이지 새로운 문제가 아니다.
- **DB 재적재 타이밍**: `upload_cpa_v2.ts`는 파일 전체를 순회하며 각 행을 개별 upsert하므로, 5개 문항만 바뀐 JSON을 그대로 `--apply`해도 나머지 27개 문항은 동일 내용으로 재upsert될 뿐 데이터 손상 위험은 없다 (idempotent). 다만 **실제 프로덕션 DB에 쓰는 작업**이므로 실행 전 `--dry-run`(기본값) 결과를 먼저 확인하는 절차를 슬라이스에 명시한다.
- **313번과의 일관성**: 313은 이미 122·209와 동일한 패턴(단일 sub + "1."~"5." item 마커)으로 존재하며 정상 작동 중이므로, 122·209를 여기 맞추는 것이 새로운 실험이 아니라 기존에 검증된 패턴을 따르는 것임을 구현자가 인지해야 한다.

## 6. Affected boundaries

- **persistence (데이터)**: `cpa_uploader/data/cpa_problems_v2.json` (5개 문항 rubric/model_answer), Supabase `cpa_questions_v2` 테이블 (동일 5행 재업로드). — 핵심 변경.
- **문서/프로세스**: `cpa_uploader/rubric_extraction_prompt.md` (3단계·6단계 규칙 추가).
- **tests**: `tests/verify-v2-quality.ts`(R2 재통과 확인용, 무변경), `tests/verify-v2-e2e.ts`(재검증 실행용, 무변경) — 코드 수정 없이 실행만.
- domain logic / UI / API: **무변경**. `lib/rubric.ts`, `lib/serverUtils.ts`, `lib/quizGrading.ts`, `app/quiz/page.tsx` 등 애플리케이션 코드는 이번 계획에서 건드리지 않는다.

## 7. Proposed implementation structure

변경 파일:

- `cpa_uploader/data/cpa_problems_v2.json` — 218·307·312(필수) + 122·209(A2 결정에 따라) 문항의 `rubric`/`model_answer` 필드. 이유: 소스 오브 트루스이며 `upload_cpa_v2.ts`가 이 파일을 읽어 DB에 upsert.
- `cpa_uploader/rubric_extraction_prompt.md` — 3단계·6단계 텍스트. 이유: 향후 신규 문항(102개 남음)이 같은 오분류를 반복하지 않도록 하는 유일한 예방 지점.

1차 패스에서 건드리지 말 것:

- `tests/lib/subSplit.ts`, `lib/rubric.ts`의 `computeRubricCoverage`, `lib/serverUtils.ts` — 이번 문제는 코드 결함이 아니라 데이터 구조 오류이므로 코드는 그대로 둔다.
- 217·121·301 등 아직 텍스트를 직접 확인하지 않은 다른 다중-sub 문항 — 섣불리 같은 패턴으로 추정해 건드리지 않는다.
- 원본 `cpa_problems.md`/v1 `cpa_questions` 테이블.

## 8. Implementation slices

- **Slice 1 — Perplexity 프롬프트 규칙 보강**
  - Goal: `rubric_extraction_prompt.md`에 R6·R7 판별 기준을 추가해 향후 신규 문항의 재발을 막는다.
  - Expected file scope: `cpa_uploader/rubric_extraction_prompt.md` — 1파일.
  - Why this slice is isolated: 문서 편집만이며 기존 5개 문항 데이터나 코드에 의존하지 않는다. 먼저 해도, 나중에 해도 무방하지만 원칙을 먼저 확정해두면 아래 슬라이스의 재구성 기준이 문서와 일치함을 스스로 검증할 수 있다.
  - Coupled updates required: 없음.
  - Verification: 육안 검토 — 추가된 문구가 218(파렌 vs 물음 구분)·307/122/209(단일 물음 vs 열거) 두 패턴을 모두 판별 가능한 문장인지 확인.
  - Done when: 3단계에 판별 기준, 6단계에 결측 마커 체크리스트가 추가되고 기존 문구와 모순되지 않음.

- **Slice 2 — 218·307·312 결측 마커 복구 (필수, A2 무관하게 진행)**
  - Goal: R1·R2·R3을 적용해 세 문항의 `splitModelAnswerBySub` 결측을 해소한다.
  - Expected file scope: `cpa_uploader/data/cpa_problems_v2.json`의 id=218,307,312 세 원소 — 1파일, 3개 행.
  - Why this slice is isolated: 세 문항 모두 "결측(빈 문자열)"이라는 동일한 증상을 공유하지만 서로 다른 행이라 상호 의존 없음. R6/R5(A1) 판단이 필요한 209는 포함하지 않는다.
  - Coupled updates required: item id 전체 재번호 (218: `2-1~2-3` 신규 부여, `3-x`/`4-x` 삭제; 307: `1-1~1-3`; 312: model_answer 텍스트 접두사만, id 변경 없음).
  - Verification:
    1. 각 문항에 대해 `node -e`로 `splitModelAnswerBySub` 직접 호출해 모든 sub 번호에 비어있지 않은 텍스트가 나오는지 확인.
    2. `npx tsx tests/verify-v2-quality.ts 218` (307, 312도 각각) → R1(스키마), R2(물음 개수 일치), R3(자기 커버리지) 통과 확인.
  - Done when: 3문항 모두 위 검증 통과 + `validateCpaQuestionV2` 오류 0건.

- **Slice 3 — 122·209 컨벤션 정리 (A2가 "포함"으로 결정된 경우에만 진행)**
  - Goal: R4·R5를 적용해 두 문항을 단일 sub + items 패턴으로 재구성한다.
  - Expected file scope: `cpa_uploader/data/cpa_problems_v2.json`의 id=122,209 두 원소.
  - Why this slice is isolated: Slice 2의 "결측 복구"와 성격이 달라(이쪽은 이미 작동 중인 걸 컨벤션에 맞게 정리) 별도 슬라이스로 분리했고, A1(209 mode 정책) 미결이면 이 슬라이스 전체를 보류할 수 있다.
  - Coupled updates required: item id 전체 재번호 (122: `1-1~1-6`; 209: `1-1~1-4`). A1이 best_n으로 결정되면 209의 item 배점도 균등 재분배 필요(도메인 리스크 2절 참고).
  - Verification: Slice 2와 동일한 2단계 검증(subSplit 직접 호출 + quality 스크립트) 각 문항에 대해 수행.
  - Done when: 2문항 모두 검증 통과 + `validateCpaQuestionV2` 오류 0건.

- **Slice 4 — DB 재적재**
  - Goal: R9 — 수정된 문항들을 실제 `cpa_questions_v2` 테이블에 반영한다.
  - Expected file scope: 코드/데이터 변경 없음 (실행만).
  - Why this slice is isolated: Slice 2/3에서 로컬 JSON 검증이 전부 끝난 뒤에만 실행 — 검증 전 DB에 쓰는 순서 역전을 방지하기 위해 별도 슬라이스로 분리.
  - Coupled updates required: 없음.
  - Verification:
    1. `npx tsx cpa_uploader/upload_cpa_v2.ts` (기본 dry-run) → 대상 문항들이 "✅ 모든 검증 통과"로 뜨는지, 검증 실패가 0건인지 확인.
    2. 사람이 dry-run 출력(배점 합계·물음 개수)을 훑어보고 이상 없으면 진행.
    3. `npx tsx cpa_uploader/upload_cpa_v2.ts --apply` → 대상 문항 업로드 성공 로그 확인.
  - Done when: dry-run 검증 실패 0건, apply 실행 후 업로드 성공 건수가 이번에 수정한 문항 수(3건 또는 5건)와 일치.

- **Slice 5 — 전체 재검증**
  - Goal: 재구조화가 채점 결과·전체 데이터 품질에 회귀를 일으키지 않았음을 실측으로 확인한다.
  - Expected file scope: 코드/데이터 변경 없음 (실행만).
  - Why this slice is isolated: 검증 전용 — 여기서 이탈이 발견되면 Slice 2/3으로 되돌아가 데이터를 재수정할 것 (이 슬라이스에서 로직 수정 금지).
  - Coupled updates required: 없음.
  - Verification (~12~20콜):
    1. `npx tsx tests/verify-v2-quality.ts <id>` — 수정된 각 문항(3건 또는 5건)에 대해 R1~R7 전체 재실행, R2 물음 개수 일치·R4 교차오염 감소 확인.
    2. `npx tsx tests/verify-v2-e2e.ts <id> --yes` — 각 문항 LIGHT 배터리 재실행, `[S1,S2,S3,S4]=[10,0,0,0]` 유지 확인 (재구조화 전과 동일해야 함 — 다르면 회귀).
    3. `npx tsx tests/verify-v2-quality.ts` 전체 32문항 재실행하여 R2 감지 실패 건수가 이번에 고친 문항만큼 감소했는지 최종 확인.
    4. 브라우저에서 개발 서버로 312(및 122·209 포함 시)의 퀴즈 화면을 열어 모범답안 표시가 정상인지 육안 확인 (도메인 리스크 "UI 표시 회귀" 항목).
  - Done when: 모든 재검증이 수정 전 점수/PASS 상태와 동일하며, dev 서버 육안 확인에서 표시 이상이 없음.

## 9. Acceptance checklist

- [ ] `cpa_uploader/rubric_extraction_prompt.md`에 3단계 판별 기준(R6) + 6단계 결측 체크(R7) 추가
- [ ] 218 sub2가 3개 item(위험평가/실증절차/감사종료 목적)을 포함하고 `splitModelAnswerBySub`가 sub1·sub2 모두 비어있지 않은 텍스트 반환
- [ ] 307이 단일 sub(10pt, 3 items)로 재구성되고 `splitModelAnswerBySub`가 결측 없이 전체 텍스트 반환
- [ ] 312의 model_answer가 "1./2." 접두사를 갖고 `splitModelAnswerBySub`가 sub1·sub2 모두 채워짐
- [ ] (A2="포함" 시) 122가 단일 sub(10pt, 6 items)로, 209가 단일 sub(A1 결정에 따른 mode)로 재구성됨
- [ ] 수정된 모든 문항에 대해 `validateCpaQuestionV2` 오류 0건
- [ ] 수정된 모든 문항에 대해 `verify-v2-quality.ts` R2(물음 개수 일치) 통과
- [ ] `upload_cpa_v2.ts --apply` 성공, DB 반영 확인
- [ ] 수정된 모든 문항의 LIGHT E2E `[S1,S2,S3,S4]=[10,0,0,0]`가 재구조화 전후 동일
- [ ] 전체 32문항 quality 재실행 시 R2 실패 건수가 (필수 3건 또는 전체 5건)만큼 감소
- [ ] dev 서버 육안 확인: 수정된 문항의 모범답안 표시 정상

## 10. Deferred work

- 217·121·301 등 텍스트 미확인 문항의 유사 패턴 여부 감사 (별도 라운드로, 실제 질문 텍스트를 다 읽은 후 계획)
- 나머지 v1 문항 102개의 v2 이관 (본 계획과 무관, 기존 로드맵)
- `rubric_grading_plan.md` Slice 3 루브릭 판정 엔진 (sub/item 구조가 정리되어야 이 엔진의 정확도가 의미 있어짐 — 순서상 이 계획이 선행되면 유리)
- 범용어 variants 구 단위 보수 (기존 Q2, 무관)
