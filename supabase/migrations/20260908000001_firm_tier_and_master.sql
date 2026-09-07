-- audit_say v2 — 감사인 군 체계 보정 및 등록회계법인 마스터 보강
--
-- 근거: 금융감독원·금융위원회 발표자료 정리본 (사용자 제공, 2026-09-08)
--       「외부감사법」 감사인 등록제 — 등록법인은 소속 회계사 수와 손해배상능력에
--       따라 가·나·다·라 4개 군으로 나뉜다.
--
-- 왜 필요한가: M0 에서는 PRD §6.2 가 "가군/나군" 이라고만 적어 CHECK 을 두 값으로
-- 걸었다. 실제 체계는 4개 군이라 다군·라군 법인을 넣을 수 없었다.

begin;

-- ── 1. 군 체계를 4단계로 ────────────────────────────────────────────────────
alter table public.firm_registered drop constraint if exists firm_registered_tier_check;

alter table public.firm_registered
  add constraint firm_registered_tier_check
  check (tier is null or tier in ('가군', '나군', '다군', '라군'));

comment on column public.firm_registered.tier is
  '감사인 등록 군. 가군=회계사 500인 이상·손배 1,000억 이상, 나군=100인/100억, 다군=40인/10억, 라군=그 밖. 감사인 군이 회사 군보다 같거나 높아야 수임할 수 있다. 미확인이면 NULL.';

-- ── 2. 가군 4개 법인 ────────────────────────────────────────────────────────
-- 글로벌 네트워크 매핑은 사용자 제공 문서의 값이 아니라 실제 제휴 관계를 따른다.
-- (문서에는 삼정=EY · 안진=KPMG · 한영=Deloitte 로 적혀 있으나 셋이 서로 밀려 있다.)
update public.firm_registered set tier = '가군', updated_at = now()
 where firm_name in ('삼일회계법인', '삼정회계법인', '안진회계법인', '한영회계법인');

-- ── 3. 등록법인 마스터 보강 ─────────────────────────────────────────────────
-- 출처 문서의 나군·다군 명단은 2019년 등록제 도입 당시 기준 "예시"이고 이후
-- 합병·등록취소로 변동이 있다고 문서가 스스로 밝히고 있다. 그래서
--   · 법인별 군 매핑이 없으므로 tier 는 NULL 로 둔다 (중견/중형/소형은 군 구분이 아니다)
--   · 등록번호도 문서에 없어 NULL 이다
-- 확정 값은 M1 수집의 unmatchedAuditors 보고서와 금감원 원자료로 채운다.
insert into public.firm_registered (firm_name, alias) values
  ('신우회계법인',     array['신우']),
  ('대성삼경회계법인', array['대성삼경', '대성', '삼경']),
  ('성도이현회계법인', array['성도이현', '성도', '이현']),
  ('도원회계법인',     array['도원']),
  ('다산회계법인',     array['다산']),
  ('태성회계법인',     array['태성']),
  ('정진세림회계법인', array['정진세림', '정진', '세림']),
  ('현대회계법인',     array['현대']),
  ('삼도회계법인',     array['삼도']),
  ('예일회계법인',     array['예일']),
  ('안경회계법인',     array['안경']),
  ('세일원회계법인',   array['세일원']),
  ('동아송강회계법인', array['동아송강', '동아', '송강']),
  ('서우회계법인',     array['서우'])
on conflict (firm_name) do nothing;

commit;
