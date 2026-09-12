# T01-A 두 명제 동시 반대 사례의 기대값 정정

[후속 QA](qa-cases-t01-a.json)의 46개 중 `sub2/opposite-crit3` 한 건의 `crit4` 기대값만 `not_met`에서 `contradicted`로 정정했다. 답안·점수0·질문·계획은 같다. `kind=opposite`, `opposite_scope=two_propositions`와 note로 두 명제 동시 반대임을 표시했다. [원본 차이](qa-diff.json)는 변경 전 기대값도 보존한다.

원답안은 회계법인 매출 비중만으로 공동사업을 유지하며 수임을 허용한 판단이 적절하다고 서술한다. 이는 부적절 판단(crit3)을 반대로 답하면서, 회계법인 쪽 중요성만으로 허용한다는 기준(crit4)도 명시한다. [공식 윤리기준290.132](../../../../../data/official/delegated-n01-ethics-2024.txt)의 예외는 재무적 이해관계가 회계법인과 의뢰인 **모두**에게 중요하지 않고 관계가 명백하게 경미해야 한다는 것이다. 해당 source_ref는 `src-cbdae8404682e7ebb9`, 인용 위치는 L198-L224/PDF58-59쪽이다. 따라서 다른 명제가 단순히 빠진 답안으로 보지 않았다.

[원3회관측 및 결함 장부](../../phase-two-v3/pilot-01-005/qa-findings-01.json)에서 두 criterion 모두 매번 `contradicted`, 점수0·보안플래그없음이었다. 수정 기대값으로 [후속1회](../../phase-two-v3/pilot-01-005/author-qa-crit3-followup-01/summary.json)도 일치했다. [최종46사례 연결](validation-linkage.json)은 같은 고정 코드·문항·답안에서 실측한 나머지45개 결과와 후속1개를 각각 실제 파일·요청/스키마/파일 해시로 연결한다. 원본 QA 및 기존 정확기대값불일치 기록은 유지한다.
