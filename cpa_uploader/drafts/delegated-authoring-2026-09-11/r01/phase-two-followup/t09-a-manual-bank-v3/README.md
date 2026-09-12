# T09-A 새 은행의 전체 수동 대조 제안

[전체 비교와 계보](full-comparison-and-lineage.json)는 현 비교은행 153세트에서 관련 발문·criterion 14개를 다시 추출해 이전 직접 대조 대상과 모두 동일함을 확인하고, 현재 공식 발췌의 실제 인용 위치 및 원문항을 대조했다. 원 모델 receipt의 7단위와 25사례를 모두 읽어 명제별 판단을 기록했다. 기존 bank-v2 후속안을 해시만 바꿔 재사용하지 않았다.

새 bank-v3 생성 사례 채점은 23개 초기 답안, 반복·빈답안 포함 27관측이며 c1 경계 한 종류가 3회 모두 불일치했다. 원 답안은 설계 효과성을 고려한다고 정확히 적고 적용 기록방식만 잘못 제한한다. 독립 명제 c1은 `met`, 적용 범위 c4는 `contradicted`여야 하므로 c1 기대 `contradicted → met`를 제안한다. 답안은 그대로다.

추가로 c2의 `condition_boundary`는 실제 실행을 고려하지 않겠다는 직접 반대 문장이다. 기대 `contradicted` 자체는 맞지만 별도 주체·대상·시점·조건·증거수준을 바꾼 경계 역할이 부족하다. [미확정 manual-input 제안](manual-input-proposal.json)은 이 사례를 `uncertain`으로 남겼으므로 전체 통과 상태가 아니다. 원 반대 답안과 모든 원시 증거를 보존한 별도 실제 경계 사례 보충이 남아 있다.

이 결과는 작성자 에이전트의 원문 대조이며 독립된 사람 확인이 아니다. `--manual-input` 확정과 실제 후속 채점은 실행하지 않았다. [원 양식](manual-template.json)의 `template` 상태·receipt 해시를 임의 확정하지 않았고, 총괄의 전체 대조 및 남은 경계 보강 판단을 기다린다.

후속 형상 확인에서 최초 제안의 문서 외피 `schema_version`이 숫자 1로 작성된 것을 발견했다. 원 파일을 보존하고 문자열 `1.0`으로 고친 [형상 교정 사본](manual-input-proposal.schema-fixed.json)을 현 문서 파서로 확인했다. 의미 내용은 그대로이며 [외피 교정 계보](schema-envelope-followup.json)에 전후 해시를 남겼다. 이것도 미확정 제안이다.
