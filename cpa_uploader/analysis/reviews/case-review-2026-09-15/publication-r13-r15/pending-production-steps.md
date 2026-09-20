# 운영 반영 단계 (사용자 실행) — 2026-09-20 완료

**완료.** 사용자가 `--prepare`·`--probe`·`--apply`를 직접 실행해 새 active release `3518cda6-b4bd-460f-9428-014b2ed70925`(358세트·514물음·1,803점)가 되었고 왕복·독립 검증을 통과했다. 결과는 [db-import/publication-v1/completion.json](db-import/publication-v1/completion.json)에 있고 장부에도 옮겼다. 아래는 그때 실행한 절차의 기록이다.

원래 배경: r13~r15의 정본·공개본 설치, 원 8세트 퇴역, coverage 재연결, wiki 퇴역·재생성까지 끝난 뒤 운영 DB 반영만 남아 있었고, 자동 모드 분류기가 `db-import/driver.mjs` 실행을 막아 **사용자가 터미널에서 직접 실행**했다.

## 범위

- 기준 원문: 운영 active release `2ed1a151`의 저장 원문(= HEAD 커밋 정본, sha256 `213b18f7…`, 364세트).
- 최종 원문: 현재 정본(358세트·514물음·1,803점).
- 이 릴리스가 올리는 변경: 퇴역 10세트, 추가 4세트. r13~r15의 8세트·3세트에 더해, 다른 세션이 정본에만 설치한 **r12**(`case-10-analytical-procedures-20260920` 추가, `case-10-completion-analytics-20260914`·`pilot-10-007` 퇴역)가 사용자 지시로 함께 올라간다. 범위는 [db-import/release-plan.json](db-import/release-plan.json)에 있다.

## 실행 순서

PowerShell에서 `npm.ps1`이 막히면 아래처럼 `node`를 직접 쓴다. 각 단계는 앞 단계의 기록 해시를 다시 검사하므로 순서를 지킨다.

```bash
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r13-r15/db-import/driver.mjs --prepare
```

```bash
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r13-r15/db-import/driver.mjs --probe
```

```bash
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r13-r15/db-import/driver.mjs --apply --expected-preparation-sha256 <preparation.json의 sha256>
```

- `--prepare`는 네트워크를 쓰지 않는다. 퇴역 manifest·로컬 PGlite 복원 증명·guarded SQL을 만들고 `db-import/preparation-v1/preparation.json`에 기록한다. 이 파일의 SHA-256이 `--apply`의 인자다(`preparation.json` 출력에 함께 나온다).
- `--probe`는 운영 DB의 read-only 트랜잭션에서 복원 payload 해시만 대조한다. 쓰기가 없고 한 준비당 한 번만 성공한다.
- `--apply`는 검토한 SQL을 한 번 실행하고 왕복·독립 검증까지 수행한다. **실패해도 다시 실행하지 않는다.** 결과가 불명확하면 `--inspect`로 현재 active release만 읽어 커밋 여부를 확인한다.

```bash
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r13-r15/db-import/driver.mjs --inspect
```

`.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`이 대상 프로젝트여야 하고 `SUPABASE_ACCESS_TOKEN`·`SUPABASE_SERVICE_ROLE_KEY`가 필요하다.

## 실행 뒤 남는 기록

`--apply`가 끝나면 `db-import/publication-v1/`에 receipt·왕복 검증·독립 검증·completion이 생긴다. 그 결과(새 release id, 건수)를 [검토 장부](../README.md#r13r152026-09-20)의 "운영 DB 반영" 행과 [수정 요청서](../../../../../docs/case-question-edit-notes-2026-09-14.md)의 반영 현황에 옮겨 적는다.

## 함께 처리할 것

- 다른 세션이 남긴 미커밋 작업이 워킹트리에 있다: r12의 정본 설치·coverage·wiki 산출물과 초안·검증 폴더, 그리고 CRLF 정리 세션의 `.gitattributes` 규칙. 커밋할 때 경로를 나누어 정리한다.
- CRLF 정리 세션이 `lib/questionV3Grading.ts`·`lib/questionV3Evidence.ts`를 LF로 정규화할 예정이다. 이 릴리스 도구가 해시로 잠그는 런타임 파일 목록에는 두 파일이 없어 영향이 없지만, 정규화 뒤에 새 승급(신규 수락)을 돌리면 manifest를 다시 떠야 한다.
