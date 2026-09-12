# C 내용 검토 및 대표 답안 인계

주제10~19의 원63세트148물음을 직접 읽고, 동일 요구의 기준서형 저장 분리1개를 포함한 **64세트149물음646점**으로 인계한다. `question-reviews.json`의149행에는 실제 발문·사실·모범답안·전체 criterion·requirement/criterion 출처 합집합 대조와 source/answer/prompt/points/style/topics/edition/nonduplication의8개 판단, 물음별 이유와 검토 시각이 있다. 모든149행은 agent 내용 검토 pass이며 미해결 항목은 없다. 사람 확인이나 실제 채점 통과를 의미하지 않는다.

- `selected-files.json`: 최종 문항·계획·QA 파일 및 SHA. 원 판본을 덮어쓰지 않은 선택 장부다.
- `representative-cases.json`: 실제 내용을 읽어 고른 모범149·부분144·오답149, 합계442개. 단일1점 물음5개는 양의 정수 부분점수가 없어 모범/오답2종이다.
- `classification-review.json`, `learning-catalog.json`:149물음의 사실 의존성과 주제를 유지한135개 학습 단위. 사례형은 부모의 모든 사례형 물음을 함께 투영하고 기준서형은 사실 없이 단독 투영한다.
- `handoff-static-checks.json`:64계획의version1 ready 형상·실제 카탈로그 ID, 선택·보충 QA3,351개의 형상·정수합산, 원QA ID/답안/대상 물음 보존, 기준은행 불변 검사를 완료했다. 이3,351개 정적 검사를 전수 의미 판정 또는 실제 채점으로 세지 않는다.

`pilot-10-007/sub2`의 분석절차 종료판단 등 사례 요구는6점으로 남기고, 일반 데이터 신뢰성 고려요소는 별도 `pilot-10-007-standards/sub4`의5점 기준서형으로 옮겼다. 이전에 묶였던 독립 속성의 부분점수 복원으로 합계4점이 증가했다. 새 내용 출제나 새 커버리지 주장이 아니다. 최초 같은 세트 내4물음 제안은 `initial-four-question-proposal`에 보존했다.

`16-011/sub1`과 `17-005/sub2`는 일반 영향 고려와 구체 조치를 중복 배점하지 않도록 정리해 각각3점을 유지했다. 최초4점 제안도 보존했다. `11-005/sub3`는 추가 공시 감사절차를 수행한다는 설명에 별도로 ‘설계’라는 단어를 반복하도록 요구하지 않는 범위 설명만 추가했다. 원 발문·답안·주 claim·배점은 그대로다.

국내800 공식2020 개정 DOCX의995개 XMLP 텍스트와 전사35문단을 독립 대조했다. 원자료는 raw 수집에 보존되었고 새 `data/official/efficient-review-kga800-2020.txt`가 등록되었다. `19-003`은800.8(a)~(c),9/A9와 기존200.18/23에 직접 연결했다.2020-12-31 이후 개시라는 실제 시행 조건에2026-01-01 개시 보고기간을 대조했으며,2027시험공고가800 개별판본을 지정했다고 주장하지 않는다. 두 물음의 정답·6점·QA는 그대로다.

원QA의 배타적 반대를 단순 누락으로 분류했던3건은 답안·ID·0점 합계를 유지한 후속 기대값으로 바로잡았다. `qa-expectation-followups-v1/changes.json`에 원본과 후속을 모두 연결했다. 변경 물음의 원QA 답안은 전부 보존했고 부분명제 기대를 다시 대조했다. 최초 생성물·실측 실패·이전 receipt는 수정하지 않았다.

파서의 반복 발췌 쪽수 오류16건은 ID/인용/오프셋을 보존하여 고쳤다. `parser-v1/impact-final.json`은800 등록 전7,789단위 대조이며,800 등록 후에는 기존7,789단위의 내용·위치가 그대로이고35단위가 추가되었다(`kga800-followup-v1/registration.json`). 최종 source catalog 테스트19개 통과는 총괄의 `../checks/source-catalog-final-v3.log`에 남아 있다. 생성 wiki·분석 갱신은 총괄 단계다.

이번 C 작업의 모델 API 호출·운영 DB 변경은0이다. 학생 채점의±1점 허용을 내용·원문·판본·기대값 오류 허용으로 사용하지 않았다. 대표 답안 실제 채점과 최종 승급·게시·운영 반영은 총괄 후속 단계다.

## 출처 분류 메타데이터 후속

첫 인계에서 국내800 출처3개의 `page`에 XML/전사 위치를 적어 출판 검증의 `KGA 800` 분류 계약을 충족하지 못했다. 최초 검사기가 `validateAuthoringBank`의 반환 `errors`를 검사하지 않은 것도 확인했다. 이전 인계·집계와 생성기 바이트는 `handoff-v1-preserved/`에 보존했다. 이를 첫 인계의 은행 검증 통과로 승계하지 않는다.

새 `kga800-page-metadata-v2/pilot-19-003/question.json`은 해당3개 `page`만 `KGA 800`으로 교정하며 실제 XML/전사 위치는 기존 `source_span`에 유지한다. 원문·문항·답안·배점·ID는 그대로이고, 새 QA/계획 사본도 이전과 바이트가 같다.14개 기존QA의 실제 채점 prompt/schema를 재구성해 모두 동일함을 확인했다(API 호출 아님). 다른63개 선택 항목은 완전히 같다.

후속 검사는 A/C 최종 선택을 포함한 **154세트351물음1,298criterion** 전체 메모리 은행에서 `validateAuthoringBank(...).errors`가 빈 배열임을 강제하고 통과했다. `full-bank-validation-v2.json`과 `kga800-page-metadata-v2/integrity-check.json`에 결과를 남겼다. 기존 정본·원 판본·receipt·공통 코드는 이 후속에서 변경하지 않았다.
