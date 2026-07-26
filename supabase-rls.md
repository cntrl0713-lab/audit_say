# Supabase RLS 정책

앱 코드가 어떤 키로 어떤 테이블에 접근하는지와, 그에 맞춰 설정해야 할 RLS 정책을 정리한다.

## 왜 이 문서가 필요한가

이전에는 서버 액션의 조회까지 브라우저용 anon 클라이언트(`createBrowserClient`)로 수행했다.
서버에는 쿠키 저장소가 없어 사용자 JWT가 실리지 않으므로, 그 조회들은 전부 **anon 역할**로
나갔다. 즉 앱이 동작하려면 `cpa_questions_v2`·`cpa_review_notes`·`user_cpa`가 모두 anon에게
열려 있어야 했고, 그렇다는 것은 **공개된 anon 키만으로 Supabase에 직접 붙어 모범답안·루브릭·
타인의 오답노트를 그대로 받아갈 수 있다**는 뜻이다. 앱의 `stripAnswers` 처리는 이 경로를
막지 못한다.

지금은 조회를 모두 서버에서 service role로 수행하도록 바꿨다(`lib/dbAdmin.ts`). 호출하는 서버
액션이 이미 `assertAdmin`/`assertSelf`/`assertAuthenticated`로 권한을 검증하므로, **테이블은
클라이언트에 대해 전부 잠가도 앱이 정상 동작한다.**

## 현재 접근 경로

| 경로 | 사용 키 | 대상 |
|---|---|---|
| 브라우저 `getCombinedProfile` / `createPublicProfile` (`lib/db.ts`) | anon (사용자 세션) | `user_cpa` 본인 행 SELECT / INSERT |
| 브라우저 `supabase.auth.*` (`contexts/AuthContext.tsx`) | anon | Auth API (테이블 아님) |
| 서버 액션 전부 (`app/actions.ts` → `lib/dbAdmin.ts`) | service role | 모든 테이블 |

즉 **클라이언트가 직접 접근해야 하는 테이블은 `user_cpa` 하나뿐**이고, 그것도 본인 행에
한정된다.

## 적용할 정책

### 0. 현재 정책 확인

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public';
```

여기 나오는 기존 정책 중 **아래에서 정의하지 않은 것은 모두 삭제**한다. 특히 `using (true)`
형태의 광범위한 SELECT 정책이 남아 있으면 이 문서의 의미가 없다.

```sql
drop policy if exists "<기존 정책 이름>" on public.<테이블>;
```

### 1. RLS 활성화

```sql
alter table public.user_cpa         enable row level security;
alter table public.cpa_questions_v2 enable row level security;
alter table public.cpa_review_notes enable row level security;
```

RLS가 켜져 있고 정책이 하나도 없으면 클라이언트(anon·authenticated)에게는 0행이 보이고,
service role은 RLS를 우회하므로 영향이 없다. 이것이 `cpa_questions_v2`와
`cpa_review_notes`의 목표 상태다 — **두 테이블에는 정책을 만들지 않는다.**

### 2. `user_cpa` — 본인 행만

```sql
-- 본인 프로필 조회 (로그인 직후 등급·레벨·경험치 표시용)
create policy "user_cpa_select_own"
on public.user_cpa for select
to authenticated
using ( (select auth.uid()) = id );

-- 가입 직후 본인 프로필 생성
-- 익명(비회원) 세션도 Supabase에서는 authenticated 역할이므로 is_anonymous로 걸러낸다:
-- 비회원은 user_cpa에 영구 프로필을 만들지 않는 것이 앱의 기존 규칙이다.
create policy "user_cpa_insert_own"
on public.user_cpa for insert
to authenticated
with check (
  (select auth.uid()) = id
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
```

### 3. `user_cpa`에 UPDATE·DELETE 정책을 만들지 않는다 (중요)

클라이언트에 UPDATE 권한이 열려 있으면 사용자가 자기 행의 `role`을 `'ADMIN'`으로 바꾸거나
`exp`를 임의로 올릴 수 있다. 경험치 증가와 등급 변경은 각각
`updateUserProgressAction`(본인 확인 + 정수 반올림 + 1회 최대 50 클램프)과
`updateUserRoleAction`(`assertAdmin`)을 거쳐 **서버에서 service role로만** 수행한다.

기존에 UPDATE 정책이 있다면 반드시 삭제한다.

## 적용 후 검증

anon 키로 직접 조회해 빈 배열이 나오면 성공이다.

```bash
# 모범답안·루브릭이 딸려오면 안 된다 → [] 기대
curl -s "$SUPABASE_URL/rest/v1/cpa_questions_v2?select=*&limit=1" \
  -H "apikey: $ANON_KEY"

# 타인의 오답노트가 보이면 안 된다 → [] 기대
curl -s "$SUPABASE_URL/rest/v1/cpa_review_notes?select=*&limit=1" \
  -H "apikey: $ANON_KEY"

# 로그인하지 않은 상태에서 회원 목록이 보이면 안 된다 → [] 기대
curl -s "$SUPABASE_URL/rest/v1/user_cpa?select=*&limit=1" \
  -H "apikey: $ANON_KEY"
```

그 다음 앱에서 다음이 정상 동작하는지 확인한다: 로그인, 회원가입(닉네임 유지), 비회원
시작하기, 문제 풀기·채점, 오답노트 저장·삭제, 랭킹, 관리자 페이지.

## 키 취급

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 공개 값이다. 브라우저 번들에 들어가는 것이 정상이며,
  보호는 RLS가 담당한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회하므로 절대 클라이언트에 노출되면 안 된다.
  `NEXT_PUBLIC_` 접두사가 없으므로 Next.js가 클라이언트 번들에 인라인하지 않으며,
  이 키를 쓰는 `lib/supabaseAdmin.ts`는 서버 전용 모듈(`lib/dbAdmin.ts`)에서만 import한다.
