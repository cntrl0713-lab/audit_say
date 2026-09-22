# 운영 문제은행 증분 반영 기록

`cpa_uploader/publish_question_release.ts`의 실행마다 `<YYYYMMDD-slug>/` 폴더에 작은 JSON 기록만 남긴다. 적용 SQL과 준비 검사 보고서는 `tmp/question-releases/<run>/`에 두고, 기록에는 해시와 크기만 적는다. 회차마다 복사하던 db-incremental 드라이버를 이 도구가 대신한다.

| 파일 | 단계 | 내용 |
| --- | --- | --- |
| `inspection.json` | inspect(운영 읽기) | active 릴리스 ID·원문 해시·세트 수와 판본 조회 메모 적용률, importer 경로 함수 정의 해시·ACL, 누적 릴리스 수와 저장 원문 크기 |
| `preparation.json` | prepare(로컬) | 기준 원문(커밋 또는 파일)·교체/추가 세트·관련 correction·payload 해시·SQL 해시·PGlite 증명 |
| `probe-result.json` | probe(운영 읽기) | 운영 원문으로 복원한 payload가 로컬 준비와 같은지 |
| `before.json`, `apply-started.json` | apply 직전 | 적용 전 active 릴리스 항목과 점검 결과 |
| `apply-response.json` 또는 `apply-failure.json` | apply(운영 쓰기, 1회) | importer 영수증 또는 실패(결과 불명, 자동 재시도 없음). 같은 transaction에서 새 릴리스의 판본 조회 메모를 채운다 |
| `verification.json`, `completion.json` | verify(운영 읽기) | 공개본·물음 분류 왕복, 바뀐 세트만 새 버전인지, 저장 원문 해시, 판본 조회 메모 적용률(항목 수와 일치) |

```sh
npm run questions:v3:release -- inspect --run <YYYYMMDD-slug> --project <ref>
npm run questions:v3:release -- prepare --run <YYYYMMDD-slug> [--baseline-commit <sha> | --baseline-file <path>] [--transport literal|compressed]
npm run questions:v3:release -- probe --run <YYYYMMDD-slug> --project <ref>
npm run questions:v3:release -- apply --run <YYYYMMDD-slug> --project <ref> --expected-preparation-sha256 <preparation.json의 SHA-256>
npm run questions:v3:release -- verify --run <YYYYMMDD-slug> --project <ref>
```

- 운영 명령(inspect·probe·apply·verify)은 사용자가 터미널에서 직접 실행한다. `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`이 `--project`와 같은 프로젝트여야 하고 `SUPABASE_ACCESS_TOKEN`이 필요하다.
- 교체(같은 위치의 세트 내용 변경)와 끝에 추가만 받는다. 퇴역(삭제)·재정렬은 퇴역 manifest 경로를 쓴다.
- Management API는 요청 본문이 크면 HTTP 413으로 거절한다(2026-09-14 1,820,645바이트 통과, 2026-09-19 3,348,849바이트 거절). `prepare`가 `preparation.json`의 `request_bytes`에 본문 크기를 남기고 통과 확인 크기를 넘으면 알린다. 여러 세트를 바꾼 릴리스는 새 `--run`으로 `--transport compressed`를 쓴다: pack을 pgcrypto OpenPGP 대칭 메시지(zlib, 공개 상수 암호, 기밀성 없음)로 보내고 DB에서 `extensions.pgp_sym_decrypt_bytea`로 풀며, 푼 결과는 평문 전송과 같은 payload 해시 guard를 거친다. 181세트 교체 기준 3.35MB → 약 0.48MB.
- 운영의 읽기 전용 요청은 `supabase_read_only_user`로 실행되어 표는 읽지만 함수 실행 권한이 없다. verify는 service_role 전용 조회 함수(`cpa_get_active_question_bank`, `cpa_get_learning_classifications`)를 read only transaction 안에서 `set local role service_role`로 부른다(쓰기는 DB가 막는다).
- PowerShell에서 `npm.ps1` 실행이 막히면 `npm.cmd run questions:v3:release -- …` 또는 `node --env-file=.env.local --import tsx cpa_uploader/publish_question_release.ts …`로 실행한다.
- 점검 이후 active 릴리스나 함수 정의가 바뀌면 probe·apply가 멈춘다. 적용이 실패하거나 응답이 불명확하면 같은 실행을 다시 적용하지 않고 verify로 상태를 확인한다.
- 한 실행 폴더는 한 번만 쓴다. 다시 반영하려면 새 `--run`으로 inspect부터 시작한다.
- 적용 SQL은 importer 호출 뒤 `reset role`로 세션 사용자(표 소유자)로 돌아가 `cpa_backfill_release_item_source(<새 릴리스>)`를 부르고, 채운 행·메모 행·판본 조각이 모두 항목 수와 같은지 대조한다. 어긋나면 릴리스까지 transaction 전체를 되돌린다. 이 함수도 점검 대상 함수 목록에 있어 정의가 바뀌면 probe·apply가 멈춘다. 배경은 [판본 조회 RPC 최적화](../../docs/판본-조회-RPC-최적화-2026-09-21.md)에 있다. 회차별 퇴역+추가 드라이버(제작 경로)로 올린 릴리스는 이 단계가 없으므로 `select public.cpa_backfill_release_item_source('<release_id>')`를 한 번 부른다.
