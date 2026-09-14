# 사례형 3개 추가 제작·검증·운영 반영

[문제·모범답안·부분점수](../../../drafts/case-trio-2026-09-14/questions-and-answers.md) · [최종 보고](../../../../docs/reports/case-trio-2026-09-14.md)

3개 사례·9물음·20점의 실제 내용을 agent가 전수 대조하고 독립 교차검토했다. Luna의 대표 모범9·부분9·오답9, 총27답안이 기대점수와 정확히 일치했다. 실제 SDK9호출이며 이 비율은 고정된 대표 입력의 실측이다.

- 수동 입력: [사용자 범위](authorization.md), [원문·답안·배점 직접 검토](root-content-review.json), root-review-notes-a/b/c, [원발문 관계 판정](coverage-root-review.json).
- 출처: [원문 보존계획](source-evidence-plan.json), source-inventory-v2, source-peer-review 및 개별 설계/교차검토. 첫 재수집 거부는 [이력](source-collection-attempt-v1.json)에 보존했다. 이미 raw에 있는 A의 시각대조 자료는 재수집하지 않고 원래 render-provenance와 plan에 결속했다.
- C 사전 정정: c-correction 및 c-source-range-correction, 기존 스냅샷을 보존했다. 새 가상 사실의 source_fidelity 형상과 인용 완결 범위·명시 source unit 연결을 실제 채점 전에 수정했다.
- 실제 채점: [고정 입력](execution-v1/grading-manifest.json), actual-a/b/c 원응답·사용량·요청 식별자, [봉인·결과](sealed-v1/summary.json), [게시 준비 판정](sealed-v1/readiness.json). 원 오답의 not_met 예상과 실제 contradicted 차이는 모두0점이며 [상태 구분 검토](grading-state-review.json)에 따로 남겼다. 입력·원응답·기대점수는 변경하지 않았다.
- 정본 반영: [격리 검증](publication-v1/stage-completion.json), [설치 확인](publication-v1/install-completion.json). 기존369개 객체와 과거 승급 장부를 보존했다.
- 운영 DB: [검증 완료](db-publication-v1/completion.json), 릴리스 a4fb1719-b3fa-43bb-975f-5e1c481e67bd. source 원문·공개·비공개·분류·주제를 독립 조회했고 함수·권한·영구 DB 설정을 바꾸지 않았다.
- DB 도구: [입력·실행 경계](incremental-db-publication-v1/README.md), 독립 정적검토 및10개 로컬 복원/트랜잭션 검사. 실제 운영 성공은 db-publication-v1에만 기록한다.
- 관계: [새 대표3개 연결](coverage-update.json). 기존 빈도 입력과 이전 관계를 보존했다. 출처ID 별칭 대응은 [후속 도구 검토](coverage-successor-peer-review.json)에 결속했다.
- 재현: [실행 순서](helpers/README.md). source 수집은 collect-source-evidence-v2, coverage 준비는 prepare-coverage-v2를 사용한다. 모델·게시를 재실행하면 유료 호출/외부변경이 생기므로 기존 결과 폴더를 덮어쓰지 않는다.
- 최종 검사: [분석·보존·wiki5개 검사](final-checks-v2/summary.json). 이 검사는 문항 의미검수나 실제 채점의 대체가 아니다.

모든 수치는 이번 완료 시점의 기록이며 사람의 직접 내용 확인, 모든 가능한 답안의 채점 보장 또는 통계적 신뢰수준을 의미하지 않는다.

최초 분석 갱신의 Windows 파일 열기 오류는 원본 해시와 쓰기 없는 열기 검사를 확인한 뒤 새 실행에서 해결했다. [첫 실패](final-checks-v1/summary.json)와 [후속 확인](analysis-file-open-followup.json)을 보존하며 최종 통과는 final-checks-v2다.
