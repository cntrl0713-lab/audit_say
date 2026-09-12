-- audit_say v2 — 등록회계법인 마스터 부분 시드 (M0)
--
-- ⚠ 이 시드는 "완전한 등록회계법인 목록"이 아니다.
--    법인명만 넣고 registration_no · tier · dart_corp_code 는 NULL 로 둔다.
--    등록번호와 가군/나군 구분은 확인되지 않은 값을 지어내지 않기 위해 비워 둔 것이며,
--    M1 수집기가 금감원 등록회계법인 목록과 DART corpCode.xml 로 백필한다.
--    (docs/회계법인-리서치-플랫폼-스키마-설계-기록.md "남은 판단거리" 1번)
--
-- alias 는 수집 시 법인명 정규화 매칭에 쓴다. 공시 문서마다 "삼일", "삼일회계법인",
-- "Samil PwC" 처럼 표기가 갈리므로 대표 변형을 미리 넣어 둔다.

begin;

insert into public.firm_registered (firm_name, alias) values
  ('삼일회계법인',  array['삼일', 'PwC', '삼일PwC', 'Samil', 'Samil PwC']),
  ('삼정회계법인',  array['삼정', 'KPMG', '삼정KPMG', 'Samjong']),
  ('안진회계법인',  array['안진', 'Deloitte', '딜로이트안진', '딜로이트 안진', 'Anjin']),
  ('한영회계법인',  array['한영', 'EY', 'EY한영', 'Hanyoung']),
  ('대주회계법인',  array['대주']),
  ('삼덕회계법인',  array['삼덕']),
  ('신한회계법인',  array['신한']),
  ('우리회계법인',  array['우리']),
  ('서현회계법인',  array['서현']),
  ('한울회계법인',  array['한울']),
  ('이촌회계법인',  array['이촌']),
  ('삼화회계법인',  array['삼화']),
  ('인덕회계법인',  array['인덕']),
  ('성현회계법인',  array['성현'])
on conflict (firm_name) do nothing;

commit;
