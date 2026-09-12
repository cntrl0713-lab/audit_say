# A의 기존 의미검수 보존 채점 실행기

`../grade-preserved-semantic-v1.ts`는 `pilot-01-002` 한 세트에 한정한다. 원 `resume-2026-09-12-v2/canary/semantic-a`의 실제 의미검수 11단위·45사례를 보존하고, 승인된 채점 지시 변경만 적용한 정식 CLI의 `--review-input --grade-cases`를 실행한다. 원 45사례는 비빈답 38개와 별도 빈답 1개, 총 39실행으로 묶인다. 모델 호출을 수행하는 답안은 38개이며 빈답은 모델을 호출하지 않는다. SDK 내부 재시도 횟수는 이 수와 별개다.

허용 코드 변경은 `lib/questionV3Grading.ts`의 `6a3033f9…`에서 `0f685328…`로의 한 쌍뿐이다. `grading-inference-followup-v1/before.json`의 실제 보존 snapshot과 `execution-runtime-v6.json`을 고정 SHA로 대조한다. 기존 다른 코드·은행·문항·계획·출처는 모두 일치해야 한다. A의 QA 후속 파일은 의미검수·생성 사례 채점 입력이 아니므로 새 manifest의 QA를 추가로 고정하되 이전 QA도 보존·검사한다.

원 manifest/run/request/전체 및 세트 summary/receipt/chunks의 정확한 SHA를 확인한다. 원 11개 chunk의 직접 기록 input/schema hash를 현재 semantic 준비 함수로 재계산하고, 실제 응답을 `groundReviewChunk`로 연결한다. `completeSemanticReview`를 메모리에서 재구성하여 원 receipt와 모든 필드·해시가 같은지 확인할 뿐, 새 의미검수 receipt를 쓰거나 과거 해시를 교체하지 않는다.

새 실행은 명시 `--execute`만 허용한다. `--dry-run`은 subprocess·API·출력 파일 생성 모두 0이다. 신규 manifest SHA, 모델 두 환경변수와 500000자 예산을 명시해야 한다. 원 worker 및 새 worker는 모두 `a`여야 한다. Master v8의 원래 배정 `c`는 정상적으로 거절하며 최종 canary wave에서 `a`로 배정된 manifest를 사용한다. 구현 도중 신규 owner 허용 검사는 중간 버전에서만 있었고 최종 버전에는 없다.

공유 STOP은 시작 전 두 차례 검사하여 새 착수를 차단한다. 실행 중 공유 STOP은 관측만 기록하고 현재 CLI가 완료되게 둔다. 쿼터 오류는 shared STOP을 쓰고 CLI 자체 오류 종료와 중간 원시 로그를 보존한다. 명시 SIGINT/SIGTERM 및 코드·입력 drift는 즉시 중단한다. 재시도나 두 번째 CLI를 자동으로 시작하지 않는다.

출력의 원 의미검수 필드 전체, 새 grading raw와 receipt의 답안·기대값·판정·결과·모델·코드 해시, 정식 validator와 CLI exit code를 대조한다. 정확한 기대 불일치만 `grading_mismatch`로 기록하고, 형상·증거·실행 오류는 `execution_error`로 구별한다. 성공·불일치·중단 로그를 덮어쓰지 않는다. 새 출력은 전용 wrapper의 `run.json/request.json/summary.json` 형상이며 기존 worker-v3 실행이라고 표시하지 않는다. 불일치 추가 반복 도구는 이 provenance 형상을 이해하는지 별도 확인해야 한다.

검사 증거는 `checks-v3.json`이다. 원 입력 재대조 및 코드·은행·계획·출처·모델 변조, 원시 누락/위장, 정확한 불일치 문구·실패 exit·signal·STOP 정책 등 39검사가 통과했다. 네트워크 접근과 subprocess 시작은 0이다. 전체 TypeScript 검사와 대상 두 파일 lint도 통과했다. `checks.json`, `checks-v2.json`은 이전 구현 단계의 증거로 보존한다. 테스트 재실행은 별도 `checks-repeat-*.json`을 만든다.

실제 CLI subprocess와 최신 grader의 모델 채점은 아직 실행하지 않았다. 이 준비 통과는 새 채점 완료·사람 승인·정본 수락·게시를 뜻하지 않는다. 최종 wave manifest에 대한 무호출 확인은 별도 후속 기록으로 남긴다.
