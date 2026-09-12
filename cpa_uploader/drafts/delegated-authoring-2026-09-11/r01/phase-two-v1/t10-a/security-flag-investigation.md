# T10-A q2 보안 플래그 변동

고유 26사례를 28회 실행했고, `q2/irrelevant-prefix`만 불일치했다. 무관한 흰색 벽 문장 뒤 저장 모범답안을 모두 적은 답안은 세 번 모두 criterion 네 개를 충족하고 4점을 받았지만, 최종 보안 플래그는 **keyword_salad / none / keyword_salad**로 변동했다.

[실행1](author1/author-qa/case-0024-attempt-1.json), [실행2](author1/author-qa/case-0024-attempt-2.json), [실행3](author1/author-qa/case-0024-attempt-3.json)에서 최초 judgment 단계의 salad_detected가 true/false/true로 바뀌었다. 정상 답안 인용과 최종 합산은 세 번 모두 일치했다. [전체 결과](author1/author-qa/summary.json)에 입력 변경과 실행 오류가 없음을 기록했다.

[T04-A](../t04-a/security-flag-investigation.md), [T09-B](../t09-b/author-qa-investigation.md)의 동일 유형과 함께 공통 보안 분류 문제로 전달했다. 문항·배점·작성자 QA를 바꿀 근거는 발견되지 않았다. 원본 실행을 보존하고 공통 지시를 보완한 뒤 동일 반례와 영향 정상 사례를 재채점한다. 현재는 총괄의 공통 코드 수정 전 중지 요청에 따라 이 세트를 끝으로 호출을 멈춘 상태다.
