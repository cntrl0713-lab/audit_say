# N03 1차 제작 인계

**draft_ready: 3세트·8물음·23점, 작성자 QA 156개.** 문항 형상·공식 인용·version1 계획·정수 배점·QA 형상·현행 은행 메모리 검증·초기 활성111세트 및 선행N02 4세트와의 ID/발문 충돌 검사가 통과했다. 독립 모델 의미검수와 실제 모델 채점은 미실행이다. 정본 편입·게시·배포도 하지 않았다.

| 계획 | 실제 문항 | 물음 | 점수 | 계획 | 작성자 QA |
|---|---|---:|---:|---|---|
| T07-A | [pilot-07-006](pilot-07-006.json) | 3 | 12 | [계획](pilot-07-006.authoring-plan.json) | [QA 73개](qa-cases-t07-a.json) |
| T07-B | [pilot-07-007](pilot-07-007.json) | 2 | 5 | [계획](pilot-07-007.authoring-plan.json) | [QA 35개](qa-cases-t07-b.json) |
| T05-B | [pilot-05-009](pilot-05-009.json) | 3 | 6 | [계획](pilot-05-009.authoring-plan.json) | [QA 48개](qa-cases-t05-b.json) |

[고정 파일·해시](draft-manifest.json), [범위·근거·빈도](scope-and-sources.md), [인계와 재개 조건](handoff.md), [최신 정적증거](evidence/phase1/latest-static.json), [관계제안](coverage-proposal.json)을 함께 본다. 각 문항 파일은1세트 배열이며 중복 합본을 만들지 않았다. [수동 입력](content.mjs)과 [전용 생성기](build-n03.mjs)는N03 폴더만 쓴다. 원자료·기존 초안·과거receipt를 수정하지 않았다.

2027년 CPA 시험 목표와2026년1월1일 개시 사례를 사용한다. 최종 시험 기준서 판본의 공고를 확인했다고 주장하지 않는다. 공식2025/2026 전문 대조, A43 다음 쪽의 두 이유, 교차참조 각주와 전체목록 확인은 근거 장부에 남겼다.

자동 source packet은 원페이지 분류와 연쇄참조 예산·미해결 문제를 가진 조사물이다. [자동 의존 조사](evidence/phase1/packet-context-investigation.json)와 [수동 문맥검토](evidence/phase1/manual-context-review.json)를 보존하며 complete packet으로 표시하거나 검수CLI에 전달하지 않는다. 수동 plan과 실제 등록공식 source_refs로 검수한다.

정적 확인 명령은 'node --import tsx cpa_uploader/drafts/delegated-authoring-2026-09-11/n03/audit-phase1.ts'다. 의미검수 입력 준비는 명시400,000자로 수행했으며 실제 모델 호출은 총괄의 최종 비교 은행·출처 고정 후 진행한다.
