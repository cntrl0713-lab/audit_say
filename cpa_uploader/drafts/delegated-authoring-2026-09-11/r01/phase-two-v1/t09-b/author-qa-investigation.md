# T09-B 작성자 QA 후속 조사

`q1/condition-boundary`의 사전 기대는 1점이다. 공란형의 회신 방식을 인정하고, 위험을 완전히 제거하며 회신율도 반드시 높인다는 두 주장에는 점수를 주지 않는다. 동일 답안 세 번의 관측은 **0 / 1 / 1점**이다. [실행1](author1/author-qa/case-0010-attempt-1.json), [실행2](author1/author-qa/case-0010-attempt-2.json), [실행3](author1/author-qa/case-0010-attempt-3.json)을 보존한다.

현재 답안은 “공란형은 상대방이 직접 금액을 적으므로”라고 방식을 설명한다. 발문에 공란형이라는 명칭이 주어져 있더라도 상대방이 직접 금액을 적는 행위는 답안이 제시한 내용이다. 공식 KGA 505.A5의 금액을 미리 기재하지 않고 조회처가 제공하도록 요청하는 방식과 연결된다. 뒤의 잘못된 효과·회신율 주장을 같은 문장에 적었다는 이유로 이 방식 설명까지 제거해서는 안 된다. 첫 실행만 q1.c1을 not_met로 판정했고 후속 두 실행은 met로 인정했다. q1.c2·q1.c3은 세 번 모두 contradicted였으며 인용·보안·합산에 별도 이상은 없었다. 현재 사전 기대 1점을 유지하되, 간결한 방식 설명의 함축 범위를 원문·발문과 함께 검토한 판단임을 남긴다.

`q2/irrelevant-prefix`는 무관한 흰색 벽 문장 뒤 정상 답안 전체를 적은 사례다. 두 criterion은 모두 met, 점수는 모두 2점인데 **keyword_salad / none / none**으로 변동했다. [실행1](author1/author-qa/case-0021-attempt-1.json), [실행2](author1/author-qa/case-0021-attempt-2.json), [실행3](author1/author-qa/case-0021-attempt-3.json)을 보존한다. 이는 [T04-A의 동일 유형](../t04-a/security-flag-investigation.md)처럼 원시 모델의 salad 분류에서 시작된 변동이며 정상 명제의 감점은 없었다.

고정 문항·계획·QA·공통 코드를 수정하지 않았다. 현재 불일치는 모델 의미판정의 부분점수 보존 및 보안 분류 안정성 문제로 총괄에게 전달한다. 명제·반례를 삭제하거나 마지막 성공 결과만 남겨 통과로 표시하지 않는다. 전체 실측 범위와 남은 일은 [작성자 QA 결과](author1/author-qa/summary.json) 및 후속 생성사례 채점 기록을 구분해 확인한다.
