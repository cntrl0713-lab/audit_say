# KICPA 수습CPA 채용공고 알림 기능 계획서

**프로젝트:** audit-say (`cntrl0713-lab/audit_say`)  
**Supabase 프로젝트:** `xvifzicrjmbfqaepcfpp`  
**작성일:** 2026-09-09

---

## 개요

KICPA(공인회계사회) 구인게시판의 수습CPA 채용공고를 자동 수집하고, audit-say에 등록한 사용자에게 카카오톡 "나에게 보내기" API로 즉시 알림을 발송하는 기능.

---

## 전체 흐름

```
스터디원 (1회 온보딩)
  → audit-say /settings 페이지
  → 카카오 로그인 (OAuth, talk_message 동의)
  → access_token + refresh_token
  → Next.js API Route (/api/kakao/callback)
  → Supabase kicpa_jobs_subscribers 저장

GitHub Actions (cron 5분, 퍼블릭 레포 무료)
  → scripts/kicpa_scraper.py 실행
  → KICPA 게시판 파싱 (비로그인 접근 가능)
      · trainee_cpa 게시판: 전체 글
      · cpa 게시판: 제목에 '수습' or '신입' 포함만
  → 신규 글 감지 시 kicpa_jobs INSERT
  → kicpa_jobs_subscribers에서 is_active=true 구독자 조회
  → 액세스 토큰 만료 시 리프레시 토큰으로 자동 갱신 후 DB 업데이트
  → 카카오 나에게 보내기 API 호출
      메시지: "[audit-say] 새 수습CPA 채용공고\n{제목}\n{source_url}"
  → kicpa_jobs.notified_at 업데이트

audit-say (Next.js / Vercel)
  → /firms/[firm_id]?tab=jobs  : 법인별 채용공고 탭 (B안)
  → /settings                  : 카카오 알림 연동 페이지
  → /api/kakao/callback        : OAuth 콜백 (토큰 저장)
```

---

## Supabase 테이블

### `kicpa_jobs`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | text PK | KICPA 원문 게시글 번호 |
| `board` | text | `trainee_cpa` / `cpa` |
| `title` | text | 공고 제목 |
| `company` | text | 회사명 |
| `posted_at` | date | 게시일 |
| `deadline` | text | 마감일 (텍스트 그대로) |
| `source_url` | text | KICPA 원문 링크 |
| `notified_at` | timestamptz | 알림 발송 시각 (null = 미발송) |
| `created_at` | timestamptz | 최초 감지 시각 |

**RLS:**
- anon: SELECT 허용 (공개 데이터)
- service_role: INSERT / UPDATE / DELETE

---

### `kicpa_jobs_subscribers`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `cpa_users` | |
| `kakao_access_token` | text | 6~12시간 유효, 자동 갱신 |
| `kakao_refresh_token` | text | 30일 유효 |
| `token_expires_at` | timestamptz | 액세스 토큰 만료 시각 |
| `refresh_expires_at` | timestamptz | 리프레시 토큰 만료 시각 |
| `is_active` | boolean default true | 수신 ON/OFF |
| `created_at` | timestamptz | |

**RLS:**
- service_role 전용 (anon / authenticated 읽기 완전 차단)
- 토큰 컬럼은 어떤 정책에도 SELECT 노출 금지
- 본인 연동 상태(is_active) 조회는 토큰 컬럼 제외한 별도 뷰로 제공

---

## 추가할 파일 목록

```
app/
  settings/
    page.tsx                        # 카카오 알림 연동 설정 페이지
  api/
    kakao/
      callback/
        route.ts                    # OAuth 콜백: 토큰 수신 → Supabase 저장
  (firm)/
    firms/
      [firm_id]/
        JobsTab.tsx                 # 법인별 채용공고 탭 (신규)
        page.tsx                    # TABS에 'jobs' / TAB_LABEL에 '채용공고' 추가

scripts/
  kicpa_scraper.py                  # KICPA 스크래퍼 + 카카오 알림 발송

.github/
  workflows/
    kicpa_scraper.yml               # cron 5분 스케줄 워크플로
```

---

## 보안 원칙

1. 토큰은 반드시 서버(API Route)를 통해서만 Supabase에 저장 — 브라우저 직접 INSERT 금지
2. `kicpa_jobs_subscribers` RLS는 service_role 전용
3. GitHub Actions 로그에 토큰 값 출력 절대 금지 (퍼블릭 레포 로그는 누구나 열람 가능)
4. 카카오 REST API 키는 Vercel 환경변수 + GitHub Secret에만 보관

---

## 환경변수

| 변수명 | 등록 위치 |
|---|---|
| `KAKAO_REST_API_KEY` | Vercel env + GitHub Secret |
| `KAKAO_REDIRECT_URI` | Vercel env |
| `SUPABASE_URL` | GitHub Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Secret |

---

## 카카오 디벨로퍼스 설정 (준영님, 1회 수동)

1. [developers.kakao.com](https://developers.kakao.com) → 앱 생성
2. 플랫폼 → Web → `https://audit-say.vercel.app` 등록
3. 카카오 로그인 활성화
4. 리다이렉트 URI → `https://audit-say.vercel.app/api/kakao/callback`
5. 동의항목 → `talk_message` → **선택 동의**
   - 동의 목적: `KICPA 수습회계사 채용공고 신규 등록 시 카카오톡으로 즉시 알림을 보내기 위해 사용됩니다.`
6. REST API 키 복사 → Vercel 환경변수 + GitHub Secret 등록

---

## 작업 순서

| # | 작업 | 담당 |
|---|---|---|
| 1 | 카카오 디벨로퍼스 앱 생성 + 설정 | 준영님 |
| 2 | KICPA 게시판 URL/HTML 구조 확인 (F12) | 준영님 |
| 3 | `kicpa_jobs` + `kicpa_jobs_subscribers` migration | GPT |
| 4 | `app/api/kakao/callback/route.ts` | GPT |
| 5 | `app/settings/page.tsx` | GPT |
| 6 | `scripts/kicpa_scraper.py` + `.github/workflows/kicpa_scraper.yml` | GPT |
| 7 | `JobsTab.tsx` + `[firm_id]/page.tsx` 탭 추가 | GPT |
| 8 | Vercel 환경변수 + GitHub Secrets 등록 | 준영님 |

---

## 미결 사항 (GPT 수행 전 준영님 확인 필요)

- [ ] KICPA 게시판 실제 URL 및 HTML/JSON 구조 (F12 확인)
- [ ] 카카오 디벨로퍼스 앱 생성 완료
- [ ] Vercel 환경변수 등록 완료
- [ ] GitHub Secrets 등록 완료
