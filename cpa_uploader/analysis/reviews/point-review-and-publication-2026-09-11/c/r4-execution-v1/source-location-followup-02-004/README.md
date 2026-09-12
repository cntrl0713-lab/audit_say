# pilot-02-004 기존 출처 위치 명료화 제안

`criterion:sub2:crit5`의 원 의미검수는 `source_support=uncertain`이다. 실제 제공된 위치 정보를 모델이 놓친 것으로 확인했으며, 자료 누락이나 정답·배점 결함으로 분류하지 않는다. 원 판정과 원 receipt는 그대로 보존한다.

`src-point-a-200-a49`의 전체 인용은 등록 공식 전사 `point-review-a-supplement-2026-09-11.txt`의 L47–59에 한 번 정확히 나타난다. 인용 문자열 SHA는 `21d5e0d17a6dc71f679f559ec6743aa213e8c3b8de644af4c8d3e064c979b611`이다. 같은 requirement 인용은 LF/CRLF 차이만 있으며 수정하지 않았다. 각주·PDF 페이지 표지·A49의 연속 결론을 모두 보존했다.

기존 실제 요청에는 이미 인접 문맥 L20–87과 `source_quote_line_start=47`, `source_quote_line_end=59`가 들어 있었다. 전 7단위의 저장된 실제 `input_hash`·`schema_hash`를 고정 코드/입력으로 재구성한 값과 일치시켰다. 이 확인은 해시로 결속된 입력 재구성이며 별도 HTTP body 직접 캡처가 아니다.

[후속 계획](pilot-02-004-plan.json)은 기존 본문을 유지하고 `metadata.source_location_clarification` 하나만 추가한다. 기존 위치와 두 카탈로그 단위가 전체 인용의 부분이라는 설명이다. 새 근거나 정답을 추가하지 않는다. [필드 변경·역변경](changes.json)을 적용해 되돌리면 원 계획과 정확히 같다.

[정적 검사](verification.json)에서 다음을 확인했다.

- QuestionAuthoringPlan validator 오류 0, R4 고정 3,065개 파일 전후 SHA 일치.
- 문항·원문·source refs·답안·criterion·배점·QA·비교 은행·코드·기존 receipt 변경 0.
- 같은 세트의 7개 의미검수 요청에서 위 metadata 경로만 변경. 대상·필수 필드·출처·응답 schema는 동일.
- 기존 QA 22개의 현재 학생 grader prompt/schema는 전후 정확히 동일. 실제 재채점은 하지 않음.

`authoringPlanHash`는 metadata를 제외하므로 동일하지만, 정식 검수의 `context_hash`와 7개 요청 해시는 달라진다. 총괄이 제안을 선택한다면 새 계획 경로·SHA와 새 실행 잠금/출력으로 후속 의미검수해야 한다. 기존 uncertain의 해시를 갱신하거나 통과로 승계하지 않는다. 물음별 1점 채점 편차 허용은 출처 검증의 불확실성을 면제하지 않는다.

이번 작업은 API 0회의 로컬 대조와 비활성 제안이다. 의미검수 통과·실제 채점 통과·사람 승인·게시를 주장하지 않는다. 원 R4 중단 현황은 [별도 중단 장부](../interruption-summary-01/summary.json)에 보존한다.
