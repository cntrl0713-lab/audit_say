# F1–F3 문구 수정·재채점·정본·운영 반영 — 2026-09-14

[전수 검증](../README.md)에서 찾은 F1–F3을 [사용자 승인](authorization.md)에 따라 고쳤다. 10물음을 다시 채점한 뒤 정본과 운영 DB·앱에 반영했다. 정답 명제, 모범답안, criterion 구성·배점, 주제, 기준서형 분류는 바꾸지 않았다. 경계 사례 B1·B2와 범위 밖 KGA 약칭 21개는 이번 범위에 들어 있지 않다.

## 바꾼 것

[changes.json](changes.json)에 수정 전후 원문과 내용 해시가 있다.

| 발견 | 물음 | 변경 |
| --- | --- | --- |
| F1 | `std-points-20260914-2089042a4b32/sub3` crit2 | "정관 위반이 동시에 부정행위·중대한 법령위반이면 보고 대상일 수 있다"를 "그런 부연은 요구하지 않으며 덧붙여도 감점하지 않는다"는 안내로 바꿈 |
| F2 | `10e28726886d/sub2` crit1, `97a86c8d6e2f/sub2` crit5·crit8 | 기준 명제와 채점 안내 사이에 마침표 삽입 |
| F3 | `d22c23444c4b`, `6e9dfa933285`, `f47d4eaf7a09`, `7e1091f2c13f`, `c9c523cdf8c0`, `e0f4e9e0403a`, `3e3ab8d53e62` | 발문·세트 제목·학습 분류의 독립 발문에서 `KGA NNN 문단N`을 `감사기준서 NNN 문단 N`으로 바꿈 |

세트마다 `verification.notes`에 수정 이유를 한 줄씩 덧붙였다.

## 실제 채점

현재 채점 모델 Luna(gpt-5.6-luna)로 10물음의 모범·부분·오답 30건을 새로 채점했다. 답안과 기대값은 재편 실측(standard-points-implementation execution-v1/v4)의 원답안을 그대로 썼다. 실행기는 같은 작업의 `run-efficient-grading.ts`이고 운영 채점 함수를 거친다. 실행 파일과 코드 보존본은 [grading-manifest.json](grading-manifest.json)과 runtime/에 있다.

- 30건 모두 점수가 기대값과 같다(±1점 편차 0건). F1 모범답안은 수정 전 3/4였고 이제 4/4다.
- 오답 10건은 모두 0점이다. 다만 Luna가 not_met 대신 contradicted로 판정해 strict 일치는 20건이다.
- 호출 30회, 입력 82,359토큰(캐시 0), 출력 8,145토큰(추론 1,512 포함). 요청·응답 ID는 [acceptance-completion.json](acceptance-completion.json)에 있다. 실행기의 고정 단가로 계산한 금액은 약 $0.0304이며 청구서 금액이 아니다. 사용자 금액 상한은 없었다.
- 담당 agent의 수정본 재대조와 이 30건을 [batch.json](batch.json)으로 묶어 비용 통제 수락 검증을 통과했다. 사람의 직접 검수는 아니다.

## 정본·운영 반영

| 단계 | 결과 |
| --- | --- |
| 격리 stage ([publish.mjs](publish.mjs) `--stage`) | 10세트 재검수(published→verified)·재게시(verified→published), 승급 장부 +20건, 공개본·암호화본·분류 카탈로그 생성, 전체 검증, DB 준비 검사 통과 |
| 정본 설치 (`--install`) | 정본 5개 파일 원자적 기록, 카탈로그 `--check`와 `validate_cpa_v3` 통과. 372세트·555물음·1,889점 |
| 운영 DB ([db-incremental-v1](db-incremental-v1/)) | 활성 릴리스 `a4fb1719…`에 저장된 원문을 보존하고 10세트 텍스트만 제자리 교체(전송 약 342KB). 로컬 PGlite 복원 증명과 읽기 전용 운영 대조를 거쳐 적용했다. 새 릴리스 `3c521583-7698-4ac7-b247-0d53ae9223ac` |
| 운영 독립 검증 | 기존 검증기 `--read-live` 통과: 372세트·555물음(기준서형 372·사례형 183)·학습 단위 442·1,889점, 원격 쓰기 조회 0 |
| 운영 앱 ([app-verification.json](app-verification.json)) | `/curriculum`·`/quiz`에서 10개 학습 ID와 새 발문 표기 7개가 보이고 옛 `KGA` 발문은 없다. 정답 필드는 노출되지 않는다 |
| coverage ([update-coverage.mjs](update-coverage.mjs)) | 바뀐 3물음을 가리키는 관계 6건을 다시 대조하고 이력·확인 해시를 남겼다. 모두 current/reviewed이고 관계·criterion 대상은 그대로다 |
| 분석·wiki | `analysis:build/check`, `wiki:build/check` 통과 |

운영 DB 경로는 case-trio 추가 게시 도구(`append-contract`)의 교체판이다. 교체된 10세트는 같은 위치에 새 판본을 받아야 하고, 나머지 세트의 판본·위치·분류와 주제는 그대로여야 한다. 이 조건을 트랜잭션 안에서 확인하며, 하나라도 어긋나면 롤백한다. 첫 준비본(preparation-v1)의 운영 대조는 읽기 전용 API가 역할 전환을 거부해 실행되지 않았다([probe-failure.json](db-incremental-v1/preparation-v1/probe-failure.json)). preparation-v2에서는 API와 SQL을 모두 읽기 전용으로 두고 역할 전환 없이 대조했다. 쓰기 가능 연결로 대조를 우회하지 않았다.

## 검사와 미검증

- 새 스크립트 eslint: 오류 0, 사용하지 않는 변수 경고 3(이미 실행한 일회성 스크립트라 그대로 둠).
- 코드·채점 로직은 바꾸지 않아 전체 테스트는 실행하지 않았다.
- 브라우저 조작과 로그인 사용자 답안 제출은 하지 않았다. 채점은 운영 채점 함수로 앱 투영을 직접 채점한 결과다.
- 커밋하지 않았다.
