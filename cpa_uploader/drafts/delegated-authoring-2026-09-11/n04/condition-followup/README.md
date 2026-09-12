# T13-A 물음3 조건 표현 후속 교정

**draft_ready: N04 3세트·9물음·53점 유지, 작성자 QA 215사례.** 이 후속 검사는 pilot-13-009/sub3의 표현·채점 범위·QA만 대상으로 했다. 실제 의미검수와 모델 채점은 총괄의 최종 비교은행 고정 뒤에 진행한다. API 호출은 0회다.

공식 KGA 620.12(b)·(c)는 유의적인 가정·방법 또는 원천데이터의 사용을 평가의 조건으로 삼는다. [문항](../pilot-13-009.json)의 f3에 이 조건이 이미 주어져 있으므로, 물음3 끝의 적용 조건을 다시 쓰라는 요구를 삭제했다. 평가특성은 발견사항·결론의 관련성·합리성·다른 감사증거와의 일관성, 가정의 관련성·합리성, 방법의 관련성·합리성, 원천데이터의 관련성·완전성·정확성 10개로 유지한다.

criterion4~10은 실제 평가특성 1개만 critical_facts에 둔다. 조건 반복을 별도 득점요건으로 삼지 않고, 조건을 명시적으로 부정하는 답안은 간결한 정답과 구별한다는 공통 해석은 각 requirement.source_span 및 [실제 계획](../pilot-13-009.json.authoring-plan.json)의 scope.exceptions에 배치했다. 모델 답안 명제·배점·지문·공식 인용·criterion ID는 유지했다. 생성 원본인 [content.mjs](../content.mjs)와 [build-package.mjs](../build-package.mjs)에도 반영했다.

[작성자 QA](../qa-cases-t13-a.json)의 sub3/boundary-8은 “유의적이지 않을 때에만” 평가한다는 답안이 주어진 유의적인 데이터의 평가를 명시적으로 부정하므로 criterion8을 not_met에서 contradicted로 교정했다. 총점은 0점으로 같다. sub3/given-significance-not-repeated는 주어진 조건을 반복하지 않고 10개 평가특성을 모두 충족하는 만점 사례다. 이 세트 QA는 76→77, 패키지는 214→215사례다. 기대값은 작성자의 사전 판단이며 모델 실측 결과가 아니다.

[보존 장부](preservation-manifest.json)는 수정 직전 36개 파일의 사본·SHA-256을 기록한다. 각 사본은 prior/의 `.txt` 파일이며 원래 바이트를 유지한다. [중간 검사 실패](attempt1-static-failure.json)와 attempt1 파일 사본도 보존했다. 중간본은 공통 해석을 여러 critical_facts에 복제하여 중복 오류 5개가 발생했다. 해석을 requirement와 계획으로 옮겨 이 원인을 고쳤으며 단어를 달리하여 중복 검사를 피하지 않았다.

[대상 검증 결과](result.json)는 보존본 36개의 해시, 다른 두 세트·계획·QA의 바이트 동일성, 목표 물음 외 내용 동일성, 공식 exact quote·등록 source ID·version 1 계획·19점/10점 유지·QA 77사례의 대응을 확인한다. 정적 오류·경고는 0개이고 실제 CLI 검사도 통과했다. 준비용 111세트+N04 비교 범위의 무호출 입력은 명시 400,000자 한도 내 320,379자다. 이 수치를 전체 49개 최종 비교은행의 측정값으로 사용하지 않는다.

최신 문항 SHA-256은 `736a08d93485334b36580415ddd152f2d176da50e732fbdab73b9614db37fbce`이며 이전 값은 `fb4e12581a1f09e55fa974aefc2944346732de7dba289cdd20c5e9e790825c55`다. [lineage](../lineage.json)에 문항·계획·QA·수동근거 장부의 현재 해시를 기록했다. 이전 static-check·metadata-followup 결과는 당시 검사 증거로 보존하며 이 수정본의 결과로 덮어쓰지 않았다.
