# Terra A 전체 QA 비교 진단

gpt-5.6-terra로 pilot-01-002의 선택 QA 35개를 production run-author-qa.ts 경로에서 모두 실행했다. runtimev7의 코드16개·원문·QA·출처를 유지했고 모델만 이 독립 진단에서 변경했다. Luna인 v9 전수 manifest를 고치지 않았다.

- 35/35 고유 사례, 35관측 모두 기대 일치. 실제 모델 응답33개, 빈 답안2개(모델 미호출).
- 자동 추가관측0, 전송/응답 trace 오류0, 실행 오류0, 원시·최종 보안 오탐0.
- 요청·스키마 해시 전수 일치, 실제 raw의 로컬 재합산 일치. 정확 verdict 차이 0개.
- 원답안과 기대표는 그대로 보존했다. 신규 반례의 crit7은 not_met, 전체0점으로 일치했다.
- 실행 구간: 2026-09-11T23:17:17.577Z ~ 2026-09-11T23:19:33.208Z. 이후 새 API 호출 없음.
- 착수/종료의 고정 입력 23개가 같다. 결과 검증기 lint 통과.

로컬 검증기의 빈 답안 점수 필드명을 실제 awarded_points로 정정한 이력은 verification-local-followup.json에 남겼다. 원 실행·학생 판정·기대값 수정이나 API 재호출은 없었다.

이 결과는 해당 35개 QA에서 Terra의 동작을 확인한 비교 진단이다. 의미검수, 전수 문항의 모델 선택 확정, 사람 확인, 정본 승급 또는 DB 반영을 뜻하지 않는다.

[실제 결과](terra-full-result.json) · [착수 입력](terra-full-invocation.json) · [로컬 검증기 후속](verification-local-followup.json)
