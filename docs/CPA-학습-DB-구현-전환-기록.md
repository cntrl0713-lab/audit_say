# CPA 학습 DB 구현·전환 기록

2026-09-08 기준. **운영 Supabase 적용에 이어 앱 배포와 경험치 원장 초기화를 완료했다.** 운영 주소는 [audit-say.vercel.app](https://audit-say.vercel.app/)이며 `CPA_LEARNING_DB_ENABLED=true`로 DB 학습 기록을 사용한다. 실제 비회원 빈 답안 제출·재시도·복원 확인도 통과했다. 사용자 지시에 따라 문항 내용을 재검증하거나 수정하지 않고, 최종 파일 식별과 이관 일치만 확인했다. 테이블별 컬럼·관계는 [설계서](CPA-문제은행-v3-학습-기록-DB-설계.md)에 있다.

## 실제 적용 결과

| 항목 | 확인 결과 |
|---|---|
| 프로젝트 | `xvifzicrjmbfqaepcfpp.supabase.co` |
| 적용 migration | `20260908024404`, `20260908024413`, `20260908024420`, `20260908024428` |
| 활성 릴리스 | 1번, `706f39ab-b46c-4219-a439-cacf5eda9a5a` |
| 저장 건수 | 96세트·192물음·521criterion·521점·251출처 |
| 정본 | `cpa_uploader/data/cpa_question_sets_v3.authoring.json` |
| 정본 SHA-256 | `21ec8158fe8d3cb91557df98a0d4ba8084254cd75db979924b926c45c063f7d1` |
| 원문 보존 | 릴리스 `source_document`에 1,241,004바이트 보존. 선택한 파일 및 현재 암호화 배포본과 동일 |
| 공개 조회 | DB 공개 DTO와 기존 공개 compiler 결과가 일치 |
| 권한 | 신규 20테이블 모두 RLS 활성, anon/authenticated 직접 권한 0건, service-role 접근 허용. 주요 RPC도 서버 전용 |
| 기존 자료 | 회원 3명·경험치 합계 0·v2 문제 107개 유지. 프로필 호환 뷰 권한과 security_invoker 유지 |
| 비회원 정리 | pg_cron job 4 활성, 매시 정각 최대 5,000건 |
| 학습 서비스 전환 | 완료. 초기화 marker 1개, 회원 3명 opening balance 3건, EXP 합계 0, 제출 적립 0건. 기존 직접 EXP 갱신 차단 활성 |

실행 영수증은 `docs/reports/cpa-learning-db-applied.json`에 저장했다. 운영 확인에 사용한 [읽기 전용 SQL](../supabase/verification/cpa_learning_post_import.sql)은 답안·회원 식별자를 출력하지 않는다.

## 앱 배포·경험치 초기화 결과

| 항목 | 확인 결과 |
|---|---|
| 배포 | `dpl_82P2ncKG3U9iHfkpXXzJVvBsjZXU`, [고유 배포 URL](https://audit-ofz8h8csd-cta-tax-law.vercel.app). `--prod --skip-domain`으로 READY 확인 후 운영 승격 완료 |
| 서버 설정 | `CPA_LEARNING_DB_ENABLED=true`, `OPENAI_API_KEY`를 production secret으로 추가. 기본 모델 `gpt-5.6-luna` 접근 확인 |
| 배포 입력 | Git push 없이 현재 작업 파일 82개를 선택한 CLI 스냅샷, 약 2.4 MB. 평문 authoring·환경 파일·임시 자료 0개. 배포 빌드·타입 검사 통과 |
| 구요청 정리 | 03:53:12 UTC에 임시 POST 차단 403 확인 후, 구배포 quiz 실행 상한 60초보다 긴 약 114초 대기 |
| 원장 초기화 | 03:55:06.273450 UTC에 `cpa_initialize_learning_progress()`로 회원 3명의 opening balance와 marker를 원자 기록. 기존 EXP가 모두 0이어서 초기화 후에도 0 |
| 전환 후 방화벽 | `rule_cpa_cutover_post_hold_0IuPMl`를 `CPA legacy deployment POST block`으로 변경·게시. 과거 hostname 49개·배포 ID 44개의 POST를 차단. 실제 서비스 별칭은 `audit-say.vercel.app`, `audit-say-cta-tax-law.vercel.app` 2개 |
| 운영 경로 확인 | 03:57:32 UTC에 `/`, `/quiz`, `/curriculum`, `/ranking`, `/history`, `/review-notes` 모두 200, `/quiz` DB 모드 확인 |
| POST 경로 확인 | 새 POST 200, 구배포 고정 POST 403. 구 고유 URL의 비인증 POST는 SSO로 302 이동 |
| 전환 직후 DB 집계 | marker 1, 프로필 3, EXP 합계 0, 비영점 프로필 0, opening 3, submission award 0, 원장 불일치 0, opening 누락 0 |
| 후속 상태 확인 | 03:58:52 UTC에 제출 0건, XP 이벤트 3건, 활성 릴리스 1개, 보관기간 작업 1개. 방화벽 변경 모두 게시되어 pending 없음 |
| 비회원 실제 제출 확인 | 운영 공개 JS의 Server Action ID 4개를 사용해 익명 세션 1개 생성 → 제출 준비 1회 → 동일 서명 토큰으로 빈 답안 채점 2회 → 결과 복원 1회 → 완료 이력 1건 확인. 같은 제출 유지·결과 복원·7일 보관 계약 통과 |
| 최종 DB 집계 | 04:02:45.983172 UTC에 회원 3명·EXP 합계 0·비영점 회원 0·opening 3·award 0·원장 불일치 0. 비회원 완료 제출 1건·7일 보관 1건·채점 실행 1건·오답노트 0건 |

비회원 smoke는 실제 운영 HTTP Server Action과 Supabase 쿠키를 유지하는 세션으로 실행했다. 비어 있지 않은 답안은 0개이며 문제 내용 검증이나 AI 모델 호출은 하지 않았다. 전체 UI를 조작한 브라우저 E2E와는 구분한다. 초기화 실행 스크립트의 CommonJS 진입점은 async main으로 정리했고, 이후 실제 초기화와 타입 검사·해당 스크립트 ESLint가 통과했다.

승격 후 별칭 API를 확인해 `audit-say-git-main-cta-tax-law.vercel.app`이 구배포에 남아 있는 것을 발견했고, 해당 hostname도 POST 차단 대상에 추가·게시했다. 현재 운영 배포의 소스는 위 CLI 스냅샷이며, 기존 Git commit 메타데이터를 새 배포 코드 전체의 커밋으로 해석하지 않는다.

## 구현 범위

| 파일 | 역할 |
|---|---|
| [스키마](../supabase/migrations/20260908024404_cpa_learning_schema.sql) | 20개 신규 테이블, 버전 소속 복합 FK, 게시 불변성, 정수 배점, 서버 전용 권한, 기존 프로필·호환 뷰 보존 |
| [문제은행 RPC](../supabase/migrations/20260908024413_cpa_question_bank_rpc.sql) | 트랜잭션 이관, 공개 DTO 조회, 제출 당시 비공개 버전 조회, 이전 릴리스 재활성화 |
| [학습 RPC](../supabase/migrations/20260908024420_cpa_learning_rpc.sql) | 제출·채점 실행, 결과·오답노트·경험치 원자 저장, 이력·랭킹 조회, 만료 정리 |
| [보관기간 작업](../supabase/migrations/20260908024428_cpa_learning_retention.sql) | pg_cron으로 매시 정각 만료 비회원 제출 최대 5,000건 삭제 |
| [제출 서비스](../lib/learningService.ts), [서명 토큰](../lib/learningSubmission.ts), [서버 액션](../app/actions.ts) | 인증된 소유자·버전·답안 해시를 묶은 제출, 같은 제출 재시도, 완료 응답 유실 복구 |
| [문제 조회](../lib/questionV3Repository.ts), [학습 저장소](../lib/learningRepository.ts), [공개 변환](../lib/learningPublic.ts) | service-role 서버 접근과 공개 필드 허용 목록 |
| [풀이 화면](../app/quiz/QuizClient.tsx), [풀이 이력](../app/history/HistoryClient.tsx), [오답노트](../app/review-notes/ReviewNotesClient.tsx), [랭킹](../app/ranking/RankingClient.tsx) | 결과 복원, 이력 50건씩 추가 조회, 오답 당시 풀이·메모·수동 상태 변경, 누적·주간·월간 탭 |

새 제출마다 획득 점수 전액을 적립한다. 같은 제출의 재시도에는 한 번만 적립한다. 빈 답안은 모델 호출·채점 한도 소비 없이 0점으로 저장한다. 채점 오류는 오답이나 경험치로 확정하지 않는다. AI 원판정은 비공개로 보관하고, 공개 결과에는 코드가 검증한 판정·인용·점수만 내보낸다.

감점 물음은 자동으로 오답노트에 들어간다. 만점 재풀이로 자동 해결하지 않으며 사용자가 해결·해제한다. 해결 이전에 제출한 답안의 지연 채점으로 다시 등록하지 않는다. 해결 이후의 새로운 감점 제출은 다시 등록한다. 메모만 저장해도 해결 기준 시각이 바뀌지 않는다.

회원 제출은 계정 삭제 전까지 보존한다. 비회원 제출은 준비 시점에 고정한 제출 시각부터 168시간 보관하며, 이후 회원으로 전환돼도 보관기간이나 경험치 대상 여부가 바뀌지 않는다. 만료 시점부터 조회·재채점은 차단한다. 물리 삭제는 다음 정리 작업에서 수행하며, 5,000건 초과 적체는 이후 배치로 처리한다. 정리 대상은 답안·실행·판정 등 해당 제출의 하위 자료를 포함한다.

기간 랭킹은 한국 시간 월요일 00:00 / 매월 1일 00:00 이후 확정된 경험치로 계산한다. 동점은 공동 순위다. 이관 전 경험치는 누적에만 유지하고 주간·월간에 더하지 않는다. 공개 랭킹에서 인증 UUID를 제외한다.

## 최종본 식별과 원문 호환 처리

`manifest.source`, 주제별 최종 완료기록, 현재 암호화 배포본을 대조해 위 파일을 선택했다. manifest의 전역 해시는 병행 수정 전 값이므로 현재 파일의 SHA-256을 사용했다. 주제19의 부분 해시는 `19-final-verification.json`의 최종 해시와 일치한다. 이전 임시 JSON이나 수정안 문서로 정본을 대체하지 않았다.

초기 DB 제약은 계획된 모두 작성 정책을 강제해 현재 원문의 일부 메타데이터를 거절했다. 사용자의 최신 지시인 **“검증하지 말고 정확한 최종본만 찾아 DB 적용”**에 따라 원문 보존형으로 저장 규격을 맞췄다. 6물음의 `ordered/max_entries/overflow_policy`, 주제19 완료기록의 `excerpt`, 원래 선언된 `content_hash`를 그대로 보존한다. 실제 인용 문자열의 SHA-256은 별도 `quote_hash`에 저장하며 원래 선언값은 `declared_quote_hash`에서 복원한다. 발문·모범답안·criterion·원문 파일은 변경하지 않았다.

이번 실행은 `--preserve-source`를 사용했다. 내용 검증기·공식 출처 재검토·모델 평가는 실행하지 않는다. 파일 SHA-256, 원문 JSON과 이관 payload의 일치, DB FK·정수 계약·공개/비공개 권한·왕복 저장만 확인한다. 영수증과 DB 기록의 `content_review_performed=false` / `source_validation`은 이를 명시한다. 기본 `db:check`의 엄격한 편집 정책 검사는 별도 선택 가능한 절차로 남는다.

## 새 환경 적용·재배포 참고 절차

현재 운영 DB의 테이블·문제 이관·경험치 초기화·앱 전환은 모두 완료했다. 아래는 새 환경이나 후속 릴리스의 참고 절차이며, 현재 운영에서 DDL과 최초 초기화를 다시 실행할 필요는 없다. 앱 재배포는 새 빌드를 먼저 준비하고 구요청을 정리한 뒤 승격한다. 구배포 POST 차단은 해당 배포가 계속 접근 가능한 동안 유지한다.

1. 진행 중인 문제·공통 코드 검토를 마친다. authoring/public/암호화 배포본을 같은 최종본으로 compile하고 검토 근거를 고정한다.
2. 아래 검사와 테스트를 통과한다. `db:check`는 구조·공식 출처·주제 분포·공개본 일치·모두 작성 정책을 확인하고 DB에 쓰지 않는다.

   ```powershell
   npm run questions:v3:validate
   npm run questions:v3:db:check
   npm run typecheck -- --incremental false
   npm test
   npm run build
   ```

3. 운영 프로필 수·경험치 합계, `cpa_users → auth.users ON DELETE CASCADE`, `user_cpa` 뷰의 정의·권한, pg_cron 설치 여부를 다시 확인한다. 마지막 읽기 전용 실사에서는 회원 3명·경험치 합계 0, 기존 v2 문제 107개, 기존 오답노트 0개, pg_cron 1.6.4를 확인했다. 이 값은 전환 시점에 다시 측정한다.
4. 새 환경이라면 네 마이그레이션을 번호순으로 적용한다. 스키마 migration은 `cpa_users.exp/level`을 bigint로 확장하고 알려진 `user_cpa` 호환 뷰의 권한과 `security_invoker`를 복원한다. 알 수 없는 뷰 의존성이나 5초 이상 잠금 대기는 실패·롤백한다. 신규 테이블을 적용하는 것만으로 기존 경험치를 원장으로 전환하지 않는다. 현재 연결된 운영 DB에는 이미 적용되어 있으므로 같은 DDL을 다시 실행하지 않는다. 로컬 파일명은 실제 원격 이력과 일치시켰다.
5. 검증 보고서의 **새** `source_file_hash`와 실제 검토 근거를 사용해 최종 문제은행을 이관한다. `.env.local`은 해당 Supabase 서버 자격증명을 가져야 한다.

   ```powershell
   npm run questions:v3:db:import -- --preserve-source --project-host xvifzicrjmbfqaepcfpp.supabase.co --expected-hash <선택한최종파일SHA256> --evidence "최종 파일 식별 근거와 내용 재검증 생략 지시"
   ```

   판본·적용시기 메타데이터가 있으면 `--applicability-file <JSON경로>`를 검사와 이관 모두에 동일하게 지정한다. 이관은 전체 은행을 트랜잭션으로 게시하고 반환된 공개 DTO를 최종 compiler 결과와 비교한다. 해시가 같으면 기존 릴리스를 재사용한다. 점수와 판정을 포함한 비공개 원문은 콘솔에 출력하지 않는다.

6. 기존 채점 쓰기를 잠시 중단한다. 초기화 시작 전에 진행 중인 옛 채점 요청을 종료하거나 대기시킨다. 다음 명령이 기존 경험치를 opening balance로 보존한다.

   ```powershell
   npm run learning:db:initialize -- --project-host xvifzicrjmbfqaepcfpp.supabase.co
   ```

   **초기화 후에는 기존 직접 EXP UPDATE가 DB에서 차단된다.** 이 시점부터 옛 배포의 채점 쓰기를 허용하면 안 된다. 기존 프로필을 잠근 상태에서 한 번만 초기화하고, 이후 재실행은 중복 적립하지 않는다. 이후 가입자는 첫 완료 시 opening balance 0을 가진다.
7. 새 배포에 `CPA_LEARNING_DB_ENABLED=true`를 설정하고 채점 쓰기를 재개한다. DB 모드에서 조회에 실패해도 파일 은행으로 몰래 전환하지 않는다. 제출용 `CPA_SUBMISSION_SIGNING_KEY`는 최소 32바이트의 서버 비밀키다. 미지정 시 기존 암호화 키에서 용도를 구분한 서명키를 파생한다. 교체 시 `CPA_SUBMISSION_PREVIOUS_SIGNING_KEY`로 이전 토큰을 검증할 수 있다. 두 키를 클라이언트 환경변수로 만들지 않는다.
8. 실제 두 계정과 익명 세션으로 타인 접근 차단, 새로고침·응답 유실 복구, 점수·프로필 일치, 오답노트 상태, 기간 순위, 이전 버전 풀이를 확인한다. 신규 테이블의 RLS 활성·anon/authenticated 직접 권한 없음과 service-role RPC 권한을 검사한다. 개인 답안·정답을 로그에 남기지 않는다.

## 보관기간 작업과 복구

Supabase DB의 기존 pg_cron을 사용한다. [공식 Cron 문서](https://supabase.com/docs/guides/cron/quickstart)에 따라 등록 후 실제 작업·실행 결과를 확인한다.

```sql
select jobid, jobname, schedule, active
from cron.job where jobname = 'cpa-learning-guest-retention';

select status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'cpa-learning-guest-retention')
order by start_time desc limit 10;

select count(*) as expired_guest_backlog
from public.cpa_attempts
where actor_kind = 'guest' and expires_at <= now();
```

실패나 적체는 작업 상태를 확인한 후 서버 권한으로 `cpa_purge_expired_attempts`를 재실행한다. 회원 이력이나 auth 계정 자체는 이 작업에서 삭제하지 않는다. cron 실행 이력의 정리 정책은 Supabase 운영 설정을 따른다.

잘못된 문제 릴리스는 서버 전용 `cpa_reactivate_question_bank(p_release_id)`로 이전 게시본을 다시 선택할 수 있다. 기존 제출은 자기 버전을 계속 참조한다. 문제 릴리스 전환은 이미 적립된 경험치를 취소하지 않는다. 학습 전환 이후 장애 시 쓰기를 멈추고 결과·원장을 보존한 채 복구한다. `CPA_LEARNING_DB_ENABLED=false`만으로 옛 직접 EXP 쓰기를 되살리는 롤백은 지원하지 않는다.

## 검증 범위와 한계

- TypeScript 검사, 관련 ESLint, Next.js production build 통과.
- 전체 테스트 **175개 통과**. 이 중 문제은행·학습 SQL을 PGlite에 실제 실행한 **14개**에서 게시 불변성·소속 FK·권한·점수 계약·트랜잭션 실패 롤백·XP 중복 방지·KST 경계·만료 삭제를 검증했다. 실제 제출 서비스와 SQL을 연결해 비회원→회원 전환 이후에도 기존 제출은 비회원 기록으로 유지되고 새 회원 제출만 적립됨을 확인했다.
- 초기 구현 때는 엄격한 저장 규격에 맞는 **89세트·178물음**으로 격리 DB 조립을 확인했다. 이번 실제 이관에서는 원문 호환 처리를 거쳐 **전체 96세트의 운영 공개 round trip과 원문 바이트 일치**를 확인했다.
- 서버 서비스와 UI 상태 테스트에서 서명 변조·다른 답안·만료 후 재전송·완료 응답 유실·이력 커서·공개 정보 경계를 검증했다.
- 이번 적용 전 변경한 저장 호환·원문 보존·권한 fixture SQL 테스트 **15개**, 이관/제출 서비스 fixture 테스트 **11개**, 타입 검사·관련 린트 통과. 실제 문제은행 내용 검증은 사용자 요청으로 생략했다.
- 운영 RLS·RPC 권한·테이블 건수·전체 원문/공개 왕복·cron 등록을 확인했다. 실제 anon 키로 정본 스냅샷 SELECT와 공개 RPC 직접 호출이 모두 권한 오류 42501로 거절됨을 확인했다. 앱 승격 후 6개 GET 경로·신규/구배포 POST 경로와 초기화 집계를 확인했다.
- 실제 운영 비회원 smoke에서 제출 준비·동일 서명 토큰 재시도·결과 복원·완료 이력 1건·7일 보관 계약을 확인했다. 빈 답안만 사용했고 AI 모델은 호출하지 않았다.
- PGlite 테스트는 여러 PostgreSQL 연결을 동시에 실행한 동시성 부하검증이 아니다. 전체 로그인·AI 채점 브라우저 E2E와 cron의 예약 실행 결과는 아직 확인하지 않았다.
