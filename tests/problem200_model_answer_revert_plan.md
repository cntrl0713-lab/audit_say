# 계획서: 200번 문항 모범답안 원형 보존 위반 복구

> 배경: `tests/v2_grading_test_results.md` 4절 권고 순위 3번 — "200번 모범답안 변형 여부 확인 (원형 보존 원칙 대비)".
> 조사 완료: v1(`cpa_questions` DB)과 v2(`cpa_problems_v2.json`)의 200번 `model_answer`를 라인 단위로 직접 대조.

## 1. Goal

`tests/v2_grading_test_results.md`는 200번 문항이 v1→v2 과정에서 유일하게 모범답안 자체가 변형된 문항(Jaccard 0.913)이라고 플래그했고, 의도된 개정인지 확인이 필요하다고 남겼다. v1/v2 `model_answer` 11줄을 전부 대조한 결과, **2줄이 다르고 둘 다 의도된 개정으로 보기 어렵다**: (1) `"답변의 신뢰성"`이 `"답변 of 신뢰성"`으로 — 조사 "의"가 영단어 "of"로 바뀐 명백한 오손상, (2) `"(2) 감사절차의 성격, 시기 및 범위의 결정"`(원문 명사형)이 `"(2) 감사절차의 성격, 시기 및 범위를 결정하는 데 전문가적 판단이 필요하다."`(완결문 재작성)로 — 같은 sub의 나머지 4개 항목(1,3,4,5번)은 전부 원문 명사형을 그대로 유지했는데 이 항목만 유독 풀어 썼다. 이 계획은 두 줄을 v1 원문으로 되돌린다.

## 2. Target behavior

변경 후 관찰 가능해야 하는 것:

- `cpa_problems_v2.json`과 DB `cpa_questions_v2` 테이블의 200번 `model_answer[2]`가 `"(2) 감사증거로 사용될 문서 및 질의에 대한 답변의 신뢰성에 의문을 갖게 하는 정보"`로 v1과 동일해진다.
- 200번 `model_answer[7]`이 `"(2) 감사절차의 성격, 시기 및 범위의 결정"`으로 v1과 동일해진다 (나머지 4개 형제 항목과 동일한 명사형 스타일로 복귀).
- `verify-v2-quality.ts 200`의 R6(신구 대조 Jaccard)에서 `model_answer` 유사도가 1.0에 근접한다 (현재 0.913 → 사실상 1.0, 두 줄만 고쳤으므로 완전한 1.0은 아닐 수 있으나 매우 근접해야 함).

변경되지 않아야 하는 것 (non-goals):

- **`rubric` 전체(items·variants·points·labels)**: 직접 확인한 결과 이미 정확하다 — item 1-2의 텍스트는 이미 v1 원문("답변의 신뢰성")을 쓰고 있고, item 2-2는 애초에 "완결된 서술" 스키마 요구사항에 따라 독립적으로 문장화된 것이라 `model_answer`와 별개다. 루브릭은 이번 계획에서 손대지 않는다.
- **question_description·explanation**: v1/v2 완전히 동일함을 이미 확인했으므로 무변경.
- **117·122·207번의 "설명만 수정" 경고**: 권고 3번은 200번만 지목했다. 이 문항들은 별도 사안이며 이번 계획 범위 밖(10절 참고).
- **채점 로직**: `computeRubricCoverage`는 `rubric.items.variants`로만 매칭하고 `model_answer` 문구를 참조하지 않으므로, 이번 텍스트 복구는 사전 필터·커버리지 계산에 영향을 주지 않는다. `model_answer`가 실제로 쓰이는 곳은 (a) 학생에게 보여주는 표시 텍스트, (b) Gemini 프롬프트의 "기준 모범 답안" 참고 문맥, (c) Jaccard 유사도 계산의 비교 대상 — 셋 다 문구가 자연스러워지는 방향이므로 회귀 위험이 낮다.

## 3. Atomic requirements

- R1. `cpa_uploader/data/cpa_problems_v2.json`의 id=200 `model_answer` 배열 인덱스 2를 `"(2) 감사증거로 사용될 문서 및 질의에 대한 답변 of 신뢰성에 의문을 갖게 하는 정보"` → `"(2) 감사증거로 사용될 문서 및 질의에 대한 답변의 신뢰성에 의문을 갖게 하는 정보"`로 수정한다.
- R2. 같은 배열 인덱스 7을 `"(2) 감사절차의 성격, 시기 및 범위를 결정하는 데 전문가적 판단이 필요하다."` → `"(2) 감사절차의 성격, 시기 및 범위의 결정"`으로 수정한다.
- R3. `rubric`·`question_description`·`explanation`·`question_title`은 한 글자도 건드리지 않는다.
- R4. 수정 후 `validateCpaQuestionV2`가 여전히 오류 0건임을 확인한다.
- R5. `npx tsx cpa_uploader/upload_cpa_v2.ts --apply`로 DB `cpa_questions_v2`의 200번 행을 갱신한다.

## 4. Open questions and assumptions

Blocking 없음.

- A1 (비차단): 원본 Perplexity 세션의 "검증 메모"가 이 두 변경 중 하나를 명시적으로 정당화했을 가능성을 완전히 배제할 순 없다 — 이번 조사에서는 그런 근거를 저장소 어디서도 찾지 못했다. 다만 두 변경 모두 (a) "완결된 서술은 item 필드의 몫이지 model_answer의 몫이 아니다"라는 이 파일 전체의 일관된 관례, (b) 같은 sub 안 형제 항목들의 스타일과의 불일치라는 **내적 증거**로 뒷받침되므로, 확인 없이 되돌려도 위험이 낮다고 가정한다. 되돌리기는 텍스트 2줄 교체일 뿐이라 잘못 판단했더라도 원상복구 비용이 매우 낮다.

## 5. Domain risks and edge cases

- **S1 시나리오 민감성**: `verify-v2-e2e.ts`의 S1("모범답안 전문")은 `model_answer`를 문자 그대로 답안으로 제출해 Gemini에게 채점시킨다. 이번 수정으로 S1에 실제로 전송되는 텍스트가 바뀌므로(비록 더 자연스러운 방향으로), 수정 후 S1이 여전히 9~10점대인지 실측 확인이 필요하다(Slice 2).
- **Jaccard 재측정**: R6의 0.913은 전체 텍스트 대비 2줄 변경분의 비율로 계산된 값이라, 두 줄만 고쳐도 정확히 1.0이 되지는 않을 수 있다(공백 정규화 등의 영향). "1.0에 근접"을 기준으로 삼고 완전한 1.0을 요구하지 않는다.
- **DB 재적재 범위**: `upload_cpa_v2.ts`는 파일 전체를 순회하지만 upsert는 id 기준이라 200번 외 다른 문항에는 영향이 없다 — 이전 계획들에서 이미 검증된 동작이므로 재확인만 한다.

## 6. Affected boundaries

- **persistence**: `cpa_uploader/data/cpa_problems_v2.json`(id=200 model_answer 2줄), Supabase `cpa_questions_v2`(동일 행). 이것이 유일한 변경 지점이다.
- domain logic / UI / API / rubric: 무변경.

## 7. Proposed implementation structure

변경 파일:

- `cpa_uploader/data/cpa_problems_v2.json` — id=200의 `model_answer[2]`, `model_answer[7]` 두 문자열. 이유: 유일한 원인 위치.

1차 패스에서 건드리지 말 것:

- `rubric` 필드 전체 (이미 정확함, 확인만 하고 수정 금지)
- 다른 v2 문항 전체
- 애플리케이션 코드 일체

## 8. Implementation slices

- **Slice 1 — 텍스트 복구 및 스키마 검증**
  - Goal: R1·R2 적용, R4로 스키마 무결성 확인.
  - Expected file scope: `cpa_uploader/data/cpa_problems_v2.json` — 1파일, 1행의 2개 배열 원소.
  - Why this slice is isolated: 로컬 파일 편집만이며 DB나 외부 시스템에 영향 없음.
  - Coupled updates required: 없음 (rubric·points·variants 무관).
  - Verification: `node -e`로 `validateCpaQuestionV2(id=200)` 직접 호출 → 오류 0건. 수정된 두 줄이 v1 DB 레코드와 정확히 일치하는지 문자열 비교.
  - Done when: 검증 통과 + diff가 정확히 그 2줄만 바뀜.

- **Slice 2 — DB 반영 및 회귀 검증**
  - Goal: R5 적용 후 회귀 없음을 실측 확인.
  - Expected file scope: 코드/데이터 변경 없음 (실행만).
  - Why this slice is isolated: Slice 1의 로컬 검증이 끝난 뒤에만 실행 — 검증 전 DB 쓰기 순서 역전 방지.
  - Coupled updates required: 없음.
  - Verification (~4콜):
    1. `npx tsx cpa_uploader/upload_cpa_v2.ts`(dry-run) → 200번 "✅ 모든 검증 통과" 확인 후 `--apply` 실행.
    2. DB에서 200번 `model_answer` 재조회해 로컬 JSON과 일치 확인.
    3. `npx tsx tests/verify-v2-quality.ts 200` → R6 Jaccard가 1.0에 근접함을 확인.
    4. `npx tsx tests/verify-v2-e2e.ts 200 --yes` → `[S1,S2,S3,S4]=[10,0,0,0]` 유지 확인 (특히 S1이 9~10점대인지).
  - Done when: 4개 검증 모두 통과, 점수 분포가 수정 전과 동일.

## 9. Acceptance checklist

- [ ] `model_answer[2]`가 v1과 문자 그대로 일치 ("답변의 신뢰성")
- [ ] `model_answer[7]`이 v1과 문자 그대로 일치 ("...범위의 결정")
- [ ] `rubric`·`question_description`·`explanation` 무변경 확인 (diff에 등장하지 않음)
- [ ] `validateCpaQuestionV2` 오류 0건
- [ ] DB `cpa_questions_v2` id=200 반영 확인
- [ ] `verify-v2-quality.ts 200` R6 Jaccard 1.0 근접
- [ ] `verify-v2-e2e.ts 200 --yes` `[10,0,0,0]` 유지

## 10. Deferred work

- 117·122번의 "설명만 수정"(question_description 변경, model_answer는 원형 보존) 경고 — 이번 권고 3번의 범위 밖, 별도 검토 필요 시 후속 라운드로.
- 207번의 "양쪽 소폭 수정" 경고 — 동일하게 별도 검토 필요.
- 나머지 v2 문항 전체에 대한 v1↔v2 체계적 라인 단위 diff 감사(현재는 Jaccard 요약 수치로만 스크리닝됨) — 별도 권고로 제안할 수 있으나 이번 계획엔 포함하지 않음.
