# v2 작성자 QA 실행 중 공통 코드 변경 감지

T04-A는 v2에서 고유 22사례를 모두 일치 판정했고, 이전 q1/irrelevant-prefix를 두 번 더 실행하여 v2 총3회 모두 정상 2점·security_flag none을 확인했다. 각 실행 파일은 t04-a/author2 및 author2-recheck 경로에 보존한다.

T09-A는 24사례의 기대 판정·점수가 모두 일치했지만, 2026-09-11T01:53:36Z 종료 시점 검사에서 공통 코드의 변경을 감지했다. [grader 결과](t09-a/author2/author-qa/summary.json)는 `lib/ai/openaiStructured.ts`를, [전체 입력 검사](t09-a/author2/author-stage-result.json)는 이 파일과 `questionSemanticReview.ts`, `questionReviewGrading.ts`를 변경 대상으로 기록했다.

다음 T09-B 호출과 T09-A의 이전 불일치 추가2회는 시작하지 않았다. 호출 프로세스는 모두 종료했다. T09-A의 판정 일치 기록을 변경 후 고정 환경의 검증 완료로 표시하지 않는다. 원시 판단·trace·당시 입력 해시·변경 검사 결과를 그대로 보존하고 총괄이 새 실행 잠금과 재사용·재실행 범위를 확정한 뒤 재개한다. 문항·작성자 QA·배점·모델을 이 담당 작업에서 변경하지 않았다.
