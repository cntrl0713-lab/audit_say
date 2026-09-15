# r01: 부문감사 세 사례의 병합

55·18·19번 사례를 옳고 그름을 구분하는 선택형 한 문제로 합쳤다. **현재 판본은 [v3](v3/)** 이다. [v3 문제·모범답안·부분점수](v3/questions-and-answers.md)

| 판본 | 파일 | 상태 |
| --- | --- | --- |
| v3 | [sets.json](v3/sets.json), [design.json](v3/design.json), [lineage.json](v3/lineage.json), [qa.json](v3/qa.json), [build-draft.mjs](v3/build-draft.mjs), [record-docs.mts](v3/record-docs.mts), [render-sheet.mjs](v3/render-sheet.mjs) | 현재 초안. v2 사실관계·출처 그대로, 새 배점 기준 적용. agent 검토·실제 채점 완료 |
| v2 | [sets.json](v2/sets.json), [design.json](v2/design.json), [lineage.json](v2/lineage.json), [qa.json](v2/qa.json), [build-draft.mjs](v2/build-draft.mjs), [render-sheet.mjs](v2/render-sheet.mjs) | v3로 대체. `execution-v2`의 고정 입력이므로 보존 |
| v1 | 이 폴더의 [sets.json](sets.json), [design.json](design.json), [lineage.json](lineage.json), [qa.json](qa.json), [build-draft.mjs](build-draft.mjs), [questions-and-answers.md](questions-and-answers.md) | v2로 대체. `execution-v1`의 고정 입력이므로 보존 |

## 사용자 지시의 반영

- 55: 물음 1(토의·감사문서 검토 결정)을 삭제하고 그 결론만 배경 사실로 남겼다. 창고 재고의 추가 감사절차를 을(부문감사인)이 수행하도록 지시하고 그룹업무팀이 결과를 평가해 반영하는 사실을 절차 ⑤로 두어 옳은 절차 함정으로 만들었다. 물음 3의 내용은 절차 ⑦·⑧의 채점 기준으로 승계했다.
- 18: A·B만 남겨 절차 ①(독립성 결격 감사인에게 관여 강화를 조건으로 요청, 옳지 않음)과 ②(심각하지 않은 적격성 우려에 관여로 대응, 옳은 함정)로 바꾸고 한 물음 안에서 고르게 했다. C는 뺐다.
- 19: 물음 1은 기준서형이므로 묻지 않고 배경 사실로만 남겼다. 절차 ③은 위험 기준 유의적 부문에 세 업무유형 중 하나(특정 감사절차)만 수행한 옳은 함정, 절차 ④는 유의적이지 않다는 이유로 추가 업무 대상을 선정하지 않은 옳지 않은 함정이다. 원 물음 3의 기간 경과 원칙은 뺐다.
- v2 추가 지시: ⑤의 책임 귀속 근거 문장을 빼 옳음의 암시를 줄였다. 자료 4를 매출(⑥ 옳음, ⑦ 옳지 않음)과 소송충당부채(⑧ 옳지 않음, ⑨ 옳음)로 나누었다.
- v3 추가 지시: 새 기준에 맞춰 발문을 “옳지 않은 이유나 수행하였어야 할 절차를 간략히 서술”로 바꾸고, 옳지 않은 항목마다 이유 또는 보완절차 중 하나에 1점을 준다.
- 공통: 등장인물의 틀린 제안·미결 사실·결론형 발문을 없앴고 연도는 20X1년으로 썼다(대상 연도 2027년).

## 배점

물음마다 옳지 않은 절차를 정확히 고른 식별 1점(함정을 고르거나 빠뜨리면 0점)과 옳지 않은 절차마다 이유 또는 보완절차 1점을 둔다. 물음 1(①·④)과 물음 2(⑦·⑧) 각 3점, 합계 6점이다.

## 검증과 남은 일

v3는 agent 내용 검토, 초안 형상·인용 검사(`validate_draft_v3.ts --against-bank`), 원 세트 포함·제외 두 경우의 전체 은행 검사, 실제 Luna 채점(대표 6답안 모두 기대점수 일치, 보완절차만·이유만 쓴 보조 답안도 만점 일치)을 마쳤다. 운영 반영은 사용자 결정에 따라 지정 검토를 모아 한 번에 한다. 정본·공개본·운영 DB 반영, 원 세 세트의 퇴역, coverage 연결 갱신은 아직 하지 않았다. 세부는 [검증 장부](../../../analysis/reviews/case-review-2026-09-15/README.md).
