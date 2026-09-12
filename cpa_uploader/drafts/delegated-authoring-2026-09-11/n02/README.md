# N02 1차 제작 인계

**draft_ready: 4세트·12물음·32점, 작성자 QA 223개.** 문항·계획·공식 인용·정수 배점·QA 형상·현행 은행 메모리 검증과 초기 비교111세트 및 N02 상호 ID/발문 충돌 검사가 통과했다. 모델 의미검수와 비어 있지 않은 실제 모델 채점은 아직 실행하지 않았다. 정본 편입·게시·배포도 하지 않았다.

| 계획 | 실제 문항 | 물음 | 점수 | 계획 | 작성자 QA |
|---|---|---:|---:|---|---|
| T08-A | [pilot-08-006](pilot-08-006.json) | 3 | 6 | [계획](pilot-08-006.authoring-plan.json) | [QA 47개](qa-cases-t08-a.json) |
| T08-B | [pilot-08-007](pilot-08-007.json) | 3 | 8 | [계획](pilot-08-007.authoring-plan.json) | [QA 55개](qa-cases-t08-b.json) |
| T06-A | [pilot-06-006](pilot-06-006.json) | 3 | 10 | [계획](pilot-06-006.authoring-plan.json) | [QA 67개](qa-cases-t06-a.json) |
| T06-B | [pilot-06-007](pilot-06-007.json) | 3 | 8 | [계획](pilot-06-007.authoring-plan.json) | [QA 54개](qa-cases-t06-b.json) |

[고정 파일·해시 장부](draft-manifest.json), [범위·근거·빈도](scope-and-sources.md), [인계 및 남은 검증](handoff.md), [최신 정적 증거](evidence/phase1/latest-static.json)를 함께 본다. 문항 파일은 각1세트 배열이며 합본 사본을 만들지 않았다. 작성 입력은 [content.mjs](content.mjs), 전용 생성기는 [build-n02.mjs](build-n02.mjs)이다. 기존 원문과 과거 receipt를 수정하지 않았다.

2027년 CPA 시험 목표와 2026년1월1일 개시 사례를 적용했다. 특정 최종 시험 판본이 공고되었다고 주장하지 않는다. 공식 2025/2026 전문의 직접·관련 문맥을 대조한 범위는 근거 장부에 기록했다.

자동 source packet은 네 세트 모두 연쇄 문단 참조가 unresolved다. [조사 결과](evidence/phase1/packet-context-investigation.json)와 [수동 문맥 검토](evidence/phase1/manual-context-review.json)를 보존했다. 현재 수동제작 계약의 계획·등록공식 source_refs로 검수하며, 조사 파일을 완전한 생성 packet으로 표시하거나 검수 CLI에 넘기지 않는다.

정적 확인 명령: 'node --import tsx cpa_uploader/drafts/delegated-authoring-2026-09-11/n02/audit-phase1.ts'. 최종 모델 검수는 총괄이 고정한 비교 은행과 새 실행 폴더를 받은 뒤 수행한다.
