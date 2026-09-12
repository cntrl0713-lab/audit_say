# C QA22 Terra 모델 비교 진단

`pilot-03-001`의 기존 QA 22개가 모두 첫 관측에서 기대값과 일치했다. 비빈 답안 20개는 `gpt-5.6-terra`로 실제 채점했고, 빈 답안 2개는 production 빈 답안 분기에서 모델 없이 0점을 받았다. 실제 원시 응답은 20개이며 불일치·추가 반복·실행 오류는 없다.

문항은 `a/execution-all-v9/manifest.json`의 후속 6(b) 직접 출처가 포함된 파일을 사용했고, QA22 원답안·기대값·runtime-v7 코드 16개·등록 출처를 그대로 유지했다. Luna로 준비된 기존 전수 manifest는 수정하지 않았다. 이번 Terra 설정은 부모가 별도 승인한 국소 모델 비교이며 정식 의미검수, 전수 모델 품질 검증, 수락 또는 DB 승급이 아니다.

`results.json`은 각 관측의 원시 파일·해시·요청/응답 schema 해시·모델 설정·점수를 연결한다. 답안/기대 보존, 현재 요청 재구성, 원시 근거 ID의 실제 답안 인용 복원, 원시 판정 재합산을 확인했다. 모든 관측의 최종 보안 플래그는 `none`이다. 과거 Luna 실패와 당시 원시 증거를 대체하거나 삭제하지 않는다.

실제 출력은 `cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/grading-model-comparison-v1/c-terra-full/`에 보존했다. 프로세스는 종료했고 새 API 호출은 하지 않는다. 모델별 일반 성능이나 전체 은행의 통과를 이 22개 사례에서 단정하지 않는다.
