# 범위 밖 KGA 약칭 21개 수정·재채점·정본·운영 반영 — 2026-09-14

[fix-v1](../fix-v1/README.md) 뒤 정본에 남은 발문 21개의 `KGA NNN` 약칭을 [사용자 승인](authorization.md)에 따라 고쳤다. 21물음을 다시 채점한 뒤 정본과 운영 DB·앱에 반영했다. 요구 범위, 정답 명제, criterion 구성·배점, 주제, 기준서형 분류는 바꾸지 않았다. 이제 정본의 발문·세트 제목·모범답안·채점기준에는 `KGA` 약칭이 없다. 출처 라벨(`source_refs[].page`의 `KGA NNN`)은 게시 계약의 분류 키라서 그대로 두었다.

## 바꾼 것

[changes.json](changes.json)에 21세트, 52개 필드의 수정 전후 원문과 내용 해시가 있다.

- 발문 21개와, 발문과 같은 세트 제목 19개: `KGA NNN 문단N` → `감사기준서 NNN 문단 N`. 감사기준서 1200은 첫 언급에 공식 제목을 붙여 `감사기준서 1200(소규모기업 재무제표에 대한 감사)`로 썼다. 기존 `소규모기업감사기준서 KGA 1200`도 이 표기로 바꿨다.
- pilot-18-001·pilot-18-003: 발문만 바꾸면 한 물음 안에서 표기가 섞이므로 모범답안 3개, 채점기준 6개, 핵심 사실 3개의 같은 약칭도 바꿨다(예: `KGA 200부터 KGA 720까지` → `감사기준서 200부터 720까지`).
- 학습 분류의 독립 발문(학습 화면 제목)을 새 발문으로 다시 결속했다. 세트마다 `verification.notes`에 수정 이유를 한 줄 덧붙였다.

## 내용 검토와 실제 채점

담당 agent가 21물음의 수정본 발문·모범답안·채점기준을 연결된 원문 인용과 대조했다. 대조한 원문은 감사기준서 200 A26, 210 문단 19–20, 240 문단 39, 260 문단 16, 265 문단 11(b), 1200 문단 3–7·27–31이다. 물음별 요지는 [accept.mjs](accept.mjs)의 검토 목록과 [batch.json](batch.json)에 있다. 사람의 직접 검수는 아니다.

현재 채점 모델 Luna(gpt-5.6-luna)로 21물음의 모범·부분·오답 63건을 새로 채점했다. 답안과 기대값은 직전 수락 실측의 원답안을 그대로 썼다(20물음은 standard-points-implementation execution-v4, pilot-18-003은 2026-09-12 efficient-verification). 모범답안이 바뀐 두 물음은 새 모범답안으로 채점했다.

- 63건 모두 기대점수와 정확히 일치했다(±1점 편차 0건). 오답 0점 판정 가운데 일부는 not_met 대신 contradicted로 나와 strict 일치는 43건이다.
- 호출 63회, 입력 167,266토큰(캐시 0), 출력 16,890토큰(추론 3,752 포함). 요청·응답 ID는 [acceptance-completion.json](acceptance-completion.json)에 있다. 실행기의 고정 단가로 계산하면 약 $0.0621이며 청구서 금액이 아니다. 사용자 금액 상한은 없었다.

## 정본·운영 반영

| 단계 | 결과 |
| --- | --- |
| 격리 stage ([publish.mjs](publish.mjs) `--stage`) | 21세트 재검수·재게시, 승급 장부 +42건, 공개본·암호화본·분류 카탈로그 생성, 전체 검증, DB 준비 검사 통과 |
| 정본 설치 (`--install`) | 정본 5개 파일 원자적 기록, 카탈로그 `--check`와 `validate_cpa_v3` 통과. 372세트·555물음·1,889점 |
| 운영 DB ([db-incremental-v1](db-incremental-v1/)) | fix-v1과 같은 제자리 교체 방식(전송 약 548KB). 로컬 PGlite 복원 증명과 읽기 전용 운영 대조(API·SQL 모두 read only)를 통과한 뒤 적용했다. 릴리스가 `3c521583…`에서 `80d36a36-cccd-41f4-9cf5-ec5baa73123f`로 바뀌었다 |
| 운영 독립 검증 | `--read-live` 통과: 372세트·555물음(기준서형 372·사례형 183)·학습 단위 442·1,889점, 원격 쓰기 조회 0 |
| 운영 앱 ([app-verification.json](app-verification.json)) | `/curriculum`·`/quiz`에서 21개 학습 ID와 새 발문 표기 21개가 모두 보이고 옛 약칭 발문은 없다 |
| coverage ([update-coverage.mjs](update-coverage.mjs)) | 바뀐 물음을 가리키는 관계 2건(frequency-gap G-1·G-2)을 다시 대조하고 이력·확인 해시를 남겼다. current/reviewed |
| 분석·wiki | `analysis:build/check`, `wiki:build/check` 통과 |

첫 coverage 기록 시도는 `links.json`을 여는 단계에서 Windows 파일 오류(errno -4094)로 실패했다. 이때 관계 장부는 바뀌지 않았다. 원인과 상태는 [coverage-attempt1-failure.json](coverage-attempt1-failure.json)에 적었고, 부분 출력은 `coverage-before.attempt1.json`으로 보존한 뒤 재실행해 성공했다. 첫 `analysis-check.log`의 불일치는 그 실패로 분석을 재생성하기 전 상태를 기록한 것이다. 최종 검사 기록은 `*-v2.log`와 `analysis-build.log`다.

## 동시 작업

같은 시각 case-trio-next-2026-09-14가 같은 정본을 기준으로 게시를 준비하고 있었다. 이 작업의 stage가 먼저 끝나 정본에 먼저 설치했다. 그 작업은 정본·운영 기준이 바뀐 것을 가드로 감지하며, 재통합(publication-v2)을 진행하고 있었다. 이 작업은 다른 작업의 파일을 수정하지 않았다.

## 검사와 미검증

- 새 스크립트 eslint: 오류 0, 경고 1(사용하지 않는 변수).
- 코드·채점 로직은 바꾸지 않아 전체 테스트는 실행하지 않았다.
- 브라우저 조작과 로그인 사용자 답안 제출은 하지 않았다.
- 커밋하지 않았다.
