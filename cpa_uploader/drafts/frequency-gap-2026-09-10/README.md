# 빈도와 출제 공백을 연결한 신규 문제 초안

기존 A–I 설계안 9세트 전체를 실제 요구사항 빈도와 대조해 작성했다. 사람이 읽을 결과는 [문제지](../../../docs/reports/question-authoring-frequency-gap-2026-09-10/출제-공백-보강-문제지.md), [모범답안·채점기준](../../../docs/reports/question-authoring-frequency-gap-2026-09-10/모범답안과-채점기준.md), [출제 근거](../../../docs/reports/question-authoring-frequency-gap-2026-09-10/요구사항-빈도와-출제-공백의-연결.md)에서 확인한다.

- `draft-*.json`: 각각 한 개의 v3 문제 세트. `needs_review`이며 정본에 편입하지 않았다.
- `*.authoring-plan.json`: 기존 원자료 단위, 목표·조건·답안 범위·기존 은행과의 차이·판본 가정. `ready`는 이 가정 안의 설계 준비 상태다.
- `frequency-links.json`: 실제 추출 요소 ID·원시험·요소별 빈도·재수록 위치. 기출과 모의고사 횟수를 합산하지 않는다.
- `qa-*.json`: 작성자가 기준서와 발문에서 먼저 정한 모범답안·동의 표현·누락·반대·조건 경계 등의 기대 사례. 실제 채점 모델의 판정 결과나 정식 의미검수 receipt가 아니다.
- `sources/`: 공식 전문 PDF, 페이지별 추출본, 실제 답안을 지지하는 발췌와 판본 대조. 2025 개정 전문의 2026년 시행 기준을 사용하고 2026년7월 개정 전문과 해당 구간을 비교했다.
- `*-source-evidence.json`, `sources/fgi-edition-comparison.json`: URL·해시·쪽수·비교 결과.
- `review-*.md`: 별도 담당자가 수행한 내용 대조와 수정 기록. 사람의 검수 승인으로 사용하지 않는다.
- `validation.json`: 현재 초안의 구조·인용·연결·원시 기대판정 점수 재생 결과. 외부 모델은 호출하지 않는다.

```sh
npx tsx cpa_uploader/drafts/frequency-gap-2026-09-10/verify-batch.ts
node cpa_uploader/drafts/frequency-gap-2026-09-10/render-batch.mjs
```

초안별 편입 전 검사는 다음과 같다.

```sh
npx tsx cpa_uploader/validate_draft_v3.ts --file cpa_uploader/drafts/frequency-gap-2026-09-10/draft-13-402-001.json --against-bank
```

`build-abc.mjs`, `build-fgi.mjs`는 해당 담당 범위의 자료 작성 기록을 재현하는 스크립트다. JSON을 직접 보완한 이후에는 변경을 먼저 작성 스크립트에 반영해야 하며, D/H/E는 개별 JSON을 편집 정본으로 관리한다.

## 2026-09-10 게시 결과

8세트를 정본에 편입해 게시하고 운영 DB 릴리스 `f5e24288-933a-4e3b-864a-7ba4394b550a`(104세트)로 이관했다([이관 receipt](../../../docs/reports/cpa-learning-db-applied-20260910.json)). 검수·채점 기록은 `release/`에 있다.

- ID: `release/id-map.json` (draft-* → pilot-XX-NNN). 게시본 criterion id는 세트 내 고유한 `crit1…critN`으로 바꿨다. 물음마다 번호가 반복되면 채점 모델이 `sub1.crit1`을 반환해 채점이 실패한다.
- 검수: `release/manual-review-notes.json`의 수동 의미검수(Claude 대리, 소유자 지시) + 실제 gpt-5.6-luna 채점 사례 전건 일치(`release/per-set/*.review.json`, 승급 장부).
- 검수 중 수정: draft-13-402-002 sub1 c2 채점 명제를 증거의 한계로 좁힘, sub2 c1에 유형 미특정·유형 1 불인정 조건 추가. draft-05-260-001 공통 사실의 "물음 1은…, 물음 2는…" 안내문 삭제.
- **보류: draft-05-260-001(pilot-05-008)**. 채점 모델이 subquestion id를 `q1`로 반환하는 실패가 반복되어(안내문 삭제 전 6회 중 2회, 삭제 후 채점 사례 실행 중 1회) 게시하지 않았다. 세트 분할이나 채점기 id 정규화 후 다시 검수한다.

## 2026-09-11 채점기 변경 후 재검수

채점기가 응답 id를 스키마로 제한하고 인용 id·보안 판정 단계를 도입해 채점 코드가 바뀌었다. 그래서 게시 8세트의 실제 채점 사례를 다시 실행하고 승급 장부에 재검수(`--reverify`)·재게시를 기록했다(`release/review-regrade-20260911.json`, `release/per-set/pilot-13-006.regrade.json`).

- **은행 기준:** 원 검수 receipt는 pilot-05-008 초안이 은행에 있던 중간 상태에 묶여 있었다. 같은 검수 내용으로 현재 은행 기준 receipt를 다시 확정했다.
- **검수 일치 기준:** 조건 경계 사례는 0점 판정(not_met/contradicted) 사이의 차이를 일치로 본다(소유자 결정). 반대 서술은 여전히 contradicted여야 한다.
- **사례 교체:** 판정이 갈린 사례는 6–10회 반복 실측으로 안정적인 문장을 확인한 뒤 교체했다(`release/manual-review-notes.json` `case_overrides`). 이전 실행 기록은 `*.regrade-run1*.json`, `*.regrade-f62d5.json`으로 보존했다.
- **게시 후 문항 수정:** pilot-13-006 sub2 crit5. 발문이 절차의 조건을 요구하는데, 새 채점기가 조건을 빠뜨린 답안에 8회 모두 met을 주었다. 그래서 명제·핵심 사실에 조건 누락 불인정 문장을 추가했다. 이 수정은 편집 정본에서 했고, 초안·작성 스크립트·렌더 문서는 제작 당시 기록으로 두었다.
  - 이 수정으로 coverage 연결 `frequency-gap-2026-09-10-A-2`가 stale로 표시된다. 연결 자체가 검토 전(`needs_review`)이며, 의미를 다시 대조할 때 갱신한다.
- **pilot-05-008:** 사례를 정정하고 새 채점기에서 51/51 전건 일치했다(`release/per-set/pilot-05-008.review.json`). 앱 재배포 후 게시·운영 DB 반영 전까지 은행 밖에 둔다.
- **운영 DB:** 운영 DB는 아직 2026-09-10 릴리스이며 pilot-13-006 수정이 반영되지 않았다. 새 채점기 배포와 문제은행 이관을 함께 해야 한다.

향후 정본 편입·게시에는 독립 의미검수와 실제 채점 사례 실측, 사람 검수 근거가 추가로 필요하다. 이 폴더의 작성자 QA를 승인 receipt로 바꾸거나 상태만 `verified`로 변경해서는 안 된다. 공식 시험의 2027년 적용 판본은 별도로 확인한다.
