# 적용하지 않은 generated receipt 수락 구현안

`proposed.patch`는 기존 **4개 검증·승급 파일**과 신규 `questionGradingAcceptance.ts` 1개, 총 5개 파일이다. 생산 경로는 수정하지 않았다. before/proposed는 `.ts.txt`로 보존했으며 프로젝트의 전역 TypeScript 입력에 들어가지 않는다. 타입 검사는 가상 메모리 파일에서, 실제 실행은 import 위치만 재배치한 `.mjs`에서 했다.

핵심 동작은 다음과 같다.

- `auditReviewGrading`은 무결성 오류와 엄격한 기대 불일치를 구분한다. 재계산한 `computedMatched`와 기록된 `matched`가 다르면 무결성 오류다. `false`를 `true`로 바꾼 기록은 허용 편차로 수락하지 않는다. 기존 `validateReviewGrading`은 선택 인자가 없는 strict API로 유지한다.
- 신규 adapter는 actual semantic pass, 원 grading receipt·실행 manifest/run/summary/request·전체 원시 JSONL의 관계, 질문/계획/출처 hash, 모든 raw criterion·근거 ID·원시/최종 보안과 재합산을 대조한다. complete exact 또는 criterion별 보수적 범위를 모든 물음에 적용한다.
- 원 receipt와 `receipt_hash`, 답안·기대·matched·실제 점수는 불변이다. 수락 문서와 해시는 verified 장부에 별도로 남고 published 장부에서 이어진다. 읽기·게시 검사에도 결속이 적용된다. 실제 사람의 검토 근거는 여전히 별도다.
- `source_review`는 별도 검토자가 실제 원문·발문·criterion·답안 전체를 대조한 자료를 정확한 형상/해시로 선택해야 한다. 이 코드가 의미 검토를 대신하지 않는다. fixture의 정규화 source-review는 테스트용이며 실제 수락 자료로 선택하면 안 된다.

## 보수적 미지원 범위

현재 구현은 **단일 완료된 production review CLI의 formal generated grading 기록**만 지원한다. 별도 diagnostic 또는 author-QA 생산자의 추가 관측을 넣으면 거부한다. 원 실행 외에 관측이 있다면 그것을 빼고 수락하지 말고, 해당 생산자의 manifest/입력/summary/원시 계약을 검증하는 adapter를 추가해야 한다. 작성자 QA 평가는 root의 별도 작업 범위다.

또한 원시 trace에 재시도 오류나 보안 재확인 단계가 있으면 보수적으로 거부한다. 정상적으로 복구된 재시도의 유효 최종 응답을 수락하려면 각 원응답·오류·복구 단계를 보존한 별도 검증을 먼저 구현해야 한다. 오류를 감점이나 허용 편차로 바꾸지는 않는다.

수락 문서 생성은 아직 자동화하지 않았다. 실제 출처 검토·기대범위와 현재 사용자 정책의 대상 집합을 root가 선택해야 하며, source-review를 모델 실제 점수에 맞춰 좁혀서는 안 된다. 원 정책 문서와 기존 실행 잠금은 그대로 둔다.

## 로컬 확인과 적용 후 필요한 확인

`fixture-results-v2.json`: 38개 검사 통과, API 0회. 실제 B 원 formal 39개 행(38 비빈 답안+1 빈 답안)과 A 원 기록을 읽어 새 adapter 경로를 검증했다. 기대 0..2/실제1은 통과하고 기대 0..3/실제1은 거부한다. matched 변조, 누락 기준, 답안/기대/정책/raw hash 변경, 원시 보안 오탐, 미등록 근거, 미지원 추가 관측, 장부 hash 변조를 대조했다. 메모리 내 수락과 장부는 파일로 저장하지 않았다. 실제 승급도 하지 않았다.

`typecheck.json`: proposed 5파일과 실제 의존 코드에 대한 타입 오류 0. `handoff.json`에는 각 파일 before/proposed hash, patch hash, 대상 lint 결과를 담았다. 첫 가상 타입검사의 `.mjs` 선언 해석과 Windows 경로 정규화 문제는 harness에서만 고쳤다.

`reuse-impact.json`: 기존 런타임 선언 중 semantic의 `validateReceipt`/`validateRecordedSemanticReview`, grading의 `validateReviewGrading`만 바뀐다. `executeReviewGrading`, request/schema 작성, semantic 요청·지시문 생성 선언은 동일하다. 실제 grading lib 5파일도 그대로다. 내용·계획·출처·사례가 동일하면 기존 actual 호출을 다시 할 이유는 없다. 단, 파일 전체 hash를 고정한 worker 잠금은 이 코드 변경을 감지하므로 **기존 잠금을 수정하거나 우회하지 말고** 적용 시 새 잠금·수락 검증 도구 신원을 만든다.

실제 적용 후에는 전체 타입/관련 기존 strict 회귀·새 adapter tests와 CLI 쓰기 전후 guard, staged verified→published→compile 흐름을 다시 확인해야 한다. 현재 fixture는 CLI를 실행하지 않았고 운영 DB·정본·공개본은 변경하지 않았다.
