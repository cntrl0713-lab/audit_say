# 추가 사례 3개 제작·검증·운영 반영

[문제지](../../../drafts/case-trio-next-2026-09-14/review-preview.md) · [최종 보고](../../../../docs/reports/case-trio-next-2026-09-14.md)

3사례·9물음·20점을 작성하여 발문·사실·정답·배점·출처를 agent가 전수 대조하고 독립 교차검토했다. 실제 Luna 채점 결과는 [봉인 요약](sealed-v1/summary.json)의 고정된 대표 답안 집합을 기준으로 한다.

- 사용자 범위: [authorization.md](authorization.md). 기존 정본 372세트·555물음을 기준으로 추가하며 이전 문항·승급·실측을 보존한다.
- 내용: [root 검토](root-content-review.json), root-review-notes-a/b/c 및 작성자별 독립 교차검토.
- 출처: [보존 계획](source-evidence-plan.json), [raw 수집](../../../raw/collections/2026-09-14-case-trio-next/index.md), [원문 대조](../../../drafts/case-trio-next-2026-09-14/source-peer-review.json). 같은 날 이미 확보한 공식 목록은 재사용 사실을 표시한다.
- 실제 채점: [고정 입력](execution-v1/grading-manifest.json), actual-a/b/c의 원응답·요청식별자·사용량, [결과](sealed-v1/summary.json), [게시 준비](sealed-v1/readiness.json). 기대값과 실제 점수 및 상태 차이를 구별한다.
- 정본·공개본: [격리 검증](publication-v2/stage-completion.json), [설치 완료](publication-v2/install-completion.json).
- 운영 DB: [완료](db-publication-v1/completion.json), 릴리스 ea9b598d-2e27-4019-98ea-790a210078fe. 전체 공개·비공개 내용, 원문·분류·주제를 독립 조회하였다.
- 도구: [최초 실행 절차(보존본)](helpers/README.md), [현재 DB 적용 경계](incremental-db-publication-v2/README-successor.md), [현재 게시 도구](publish-reconciled-v2.mjs), [현재 보고서 생성 도구](final-report-v2.mjs), [현재 최종 문서 검사 도구](final-artifact-check-v2.mjs). 정적·로컬 DB 검사는 운영 실행과 구별한다.
- 관계: [추가 연결](coverage-update.json), [root 관계 판정](coverage-root-review.json). 기존 빈도 입력과 관계를 유지한다.
- 최종 검사: [분석·보존·wiki 검사](final-checks-v1/summary.json). 실패 시 새 실행버전과 성공 경로를 후속 기록에 남긴다.

실측 통과율은 대표 답안의 관측 결과이며 모든 가능한 답안이나 통계적 신뢰수준에 관한 주장이 아니다. 모델 상향과 별도 유료 API 의미검수는 수행하지 않았다.

[첫 통합 기준 검토](integration-baseline-root-review.json)는 제작 중 다른 작업이 완료한 기준서형 10세트 수정과 당시 운영 릴리스를 대조했다. 이 첫 단계의 수정과 검토 기록을 보존했다.

[후속 통합 기준 검토](integration-baseline-v2-root-review.json)는 그 뒤 별도 작업이 완료한 기준서형 21세트의 약칭·문단 표기 수정과 운영 릴리스를 추가로 대조했다. [새 게시 기준](integration-baseline-v2.json)은 두 단계의 수정을 모두 포함한 기존 372세트를 보존하며, 이번 사례 3개만 추가한다. 두 숫자는 서로 다른 수정 단계의 대상 수이며 합산한 고유 세트 수를 뜻하지 않는다.

[새 게시 조정 장부](publication-reconciliation-v2.json)는 원 publication-v1에서 성공한 새 사례의 검증·게시 전이와 최종 문항 객체를 최신 기준에 연결한다. 원 publication-v1은 검증·게시·컴파일·분류 생성까지 완료한 뒤 정본 동시 변경 감지(CAS)로 중단되었다. [이전 게시 중단 기록](publication-v1/stage-interruption.json)에 전체 stage 미완료와 정본·DB·모델 호출 0을 별도로 보존했으며, 성공으로 덮어쓰지 않았다. 원 준비·로그·승급 기록, 시작 시점 스냅샷과 과거 검토·실측은 변경하지 않았다.

[오답 상태 차이 검토](verdict-state-review.json): 대표 오답 9개의 점수는 모두 기대 0점과 일치한다. generic 기대값의 not_met와 실제 응답의 contradicted 차이는 명시적인 반대 서술에 대한 상태 분류 차이로 확인했다. 원 기대값을 변경하거나 재채점하지 않았다.
