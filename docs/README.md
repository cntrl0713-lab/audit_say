# 문서와 작업 기록

`docs`는 사람이 읽는 설계 결정, 계획, 검토 보고서와 실행 이력을 보관한다. 현재 문제은행·요구사항·검수 상태를 찾을 때는 [출제·검토 현황](../cpa_uploader/wiki/_meta/authoring-dashboard.md)에서 시작한다.

## 어디에 기록할지

| 필요한 자료 | 위치 |
| --- | --- |
| 문서·데이터 소유권과 갱신 방법 | [자료 관리 원칙](출제-검토-자료-관리.md) |
| 현재 출제·검토 현황과 연결 자료 | [wiki 현황](../cpa_uploader/wiki/_meta/authoring-dashboard.md) · [연결 분석](../cpa_uploader/analysis/coverage/README.md) |
| 계획·정책 결정과 변경 이유 | [plans](plans/) 및 해당 설계 문서 |
| 날짜별 검토 결과·제작 이유·당시의 판단 | [reports](reports/) |
| 추출·보정·빈도·검수의 기계 판독 자료 | [analysis 안내](../cpa_uploader/analysis/README.md) |
| 개별 제작 배치의 문제·계획·출처 패킷·검수 증거 | [drafts](../cpa_uploader/drafts/) |

## 읽고 수정할 때

물음별 학습 구조: [기준서형·사례형 및 주제·DB·제출 계약](물음별-학습-단위와-분류-계약.md) · [2026-09-11 개편·이관 기록](reports/물음별-유형-주제와-독립-풀이-개편.md).

최근 채점 검토: [추가 개선·스킬 반영·공통 코드 확정](reports/채점-검수-추가-개선과-공통-코드-확정-2026-09-11.md) · [ID 제한 보고서의 후속 검토·수정](reports/채점기-ID-제한-보고서와-관련-변경의-후속-검토-2026-09-11.md).

이전 제작 자료(보관): [요구사항별 기출빈도 기반 보완 문제·모범답안](archive/과거-검토-증거/reports/question-authoring-frequency-priority-2026-09-10/README.md).

과거 검토 증거: [보관 문서 목록](archive/과거-검토-증거/README.md). 기계 판독 증거와 원 응답은 [analysis/reviews](../cpa_uploader/analysis/reviews/) 및 [drafts](../cpa_uploader/drafts/)에 보존한다.

다음 제작 계획: [19개 주제별 문제·물음 선정과 상세 계획](plans/question-authoring-by-topic-2026-09-11/README.md). wiki·구체 요구 빈도·현재 은행·별도 초안을 대조한 2026-09-11의 계획이며, 실제 출제·검수 완료와 구분한다.

작업 분담: [서브에이전트용 14개 배정서와 병렬 실행 순서](plans/question-authoring-by-topic-2026-09-11/assignments/README.md). 담당 범위·선행 자료·출력 폴더·완료 조건과 전달용 지시문을 제공한다.

- 날짜별 보고서의 수치·미해결 사항·문항 상태는 그 실행 당시의 기록이다. 현재 상태는 현행 데이터와 연결 분석의 입력 해시를 확인한다.
- 과거 보고서의 결론을 최신값으로 덮어쓰지 않는다. 후속 수정은 새 기록으로 남기고 이전 기록에서 후속 결과를 연결한다.
- 생성된 문서의 수치는 입력과 생성기를 수정한 뒤 재생성한다. Markdown이라는 이유로 분석용 생성 표를 모두 `docs`로 옮기지 않는다.
- 파일 이동은 참조 경로와 생성·검증 명령을 함께 고친다. 원자료·문항 ID와 과거 실행 증거는 위치 정리를 위해 바꾸지 않는다.
