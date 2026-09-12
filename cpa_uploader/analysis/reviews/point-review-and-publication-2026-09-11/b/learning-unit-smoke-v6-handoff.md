# smoke-v6 인계

runtime-v7 `17e99d1dff7f6ecaba48658796788be0b1f47b03364cc23c348932474d18a250`와 C의 prepared-reviewed-v8 은행을 사용했다. 대상은 기존 변경70+신규49, 총119세트의 249학습 단위(기준서209·사례40, 280물음·1113점)이다. 현재 저장 모범답안의 실제 모델 실행은 0회다.

빈 답안249개는 키를 빈 문자열로 명시한 생산 함수에서 0점·정상 보안으로 확인했다. 실행기18개 fixture, 세 작업자 각83개 dry-run, 기존출력거절/STOP 경계, 타입 검사와 대상 lint가 통과했다. fixture는 합성 전송이며 실제 모델 관측이 아니다. 초기 공개출처 메타 비교와 옛 catalog 경로 오류는 별도 `*-attempt-01.json`에 보존했다.

v5와 학습ID·발문·부모사실·답안·점수·schema 및 채점 payload/출력예시는 같다. 03의 두 단위에 추가 직접 출처의 private/public 메타데이터와 파생 분류판본 ID 변화가 있다. 모든249 prompt에 새 판정 지시 두 줄이 추가됐다. 기존 v5 bundle371파일은 보존했으며 새 실제 관측으로 재표시하지 않았다.

| 산출물 | SHA-256 |
| --- | --- |
| [manifest](learning-unit-smoke-v6/manifest.json) | `6a49e407e3a85e2a2f44ba3c434f2ca5fc75ffd54b4b4b8b918bb952a3c28b2c` |
| [실행기](run-learning-unit-smoke-v6.ts) | `de3aca6cc2a1051a48455d28c145f35d420f9525ed913231fa4546823652db92` |
| [816입력 잠금 목록](learning-unit-smoke-v6-runtime-inputs.json) | `ab30fc235eb0545480173820af1972c0662d3a0d00b82b2cf2cb3ffe7c983913` |
| [검증 결과](learning-unit-smoke-v6-validation.json) | `166853ca79351ae04f8af2f7f4ec16b58688b37cdc73d4779d69266cabf8b09c` |

실행기와 v5의 차이는 manifest핀·version6·새 catalog 고정 경로뿐이다. 이후 실제 실행은 총괄의 새 잠금·출력 및 시작 지시에 따른다. 원문·은행·기존실행기·과거결과·공통코드는 이 작업에서 수정하지 않았다.
