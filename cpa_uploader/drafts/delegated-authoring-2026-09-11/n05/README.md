# N05 — 그룹감사의 부문감사인과 업무유형

현재 상태는 **1차 `draft_ready`**이다. 신규 2세트·5물음·19점, 작성자 QA 76사례를 준비했다. 문항·인용·계획·ID·작성자 QA의 정적 오류는 0이며, 실제 모델 의미검수와 채점은 실행하지 않았다. 문항 상태는 `needs_review / needs_human_review`이다.

| 계획 ID | 실제 초안 | 물음별 점수 | 합계 |
|---|---|---|---:|
| T14-A | [pilot-14-006.json](pilot-14-006.json) | sub1 2 · sub2 3 | 5 |
| T14-B | [pilot-14-007.json](pilot-14-007.json) | sub1 2 · sub2 5 · sub3 7 | 14 |

총괄 ID 장부의 배정을 그대로 사용했다. 중요성 기준을 업무유형과 독립 배점으로 분리하면서 최초 17점에서 19점으로 변경했다. 총괄이 조정을 수용했으며 세트·물음 수는 같다. 당시 전체 잠정 총점의 변동은 377→379이다. [변경 근거](design-changes.json)와 [실제 파일·해시 계보](lineage.json)를 참조한다.

국내 KGA 600의 2025 개정 전문을 2026-01-01 개시 보고기간에 적용한다. 2025·2026 공식 다운로드가 기존 PDF와 같은 바이트임을 다시 확인했고 37개 문단을 직접 비교했다. 31개는 공백·페이지 머리말·꼬리말만 정리하여 일치했고, 6개는 각주 번호·각주 삽입·도표 추출 범위를 별도로 조사하여 본문 대응을 확인했다. 최신 전문 전체가 완전히 동일하다고 선언한 결과는 아니다. 금융위원회의 2027 시험범위 공고가 특정 KGA 판본을 지정했다는 뜻도 아니다.

- 공식 근거·빈도·차이: [scope-and-sources.md](scope-and-sources.md), [frequency-evidence.json](frequency-evidence.json), [comparison-notes.json](comparison-notes.json)
- 버전 1 계획: [T14-A](pilot-14-006.json.authoring-plan.json), [T14-B](pilot-14-007.json.authoring-plan.json)
- 수동 근거 장부: [T14-A](evidence-packet-t14-a.json), [T14-B](evidence-packet-t14-b.json). 생성기의 자동 source packet이 아니며 `--packet`으로 전달하지 않는다. 실제 모델에 필요한 문단과 의존 문맥은 초안의 `source_refs`와 계획에 포함했다.
- 작성자 QA: [T14-A](qa-cases-t14-a.json), [T14-B](qa-cases-t14-b.json). 기대판정을 합산한 준비자료이며 실측 결과가 아니다.
- 정적 검사: [static-check.json](static-check.json). `node --env-file=.env.local --import tsx cpa_uploader/drafts/delegated-authoring-2026-09-11/n05/verify-package.ts`로 실행했다.
- 후속 실행: [handoff.md](handoff.md), S05 연계: [s05-handoff.md](s05-handoff.md)

최종 비교은행은 아직 고정되지 않았다. 준비용 111세트 비교본에 N05를 더한 의미검수 입력은 A 170,059자·B 203,792자다. 기본 160,000자 한도에서 실패한 기록은 [초기 검사](preflight/default-budget-static-check.json)에 보존했다. 총괄의 검증된 명시적 400,000자 지원을 받은 후 원문·비교 은행을 그대로 두고 다시 확인했으며, 두 세트 모두 API 호출 없이 입력 준비가 통과했다. 현재 `static-check.json`의 errors와 review_preparation_issues는 모두 비어 있다. 최종49 비교본·코드·설정을 받은 후 2차에서 재개한다. 기존 배치, 정본, 공용 원자료, wiki, 공개본 및 운영 자료는 이 패키지에서 수정하지 않았다.

작성자 QA의 후속 보완과 현재 해시는 [총괄 QA 후속 기록](qa-followup-root.md)을 함께 읽는다. 이전 인계의 수치·해시는 당시 기록으로 보존한다.
