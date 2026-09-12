# Terra 모델 독립 진단

`pilot-05-003`의 원 QA37을 `gpt-5.6-terra`로 전부 실행해 37개 모두 첫 관측에서 일치했다. 비빈 답안은35개 실제 모델 응답, 빈 답안은2개 생산 무호출 경로다. 추가 반복·전송 실패·응답 형상 오류·보안 오탐은 없었다. 모든 프로세스는 종료됐다.

핵심 시점 누락 원답은2점이며 `crit2=not_met`의 원시 이유는 “적시 커뮤니케이션을 언급하지 않았다.”이다. 내역 명시반대 원답은 `crit4=contradicted`, `crit5=met`으로1점이다. 이전에 흔들렸던 `omit-crit7`은5점, 상대방을 제시한 법규 조건 원답은1점이었다. 원답안·기대값·문항·공통코드·과거 Luna 결과는 수정하지 않았다.

현재 runtime-v7의16개 코드 해시와 v9 manifest의05 입력·QA를 대조했다. v9의 Luna 모델 설정을 바꾼 전수 실행이 아니라 명시 승인된 별도 Terra 진단이다. 실제 CLI는 `createResponse=undefined`로 생산 함수를 호출했고 `mock=false` 기록을 확인했다.37개 요청 prompt/schema를 재구성했으며,35개 모델 응답의315개 기준을 근거 ID에서 다시 복원하고 저장 raw와 정확히 대조했다. 원시 판정을 순수 합산 함수로 재처리한 전체 결과도 일치한다. 빈 답안 포함333개 결과 criterion은 기대판정과 정확히 같아 조건 경계 동등점수 규칙에 기대지 않았다.

- [검증 JSON](terra-verification.json): `cd167ea9be99fbf9f0db44a27e39a35ca085cced6d67e011b42bab3c56b2ca89`
- 실제 실행 `drafts/delegated-authoring-2026-09-11/validation-resumes/grading-model-comparison-v1/b-terra-full/summary.json`: `3ad36b064d231c99758590d01ec3c043f86ac5475cc973ea17048f173bfacb95`
- [입력 선택 장부](input-selection.json), [로컬 검증기](verify-terra.mjs): 추가 모델 호출0, 대상 lint 통과.

현 trace는 요청 모델과 생산 경로를 기록하며 공급자의 응답 모델명을 별도 필드로 보존하지는 않는다. 이37개 사례의 성공은 전체은행·정식 의미검수·실제 학습 smoke·DB 승급 또는 게시 완료를 뜻하지 않는다. 후속 모델 선택과 실행 범위는 총괄이 이 근거를 다른 진단과 함께 판단한다.
