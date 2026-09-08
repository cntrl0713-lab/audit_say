-- Read-only deployment receipt. Contains counts and catalog metadata, no answers or identities.
with expected(name) as (values
 ('cpa_question_sets'),('cpa_subquestions'),('cpa_question_set_versions'),
 ('cpa_subquestion_versions'),('cpa_subquestion_answers'),('cpa_question_sources'),
 ('cpa_requirements'),('cpa_criteria'),('cpa_criterion_sources'),('cpa_criterion_facts'),
 ('cpa_question_review_events'),('cpa_question_bank_releases'),('cpa_question_bank_release_items'),
 ('cpa_attempts'),('cpa_attempt_answers'),('cpa_grading_runs'),('cpa_subquestion_grade_results'),
 ('cpa_criterion_grade_results'),('cpa_review_items'),('cpa_xp_events')
), inventory as (
 select e.name,c.oid,c.relrowsecurity from expected e
 left join pg_class c on c.relname=e.name and c.relnamespace='public'::regnamespace and c.relkind='r'
)
select jsonb_build_object(
 'table_count',(select count(oid) from inventory),
 'rls_enabled_count',(select count(*) from inventory where relrowsecurity),
 'browser_table_grants',(select count(*) from inventory i cross join (values ('anon'),('authenticated')) r(role_name)
   where has_table_privilege(r.role_name,i.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')),
 'service_table_access_count',(select count(*) from inventory where has_table_privilege('service_role',oid,'SELECT')),
 'question_sets',(select count(*) from public.cpa_question_sets),
 'subquestions',(select count(*) from public.cpa_subquestions),
 'criteria',(select count(*) from public.cpa_criteria),
 'sources',(select count(*) from public.cpa_question_sources),
 'active_release',(select jsonb_build_object('id',id,'release_no',release_no,'source_file_hash',source_file_hash,
   'bank_content_hash',bank_content_hash,'source_document_bytes',octet_length(source_document),
   'source_hash_matches',source_file_hash=encode(sha256(convert_to(source_document,'UTF8')),'hex'),
   'validation_report',validation_report) from public.cpa_question_bank_releases where status='active'),
 'active_release_sets',(select count(*) from public.cpa_question_bank_release_items i
   join public.cpa_question_bank_releases r on r.id=i.release_id where r.status='active'),
 'total_points',(select sum(v.max_points) from public.cpa_question_set_versions v
   join public.cpa_question_bank_release_items i on i.set_version_id=v.id
   join public.cpa_question_bank_releases r on r.id=i.release_id where r.status='active'),
 'existing_profiles',(select count(*) from public.cpa_users),
 'existing_exp_total',(select sum(exp) from public.cpa_users),
 'legacy_v2_questions',(select count(*) from public.cpa_questions_v2),
 'attempts',(select count(*) from public.cpa_attempts),
 'xp_events',(select count(*) from public.cpa_xp_events),
 'retention_job',(select jsonb_agg(jsonb_build_object('jobid',jobid,'schedule',schedule,'active',active))
   from cron.job where jobname='cpa-learning-guest-retention')
) as receipt;
