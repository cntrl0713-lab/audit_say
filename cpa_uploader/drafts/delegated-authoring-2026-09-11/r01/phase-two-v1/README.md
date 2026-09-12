# R01·N04·N05·S03 실제 검증 1차 실행 기록

대상은 총괄이 고정한 16세트와 작성자 QA 746사례다. final-153-v1의 문항·계획·QA·153세트 비교은행과 공통 runtime-lock을 사용했다. 현재 이 기록은 **공통 프롬프트 보완 전 중간 상태**이며 전체 검증 완료를 뜻하지 않는다. 문항·배점·모델·공식 원문은 이 실행에서 수정하지 않았다.

T04-A의 [실제 의미검수](t04-a/semantic.json)는 6단위 pass이며 20개 생성사례를 포함한다. 생성사례 실제 채점은 아직 하지 않았다. T09-A는 q1 이후 criterion 요청에서 전송 오류가 두 번 발생하여 [원시 로그](t09-a/semantic.json.chunks.jsonl)만 남고 전체 receipt는 생성되지 않았다. 총괄의 별도 HTTP 진단 성공은 과거 전송 오류의 원인 확정이나 전체 검수 완료와 구별한다.

T09-A q1의 초기 조건 검수 fail은 [공식 원문 대조](t09-a/content-investigation.md)에서 현재 지문·발문의 추가 절차 범위를 다시 읽었다. 총괄 지시에 따른 동일 단위 두 번의 추가 호출은 둘 다 pass였으며 [총3회 기록](t09-a/q1-reproduction-summary.json)은 fail/pass/pass를 그대로 남긴다. 입력·스키마·모델은 같으며 원래 판정을 덮어쓰지 않았다.

작성자 QA는 한 세트씩 실행하여 다음 범위를 마쳤다.

| 계획 | 고유 사례 | 실제 grader 실행 | 비빈답안 실행 | 무모델 빈답안 실행 | 불일치 사례 |
|---|---:|---:|---:|---:|---|
| T04-A | 22 | 24 | 22 | 2 | q1/irrelevant-prefix |
| T09-A | 24 | 26 | 23 | 3 | q1/opposite |
| T09-B | 26 | 30 | 28 | 2 | q1/condition-boundary, q2/irrelevant-prefix |
| T10-A | 26 | 28 | 26 | 2 | q2/irrelevant-prefix |
| 합계 | 98 | 108 | 99 | 9 | 5개, 각각 총3회 관측 |

빈답안 수는 kind 이름이 아니라 실제 transport를 기준으로 집계했다. T09-A의 단일 criterion 누락 입력도 빈 문자열이어서 무모델 실행에 포함된다. 위 비빈답안 수는 production grader 호출 단위이며 각 원시 trace를 보존했다. [중지 시점 장부](pause-before-prompt-update.json)에 세트별 실제 수와 입력 변경 0을 기록했다.

불일치 원인은 [T04-A 보안 플래그](t04-a/security-flag-investigation.md), [T09-A 명시적 반대 분류](t09-a/author-qa-investigation.md), [T09-B 부분점수·보안 플래그](t09-b/author-qa-investigation.md), [T10-A 보안 플래그](t10-a/security-flag-investigation.md)로 나누어 조사했다. 정상 명제 인용·합산은 유지되지만 무관한 문장에 대한 보안 분류와 명시적 반대/누락 분류가 변동했다. T09-B의 방식 설명 점수는 0/1/1로 변동했다. 마지막 성공만으로 앞선 실패를 없애지 않았다.

총괄이 공통 지시를 수정하기 전에 현재 T10-A까지 마치고 호출을 중지하라고 요청했다. 다음 T12-A의 `author1/author-input-lock.json`은 실행 입력 파일이 아닌 **명시적 pause sentinel**이다. 이 파일의 쓰기 보호에서 launcher가 멈춰 T12-A의 CLI·API는 시작되지 않았다. [queue 로그](author-queue-author1.json)의 EEXIST는 이 의도적 중지이며 provider 실패가 아니다. 재개 시 새 출력 경로를 사용하고 이 기록을 보존한다.

남은 작성자 QA는 648사례이며, 이미 실행한 불일치와 공통 프롬프트 변화의 영향 범위도 새 버전으로 확인해야 한다. 나머지 의미검수·생성사례 채점·문항 수정 필요성 검토는 총괄이 전달하는 다음 고정 버전과 재개 지시를 따른다. 실제 사람 승인·정본 반영·게시·배포는 하지 않는다.
