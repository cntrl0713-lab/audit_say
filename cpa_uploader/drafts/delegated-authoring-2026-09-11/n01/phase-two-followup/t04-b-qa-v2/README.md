# T04-B 최초 문서화 지연 반대 사례의 기대값 정정

[후속 QA](qa-cases-t04-b.json)의 50개 중 `sub1/opposite-crit1` 한 건에서 `crit2`의 기대값을 `not_met`에서 `contradicted`로 정정했다. 원답안·점수0·질문·계획은 바꾸지 않았다. `kind=opposite`, `opposite_scope=two_propositions`와 note로 두 명제 동시 반대임을 표시했다. [원본 diff](qa-diff.json)는 과거 기대값을 보존한다.

원답안은 최초 문서화를 최종 취합까지 모두 미루는 것을 명시적으로 적절하다고 한다. 이는 부적절 판단인 crit1뿐 아니라 적시에 작성해야 한다는 crit2의 필수 명제에 직접 반대된다. [공식230.7 및 A22](../../../../../data/official/delegated-n01-kga230-supplement-2025.txt)는 각각 적시작성과 행정적최종취합의 성격을 뒷받침한다. 직접 등록근거는 `src-486c61dad20d1c3349` 및 `src-b54be20acba919f30f`다. 행정적취합에 관한 설명이 빠졌더라도 적시작성에 대한 명시반대까지 누락으로 처리하지 않는다.

[원3회관측](../../phase-two-v3/pilot-04-006/qa-findings-01.json)은 두 명제 모두 `contradicted`, 점수0·보안플래그없음이었다. [후속1회](../../phase-two-v3/pilot-04-006/author-qa-crit1-followup-01/summary.json)도 수정 기대값과 일치했다. [최종50사례 연결](validation-linkage.json)은 같은 고정 채점 코드와 질문·답안에서 실측한 49개 기존 결과 및 수정1개의 실제 해시를 연결한다. 의미검수 및 생성 사례 채점은 별도로 확인한다.
