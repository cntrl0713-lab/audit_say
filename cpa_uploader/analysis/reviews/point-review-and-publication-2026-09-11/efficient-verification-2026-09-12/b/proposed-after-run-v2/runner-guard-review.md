# 재사용 행 사이의 전체 해시 검사 이동 — 미적용

제안은 적용 가능하다. 반복되는 prepared.guard() 한 곳을 job.reused의 continue 다음, 신규 job 폴더 생성 직전으로 이동한다. 요청 내용·답안·기대값·점수·원 관측·비용 집계는 변경하지 않는다.

prepare는 전체 entries·역할·입력/원관측·과거 runtime·원 raw 재생을 완료한 뒤 초기 전체 guard를 실행한다. 재사용은 이때 확보한 불변 메모리 관측을 summary 행에 연결하며 새 API나 관측 파일을 만들지 않는다. 따라서 중간 재사용 행마다 같은 수천 파일을 다시 읽지 않아도 새 API 이전 guard와 최종 guard가 완료 판정을 보호한다.

이동 후에도 다음 검사는 유지한다.

- 매 entry 시작 STOP 확인.
- 신규 job 준비 직전 전체 guard.
- 실제 SDK forward 직전 전체 guard와 STOP 확인. 프로토콜 재시도에도 같은 forward를 사용한다.
- 실제 응답을 production replay/compare한 뒤 관측 파일 저장 전 전체 guard.
- finally에서 summary를 쓰기 직전 전체 guard. 실패하면 stopped와 frozen_input_error를 기록하며 completed가 되지 않는다.

3개 격리 mock 검사 통과. 737개 재사용만 있는 단일-worker fixture에서 전체 guard 호출은 739→2가 되고 summary·원 관측 참조·집계는 완전히 같다. API client 생성도 0회다. 마지막 재사용 행 이후 입력 변경은 최종 guard에서 잡혀 summary가 stopped가 된다. 신규 job 시작·SDK 직전·응답 후 변경을 각각 주입해 요청 차단 또는 완료 관측 저장 금지를 확인했다. mock SDK 호출은 합성 검사 안에서만 발생했으며 실제 API·네트워크 호출은 0회다.

중간 변경을 감지하는 시점은 달라진다. 재사용 구간의 파일 변조는 다음 신규 요청 전 또는 최종 guard에서 발견하므로, 그 전에 console의 reused 행이나 중간 행 수가 나타날 수 있다. 이를 완료 승인으로 사용하면 안 된다. 현재 seal-results는 summary.status=completed, frozen_input_error=null 및 최종 전체 원응답 검증을 요구하므로 이 경계와 맞는다. 마지막 guard 실패 시 737개 행을 보존하더라도 해당 worker는 완료되지 않는다.

실제 원응답 재사용 검증 자체를 생략하거나 guard의 해시 목록을 줄이지 않는다. 측정한 것은 mock의 guard 호출 수이며 실행시간/IO 속도 측정이 아니다. 현재 실행 종료 후 별도 새 runtime/manifest에 runner 새 해시를 반영해야 하며 old runner와 잠금은 보존한다.
