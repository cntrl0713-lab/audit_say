# 보안 조사·수정 기록

2026-09-08. 대상: Audit Say 애플리케이션과 `audit-say.vercel.app`, 연결된 Supabase의 CPA 데이터 접근 경계. 운영 서버에 부하 공격이나 실제 사용자 자료 변경은 하지 않았다.

## 확인한 결함과 수정

| 항목 | 조사 결과 | 수정 |
|---|---|---|
| 취약한 런타임·의존성 | Next.js 16.2.10은 App Router Server Actions 서비스 거부 취약점의 영향 범위. npm audit에서 high 7개 패키지 보고 | Next.js·eslint-config-next 16.3.4로 갱신하고 잠금 파일의 하위 의존성 패치. 최종 audit 0개 |
| 세션 갱신 응답 캐시 | `proxy.ts`가 Supabase SSR `setAll`의 두 번째 인자에 담긴 캐시 방지 헤더를 누락 | 갱신 쿠키와 함께 Cache-Control·Expires·Pragma 전달. 실제 교차 사용자 세션 유출을 재현한 것은 아님 |
| 채점 제한의 fail-open | RPC·테이블이 없으면 서버리스 인스턴스 로컬 카운터로 전환 | DB가 명시적으로 true를 반환해야 허용. 미설치·권한·통신 오류 모두 거절 |
| 신규 제출 기록 남용 | 빈 답안은 AI 호출이 없어서 기존 한도와 무관하게 기록 생성 가능 | 사용자별 신규 제출 60초당 30회. DB 기록 생성 전에 검사. 기존 제출 복원·결과 조회는 이 한도를 소비하지 않음 |
| 서버 전용 코드 경계 | 관리자 클라이언트의 `server-only` 오류를 try/catch로 무시 | 정적 `import 'server-only'`로 클라이언트 의존성 유입을 빌드 단계에서 차단 |
| 브라우저 보호 헤더 | 프레임 삽입 방지·MIME 추측 방지 헤더 누락 | CSP frame-ancestors/object-src/base-uri, X-Frame-Options DENY, nosniff, Referrer-Policy 추가 |
| 공개 입력 방어 | 닉네임 중복 확인 액션이 비문자열 입력에 trim 호출 가능, 입력 길이 제한 없음 | 문자열·100자 상한 검사 후 DB 조회 |

Next.js 영향 범위와 업그레이드 필요성은 [공식 보안 공지](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj)를 대조했다. 패치 릴리스는 [16.3.4](https://github.com/vercel/next.js/releases/tag/v16.3.4). 캐시 헤더 계약은 설치된 `@supabase/ssr/src/types.ts`와 `cookies.ts`의 `SetAllCookies`·`applyServerStorage` 구현에서 확인했다.

## 검증

- `npm run typecheck -- --incremental false`: 통과.
- `npm test`: 180/180 통과. DB 소유권·권한·공개 투영·채점 보안 회귀 포함.
- 수정 코드와 신규 테스트 파일 ESLint: 통과.
- `npm run build`: Next.js 16.3.4 빌드 통과.
- `npm audit`: 전체 의존성 경고 0개.
- 프록시 실제 소스를 모의 Auth 갱신과 실제 NextRequest/NextResponse로 실행해 갱신 쿠키·캐시 헤더를 검증. 실사용자의 만료 토큰을 이용한 검증은 아님.
- 신규 빈 답안 한도 초과 시 begin/grade/complete 모두 호출되지 않음. 기존 완료 제출은 신규 한도가 소진되어도 복원 가능.
- 로컬 production 브라우저 번들 31개 파일에서 설정된 서버 비밀키 3종의 실제 값이 포함되지 않음을 검사. 값 자체를 로그에 남기지 않음.
- 운영 비로그인 관리자 개인 명세 API: 403, `Cache-Control: private, no-store`.
- 운영 anon REST: `cpa_users`, `user_cpa`, `cpa_firm_director`, `firm_director`, `cpa_firm_director_pay`, `firm_director_pay`는 빈 결과. `cpa_criteria`, `cpa_question_sources`, `cpa_attempt_answers`, `cpa_grading_runs`는 401.
- 운영 카탈로그: CPA 학습·채점 RPC와 `consume_rate_limit`의 anon/authenticated 실행 권한 없음. 사용자 프로필은 본인 행 조회·회원 본인 생성 정책. 이사 개인 명세는 RLS 정책 없이 차단, 집계 자료는 공개 조회.

테스트와 audit 원로그는 로컬 `tmp/security-*.txt`, `tmp/security-audit-after.json`에 보관한다. 배포는 검증 파일을 고정한 별도 런타임 스냅샷에서 수행한다. 앞서 배포한 회계법인 정보 메뉴와 병행 배포에서 이미 반영된 챗봇 안내 문구 변경을 보존한다.

## 남은 범위와 설정

- Supabase가 유출 비밀번호 검사 비활성화와 public 스키마의 pg_net 확장을 경고한다. 이 프로젝트는 다른 앱과 공유하므로 이번 앱 수정에 포함하지 않았다. 확장 이동이나 Auth 정책 변경은 공유 서비스 영향을 따로 검토해야 한다.
- 익명 로그인을 통한 학습은 의도한 기능이다. 이번 제한은 사용자 ID별이므로 여러 익명 계정·IP를 이용한 분산 남용까지 차단하지 않는다. 전역 비용 한도·봇 방지는 별도 운영 정책이 필요하다.
- 공개 닉네임 중복 확인은 가입 흐름상 유지했다. 입력 제한은 있으나 대량 열거를 차단하는 요청별/IP별 제한은 이번 범위에 포함하지 않았다.
- 추가한 CSP는 프레임·객체·base URL 보호에 한정한다. nonce 기반의 엄격한 script-src 정책을 구현했다고 주장하지 않는다.
- 접근 차단 확인은 비로그인 운영 요청과 격리 DB 회귀 테스트 기준이다. 실제 관리자·일반 회원 계정의 운영 E2E나 침해 흔적 전수 조사는 수행하지 않았다. 발견·수정된 결함이 침해 발생의 증거는 아니다.

## 운영 반영

최종 배포 `dpl_BcKuKwVqd8bfPa75N4pNkybj5AtT`, [고유 URL](https://audit-rdr2rw2oh-cta-tax-law.vercel.app). Vercel production 빌드도 통과했다. 홈페이지·회계법인 목록·문제 페이지는 200, 비인가 관리자 API는 403이며 보안 헤더가 적용된다. 브라우저에서 홈페이지 메뉴와 회계법인 목록 이동을 확인했다. `audit-say.vercel.app`, `audit-say-cta-tax-law.vercel.app`, `audit-say-git-main-cta-tax-law.vercel.app` 별칭을 같은 수정본으로 연결했다. 과거 배포의 모든 고유 URL 삭제·차단은 이번 검증 범위에 포함하지 않는다.
