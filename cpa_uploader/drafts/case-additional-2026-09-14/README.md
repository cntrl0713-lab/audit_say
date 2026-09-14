# 사례형 추가 제작 6개

사용자 확정 범위는 사례 6개·각 3물음, 사실관계 400자 이상이다. `bank-before.json`, `catalog-before.json`, `classification-before.json`은 시작 당시 은행·분류의 보존본이다. `source-catalog.json`은 당시 등록 자료의 탐색 단위이며 공식성·내용 검수의 증거와 구별한다.

`a/`, `b/`에서 문항(`sets.json`), 설계·출처 대조(`design.json`), agent 내용 검토(`review.json`), 실제 채점 전 기대값(`qa.json`)을 관리한다. 실행과 반영 증거는 [검토 배치](../../analysis/reviews/case-additional-2026-09-14/README.md)에 남긴다.

## 완성본

[새 사례 6개와 모범답안](questions-and-answers.md)을 정본·공개본·운영 DB에 반영했다. 사실관계는 653~822자이며 각 사례는 사실을 적용해야 하는 물음 3개를 포함한다. 총 18물음·55점이다. 업무조건 변경·중요성 재검토·외부조회·전문가 업무·보고서일 후 사건·내부통제 미비점을 다룬다.

`sets.json`은 실제 채점 전 동결한 초안 상태를 보존한다. 현재 게시 상태는 정본 및 검토 배치의 게시·운영 receipt에서 확인한다. 여기의 초안 상태를 `published`로 덮어쓰지 않는다.

## 입력과 검토 근거

- 수동 제작·검토 입력: [A 설계와 출처](a/design.json), [B 설계와 출처](b/design.json), 각 폴더의 `review.json`과 `qa.json`. 기출·고급연습 원발문 및 해설과 공식 기준서 문단을 대조했고 과거 문단번호와 소수 배점을 그대로 이식하지 않았다.
- 동료 내용 검토: [중요성 사례 교차 검토](a/integration-review.json), [B 9물음 독립 검토](b-peer-review.json). agent 검토이며 사람의 직접 내용 확인이나 별도 API 의미검수가 아니다.
- 출처 보존: [공식 목록 수집](../../raw/collections/2026-09-14-case-additional/index.md), 설계 파일의 공식 전문·기출·연습자료별 원문 위치와 해시. 기존 원본 경로와 바이트를 유지한다.
- 제작 시작 당시 186세트의 snapshot은 그대로 보존했다. 병행 작업이 추가한 기준서 27세트를 합친 213세트는 [별도 통합 기준](../../analysis/reviews/case-additional-2026-09-14/integration-baseline.json)에 기록했으며 새 6사례만 추가했다.
- 생성 조회물: `questions-and-answers.md`는 실제 게시 정본에서, 실행·통합 형상과 요약은 검토 배치의 입력·생성기에서 만든다. 생성 결과의 수치나 표를 직접 편집하지 않는다.
