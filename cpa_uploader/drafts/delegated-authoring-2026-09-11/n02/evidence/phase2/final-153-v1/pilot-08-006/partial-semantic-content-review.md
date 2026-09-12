# pilot-08-006 수신된 의미검수의 내용 대조

현재 수신된 유효 단위 3개에서 checks 또는 사례 기대판정의 fail/uncertain은 **0건**이다. API 전송 장애 때문에 최종 receipt가 없으므로 세트 전체 의미검수 통과라고 보고하지 않는다. 생성사례 10개는 모델이 제시한 기대판정이며 실제 채점 사례 수는0개다.

- sub1/crit1·crit2: 기업생성연령표의정확성검증과완전성검증을사례절차로요구한다. 총액일치만으로연령입력·계산·추출누락을보장할수없다는구별과상황상관련통제테스트대안을보존한다. 받은paraphrase와반대사례는이구별에대응하며실제채점은남음.
- criterion:sub1:crit1/crit2 attempt1: 일부생성사례의source_ref_ids에criterion의전체연결출처가빠져validator가거부했다. 모델checks/caseverdict는전부pass이며의미내용결함의판정이아니다. attempt2에서는전체근거목록이보완됨.

근거: [원시응답](semantic-run1.json.chunks.jsonl), [전송실패 조사](transport-investigation-run1.json), [구조화 대조](partial-semantic-content-review.json). 고정 문항·계획·QA·공식원문·공통코드는 수정하지 않았다. 새 API 진단과 재시도는 총괄의 원인 계측과 재개 지시를 기다린다.
