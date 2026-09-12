# Generated receipt adapter 후속 제안 v2

v1의 patch·handoff·before/proposed·검사 결과 13파일의 SHA를 `predecessor.json`으로 고정하고 모두 보존했다. 이 폴더의 `proposed.patch`는 현행 production 기준 전체 패치이며 v1을 먼저 적용할 필요가 없다. 생산 파일 수정, API 호출, 승급은 모두 0이다. 소스 스냅샷 확장자는 `.ts.txt`이고 실제 `.ts` 파일은 만들지 않았다.

## 보완 내용

`questionGradingAcceptance.ts`의 raw grounding이 실제 `lib/questionV3Grading.ts`의 다음 세 조건을 직접 검사한다.

- `injection_detected=false`이면 `injection_evidence_ids=[]`.
- `not_met`이면 `evidence_ids=[]`.
- 해당 criterion에 `scores.partial`이 없으면 `partial` 금지.

각 반례가 현재 AJV schema에는 통과하지만, 실제 production `groundJudgment` 함수와 v2 adapter에는 거부됨을 대조했다. 생산 함수를 호출하는 oracle은 현재 원문에서 private 함수 세 개를 AST로 그대로 추출한 로컬 코드이며 모델 요청 함수는 포함하지 않는다. partial을 실제로 허용한 criterion의 정상 상대 사례도 통과한다.

지원하는 trace는 빈 답안의 빈 trace 또는 비빈 답안의 **judgment/attempt=1 성공 응답 한 개**다. 이 adapter는 재시도 오류·보안 재확인 경로를 수락하지 않으므로, 성공 뒤 두 번째 응답이나 선행 실패가 없는 attempt=2는 실제 지원 producer 경로가 아니다. 누락/음수/0/2/3/소수/문자열 attempt, 중복·두 번째 성공·빈 trace·추가 필드·빈 error 필드도 거부한다. 정상 복구 경로는 여전히 별도 adapter 구현 전까지 미지원이다.

`promote_cpa_v3.ts`는 acceptance 파일 snapshot을 먼저 잡고 guard에 추가한 후 읽는다. 읽기 함수가 그 snapshot hash를 확인하고 **검증한 동일 Buffer를 parse**한다. source-review/manifest/원시 JSONL 등의 `safeFile`도 확인한 Buffer를 반환하여 hash 검사 후 두 번째 파일 읽기를 없앴다. 파일이 snapshot 이후 생기거나 내용이 바뀌면 거부한다.

## 검증

`fixture-results-v2.json`의 **88개 검사**가 통과했다. 기존 38개 actual-origin/strict/보안/범위/장부 검사를 유지하고 grounding 세 반례, producer trace 형상, 같은 Buffer의 hash·parse, snapshot/read 순서 및 v1 보존 검사를 추가했다. 실제 A/B 호출은 새로 하지 않고 보존된 자료만 읽었다.

복제본 타입 오류 0, 대상 lint는 `handoff.json`에 기록했다. `.mjs` fixture runtime은 의존 import 위치와 테스트 전용 private 함수 export만 바꿨다. 가상 타입검사 외부에 production `.ts`를 복제하지 않는다.

정식 적용 전에는 기존 strict 회귀·승급 CLI의 전체 쓰기 guard를 다시 검사해야 한다. 별도 diagnostic/작성자 QA producer와 복구 trace는 아직 미지원이다. 테스트용 source-review/acceptance JSON을 실제 수락 증거나 사람 확인으로 선택하면 안 된다.
