# Runner v3 및 v4 학습 단위 준비 인계

v2의 receipt 출처 목록과 job 전체 출처 목록을 동일시한 검증을 새 `validation-worker-v3.mjs`에서 수정했다. 실제 v4 선택 119세트 중 53세트(기존 14, 신규 39)에 계획 전용 파일이 있었고 추가 파일 membership은 77개다. 구체 파일·해시·source unit ID를 `validation-worker-v3-checks.json`에 기록했다.

receipt는 실제 `set.source_refs` 파일의 현재 SHA256 목록과 정확히 일치해야 한다. 이 목록은 job에서 모두 고정되어 있어야 한다. 계획 전용 출처를 포함한 job 전체 목록의 전후 동일성, 원 runtime 전체 코드 및 실행 중 변경 검사는 계속 유지한다. receipt에 계획 전용 파일을 임의 추가하거나 직접 출처를 생략하는 것도 거절한다.

v3 SHA256: `c3c6aa47085eae4f9aac7502ed1a7523f8d2ef84c59e486f498a1537dcad2926`. v1과 v2 바이트는 보존했다. node syntax·대상 ESLint·임시 fixture 19경계 통과, 실제 production CLI/API 호출 0회다. 기존 원 manifest/run/request/summary/receipt 결속 및 중지 동작을 유지했다. 신규 grading manifest는 원 runtime 모든 파일과 같은 해시를 유지하고 v3 파일을 추가해야 한다.

`prepare-learning-unit-smoke-v2.mjs`는 승인 v4 은행 SHA `ab2986dad1d82f4f4e24e7d50d9058a17ec324af84c706c7e7f51b92bf8f745b`를 읽어 `learning-unit-smoke-v2/`에 새 묶음을 만들었다. 119세트·280물음·249학습 단위(기준서형 209, 사례형 40)·1113점이며 기존 묶음의 249 artifact 해시를 전후 확인했다. 실제 앱 projection과 빈 답안 생산 경로 249개가 통과했다. 비어 있지 않은 저장 답안 249개는 기대값만 준비했고 호출하지 않았다.

이전 대비 실제 채점 body·prompt·schema·분류가 바뀐 단위는 `pilot-08-007--case` 하나이며 13→12점이다. 각 물음 점수 4/5/3을 확인했다. formal source QA와 실제 projection의 prompt/schema가 다른 단위는 각각 237개로 표시했다. 이전 결과의 비빈 답안 실측 재사용을 주장하지 않는다. 상세 비교는 `learning-unit-smoke-v2/v3-v4-comparison.json`, manifest SHA는 `9f9ba50c3ce15b028985d6f8f68e234877e060b256d1e431f063af336e4df117`이다.

smoke script SHA256은 `1e5f470441c5a8740ae1d2296428ec69f5709463f1eb9160ccf84b44ec7c01a0`이며 node syntax와 대상 ESLint가 통과했다. 문항·카탈로그·공통 코드·현재 실행 manifest는 수정하지 않았다.
