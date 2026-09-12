# 출제 요소·기준서·문항 연결 관리

[현재 집계](summary.md)와 [wiki 통합 진입점](../../wiki/_meta/authoring-dashboard.md)을 먼저 읽는다. 추출 요소, 판본별 기준서 원자료 단위, 은행의 물음·criterion은 서로 다른 ID를 유지한다. 기출에 연결되지 않은 기준서 단위도 목록에 남기며 단위 수를 고유한 법적 요구사항 수로 해석하지 않는다.

| 파일 | 편집 주체와 역할 |
| --- | --- |
| `links.json` | 수동 관계 장부. 요소 ID, 원자료 단위 ID, 대상 물음/criterion, 대응 범위, 근거, 확인 상태와 입력 해시 |
| `registry.json` | 생성 결과. 현행 요소·빈도·판본별 원자료 위치·문항 상태·인용 연결·관계별 최신성 |
| `summary.md`, `topics/*.md` | 생성 결과. OX 학습 순서의 집계와 주제별 탐색 표 |
| `build-coverage.mjs` | 읽기 전용 분석·렌더 함수. 저장과 검사는 관리 명령에서 수행 |

`npm run analysis:build`는 요소 분석과 이 폴더의 생성 파일을 갱신한다. `npm run analysis:check`는 저장된 결과와 현재 입력을 비교하며 파일을 쓰지 않는다. 이어서 `npm run wiki:build`, `npm run wiki:check`로 탐색 문서를 갱신·검사한다.

## 관계를 추가하거나 다시 확인할 때

1. `question-elements`에서 실제 발문·원출제·조건을 읽고 기존 요소 ID를 선택한다. 새 별칭·추출 보정은 해당 폴더의 수동 입력에서 관리한다. 이 장부에 빈도를 직접 입력하지 않는다.
2. 원자료 카탈로그에서 적용 판본·문단별 `src-*` ID를 선택한다. `source_unit_ids`는 내용을 지지하는 원문 단위를 가리킨다. 대상 문항이 없으면 `target: null`을 사용할 수 있다.
3. 대상이 있으면 현재 `set_id`, `subquestion_id`, `criterion_ids`를 정확히 적는다. 기본 대상은 은행이다. 은행에 없는 보존 초안은 `target.scope: draft`와 `target.file`에 `cpa_uploader/drafts/` 아래 실제 JSON 경로를 명시한다. 초안 파일은 한 세트 또는 세트 배열이며 파일·ID를 함께 확인한다. 초안 연결은 은행 포함으로 세지 않는다. `direct`, `partial`, `broader`, `adjacent`, `excluded` 중 관계를 선택하고 `reason`에 조건·범위를 설명한다.
4. 새 관계는 `review_status: needs_review`로 시작한다. `snapshot`에는 요소 객체의 JSON SHA-256, `questionHash(set, subquestion)` 값, 원자료 단위별 `contentHash`(`source_hashes`)와 `sourceUnitHash(unit)`(`source_metadata_hashes`)를 기록한다. 원문이 같아도 판본·자료 성격·위치가 바뀌면 재확인이 필요하다. ID·주어진 사실·발문·답안·criterion·출처의 변경도 검사한다. 관계를 실제로 확인한 뒤에만 `reviewed`로 바꾼다. 이것은 문항의 사람 승인이나 게시 상태가 아니다.
5. 생성 결과에서 `freshness: stale`이면 `changed_inputs`를 읽고 의미를 재대조한다. 해시만 현행값으로 바꾸어 검토를 대신하지 않는다. 없는 ID는 검사 오류이며 삭제·대체 이력을 확인해 연결을 수정한다.

기존 제작 배치에서 가져온 관계에는 `provenance`로 당시 파일·해시·ID를 남긴다. 첫 이관은 후보 관계와 현재 대상 ID 연결의 복원이며 모든 대응 관계의 신규 의미검수는 아니다. 과거 파일의 내용을 수정하지 않는다.

## 해석 범위

- `freshness: current`는 입력 일치만 뜻한다. 관계의 현행 판정은 `effective_review_status`로 읽고, 대응 관계·은행/초안 범위와 문항의 검수·게시 상태를 별도로 확인한다.
- 기출·모의 횟수는 `question-elements.json`의 원출제별 집계를 조회한다. 재수록을 새 출제로 세지 않는다.
- 요소 미연결, 인용 미연결, 0회, 낮은 문구 유사도는 미출제 확정이 아니다. 전체 의미 대응 작업의 진행 정도를 함께 보여 준다.
- `citation_overlap`은 같은 파일의 인용 포함관계만 확인한다. 문단 전체의 학습목표 충족이나 기준서 내용의 옳음을 확인한 결과가 아니다.
- 은행 상태는 편집 정본에서 읽는다. `needs_review`, `verified`, `published`를 분리하며 운영 DB 배포 완료로 해석하지 않는다.
- 생성 결과는 정본 내용을 조회하는 내부 자료다. 비공개 채점 정보를 포함하는 분석·wiki를 공개 문제 배포물에 포함하지 않는다.
