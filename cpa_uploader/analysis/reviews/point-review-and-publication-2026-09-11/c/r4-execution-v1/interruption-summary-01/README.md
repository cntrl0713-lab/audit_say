# R4 원실행 중단 snapshot

R4의 원래 canary/remaining 의미검수 경로를 읽기 전용으로 집계했다. 고정 입력 3,065개는 집계 전후 모두 일치했다. 별도 경로에서 진행하는 루트의 단일세트 재개는 이 snapshot에 자동 합치지 않았다.

| 원실행 상태 | 세트 | 단위 |
| --- | ---: | ---: |
| 완료 receipt | 13 | 108 |
| 부분 응답만 보존 | 3 | 유효 응답 8 |
| 미착수 | 103 | summary의 개별 목록 참조 |

완료 receipt는 12개 pass와 `pilot-02-004` uncertain 1개다. 부분 응답은 A `pilot-05-001` 1개, B `pilot-04-005` 2개, C `pilot-05-007` 5개다. 총 116개 유효 응답의 실제 input/schema를 재구성하고 원시 응답을 다시 ground 검증했다. A의 HTTP429 기록 2개는 별도 오류로 남겼다. C에는 provider429가 없으며 부모의 일시 중지 지시에 따른 강제중단을 실행 오류의 원인으로 구분했다.

C worker41348·child42076·세션75787은 종료했다. 중단 당시 기록되지 않은 진행 중 요청의 결과는 알 수 없으므로 성공이나 실패로 세지 않는다. C의 새 모델 호출은 0회다.

완료 pass receipt는 원 manifest/run/request/job-summary/receipt 해시를 그대로 연결하는 새 명시 provenance의 후보다. 실제 선택 시 기존 validator를 통과해야 하며 이 문서가 자동 승계를 수행하지 않는다. 비통과 receipt는 내용 합격으로 읽지 않는다. 부분 응답은 완료 receipt가 아니므로, 동일 입력을 검증하는 후속 resumer에서 기존 유효 단위와 잔여 단위를 구분해야 한다. 어떤 경우도 옛 receipt를 재해시하거나 원시 파일을 덮어쓰지 않는다.

[전체 목록·해시·재개 경계](summary.json) · [읽기 전용 집계기](collect.mjs)
