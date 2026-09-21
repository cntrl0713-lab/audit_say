# 운영 반영 단계 (사용자 실행) — r20~r27

r20~r27의 정본·공개본 설치, 원 17세트 퇴역, coverage 재연결 12건, wiki 퇴역·재생성을 마쳤다. 남은 것은 운영 DB 증분 반영뿐이다. 자동 모드 분류기가 `db-import/driver.mjs` 실행을 막으므로 **사용자가 터미널에서 직접 실행**한다.

## 범위

- 기준 원문: 운영 active release `77fc4607-af06-45fb-bace-270cfccf3138`의 저장 원문(설치 전 정본, sha256 `3b7d62db…`, 354세트).
- 최종 원문: 현재 정본(346세트·480물음·1,748점).
- 이 릴리스가 올리는 변경: **퇴역 17세트, 추가 9세트**. 추가 9세트에는 r21에서 분리 보존한 기준서형 `pilot-11-005-standards-20260921`이 포함된다(퇴역 없이 추가만 한다).
- 범위는 [plan.json](plan.json)과 같다. 다른 세션이 정본에만 설치해 둔 변경은 없어 릴리스 범위와 정본 설치 범위가 일치한다.

## 앞 회차에서 멈췄던 곳 — 이번에는 고쳐 두었다

r16~r19에서는 `--apply`가 import를 커밋한 뒤 학습 단위 확인에서 멈췄다(`New case unit missing: pilot-07-006-standards-20260920`). 드라이버가 새 세트를 전부 사례형으로 보고 `<세트ID>--case`만 찾았기 때문이다. 그때는 드라이버 바이트가 `preparation.json`의 `code_files`로 이미 고정되어 있어 고치지 못하고 `verify-v1.mjs`로 커밋 이후 단계를 재개했다.

이번 사본은 고정 전에 고쳤다. [driver.mjs](db-import/driver.mjs)는 분류의 `question_style`을 읽어 **사례형은 세트당 한 단위, 기준서형은 물음마다 `<세트ID>--<물음ID>--standard`와 `facts=[]`** 를 확인하고 결과를 `roundtrip.json`의 `new_unit_checks`에 남긴다. `pilot-11-005-standards-20260921`이 이 경로를 탄다. 재개 스크립트는 필요 없다.

## 실행 순서

PowerShell에서 `npm.ps1`이 막히면 아래처럼 `node`를 직접 쓴다. 각 단계는 앞 단계의 기록 해시를 다시 검사하므로 순서를 지킨다.

```bash
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r20-r27/db-import/driver.mjs --prepare
```

```bash
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r20-r27/db-import/driver.mjs --probe
```

```bash
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r20-r27/db-import/driver.mjs --apply --expected-preparation-sha256 <preparation.json의 sha256>
```

- `--prepare`는 네트워크를 쓰지 않는다. 퇴역 manifest·로컬 PGlite 복원 증명·guarded SQL을 만들고 `db-import/preparation-v1/preparation.json`에 기록한다. 그 파일의 SHA-256이 `--apply`의 인자이며 실행 출력에 함께 나온다.
- `--probe`는 운영 DB의 read-only 트랜잭션에서 복원 payload 해시만 대조한다. 쓰기가 없고 한 준비당 한 번만 성공한다.
- `--apply`는 검토한 SQL을 한 번 실행하고 왕복·독립 검증까지 수행한다. **실패해도 다시 실행하지 않는다.** 결과가 불명확하면 아래 `--inspect`로 현재 active release만 읽어 커밋 여부를 확인한다.

```bash
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r20-r27/db-import/driver.mjs --inspect
```

`.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`이 대상 프로젝트여야 하고 `SUPABASE_ACCESS_TOKEN`·`SUPABASE_SERVICE_ROLE_KEY`가 필요하다.

## 실행 뒤 남는 기록

`--apply`가 끝나면 `db-import/publication-v1/`에 receipt·왕복 검증·독립 검증·completion이 생긴다. 그 결과(새 release id, 건수)를 [검토 장부](../README.md)의 "운영 DB 반영" 행, [수정 요청서](../../../../../docs/case-question-edit-notes-2026-09-14.md)의 반영 현황, [설계서](../../../../../docs/사례형-병합-종합문제-설계.md) 3절에 옮겨 적는다.

## 커밋 전에 할 일

- 이번 회차의 runtime snapshot도 `lib/questionV3Grading.ts`(mixed)·`lib/questionV3Evidence.ts`(CRLF) 바이트를 그대로 복사한다. 실행 디렉터리 9개(`r20/execution-v1`, `r21/execution-v1`, `r21/execution-standards-v1`, `r22`~`r27/execution-v1`)마다 `.gitattributes`에 두 줄(`-text`, `text eol=crlf`)이 필요하다. **규칙이 들어간 뒤에 `git add`** 해야 verbatim으로 저장된다.
- `data/cpa_question_sets_v3.authoring.enc.json`은 저장소 루트에 있어 `cpa_uploader/data`로 담을 때 빠지기 쉽다. r16~r19 커밋(`d3e5bc04`)이 실제로 이 파일을 빠뜨렸으므로 이번 커밋에 반드시 포함한다.
- pre-commit 전체 테스트가 실제 정본·장부 파일이 바뀌지 않는지 감시하므로, 승급·설치가 도는 동안에는 커밋하지 않는다.
