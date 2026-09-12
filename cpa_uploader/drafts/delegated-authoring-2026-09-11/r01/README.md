# R01 후속 초안 — 1차 준비 완료

**기존 6세트·12물음·37점, 작성자 QA 143사례를 준비했다.** 정적 검사 오류 0건이며 최종 모델 의미검수·실제 채점은 아직 실행하지 않았다. 문항은 needs_review / needs_human_review 상태다. 49세트 총괄 장부 중 T04-A, T09-A/B, T10-A, T12-A/B에만 해당한다.

| 계획 | 후속 문항 | 실제 물음·배점 | QA 사례 | 상태 |
|---|---|---|---:|---|
| T04-A | [draft-04-320-freq01](draft-04-320-freq01.json) | q1: 2점 / q2: 2점 | 20 | draft_ready / 모델 미실행 |
| T09-A | [draft-09-501-freq01](draft-09-501-freq01.json) | q1: 1점 / q2: 4점 | 21 | draft_ready / 모델 미실행 |
| T09-B | [draft-09-505-freq01](draft-09-505-freq01.json) | q1: 3점 / q2: 2점 | 24 | draft_ready / 모델 미실행 |
| T10-A | [draft-10-530-freq01](draft-10-530-freq01.json) | q1: 4점 / q2: 4점 | 24 | draft_ready / 모델 미실행 |
| T12-A | [draft-12-560-freq01](draft-12-560-freq01.json) | q1: 2점 / q2: 5점 | 26 | draft_ready / 모델 미실행 |
| T12-B | [draft-12-570-freq01](draft-12-570-freq01.json) | q1: 5점 / q2: 3점 | 28 | draft_ready / 모델 미실행 |

[인계서](handoff.md) · [원문·명제 조사](scope-and-sources.md) · [ID·파일·해시 대응](lineage.json) · [정적 검사](static-check.json) · [원본 패치 제안](patch-proposal.json) · [QA 기대값 정정](expected-value-changes.json)

후속 원본은 content-followup.mjs이며 build-followup.mjs가 제안본·계획·QA를 재현한다. 기존 frequency-priority 원본·content/build·과거 로그/receipt는 보존했다. 전용 폴더 밖에는 쓰지 않았으며 정본·게시·배포를 하지 않았다. 총괄이 등록한 공용 공식 파일은 읽어 연결했다.

계획은 2027년 CPA 시험 대비, 2026-01-01 개시 보고기간과 2027년 후속 업무를 기준으로 한다. 공식 2025/2026 다운로드 일치·직접 16문단 대조와 두 판본의 시행일은 sources/에 보존했다. 수동 근거 패킷은 자동 source-packet sidecar가 아니므로 검수 CLI의 --packet 인자로 사용하지 않는다.

검사 재현: node --env-file=.env.local --import tsx cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/verify-followup.ts

이 명령은 모델을 호출하지 않는다. 최종 비교은행이 고정된 후 총괄의 검수 실행 설정으로 2차를 시작한다.

작성자 QA의 후속 보완과 현재 해시는 [총괄 QA 후속 기록](qa-followup-root.md)을 함께 읽는다. 이전 인계의 수치·해시는 당시 기록으로 보존한다.
