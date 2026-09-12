# 잔액 소진 중단 후 재개 준비

이 묶음은 API 0회의 준비 자료다. 현재 119세트 중 의미검수 완료는 19세트(통과 15, 비통과·불확실 4), 부분 실행은 3세트, 미착수는 97세트다. 전체 검증·사람 확인·DB 반영 완료를 뜻하지 않는다.

100세트 재개 목록은 A 30 → B 36 → C 34의 원 담당 label과 기존 입력을 보존한다. 부분 실행된 pilot-10-002, pilot-04-005, pilot-05-007은 이전 성공 원시를 보존하며 새 전체 세트 실행 때 중복 관측을 별도 기록해야 한다. 기존 성공을 새 요청으로 바꾸거나 부분 로그를 완료 receipt로 사용하지 않는다. 02/06/09의 별도 출처 계획 후속은 비활성이다.

정식 사례 채점은 3세트 105고유 실행 중 103엄격 일치다. 작성자 QA는 94개 중 92개가 모든 관측에서 엄격 일치하며, 내부 반복을 포함해 총 98관측이다. 허용 편차에 관한 개별 판단은 원판정과 분리된 연결 장부를 참조한다. 나머지 116세트의 실제 사례 채점·작성자 QA 및 249학습단위 smoke는 미실행이다.

현재 R4와 후속의 의미검수 실제 성공 응답 관측은 180개, 오류 관측은 4개다. 이 가운데 pilot-05-001의 성공 1개는 같은 입력의 실제 중복 호출이다. 총괄의 별도 전송 진단은 신규 요청 1회에서 credit_balance_exhausted/insufficient_quota를 확인했다. 진단 당시 과거 10개 응답의 로컬 재생은 신규 모델 호출도 정식 receipt도 아니다.

[100세트 manifest](pending-manifest.json), [119세트 전체 상태와 증거](status-119.json), [보존 해시](preserved-evidence.json), [3개 무호출 dry-run](dry-runs.json), [검사 결과](checks.json)를 함께 읽는다. 고정 3065개 입력과 출처·코드·계획·QA를 전후 검증했고 새 실제 출력 폴더는 만들지 않았다. 충전 확인과 총괄의 별도 재개 신호 전에는 실제 실행하지 않는다.

| 세트 | 원 담당 | 의미검수 | 정식 생성사례 채점 | 작성자 QA |
| --- | --- | --- | --- | --- |
| pilot-01-002 | a | pass | 38/39 엄격일치 | 35/35 일관일치 |
| pilot-03-001 | c | pass | 27/27 엄격일치 | 21/22 일관일치 |
| pilot-05-003 | b | pass | 38/39 엄격일치 | 36/37 일관일치 |
| pilot-01-004 | c | pass | 미실행 | 미실행 |
| pilot-02-001 | b | pass | 미실행 | 미실행 |
| pilot-02-004 | a | uncertain | 미실행 | 미실행 |
| pilot-02-005 | b | pass | 미실행 | 미실행 |
| pilot-03-002 | c | pass | 미실행 | 미실행 |
| pilot-03-004 | c | pass | 미실행 | 미실행 |
| pilot-04-001 | b | pass | 미실행 | 미실행 |
| pilot-04-002 | c | pass | 미실행 | 미실행 |
| pilot-04-004 | a | pass | 미실행 | 미실행 |
| pilot-04-005 | b | partial | 미실행 | 미실행 |
| pilot-05-001 | a | pass | 미실행 | 미실행 |
| pilot-05-002 | a | pass | 미실행 | 미실행 |
| pilot-05-005 | c | pass | 미실행 | 미실행 |
| pilot-05-006 | a | pass | 미실행 | 미실행 |
| pilot-05-007 | c | partial | 미실행 | 미실행 |
| pilot-06-001 | b | not_started | 미실행 | 미실행 |
| pilot-06-002 | a | fail | 미실행 | 미실행 |
| pilot-06-003 | b | not_started | 미실행 | 미실행 |
| pilot-06-005 | c | not_started | 미실행 | 미실행 |
| pilot-07-005 | c | not_started | 미실행 | 미실행 |
| pilot-08-002 | b | not_started | 미실행 | 미실행 |
| pilot-08-005 | b | not_started | 미실행 | 미실행 |
| pilot-09-002 | c | not_started | 미실행 | 미실행 |
| pilot-09-003 | a | uncertain | 미실행 | 미실행 |
| pilot-09-004 | b | not_started | 미실행 | 미실행 |
| pilot-09-005 | a | uncertain | 미실행 | 미실행 |
| pilot-09-007 | b | not_started | 미실행 | 미실행 |
| pilot-09-008 | c | not_started | 미실행 | 미실행 |
| pilot-10-002 | a | partial | 미실행 | 미실행 |
| pilot-10-003 | a | not_started | 미실행 | 미실행 |
| pilot-10-004 | b | not_started | 미실행 | 미실행 |
| pilot-11-001 | a | not_started | 미실행 | 미실행 |
| pilot-11-004 | c | not_started | 미실행 | 미실행 |
| pilot-12-001 | c | not_started | 미실행 | 미실행 |
| pilot-12-002 | b | not_started | 미실행 | 미실행 |
| pilot-12-004 | c | not_started | 미실행 | 미실행 |
| pilot-12-005 | b | not_started | 미실행 | 미실행 |
| pilot-12-006 | a | not_started | 미실행 | 미실행 |
| pilot-12-007 | b | not_started | 미실행 | 미실행 |
| pilot-12-008 | a | not_started | 미실행 | 미실행 |
| pilot-13-002 | b | not_started | 미실행 | 미실행 |
| pilot-13-003 | a | not_started | 미실행 | 미실행 |
| pilot-13-005 | b | not_started | 미실행 | 미실행 |
| pilot-13-006 | b | not_started | 미실행 | 미실행 |
| pilot-14-001 | a | not_started | 미실행 | 미실행 |
| pilot-14-002 | c | not_started | 미실행 | 미실행 |
| pilot-14-003 | b | not_started | 미실행 | 미실행 |
| pilot-14-004 | c | not_started | 미실행 | 미실행 |
| pilot-14-005 | c | not_started | 미실행 | 미실행 |
| pilot-15-001 | c | not_started | 미실행 | 미실행 |
| pilot-15-002 | c | not_started | 미실행 | 미실행 |
| pilot-15-004 | b | not_started | 미실행 | 미실행 |
| pilot-15-005 | b | not_started | 미실행 | 미실행 |
| pilot-16-003 | c | not_started | 미실행 | 미실행 |
| pilot-16-004 | c | not_started | 미실행 | 미실행 |
| pilot-16-005 | c | not_started | 미실행 | 미실행 |
| pilot-16-007 | a | not_started | 미실행 | 미실행 |
| pilot-16-008 | a | not_started | 미실행 | 미실행 |
| pilot-16-009 | a | not_started | 미실행 | 미실행 |
| pilot-17-002 | a | not_started | 미실행 | 미실행 |
| pilot-17-004 | b | not_started | 미실행 | 미실행 |
| pilot-18-002 | b | not_started | 미실행 | 미실행 |
| pilot-18-003 | a | not_started | 미실행 | 미실행 |
| pilot-19-001 | a | not_started | 미실행 | 미실행 |
| pilot-19-002 | c | not_started | 미실행 | 미실행 |
| pilot-19-003 | c | not_started | 미실행 | 미실행 |
| pilot-19-004 | a | not_started | 미실행 | 미실행 |
| draft-04-320-freq01 | b | not_started | 미실행 | 미실행 |
| draft-09-501-freq01 | b | not_started | 미실행 | 미실행 |
| draft-09-505-freq01 | c | not_started | 미실행 | 미실행 |
| draft-10-530-freq01 | a | not_started | 미실행 | 미실행 |
| draft-12-560-freq01 | c | not_started | 미실행 | 미실행 |
| draft-12-570-freq01 | b | not_started | 미실행 | 미실행 |
| pilot-05-008 | c | not_started | 미실행 | 미실행 |
| pilot-02-006 | b | not_started | 미실행 | 미실행 |
| pilot-01-005 | b | not_started | 미실행 | 미실행 |
| pilot-03-005 | b | not_started | 미실행 | 미실행 |
| pilot-04-006 | c | not_started | 미실행 | 미실행 |
| pilot-08-006 | a | not_started | 미실행 | 미실행 |
| pilot-08-007 | a | not_started | 미실행 | 미실행 |
| pilot-06-006 | a | not_started | 미실행 | 미실행 |
| pilot-06-007 | b | not_started | 미실행 | 미실행 |
| pilot-07-006 | b | not_started | 미실행 | 미실행 |
| pilot-07-007 | c | not_started | 미실행 | 미실행 |
| pilot-05-009 | c | not_started | 미실행 | 미실행 |
| pilot-11-005 | b | not_started | 미실행 | 미실행 |
| pilot-11-006 | c | not_started | 미실행 | 미실행 |
| pilot-13-009 | b | not_started | 미실행 | 미실행 |
| pilot-14-006 | c | not_started | 미실행 | 미실행 |
| pilot-14-007 | c | not_started | 미실행 | 미실행 |
| pilot-16-010 | b | not_started | 미실행 | 미실행 |
| pilot-16-011 | a | not_started | 미실행 | 미실행 |
| pilot-17-005 | a | not_started | 미실행 | 미실행 |
| pilot-02-007 | c | not_started | 미실행 | 미실행 |
| pilot-01-006 | b | not_started | 미실행 | 미실행 |
| pilot-03-006 | a | not_started | 미실행 | 미실행 |
| pilot-04-007 | b | not_started | 미실행 | 미실행 |
| pilot-08-008 | b | not_started | 미실행 | 미실행 |
| pilot-06-008 | c | not_started | 미실행 | 미실행 |
| pilot-07-008 | a | not_started | 미실행 | 미실행 |
| pilot-09-009 | c | not_started | 미실행 | 미실행 |
| pilot-09-010 | a | not_started | 미실행 | 미실행 |
| pilot-05-010 | a | not_started | 미실행 | 미실행 |
| pilot-13-010 | c | not_started | 미실행 | 미실행 |
| pilot-13-011 | b | not_started | 미실행 | 미실행 |
| pilot-10-006 | c | not_started | 미실행 | 미실행 |
| pilot-10-007 | a | not_started | 미실행 | 미실행 |
| pilot-12-009 | a | not_started | 미실행 | 미실행 |
| pilot-12-010 | b | not_started | 미실행 | 미실행 |
| pilot-15-006 | b | not_started | 미실행 | 미실행 |
| pilot-15-007 | a | not_started | 미실행 | 미실행 |
| pilot-16-012 | a | not_started | 미실행 | 미실행 |
| pilot-14-008 | c | not_started | 미실행 | 미실행 |
| pilot-17-006 | a | not_started | 미실행 | 미실행 |
| pilot-18-005 | a | not_started | 미실행 | 미실행 |
| pilot-19-005 | c | not_started | 미실행 | 미실행 |
