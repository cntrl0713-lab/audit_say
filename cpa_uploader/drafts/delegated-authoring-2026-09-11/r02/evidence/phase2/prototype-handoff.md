# 의미검수 재개 도구 프로토타입 인계

[실행기](resume-semantic.ts)는 기본적으로 캐시 검증만 수행한다. 실제 호출은 `--execute`를 명시한 새 출력 경로에서만 가능하며 이번 프로토타입에서는 실행하지 않았다. `--manifest`, `--plan-id`, `--runtime-lock`, `--output`, 반복 가능한 `--resume-log`를 받는다.

동일한 원문·문항·계획·은행·입력·canonical schema·모델·공통 코드 해시를 검증하고 기존 실제 응답을 직접 `groundReviewChunk`로 다시 검증한다. 코드나 지시가 바뀌면 옛 runtime 로그를 거부한다. 유효 응답이 없는 단위만 현재 생산 지시문을 TS AST로 추출해 SDK의 실제 API에 요청한다. 모델 응답 주입으로 캐시를 흉내 내지 않는다.

신규 실제 응답 `semantic.json.chunks.jsonl`과 과거 근거의 직접 재사용 `reused-actual-model-evidence.jsonl`을 구분한다. 다음 재개에는 이전 원 로그들과 새 실제 응답 로그를 함께 지정한다. 같은 입력에서 서로 다른 유효 응답이 발견되면 유리한 것을 골라 쓰지 않고 중지한다. 원 로그·receipt·기존 출력은 덮어쓰지 않는다. 모델 요청과 grounding만 재시도 try/catch에 두었으므로 입력 guard·로그 저장·관측 실패는 즉시 바깥으로 전파된다.

원 v1 코드에서는 R02의 실제 과거 모델 9단위를 다시 검증했고 5단위 누락을 확인했다. 이후 정책 및 외부 공통 코드 변경 뒤에는 옛 lock/캐시를 안전하게 거부했다. 안전 메타·AST·출력 보존·변경 guard·observer 경계 등 최종 8개 로컬 검사와 TypeScript 및 대상 lint를 통과했다. 실행 증거·해시는 [인계 JSON](prototype-handoff.json)에 있다.

채택 시 imports를 새 위치에 맞추고, 새 공통 계약에 따라 `completeSemanticReview` 실행 표시에 `transport: 'model'`을 추가해야 한다. 이 계약은 프로토타입 작성 뒤 다른 작업에서 추가되었으며, 요청에 따라 프로토타입 원본은 현재 버전으로 보존했다. 실제 네트워크 오류 후 재개와 최종 receipt 생성은 공통 채택본에서 새로 검증해야 한다.
