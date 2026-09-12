# 효율 검증 결과 봉인

이 도구는 모델을 호출하지 않고 기존 실행의 원시 증거를 재생한다. 문항·모범답안·기대값·실측값·원 receipt를 수정하지 않고, 승급이나 DB 반영도 수행하지 않는다.

저장소 루트에서 실행한다. 출력 디렉터리는 존재하지 않아야 한다.

```powershell
$efficientBatch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12'
node "$efficientBatch/b/seal-results.ts" --candidate "$efficientBatch/candidate-v1" --runs "$efficientBatch/run-v1/worker-a,$efficientBatch/run-v1/worker-b,$efficientBatch/run-v1/worker-c" --output "$efficientBatch/sealed-results-v1"
```

±1점 초과 관측이 있으면 직접 조사한 JSON 배열 파일을 `--residual-findings <파일>`로 지정한다. 배열의 각 항목은 `EfficientReviewBatch.residual_grading_findings`의 실제 형상이어야 한다. 각 항목에 `entry_id`, `subquestion_id`, 실제 `delta`, `classification: grading_consistency_only`, 원문·기대값을 재검토한 `rationale`, `content_rechecked: true`, `disposition: accepted_within_batch_95_percent`가 필요하다. 이 도구는 조사나 승인 문구를 대신 생성하지 않는다. 이 파일의 원본 해시는 `seal-inputs.json`에 보존되고 항목 전체는 `batch.json`에 들어간다.

- `batch.json`: 원 manifest·관측 파일 해시와 실제 agent 검토·보존 runtime을 결합한 공통 형상. **파일 존재만으로 수락된 증거가 아니다.**
- `readiness.json`: 최종 `ready`와 오류. 누락·중복·다른 worker의 결과·실행 오류·현재 파일 변경이 하나라도 있으면 false다.
- `receipts.json`: 공통 `createEfficientReviewReceipt`와 `validateRecordedEfficientReview`로 검증한 결과. 수락 실패 상태에서는 승급에 사용하지 않는다.
- `summary.json`: 고정 전체 분모, 숫자 정확일치와 criterion 판정 정확일치, ±1 관측, context-only를 포함한 모든 물음의 기대·실점, 원 transport 호출 수와 usage. 실패하거나 없는 관측의 실점은 null이며 0점으로 바꾸지 않는다.
- `seal-inputs.json`: candidate 파일, authorization, policy, 원 worker preflight/summary, residual 원본, 실제 읽은 모든 입력과 batch 해시. 최종 배포 장부에 이 봉인 입력도 함께 보존한다.

모든 worker가 완료되지 않아도 읽을 수 있는 부분 증거는 보존한다. 그런 결과의 통계는 미검증·부분 수집으로 표시하며 분모를 줄이지 않는다. 가격이 알려진 응답은 기존 runner가 기록한 endpoint/tier 자격을 전제로 토큰 산식을 다시 대조한다. unknown, 미반환 usage, 빠진 worker 로그는 확정 금액 0으로 처리하지 않는다. reasoning token은 output token에 이미 포함되므로 중복 합산하지 않는다.

`seal-results.test.ts`의 15개 검사는 임시 디렉터리의 명시적 합성 fixture를 사용한다. 합성 결과는 실제 모델 검증이나 사람 검토 증거가 아니다. 입력 완결성, 보안·출처·기대값 오류, 고정 분모, 정확히95%의 residual 필요조건, 경로/덮어쓰기, unknown 비용을 검사한다.
