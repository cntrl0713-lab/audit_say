# pilot-05-008 수신된 의미검수의 내용 대조

현재 수신된 유효 단위 9개에서 checks 또는 사례 기대판정의 fail/uncertain은 **0건**이다. API 전송 장애 때문에 최종 receipt가 없으므로 세트 전체 의미검수 통과라고 보고하지 않는다. 생성사례 35개는 모델이 제시한 기대판정이며 실제 채점 사례 수는0개다.

- sub1/crit1~crit7: 발문이모든유의적발견사항과조건을요구하여질적측면/추가이유/유의적어려움/경영참여예외하논의사항/서면진술/보고서상황/기타유의적사항7명제와대응. 조건을빼거나반대로제한한생성사례는원문과대조할수있음.실제채점은미수행.
- sub2 물음 단위만: 상장기업조건과진술대상·관계·보수범위/배분·안전장치의발문범위가대응한다. crit8~crit12 모델검수는수신되지않아통과로확장하지않음.
- criterion:sub1:crit4 attempt1: 모델의checks는전부pass이나같은물음의다른requirement quote/span필드ID가응답에서누락되어validator가거부했다. 실제문항·공식근거의내용fail아님. attempt2에서전체필드ID를포함해검증통과.

근거: [원시응답](semantic-run1.json.chunks.jsonl), [전송실패 조사](transport-investigation-run1.json), [구조화 대조](partial-semantic-content-review.json). 고정 문항·계획·QA·공식원문·공통코드는 수정하지 않았다. 새 API 진단과 재시도는 총괄의 원인 계측과 재개 지시를 기다린다.
