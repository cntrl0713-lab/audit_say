# 작성자 QA의 보존 관측과 허용 편차 평가

`assess.ts`는 완료된 QA 실행의 원래 답안·기대표·모든 실제 관측을 읽는다. 저장된 응답을 주입하여 현재 채점기의 형상·근거 복원·합산을 로컬에서 재현한다. **추가 API 호출, 새 의미검수 receipt, 정식 승급 수락 문서, 사람 확인을 만들지 않는다.** 생성 사례의 부분 target 기대표는 이 도구의 입력이 아니다.

- 고정 manifest의 문항·QA·출처와 생산자 코드, 입력 snapshot·summary·관측 목록을 대조한다. 경로 표기가 상대/절대인지와 관계없이 같은 파일의 해시를 확인한다.
- 원래 `matched`, 기대표, 점수, 답안, raw response, 보안 판정, 요청·스키마를 재검사한다. 원시 응답과 근거가 복원된 기록, 재합산 결과가 다르면 거부한다.
- 대상 물음의 모든 criterion 기대점수를 합산하고 다른 빈 물음은 0점으로 확인한다. 반복 중 마지막 통과만 선택하지 않고 모든 관측의 물음별 차이를 계산한다.
- 결과를 `strict_match`, `accepted_with_grading_deviation`, `outside_authorized_tolerance`로 구분한다. 실제 점수 편차의 허용은 이번 배치에서 확정된 물음당 ±1점이며 전역 기본값이 아니다.
- 전송·응답 오류의 복구 경로나 보안 재확인이 포함된 trace는 이 평가기에서 보수적으로 거부한다. 유효한 복구를 별도로 검증할 필요가 있으면 그 계약을 구현해야 하며, 점수 편차로 오류를 덮지 않는다.

## 현재 결과

`canary-assessment-v2.json`: 선행 3세트의 94개 QA, 98개 실제 관측을 모두 대조했다. 고유 QA 92개는 모든 관측에서 엄격 일치하며 나머지 2개는 원 불일치를 보존한 채 물음별 ±1점 이내다. 실제 모델 호출은 추가하지 않았다. 전체 6,040개 QA 완료를 뜻하지 않는다.

`self-test-results.json`: 보존된 실제 기대2/실제3 사례와 메모리 내 변조·초과 편차 반례를 검사한 16개 테스트가 통과했다. 테스트용 변조는 파일이나 새 기대값으로 저장하지 않았다. 타입 검사와 대상 lint도 통과했다.

첫 평가 `canary-assessment.json`과 당시 정확한 실행 코드 `assess.initial.ts.txt`는 보존했다. 후속 v2에서는 생산자 코드·입력 목록 확인을 보강했다. 최초 타입 검사의 관측 배열 타입 오류와 테스트 실행기의 top-level await/CJS 오류는 평가기·테스트 파일에서 수정했다. 생산 코드·원 QA·실제 응답은 변경하지 않았다.

## 실행

새 출력 경로로만 실행한다. `--qa-root` 아래에는 `author-qa-a|b|c/<set-id>/author-qa/`가 있어야 한다. 완료되지 않은 대상은 `not_completed`이며 수락 완료로 집계하지 않는다.

```powershell
npx tsx cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/qa-tolerance-assessment-v1/assess.ts --manifest <frozen-manifest.json> --qa-root <wave-directory> --policy cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/grading-inference-followup-v2/minor-error-policy.json --output <new-assessment.json>
```

출력에는 실제 원본들의 파일 해시와 평가 도구의 해시가 들어간다. 보존 코드와 현재 코드가 다른 경우 그 이력을 설명하고 필요한 검사만 후속 출력으로 수행한다. 기존 출력의 해시를 현재 코드 값으로 덮어쓰지 않는다.
