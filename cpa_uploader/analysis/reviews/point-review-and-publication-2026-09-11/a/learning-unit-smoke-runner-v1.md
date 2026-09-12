# 실제 학습 단위의 저장 모범답안 실행기

[실행기](run-learning-unit-smoke-v3.ts)는 [동결 manifest](learning-unit-smoke-v3/manifest.json)의 249개 학습 단위를 대상으로 한다. 전역 배열의 index % 3을 사용해 a/b/c가 각각 83개를 순차 실행한다. 새 출력 경로만 허용하며 기존 준비 자료·기대 답안·검수 결과를 덮어쓰지 않는다.

```powershell
node --import tsx cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/a/run-learning-unit-smoke-v3.ts --manifest cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/a/learning-unit-smoke-v3/manifest.json --worker a --output <새 출력 경로> --stop-file <공통 중단 파일> --dry-run
```

실제 실행은 총괄이 현재 환경과 잠금을 확인한 뒤 `--dry-run`을 제거하고 필요한 환경 파일을 로드하여 수행한다. 현재 구현·검사에서는 실제 API를 호출하지 않았다. 이 CLI에는 기존 완료 작업을 자동 재사용하는 resume 선택이 없으므로 중단 후 전체 작업자를 그대로 다시 호출하여 이미 완료된 작업까지 반복하지 않는다. 재개 대상 선정은 총괄의 별도 후속 작업이다.

- manifest 자체와 은행·문항·직접 출처 파일·분류·이전 snapshot·현재 앱 투영/학생 채점 코드·실행기 해시를 사전, 각 job과 관측 전후, 최종 경계에서 검사한다. 사라진 파일도 전체 중단 사유다. sourceCatalog 파서는 학생 채점 입력 코드에 해당하지 않아 이 잠금에 추가하지 않는다.
- 실제 앱 함수로 projection을 다시 만들어 저장된 body·원답안·기대값·prompt·schema와 대조한다. 요청 모델은 준비 manifest/현재 환경/실제 SDK 응답에서 동일해야 한다. 실제 API 요청의 모델·instructions·prompt·schema를 확인하고 저장한다.
- `gradeQuestionSetV3`에는 실제 SDK 응답을 기록하고 그대로 반환하는 전달 함수를 제공한다. 기대값을 응답으로 주입하거나 점수를 수정하는 경로는 없다. 실제 요청/응답과 요청 ID·모델이 포함된 SDK 원응답은 `transport.jsonl`, 파싱된 원시 판단/오류는 `trace.jsonl`, 최종 판단과 점수는 별도 JSON에 남는다. 비밀키·인증 헤더는 기록하지 않는다.
- 첫 관측이 만점이고 원시 보안 판정에도 문제가 없으면 다음 job으로 간다. 첫 불일치는 같은 답안·기대값으로 총 3회 관측한다. 뒤에 통과해도 첫 불일치를 지우지 않고 변동으로 기록한다. 실행 오류는 0점이나 학생 오답으로 바꾸지 않는다. 채점기의 제한된 응답 형식 재시도와 실행기의 3회 불일치 관측은 별도로 기록된다.
- 전체점수와 모든 criterion의 met/만점, 최종 보안 플래그 및 원시 판단의 물음별 injection/salad 플래그를 확인한다. 현재 원시 schema는 최상위 플래그를 필수로 요구하지 않으므로 최상위 필드 부재는 정상이다. 물음별 필드는 필수이며, 보안 재확인 후 해제됐더라도 원시 오탐은 별도 문제로 보존한다.
- nested `credit_balance_exhausted`/`insufficient_quota`, 인증·설정·모델 변경, 입력 변경, 기록 실패는 전체 큐를 중단한다. 잔액 부족은 채점기 내부에서 다시 호출되지 않도록 nonretryable 오류로 전달하며 원래 오류를 cause에 보존한다. 일반 실행 오류는 보존 후 독립된 다음 job을 진행할 수 있다. 공통 중단 파일은 새 요청 전에 확인하고, SIGINT/SIGTERM은 진행 중 SDK 요청도 중단한다.

[로컬 검증 기록](learning-unit-smoke-runner-v1-validation.json): fixture 18개, 세 작업자 CLI dry-run, 빈 키+중단 파일, 기존 출력 보존, 전체 TypeScript와 대상 lint 통과. 주입 응답을 이용한 quota fixture는 제어 흐름 검사이며 실제 모델 검수 증거가 아니다. 실제 저장 모범답안 채점·의미검수·DB 반영은 이번 실행기 준비로 완료되지 않는다.
