# 기준서형 배점 검토의 정본·공개본·운영 반영

[결과 보고서](../../../../docs/reports/standard-points-implementation-2026-09-14.md) · [최종 결과](completion.json)

## 수동 입력

- 사용자 승인: authorization.md, baseline.json
- 물음별 재편 명세: plan-01-05.json, plan-06-10.json, plan-11-14.json, plan-15-19.json
- 독립 검토: qa-*.json 및 후속 resolution, source-evidence-11-14.json
- 추가 잔존 검수: subset-regrade-representatives.json, subset-additional-representatives.json
- 실측 오류의 후속 명료화: targeted-clarification.json, residual-findings-v1.json
- 관계 재연결: coverage-final-candidate.json 및 update-coverage.mjs의 수동 매핑

## 생성 결과와 실행

- candidate-v1: 최초 통합. candidate-v2: 한 물음의 전제·scope 명료화. candidate-v3: 동시 추가된 사례 6세트 보존 통합.
- execution-v1/ sealed-v1/: 192물음·576답안. execution-v2/ sealed-v2/: 잔존 1물음·3답안. execution-v3/ sealed-v3/: 명료화 1물음·3답안. 각 원 manifest·응답·사용량·판정은 해당 버전으로 보존한다.
- subset-batch-v1/: 51개 사전검사 중 50개 통과·1개 새 실측 필요. subset-batch-v2/: 통과 50개. 이후 성능 검증은 후속 evidence로 구별한다.
- publication-v1/: 게시 전 상태 점검 인자 오류로 격리 stage 실패. 정본·DB 쓰기 0. 당시 코드·로그 보존. publication-v3/: 수정 후 엄격 검증·설치.
- concurrent-additions-v1/: 작업 중 추가된 사례와 당시 원릴리스의 읽기 전용 보존본.
- db-publication-v5/: 승인 퇴역·원릴리스 결속과 운영 DB 적용·독립 검증.
- code-checks/: 타입·테스트 결과. 중단되거나 외부 병렬 변경에 영향을 받은 실행은 별도 evidence로 보존하며 통과로 표시하지 않는다.

## 재현 범위

정적 후보 생성기는 저장 수동 입력과 해당 버전 원본을 사용한다. publish/deploy는 현재 파일·입력·기대 원릴리스 가드가 있는 실제 변경 도구이며 이전 실행 폴더를 덮어쓰지 않는다. 과거 API 응답을 새 호출로 재현했다고 기록하지 않는다. 키와 계정 자격증명은 장부에 저장하지 않는다.

## 후속 수락·운영 검증

- publication-v2/: 검수 코드 변경을 엄격한 새 수락이 거절하여 쓰기 전에 중단했다. failure-analysis.json과 당시 runtime을 보존한다.
- execution-v4/5/6 및 sealed-v4/5/6/: 원 v1/2/3 관측을 새 수락 코드로 재처리했다. 추가 API 0회이며 원 manifest·답안·기대값·사용량은 원 실행에 남는다. reuse-acceptance-completion.json과 publication-review-routing-v2.json에 연결한다.
- evidence-archive-followup*.json: 당시 실행에 봉인된 수집 기록과 동일 SHA의 보조 분석 보존본 해석, 원 6개 receipt·54답안 동일성과 후속 회귀 62개·타입 검사.
- retirement-history-verification-v1/after.json: 55세트의 정확한 비활성화와 기존 12개 테이블 역사행 보존.
- db-grading-scope-postdeployment.json: 실제 운영 19세트·44개 scope의 비공개 RPC→학습 투영→채점 입력 전달.
- final-checks-v1/: coverage 적용·분석 생성/검사·과거자료 보존 통과와 첫 wiki 실패. final-checks-v2/: 퇴역 페이지 보존·생성 목차 보완 후 최종 wiki 검사.

## 운영 DB 전송과 후속 실행

- db-publication-v1/: 은행 전체 검증은 통과했으나 PostgREST 트랜잭션 시간 제한으로 등록이 취소됐다. 원 응답과 실패를 보존했다.
- db-publication-v2/: Management API 요청 크기 제한으로 HTTP 413이 발생했다. db-publication-v3/4는 크기를 줄이는 읽기 전용 사전검사에서 같은 제한을 확인했으며 등록을 실행하지 않았다. 실패 후 기존 활성 릴리스와 역사행이 그대로임을 확인했다.
- pgp-transport-probe-v2/와 db-publication-v5/: 원 payload를 압축 전송하고 기존 DB 함수로 복원했다. 공개 상수를 사용하는 전송 용기이며 비밀 보호 수단으로 취급하지 않는다. 원 바이트 SHA와 PostgreSQL JSONB SHA, 정본 원문 SHA가 일치하는 경우에만 기존 퇴역 승인 RPC를 실행했다. service_role과 120초 제한은 해당 트랜잭션에만 적용했으며 기본 설정과 권한은 그대로다.
- v5의 원 응답·receipt·roundtrip과 독립 verification/completion을 함께 보존한다. 기존 승인 55세트와 원릴리스 비교 조건을 유지했으며 실제 등록은 한 번 성공했다.
