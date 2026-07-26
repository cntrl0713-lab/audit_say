# Supabase RLS 적용 런북

Supabase 대시보드 → SQL Editor에서 STEP 0부터 순서대로 실행한다.
**순서를 지키지 않으면 운영 앱이 멈춘다** (STEP 0 참고).

> 이 문서의 STEP 1·2·4 SQL은 로컬 PostgreSQL 16에 Supabase 환경(anon·authenticated·
> service_role 역할, `auth.uid()`/`auth.jwt()`, 적용 전의 광범위한 정책)을 재현해 실제로
> 실행 검증했다. 확인한 동작:
> - anon: 세 테이블 모두 0행
> - 로그인 사용자: 본인 `user_cpa` 행만 조회, 문제·오답노트는 0행
> - 자기 `role`을 `ADMIN`으로, `exp`를 임의 값으로 UPDATE 시도 → 0행 (차단)
> - 가입 INSERT: 본인 id 성공 / 타인 id 거부 / 익명 세션 거부
> - service role: 전부 정상 조회 (서버 액션 경로)
> - STEP 4 롤백으로 적용 전 상태 복구
>
> 다만 검증은 재현 환경이라 실제 스키마와 다를 수 있다. STEP 1을 건너뛰지 말 것.

---

## 왜 필요한가

이전에는 서버 액션의 조회까지 브라우저용 anon 클라이언트(`createBrowserClient`)로 수행했다.
서버에는 쿠키 저장소가 없어 사용자 JWT가 실리지 않으므로, 그 조회들은 전부 **anon 역할**로
나갔다. 즉 앱이 동작하려면 `cpa_questions_v2`·`cpa_review_notes`·`user_cpa`가 모두 anon에게
열려 있어야 했고, 그렇다는 것은 **공개된 anon 키만으로 Supabase에 직접 붙어 모범답안·루브릭·
타인의 오답노트를 그대로 받아갈 수 있다**는 뜻이다. 앱의 `stripAnswers` 처리는 이 경로를
막지 못한다.

지금은 조회를 모두 서버에서 service role로 수행한다(`lib/dbAdmin.ts`). 호출하는 서버 액션이
이미 `assertAdmin`/`assertSelf`/`assertAuthenticated`로 권한을 검증하므로, **테이블을
클라이언트에 대해 전부 잠가도 앱이 정상 동작한다.**

### 적용 후 접근 경로

| 경로 | 사용 키 | 대상 |
|---|---|---|
| 브라우저 `getCombinedProfile` / `createPublicProfile` (`lib/db.ts`) | anon (사용자 세션) | `user_cpa` 본인 행 SELECT / INSERT |
| 브라우저 `supabase.auth.*` (`contexts/AuthContext.tsx`) | anon | Auth API (테이블 아님) |
| 서버 액션 전부 (`app/actions.ts` → `lib/dbAdmin.ts`) | service role | 모든 테이블 |

**클라이언트가 직접 접근해야 하는 테이블은 `user_cpa` 하나뿐**이고, 그것도 본인 행에 한정된다.

---

## STEP 0. 먼저 코드부터 배포 (건너뛰면 앱이 멈춘다)

RLS를 잠그는 순간부터 **anon 키로는 아무것도 읽히지 않는다.** 운영에 아직 이전 코드가
돌고 있으면(=조회를 anon 클라이언트로 하는 버전) 문제 목록·랭킹·오답노트가 전부 비게 된다.

1. `claude/ai-design-natural-fix-nreaoi` 브랜치를 머지하고 배포한다.
2. 배포 환경에 **`SUPABASE_SERVICE_ROLE_KEY`가 설정돼 있는지 반드시 확인한다.**
   이제 모든 조회가 이 키에 의존한다. 없으면 `getSupabaseAdmin()`이 예외를 던져
   문제 로딩·랭킹·오답노트가 전부 실패한다.
3. 배포본에서 문제 풀기와 랭킹이 정상인지 확인한 뒤에 STEP 1로 넘어간다.

---

## STEP 1. 현재 상태 점검 + 백업

**읽기 전용이므로 STEP 0(배포) 전에 미리 실행해도 안전하다.**
Supabase 대시보드 → 왼쪽 메뉴 **SQL Editor** → **New query** → 아래를 붙여넣고 **Run**.

### 1-0. 통합 진단 (이것 하나만 실행하면 1-1 ~ 1-4를 모두 포함한다)

```sql
select section, item, detail from (
  -- 0) 테이블 존재 확인 (이름이 다르면 아래 진단이 전부 빈다)
  select 0 as ord, 'A. 테이블' as section, t.name::text as item,
         case when to_regclass('public.' || t.name) is null
              then '없음 ← 테이블 이름 확인 필요' else '있음' end as detail
  from (values ('user_cpa'),('cpa_questions_v2'),('cpa_review_notes')) as t(name)

  -- 1) RLS 활성화 여부
  union all
  select 1, 'B. RLS 켜짐?', relname::text,
         case when relrowsecurity then '켜짐'
              else '꺼짐 ← 정책과 무관하게 전부 공개 상태' end
  from pg_class
  where relnamespace = 'public'::regnamespace
    and relname in ('user_cpa','cpa_questions_v2','cpa_review_notes')

  -- 2) 현재 정책 (위험한 것 표시)
  union all
  select 2, 'C. 현재 정책', (tablename || ' / ' || policyname)::text,
         cmd || ' to ' || array_to_string(roles, ',')
         || ' using(' || coalesce(qual, '-') || ')'
         || case when tablename = 'user_cpa' and cmd in ('UPDATE','ALL')
                 then '  [!] 사용자가 자기 role을 ADMIN으로 바꿀 수 있음' else '' end
         || case when coalesce(qual, '') = 'true' and cmd in ('SELECT','ALL')
                 then '  [!] 전체 공개 읽기' else '' end
  from pg_policies
  where schemaname = 'public'
    and tablename in ('user_cpa','cpa_questions_v2','cpa_review_notes')

  -- 3) 컬럼 타입 (STEP 2 정책 문법이 여기서 갈린다)
  union all
  select 3, 'D. 컬럼 타입', (table_name || '.' || column_name)::text,
         data_type
         || case when table_name='user_cpa' and column_name='id' and data_type <> 'uuid'
                 then '  <- STEP 2에서 auth.uid()::text 로 바꿔야 함' else '' end
  from information_schema.columns
  where table_schema = 'public'
    and (table_name, column_name) in (('user_cpa','id'), ('user_cpa','exp'))

  -- 4) 롤백용 복원 SQL (반드시 따로 저장해 둘 것)
  union all
  select 4, 'E. 롤백용 복원SQL', tablename::text,
         'create policy "' || policyname || '" on ' || schemaname || '.' || tablename
         || ' as ' || permissive || ' for ' || cmd
         || ' to ' || array_to_string(roles, ', ')
         || coalesce(' using (' || qual || ')', '')
         || coalesce(' with check (' || with_check || ')', '') || ';'
  from pg_policies
  where schemaname = 'public'
    and tablename in ('user_cpa','cpa_questions_v2','cpa_review_notes')
) t
order by ord, item;
```

**결과 읽는 법**

| 구역 | 봐야 할 것 |
|---|---|
| A. 테이블 | 셋 다 `있음`이어야 한다. `없음`이면 실제 테이블명을 확인해 이후 SQL의 이름을 모두 바꾼다. |
| B. RLS 켜짐? | `꺼짐`인 테이블은 정책과 무관하게 지금 전부 공개다. |
| C. 현재 정책 | `[!]` 표시가 붙은 행이 이번에 없애려는 대상이다. 아무 행도 없으면 정책이 없다는 뜻(B가 `꺼짐`이면 공개, `켜짐`이면 이미 잠긴 상태). |
| D. 컬럼 타입 | `user_cpa.id`가 `uuid`가 아니면 STEP 2에서 `auth.uid()::text`로 바꿔야 한다. |
| E. 롤백용 복원SQL | **이 행들을 메모장에 복사해 둔다.** STEP 4 롤백의 유일한 수단이다. |

E 구역이 비어 있으면(정책이 원래 없었으면) 롤백 시 복원할 정책도 없다는 뜻이므로 그대로 진행하면 된다.

---

<details>
<summary>참고: 1-0을 항목별로 나눠 실행하고 싶을 때 (1-1 ~ 1-4)</summary>

### 1-1. 현재 정책을 복원용 SQL로 덤프 (롤백 대비 — 결과를 어딘가에 저장해 둘 것)

```sql
select 'create policy "' || policyname || '" on ' || schemaname || '.' || tablename ||
       ' as ' || permissive || ' for ' || cmd ||
       ' to ' || array_to_string(roles, ', ') ||
       coalesce(' using (' || qual || ')', '') ||
       coalesce(' with check (' || with_check || ')', '') || ';' as restore_sql
from pg_policies
where schemaname = 'public'
  and tablename in ('user_cpa', 'cpa_questions_v2', 'cpa_review_notes');
```

### 1-2. RLS 활성화 여부

```sql
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('user_cpa', 'cpa_questions_v2', 'cpa_review_notes');
```

`rls_enabled`가 `false`인 테이블은 정책과 무관하게 anon에게 전부 열려 있다는 뜻이다.

### 1-3. 위험한 정책이 있는지 확인

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_cpa', 'cpa_questions_v2', 'cpa_review_notes')
order by tablename, cmd;
```

특히 다음을 확인한다:

- **`user_cpa`에 `cmd = 'UPDATE'`(또는 `'ALL'`) 정책이 있는가** — 있으면 사용자가 자기 행의
  `role`을 `'ADMIN'`으로 바꾸거나 `exp`를 임의로 올릴 수 있다. 가장 시급한 항목이다.
- `qual`이 `true`인 광범위한 SELECT 정책 — 모범답안·타인 오답노트 노출 경로다.

### 1-4. 컬럼 타입 확인 (STEP 2의 정책·EXP 처리와 직결)

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (('user_cpa','id'), ('user_cpa','exp'));
```

- `user_cpa.id`가 **`uuid`가 아니라 `text`**라면 STEP 2의 정책에서 `(select auth.uid())`를
  `(select auth.uid())::text`로 바꿔야 한다. 안 그러면 타입 불일치로 본인 프로필 조회가
  실패하고 **로그인이 안 되는 것처럼 보인다.**
- `user_cpa.exp`가 `integer`류면 소수 경험치 update가 거부된다 — 코드에서 이미 정수로
  반올림하므로(`sanitizeExpGain` + `incrementProgress`) 문제없지만, 확인해 두면 좋다.

</details>

---

## STEP 2. 적용

아래를 **그대로** SQL Editor에 붙여넣고 Run 한다. 수정할 곳은 없다 —
`user_cpa.id`가 `uuid`든 `text`든 스크립트가 컬럼 타입을 읽어 비교식을 스스로 맞춘다.

전체가 하나의 트랜잭션이라, 대상 테이블이 하나라도 없으면 명확한 메시지와 함께
**아무것도 바꾸지 않고 중단**한다.

> 실행 전에 STEP 1의 **E. 롤백용 복원SQL** 결과를 저장해 두었는지 확인할 것.
> 이 스크립트는 대상 3개 테이블의 기존 정책을 모두 제거한다.

```sql
begin;

do $$
declare
  p        record;
  t        text;
  id_type  text;
  uid_expr text;
  tables   text[] := array['user_cpa','cpa_questions_v2','cpa_review_notes'];
begin
  -- 1) 대상 테이블이 모두 있는지 먼저 확인 (없으면 아무것도 적용하지 않고 중단)
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise exception '테이블 public.% 를 찾을 수 없습니다. 실제 테이블명을 확인한 뒤 다시 실행하세요.', t;
    end if;
  end loop;

  -- 2) 대상 테이블의 기존 정책 전부 제거
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename = any(tables)
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    raise notice '기존 정책 제거: % / %', p.tablename, p.policyname;
  end loop;

  -- 3) RLS 활성화
  --    cpa_questions_v2 / cpa_review_notes에는 정책을 만들지 않는다:
  --    RLS가 켜져 있고 정책이 없으면 클라이언트에는 0행이 보이고, service role은 RLS를 우회한다.
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- 4) user_cpa.id 타입에 맞는 비교식 자동 선택
  select data_type into id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_cpa' and column_name = 'id';

  if id_type is null then
    raise exception 'user_cpa.id 컬럼을 찾을 수 없습니다.';
  elsif id_type = 'uuid' then
    uid_expr := '(select auth.uid())';
  else
    uid_expr := '(select auth.uid())::text';
  end if;
  raise notice 'user_cpa.id 타입 = %  ->  비교식 %', id_type, uid_expr;

  -- 5) user_cpa: 본인 행만 조회 / 본인 행만 생성
  --    익명(비회원) 세션도 Supabase에서는 authenticated 역할이므로 is_anonymous로 걸러낸다 —
  --    비회원은 user_cpa에 영구 프로필을 만들지 않는 것이 앱의 기존 규칙이다.
  execute format($f$
    create policy "user_cpa_select_own" on public.user_cpa
      for select to authenticated
      using ( %s = id )
  $f$, uid_expr);

  execute format($f$
    create policy "user_cpa_insert_own" on public.user_cpa
      for insert to authenticated
      with check (
        %s = id
        and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      )
  $f$, uid_expr);

  raise notice '적용 완료';
end $$;

commit;
```

**성공 시 출력되는 NOTICE** (Supabase SQL Editor 하단에 표시된다)

```
NOTICE:  기존 정책 제거: user_cpa / <기존 정책명>
NOTICE:  user_cpa.id 타입 = uuid  ->  비교식 (select auth.uid())
NOTICE:  적용 완료
```

**UPDATE·DELETE 정책은 의도적으로 만들지 않는다.** 경험치 증가와 등급 변경은 각각
`updateUserProgressAction`(본인 확인 + 정수 반올림 + 1회 최대 50 클램프)과
`updateUserRoleAction`(`assertAdmin`)을 거쳐 서버에서 service role로만 수행한다.

---

## STEP 3. 검증

### 3-1. anon 키로 직접 조회 → 셋 다 `[]`가 나와야 한다

```bash
export U="<NEXT_PUBLIC_SUPABASE_URL>"
export K="<NEXT_PUBLIC_SUPABASE_ANON_KEY>"

# 모범답안·루브릭이 딸려오면 실패
curl -s "$U/rest/v1/cpa_questions_v2?select=*&limit=1" -H "apikey: $K"

# 타인의 오답노트가 보이면 실패
curl -s "$U/rest/v1/cpa_review_notes?select=*&limit=1"  -H "apikey: $K"

# 로그아웃 상태에서 회원 목록이 보이면 실패
curl -s "$U/rest/v1/user_cpa?select=*&limit=1"          -H "apikey: $K"
```

### 3-2. 앱 주요 흐름 (하나라도 깨지면 STEP 4로)

- [ ] 로그인 → 대시보드에 닉네임·등급·레벨이 뜬다 *(깨지면 대개 STEP 1-4의 `id` 타입 문제)*
- [ ] 회원가입 → 입력한 닉네임이 그대로 유지된다
- [ ] 비회원으로 둘러보기 → 문제 풀기까지 진행된다
- [ ] 문제 풀기 → 채점 결과와 점수가 나온다
- [ ] 채점 후 경험치가 **정수로** 오른다
- [ ] 오답 노트 저장·조회·삭제
- [ ] 랭킹 목록이 보인다
- [ ] 관리자 페이지에서 회원 목록·문제 수정

---

## STEP 4. 롤백

STEP 2는 하나의 트랜잭션이므로 실행 중 실패했다면 아무것도 바뀌지 않았다.
커밋된 뒤 문제가 생겼다면:

```sql
begin;

-- 새로 만든 정책 제거
drop policy if exists "user_cpa_select_own" on public.user_cpa;
drop policy if exists "user_cpa_insert_own" on public.user_cpa;

-- STEP 1-1에서 덤프해 둔 restore_sql을 여기에 붙여넣어 실행

-- STEP 1-2에서 rls_enabled가 false였던 테이블만 되돌린다
-- alter table public.cpa_questions_v2 disable row level security;
-- alter table public.cpa_review_notes disable row level security;
-- alter table public.user_cpa         disable row level security;

commit;
```

---

## 키 취급

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 공개 값이다. 브라우저 번들에 들어가는 것이 정상이며,
  보호는 RLS가 담당한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회하므로 절대 클라이언트에 노출되면 안 된다.
  `NEXT_PUBLIC_` 접두사가 없어 Next.js가 클라이언트 번들에 인라인하지 않으며, 이 키를 쓰는
  `lib/supabaseAdmin.ts`는 서버 전용 모듈(`lib/dbAdmin.ts`)에서만 import한다.
  빌드 산출물에서 클라이언트 번들이 직접 참조하는 테이블이 `user_cpa`뿐임을 확인했다.
