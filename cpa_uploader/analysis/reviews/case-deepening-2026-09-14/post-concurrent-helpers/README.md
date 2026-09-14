# 동시 게시 이후의 게시·배포 도구

이 폴더는 별도 승인 작업의 정본 변경을 보존하면서 이번 검증된 사례 6개를 새 통합 후보에 추가하기 위한 실행 준비다. 도구 제작 시점에는 게시·DB·API를 실행하지 않았다. 기존 helpers, publication-v1과 누락된 환경변수로 실패한 04-compile 기록, 동시 변경으로 중단된 resume-publication 기록을 수정하지 않는다.

원본 도구 바이트는 originals에 보존하고 초기 변경·해시는 provenance.json과 static-checks.json에 보존한다. 로컬 의존성·coverage 도구를 추가한 후속 버전은 provenance-v2.json과 static-checks-v2.json에 기록한다. 새 후보·분류와 통합 기준은 root가 확정하며, 기존 실측을 재사용할 수 있는지에 대한 root의 내용·코드·보존 원자료 검토가 선행한다. 이 폴더를 만들었다는 사실로 그 검토나 게시 완료를 인정하지 않는다.

입력 경로는 candidate-v2.json, classification-v2.json, integration-baseline-v2.json 및 integration-baseline-v2/bank.json·catalog.json이다. 게시 출력은 publication-v2, 운영 DB 출력은 db-publication-v2다. changed-sets-v1.json, sealed-v1, shape-check.json, case-qa.json, 대표 답안 범위와 원 실측은 그대로 재사용한다. write-report는 기존 helpers에서 원바이트로 복사한 로컬 final-check-paths와 representative-qa 계약을 읽는다. 두 사본의 원본·현재 해시를 후속 provenance에 함께 고정한다.

저장소 루트에서 확정 입력과 선행 결과를 검토한 root가 다음 순서로 실행한다. 아래 명령은 실행 방법이며 완료 기록이 아니다.

```text
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-deepening-2026-09-14/post-concurrent-helpers/publish.mjs --stage
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-deepening-2026-09-14/post-concurrent-helpers/publish.mjs --install
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-deepening-2026-09-14/post-concurrent-helpers/deploy.mjs
node cpa_uploader/analysis/reviews/case-deepening-2026-09-14/post-concurrent-helpers/update-coverage.mjs
node cpa_uploader/analysis/reviews/case-deepening-2026-09-14/helpers/final-checks.mjs --output final-checks-v1
node cpa_uploader/analysis/reviews/case-deepening-2026-09-14/post-concurrent-helpers/write-report.mjs --final-checks final-checks-v1
```

stage는 부모 Node의 --env-file=.env.local 옵션과 암호화 키 존재를 먼저 확인한다. 키 값을 로그나 증거에 쓰지 않는다. 자식 명령 환경에서 모델·Supabase 자격 증명과 NODE_OPTIONS를 제거하고 정본·공개본·암호화본·승급 장부를 격리 경로로 지정한다. DB readiness는 --apply 없이 실행한다. stage의 정본·기준 입력 해시, 백업, 기존 내용 보존, 승급 장부 앞부분 보존과 추가 12행 검사는 그대로 유지한다. install은 잠금·동시 변경 감지·외부 변경을 덮지 않는 롤백을 유지한다. deploy는 기존 설치 완료 파일을 확인한 후 승인된 운영 프로젝트로만 반영하고 독립 조회한다.

write-report는 최신 통합 전후 수치와 실제 sealed-v1 및 db-publication-v2 결과에서 집계한다. 최종 검사 재실행이 있었다면 --final-checks로 성공한 별도 폴더를 명시한다. 완료·사용량·비용 수치를 이전 배치나 예상 369세트로 하드코딩하지 않는다. 모델은 Luna, 금액 상한은 기존 null/not_specified 정책을 유지하며 새 채점 호출을 만들지 않는다.

coverage는 db-publication-v2 완료 후 기존 6개 제안·root 검토와 현행 원요소·출처·문항 해시를 다시 대조한다. 새 helper 준비 자체로 coverage 반영을 인정하지 않는다. 원 helper의 final-checks는 그대로 사용한다.
