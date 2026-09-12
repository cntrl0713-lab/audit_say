# 최종 게시 원문에 학습 분류 재결속

`rebind-final-catalog.ts`는 원 분류의 전체 entries를 보존하고, `status`와 `verification.review_status`만 바뀐 최종 게시 은행에 새 분류 review와 catalog를 만든다. 실제 승급·게시 승인·모델 검수·DB 쓰기를 수행하지 않는다. 최종 파일에 대한 실행은 총괄이 승급 이후 수행한다.

```powershell
node --import tsx cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c/rebind-final-catalog.ts `
  --bank <최종-published-authoring.json> `
  --review cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/candidate-v1/classification-review.json `
  --output <새-published-classification-review.json> `
  --catalog-output <새-learning-question-classifications.json>
```

원 review의 source_file/source_file_sha256, 원·최종 은행 전체 ID와 순서, 각 reviewedContentHash 및 lifecycle 제거 후 deep equality를 확인한다. 최종 상태는 모든 세트가 published/verified여야 한다. 모든 물음의 분류가 정확히 한 번 존재해야 한다. 각 입력은 같은 Buffer로 파싱·해시 계산하고, 쓰기와 공식 compiler 호출 전후에 경로·바이트 해시를 재확인한다.

두 출력은 새 경로만 허용한다. review는 `wx`로 쓴다. 공식 `scripts/build-learning-unit-catalog.ts`의 main 경로에서 임시 catalog를 생성한 뒤 동일 바이트를 최종 경로에 `wx`로 설치하므로, 실행 도중 다른 catalog가 생겨도 덮어쓰지 않는다. 공식 `--check`를 마지막으로 수행한다. 오류 뒤 남은 부분 출력은 성공 산출물로 사용하지 않으며, 새 경로로 원인을 해결한 뒤 다시 실행한다.

현재 후보의 복사본에만 합성 published 상태를 적용한 fixture16개가 통과했다. 정상 재결속은154세트351물음320학습단위(기준서형279물음·사례형72물음)를 실제 입력에서 계산했다. 원 해시/내용/ID/순서/분류의 변경, 출력 중복·경쟁, 입력 drift를 거부하고 기존 출력·원 후보를 보존했다. 수치가 다른 정상 최종 은행에도 고정 개수 제한을 적용하지 않는다.

대상 helper와 실제 import graph의 TypeScript 검사 및 대상 ESLint는 통과했다. 전체 저장소 `tsc --noEmit --incremental false`는 `components/ThemeToggle.tsx:45,46`의 TS7053 두 건으로 실패했다. 이 별도 앱 파일은 수정하지 않았다.

실행 증거는 `rebind-catalog-fixture-tidwg8/results.json`, 대상 타입 설정은 같은 폴더 `tsconfig-helper.json`이다. 이 fixture는 실제 게시·승급·사람 확인·모델 실측 증거가 아니다. 기존 C 동결 인계, 현재 candidate, 공통 코드와 운영 DB는 수정하지 않았다. API/DB 호출은0이다.
