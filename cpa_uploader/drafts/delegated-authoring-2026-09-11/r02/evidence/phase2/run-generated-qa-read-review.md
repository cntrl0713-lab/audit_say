# 생성 사례 채점 실행기 읽기 검토

공통 파일을 수정하거나 API를 호출하지 않았다. 실제 production grader 사용, 현재 문맥으로 receipt 재조립, 불일치 세 실행의 보존, observer 실패 전파는 적절하다.

- **GQA-1 P1** — semanticReceiptIntegrityErrors(false)와 rebuilt hash 확인만으로는 최신 execution.transport=model 요구를 검사하지 않는다. 따라서 transport 없는 과거 model_reasoned receipt가 로컬 preflight를 통과한 뒤 gradeSemanticReviewReceipt 실행 시에만 거부될 수 있다. 미채점 pass/model_reasoned/model 이름 조건과 함께 receipt.execution.transport === model을 preflight에서 검사. resumer 채택본도 completeSemanticReview에 transport:model을 명시.

- **GQA-2 P2** — 원 semantic runtime의 code_hashes를 열거만 하므로 빈 객체/일부 해시만 있는 runtime은 현재 코드별 증거 누락을 탐지하지 않는다. 원 runtime args의 file/plan/bank/output 및 max_input_chars도 현재 manifest와 직접 대조하지 않는다. 최소 공통 코드 파일 집합 존재, 원 file/plan/bank/output 경로, 500000 예산을 검사. 원 runtime과 receipt의 대응을 명시하여 잘못 복사한 보조 파일도 거부.

- **GQA-3 P2** — 바깥 catch가 stopped.json에 String(error)만 남겨 실제 OpenAIRequestError의 status/code/retryable/cause 정보를 잃는다. 현재 전송장애 원인 구분에는 이 구조화 메타가 필요하다. 프로토타입 safeError처럼 허용한 상태/코드/retryable/request_id와 안전 헤더만 원인 체인에서 기록. provider body/전체 headers/credentials는 보존하지 않음. 기존 event.error는 당시 기록대로 유지.

- **GQA-4 P2** — summary.model_executions는 nonempty 답안의 grading event 수다. 한 gradeQuestionSetV3 실행에서 구조 검증 재시도 등 실제 API가 여러 번 발생하거나 설정 실패로 API가 0번일 수 있어 실제 API 요청 수와 같다고 볼 수 없다. 이 값을 nonempty_grading_executions처럼 정확히 명명하고 실제 API 수는 별도 계측 있을 때만 표시. trace judgment attempt는 실제 관측 가능한 보조 수치로 구분. 재실행 executeReviewGrading이 매번 추가하는 empty-answer 실행도 현재처럼 별도 집계.

해당 파일 해시와 근거 위치는 [검토 JSON](run-generated-qa-read-review.json)에 기록했다.
