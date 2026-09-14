# 기준서형 배점 변경의 coverage 후속 연결

이 폴더의 `coverage-update-plan.json`은 기존 관계 34개의 원발문, 최종 발문과 criterion, 연결된 공식 전사 및 학습자료 원자료 단위를 실제 대조한 수동 결정이다. `coverage-review-input.json`에 비교한 원발문·구 criterion·새 criterion·출처 단위를 보존했다. 삭제만 된 물음을 대상으로 삼던 관계는 없었으므로 삭제 물음의 `related_keys`를 대표로 추정하여 옮긴 관계도 없다.

원 `coverage-links.snapshot.json`에는 228개 관계가 있다. 작업 중 별도 사례 제작 작업이 기존 관계를 하나도 바꾸지 않고 6개를 추가했다. 이 차이를 `coverage-concurrent-links.snapshot.json`과 `coverage-reconciliation.json`에 기록했다. 해당 6개의 근거·provenance·판정은 보존하며 이번 검토의 성과로 귀속하지 않는다.

수정할 34개 관계는 분리 후 39개가 된다. 현재 234개에서 최종 239개가 되며, 이번 대상 외 200개는 JSON 값 그대로 보존한다. 기존 미검토·stale 관계를 일괄 검토 완료 처리하지 않는다. 각 변경 관계의 과거 대상·판정·근거·출처·snapshot은 `review_history`에 남고 기존 `provenance`는 변경하지 않는다.

대표적인 의미상 조정은 다음과 같다.

- 부정으로 감사 계속이 불가능한 경우의 세 절차를 묻던 원발문과, 해지 전 책임 결정·해지 고려만 남은 물음의 관계 두 개를 `direct`에서 `partial`로 변경했다.
- 서비스감사인 보고서 언급의 사례판단과 일반 비언급 원칙·법규 예외의 범위를 구별하여 `broader`로 표시했다.
- 선정주체, 부문감사인 계획·종결 소통, 보고서 후 사실에 따른 후속 보고 등은 실제 남은 요구에 맞춰 관계를 분리했다. 원출제 빈도를 분리된 criterion 수만큼 늘리지 않는다.
- 제시문에 이미 주어진 범위제한 원인 명칭은 그 원인의 예시를 묻는 출제와 계속 `adjacent`로 남긴다. 2025년 부문감사인 확인서에 이미 제시된 사항도 누락 요구의 criterion 연결에서 제외했다.
- 동일 ID로 남은 `pilot-16-009/sub1`도 부모 사실과 독립 발문 정리 때문에 question hash가 바뀌어 별도로 의미를 확인했다.

`update-coverage.mjs` 기본 실행은 이 폴더의 제안 JSON과 검사 기록만 쓴다. 최종 `coverage-final-candidate.json`은 v3 후보에 결속하며, v2의315 명료화와 v3의 동시추가6사례 보존을 대조한 근거를 남긴다. 후보은행의 버전을 명시할 수도 있다.

```powershell
node cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/update-coverage.mjs --candidate-bank cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/candidate-v3/bank.json
```

정본 반영 뒤 root가 다음 명령을 실행한다. 이 모드는 실제 정본은행의 대상·criterion과 검토 시점의 question/source/element hash가 맞아야만 canonical `links.json`을 쓴다. 독립적인 관계 변경을 발견하면 중단하며 해시만 새로 고쳐 우회하지 않는다.

```powershell
node cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/update-coverage.mjs --apply
```

실행 후 `analysis:build` → `analysis:check`와 영향받는 wiki 재생성·검사는 root가 수행한다. 관계 검토는 실제 채점, 사람 확인, 정본 수록, 운영 DB 게시와 별개다. 과거 학습자료의 원출제 판본을 이번에 공식 시험 원본으로 승격한 것이 아니며, 출처 단위가 비어 있던 관계는 근거 없는 ID를 새로 만들지 않고 그 한계를 유지했다.
