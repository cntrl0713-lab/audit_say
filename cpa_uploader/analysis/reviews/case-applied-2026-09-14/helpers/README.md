# 적용 확장 배치 실행 도구

이 폴더의 코드는 직전 `case-followup-2026-09-14` 실행 도구를 새 배치에 맞춘 것이다. 직전 소스의 바이트 사본은 `reuse-source/`, 원래 파일·해시는 `reuse-origins.json`, 최종 변경·해시 계보는 `provenance.json`에 보존한다. 검토 배치의 기존 setup·authorization·baseline·policy 입력은 수정하지 않는다.

입력은 새 사례 6개·사례당 물음 3개이며, 작성자 `a/b`가 각각 세트 3개·검토 9행·부분/오답 QA 18행을 제공한다. 최종 등록 출처 카탈로그는 제작 폴더의 `source-catalog-final.json`이다. 모든 실행 출력은 검토 배치 바로 아래에 생긴다.

## 출처 완료 입력

root는 검토 배치에 `source-evidence-plan.json`을 작성한다.

```json
{
  "version": 1,
  "status": "complete",
  "raw_collection_manifests": [{"file": "실제 최종 raw 매니페스트 경로", "sha256": "실제 SHA-256"}],
  "source_peer_reviews": [],
  "additional_files": []
}
```

각 raw 매니페스트의 원래 파일과 보존 사본, 같은 폴더의 `verification.json`과 `index.md`를 모두 검증·봉인한다. 이번 범위에서 필요한 출처 peer가 있으면 `source_peer_reviews`에 실제 파일·해시를 적는다. 이전 540 검토 기록을 필수 입력으로 재사용하지 않는다. 추가 수집 인벤토리·변환 검증 등은 `additional_files`로 명시한다.

작성자별 `source-files.json`은 배열 또는 `entries`/`files` 배열을 포함하는 객체이며, 각 항목에는 `file` 또는 `original_path`와 실제 `sha256`이 있어야 한다. 두 작성자의 원자료 파일과 인덱스 자체가 모두 실행 증거에 들어간다. `a-peer-review.json`과 `b-peer-review.json`은 이번 6개 문항의 별도 검토 기록으로 필요하다.

## 실행 순서

저장소 루트에서 `node --import tsx <이 폴더>/<도구>`로 호출한다. 이 목록은 실행 방법이며 실행 완료 기록이 아니다.

1. `capture-integration-baseline.mjs`: 현재 정본·분류의 사본을 만들고 시작 시점 문항이 보존되었는지 검사한다.
2. `integrate.mjs`: 두 작성자 초안을 합쳐 후보·분류·검토·QA 입력을 만든다. `scripts/build-learning-unit-catalog.ts`로 후보와 `classification-v1.json`에 결속한 `catalog-v1.json`을 별도로 만든다.
3. root가 18개 실제 검토 결정을 `root-review-notes-a/b.json`에 기록하고 출처 계획·peer 기록을 확정한다.
4. `record-root-review.mjs`, `complete-draft-evidence.mjs`: 수동 결정을 정확한 대상에 결속하고 원자료 증거를 완성한다.
5. `build-execution.mjs`: 대표 요청·기대값·출처·코드 스냅샷과 manifest를 만든다.
6. `run-efficient-grading.ts`: 먼저 `--dry-run`으로 worker a/b 각각 새 출력 폴더에서 검사한다. 실제 실행은 정확한 manifest SHA-256과 공통 stop-file을 지정한다. 금액은 `null/not_specified`, 모델은 Luna이며 제공자 한도 오류에서 모든 새 호출을 중단한다.
7. `seal.mjs`: 실제 원응답·사용량·모든 대표 결과와 잔여 편차 조사를 검증한다. 원 실행·재사용 비용을 구별한다.
8. `publish.mjs --stage`, `publish.mjs --install`: 격리 게시본 검사 후 원본 해시·백업·잠금·롤백 보호 아래 정본을 설치한다.
9. `deploy.mjs`: 운영 DB를 반영하고 실제 릴리스를 독립 조회한다. 사전 승인과 게시 검증을 마친 root만 실행한다.
10. root가 coverage 제안과 실제 관계 검토를 확정한 뒤 `update-coverage.mjs`, `final-checks.mjs`, `write-report.mjs`로 관계·생성 자료·최종 보고서를 만든다.

보고서 수치와 배점·문항 수·릴리스·채점 통과율·비용은 새 배치의 실제 산출물에서 읽는다. 회계용 단가는 직전 실행의 2026-09-12 확인 기록을 명시적으로 재사용한 값이며 현재 청구액 확인을 의미하지 않는다. 누락된 사용량은 0으로 처리하지 않는다.

도구 제작 단계에서는 모델 API, 정본 설치, 운영 DB를 호출하지 않았다. `validate-static.mjs`는 문법·import·타입·lint만 확인하며 배치 통합이나 실제 채점 증거를 대신하지 않는다.
