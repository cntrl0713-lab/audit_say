# v9 전수검증 실행 준비 인계

API 호출 없이 사전검사와 실행 형상 확인을 완료했다. 실제 의미검수·학생 채점·사람 확인·DB 반영 완료가 아니다.

- 대상: 119세트 / 280물음 / 1,113 criterion / 1,393 의미검수 단위 / 작성자 QA 6,040개.
- 출처·문맥 누락 및 사전검사 오류 0. 최대 입력 476,203자(상한 500,000자).
- 원 QA 6,038개 객체를 보존하고 B 반례 2개만 추가했다. 문항 파일 118개, QA 파일 118개, job 전체 117개는 종전과 같다.
- C의 03세트 출처 1개 및 crit1~3 근거 연결, C 계획, B 계획·QA, runtimev7의 명시된 코드 2개·정책 1개 변경만 수용한다.
- 과거 canary QA 92개(실제 모델 86개·빈 답안 6개)의 원답안·기대·원시·합산을 보존 대조했다. 새 grader 요청 해시 92개가 모두 달라 현행 실측으로 재사용하지 않는다. canary는 이제 94개다.
- self-test 허용 3/거부 7, 전체 타입 검사, 대상 lint, worker a/b/c dry-run 39/40/40 모두 통과. API 0, 생산 검수 자식 프로세스 0.

총괄이 새 canary/remaining 실행 경로를 만든 뒤 전수 의미검수와 새 pass receipt의 생성 사례 채점, 작성자 QA를 수행한다. 구버전 pass의 해시만 바꾸어 승계하지 않는다.

[manifest](manifest.json) · [전수 사전검사](preflight.json) · [과거 QA92 보존](historical-qa92-preservation.json) · [재실행 요구 목록](execution-requirements.json) · [검사](checks.json) · [해시 인계](handoff.json)
