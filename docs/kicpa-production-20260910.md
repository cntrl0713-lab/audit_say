# KICPA 채용 기능 운영 배포 기록

2026-09-10 14:46 KST 기준 웹 배포, 운영 DB 적용 및 아래 검증을 완료했다.

## 배포 식별자

- 운영 주소: https://audit-say.vercel.app/jobs
- 설정 화면: https://audit-say.vercel.app/settings
- GitHub `main`: `8c57afc58788d1a263d3a7c72f451526b9985056`
- Vercel 프로젝트: `audit-say` / `prj_jgT6LVatyIeOWM5xdcQM67zumJgu`
- 운영 배포: `dpl_6GPaiaN5a5fgkpPn7FsWq347qx7y` (`READY`)
- 배포 URL: https://audit-6ltyzykqf-cta-tax-law.vercel.app
- `audit-say.vercel.app`의 실제 alias가 위 배포를 가리키는 것을 API로 확인했다.
- 기존 배포: `dpl_5uL4FSTbZfB9pkKcZwWRBHAqvQPd`. 이 버전은 `deadline`을 조회하므로 현재 컬럼 권한에서 그대로 되돌리지 않는다.

이번 배포에는 제목·회사명·게시일과 원문 링크 변경, 수집 필드 제한, 공통 계정 전환 이후의 채용 구독 가입 회차 검증을 포함했다. 다른 작업에서 수정 중인 문제 출제·위키·공통 계정 운영 스크립트는 배포에 포함하지 않았다.

첫 CLI 배포는 로컬 Git 이메일과 계정 연결이 맞지 않아 작성자 권한 확인으로 차단됐다. 로그인된 본인 Vercel 계정의 이메일로 이번 커밋을 정리했고, GitHub가 작성자를 `cntrl0713-lab`으로 확인한 뒤 정식 GitHub 연동 배포가 성공했다. 전체 Git 설정이나 계정 권한은 변경하지 않았다. 차단된 배포는 운영 주소에 연결하지 않았다.

## 운영 DB

대상 Supabase는 `xvifzicrjmbfqaepcfpp`다. 웹의 새 버전 연결을 확인한 뒤 14:45:52 KST에 다음 SQL과 마이그레이션 이력을 하나의 트랜잭션으로 적용했다.

1. `20260909010000_kicpa_jobs`
2. `20260910020000_kicpa_jobs_summary_fields`
3. `20260910093000_kicpa_jobs_membership_guard`

기존 공통 계정 SQL을 재실행하지 않았다. 계정 삭제나 회원 회차 초기화도 하지 않았다. 채용 테이블은 설치 전 없었으며, 검증 시 공고·구독·발송 기록은 각각 0건이다.

- 채용 관련 4개 테이블의 RLS 활성 확인.
- 공개 읽기는 `board`, `id`, `title`, `company`, `posted_at`, `source_url`, `firm_id`, `created_at`만 허용.
- `deadline`, 구독 원장, 발송 원장에 대한 익명 REST 조회 차단 확인.
- 수집 RPC의 추가 필드 거부와 익명 실행 권한 차단 확인.
- 구독 `membership_version` 기본값 없음 및 공통 가입 회차 트리거 활성 확인.

## 검증

- 격리된 배포본에서 전체 Node 테스트 371개, Python 테스트 38개 통과.
- TypeScript, 변경 파일 ESLint, 위키 동기화 검사 통과.
- GitHub 연동 Vercel 운영 빌드 성공.
- `/`, `/jobs`, `/settings`, `/firms`, `/firms/1?tab=jobs` HTTP 200.
- 전체·법인별 채용 목록에서 정상적인 공고 없음 상태 확인.
- 비로그인 구독 API 401, 다른 출처의 구독 변경 요청 403.
- 실제 회원의 브라우저 로그인 후 설정 저장 및 휴대전화 전달은 이번 운영 검증에 포함하지 않았다. 가입 회차별 저장·탈퇴·오래된 요청 차단은 실제 공유 SQL 함수를 사용하는 로컬 PGlite 테스트로 확인했다.

전체 검사에서 처음 발생한 출처 자료 관련 실패는 Git에서 제외된 `cpa_uploader/data/official`의 14개 텍스트가 격리 사본에 없어서 발생했다. 로컬 검증 자료를 복사한 후 371개 전체 검사가 통과했으며, 해당 자료는 Vercel 업로드에서 제외했다.

## 운영 준비 상태

실제 목록 파서·원문 링크 검증과 첫 기준 적재는 아직 완료하지 않았다. 따라서 공고 목록은 현재 비어 있다. 수집 예약 변수나 시크릿을 이번 배포에서 활성화하지 않았다. GitHub Actions 변수 조회는 현재 토큰에서 403이므로 원격 변수 값을 확인했다고 해석하면 안 된다. 저장소에는 검증된 운영 파서 설정이 없고, 합성 설정은 실제 수집에서 거부한다.

카카오 발송기는 계속 `DisabledProvider`다. 업체 선정·사업자등록·휴대전화 인증·템플릿 승인 및 실제 연결 후 발송을 시작한다. 이번 배포에서 메시지를 보내지 않았다.

실제 수집을 검증하고 활성화할 때도 매일 KST 08:30 이상 18:30 미만의 요청 제한을 유지한다.

세부 로컬 실행 기록은 Git에서 제외된 `tmp/kicpa-production-db-receipt.json`, `tmp/kicpa-production-db-verification.json`, `tmp/kicpa-production-http-verification.json`, `tmp/kicpa-production-commit-identity.log`에 남겼다. 배포본은 `tmp/kicpa-production-20260910` 작업트리에 보존하며, 현재 작업 폴더의 `main`도 배포 커밋으로 fast-forward했다. 다른 진행 중인 변경은 유지했다.
