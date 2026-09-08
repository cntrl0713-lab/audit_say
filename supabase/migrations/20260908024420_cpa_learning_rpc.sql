-- Learning writes are accessible only to the trusted server. No opening balances
-- are created by this migration: invoke cpa_initialize_learning_progress at cutover.
begin;

create or replace function public.cpa_normalize_answer_quote(p_text text)
returns text language sql immutable strict set search_path = pg_catalog, public as $$
  select btrim(regexp_replace(p_text,
    U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'));
$$;

create or replace function public.cpa_answer_utf16_length(p_text text)
returns integer language sql immutable strict set search_path = pg_catalog, public as $$
  select coalesce(sum(case when ascii(ch) > 65535 then 2 else 1 end),0)::integer
  from regexp_split_to_table(p_text,'') as chars(ch);
$$;

create or replace function public.cpa_begin_attempt(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_owner uuid := (p_payload->>'owner_user_id')::uuid;
  v_actor text := p_payload->>'actor_kind';
  v_set uuid := (p_payload->>'set_version_id')::uuid;
  v_key uuid := (p_payload->>'submission_key')::uuid;
  v_submitted timestamptz := (p_payload->>'submitted_at')::timestamptz;
  v_expires timestamptz := (p_payload->>'expires_at')::timestamptz;
  v_answers jsonb := p_payload->'answers';
  v_attempt public.cpa_attempts%rowtype;
  v_anonymous boolean;
  v_new boolean;
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
    or v_owner is null or v_set is null or v_key is null
    or v_submitted is null or v_submitted > clock_timestamp() + interval '30 seconds'
    or v_actor not in ('member','guest') or v_actor is null
    or jsonb_typeof(v_answers) is distinct from 'object'
    or not coalesce(p_payload->>'answers_hash' ~ '^[a-f0-9]{64}$',false) then
    raise exception 'Invalid submission payload';
  end if;
  select coalesce(is_anonymous,false) into v_anonymous from auth.users where id=v_owner;
  if not found then raise exception 'Unknown submission owner'; end if;
  if v_actor='member' and (v_anonymous or not exists(
    select 1 from public.cpa_users where id=v_owner and role in ('MEMBER','PRO','ADMIN')
  )) then raise exception 'Member profile required'; end if;
  -- A signed token issued while anonymous may be retried after account conversion.
  -- The server verifies that token and its original actor before calling this RPC.
  if (v_actor='member' and v_expires is not null)
    or (v_actor='guest' and (v_expires is null or v_expires <> v_submitted+interval '168 hours'
      or v_expires <= clock_timestamp())) then raise exception 'Submission expired or invalid retention'; end if;
  if not exists(select 1 from public.cpa_question_bank_release_items ri
    join public.cpa_question_bank_releases r on r.id=ri.release_id
    join public.cpa_question_set_versions sv on sv.id=ri.set_version_id
    where ri.release_id=(p_payload->>'release_id')::uuid and ri.set_id=p_payload->>'set_id'
      and ri.set_version_id=v_set and r.status in ('active','retired')
      and r.published_at is not null and sv.sealed_at is not null)
  then raise exception 'Submission version is not published'; end if;
  if exists(select 1 from jsonb_each(v_answers) a where jsonb_typeof(a.value)<>'string'
    or public.cpa_answer_utf16_length(a.value#>>'{}') > 5000
    or not exists(select 1 from public.cpa_subquestion_versions sv
      join public.cpa_subquestions s on s.id=sv.subquestion_id
      where sv.set_version_id=v_set and s.code=a.key))
  then raise exception 'Invalid answer or subquestion code'; end if;

  insert into public.cpa_attempts(owner_user_id,actor_kind,release_id,set_id,set_version_id,
    submission_key,answers_hash,status,submitted_at,expires_at)
  values(v_owner,v_actor,(p_payload->>'release_id')::uuid,p_payload->>'set_id',v_set,
    v_key,p_payload->>'answers_hash','queued',v_submitted,v_expires)
  on conflict(owner_user_id,submission_key) do nothing returning * into v_attempt;
  v_new := found;
  if not v_new then
    select * into v_attempt from public.cpa_attempts
      where owner_user_id=v_owner and submission_key=v_key for update;
    if v_attempt.expires_at <= clock_timestamp() then raise exception 'Submission expired'; end if;
    if v_attempt.set_version_id <> v_set or v_attempt.release_id<>(p_payload->>'release_id')::uuid
      or v_attempt.set_id<>p_payload->>'set_id' or v_attempt.answers_hash<>p_payload->>'answers_hash'
      or v_attempt.actor_kind<>v_actor or v_attempt.submitted_at<>v_submitted
      or v_attempt.expires_at is distinct from v_expires
      or exists(select 1 from public.cpa_attempt_answers a
        join public.cpa_subquestion_versions sv on sv.id=a.subquestion_version_id
        join public.cpa_subquestions s on s.id=sv.subquestion_id
        where a.attempt_id=v_attempt.id and a.answer_text<>coalesce(v_answers->>s.code,''))
    then raise exception 'Submission key conflict'; end if;
  else
    insert into public.cpa_attempt_answers(attempt_id,set_version_id,subquestion_version_id,answer_text)
      select v_attempt.id,v_set,sv.id,coalesce(v_answers->>s.code,'')
      from public.cpa_subquestion_versions sv join public.cpa_subquestions s on s.id=sv.subquestion_id
      where sv.set_version_id=v_set;
  end if;
  return jsonb_build_object('attempt_id',v_attempt.id,'status',v_attempt.status,
    'current_grading_run_id',v_attempt.current_grading_run_id);
end;
$$;

create or replace function public.cpa_claim_grading_run(
  p_attempt_id uuid,p_owner_user_id uuid,p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_attempt public.cpa_attempts%rowtype;
  v_run public.cpa_grading_runs%rowtype;
  v_run_no integer;
begin
  select * into v_attempt from public.cpa_attempts
    where id=p_attempt_id and owner_user_id=p_owner_user_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.expires_at <= clock_timestamp() then raise exception 'Submission expired'; end if;
  if v_attempt.status='completed' then
    return jsonb_build_object('state','completed','run_id',v_attempt.current_grading_run_id);
  end if;
  select * into v_run from public.cpa_grading_runs
    where attempt_id=p_attempt_id and status='running' for update;
  if found and v_run.lease_expires_at>clock_timestamp() then
    return jsonb_build_object('state','busy');
  end if;
  if v_run.id is not null then
    update public.cpa_grading_runs set status='failed',error_code='lease_expired',finished_at=clock_timestamp()
      where id=v_run.id;
  end if;
  if jsonb_typeof(p_metadata) is distinct from 'object'
    or nullif(p_metadata->>'engine_version','') is null
    or nullif(p_metadata->>'grading_contract_hash','') is null then
    raise exception 'Grading metadata required';
  end if;
  select coalesce(max(run_no),0)+1 into v_run_no from public.cpa_grading_runs where attempt_id=p_attempt_id;
  insert into public.cpa_grading_runs(attempt_id,set_version_id,run_no,run_kind,status,
    lease_token,lease_expires_at,engine_version,grading_contract_hash,prompt_hash,provider,model,max_points,started_at)
  select p_attempt_id,v_attempt.set_version_id,v_run_no,case when v_run_no=1 then 'initial' else 'retry' end,
    'running',gen_random_uuid(),clock_timestamp()+interval '3 minutes',p_metadata->>'engine_version',
    p_metadata->>'grading_contract_hash',p_metadata->>'prompt_hash',p_metadata->>'provider',p_metadata->>'model',
    sv.max_points,clock_timestamp() from public.cpa_question_set_versions sv where sv.id=v_attempt.set_version_id
  returning * into v_run;
  update public.cpa_attempts set status='grading' where id=p_attempt_id;
  return jsonb_build_object('state','claimed','run_id',v_run.id,'lease_token',v_run.lease_token);
end;
$$;

create or replace function public.cpa_get_attempt_result(p_attempt_id uuid,p_owner_user_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_attempt public.cpa_attempts%rowtype; v_result jsonb;
begin
  select * into v_attempt from public.cpa_attempts where id=p_attempt_id and owner_user_id=p_owner_user_id;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.expires_at<=clock_timestamp() then raise exception 'Submission expired'; end if;
  if v_attempt.status='completed' then
    select jsonb_build_object('question_set_id',v_attempt.set_id,'score',gr.score,'max_points',gr.max_points,
      'security_flag',gr.security_flag,'subquestions',coalesce((
        select jsonb_agg(jsonb_build_object('subquestion_id',s.code,'prompt',sv.prompt,'user_answer',a.answer_text,
          'score',sr.score,'max_points',sr.max_points,'model_answer',to_jsonb(ma.model_answer),
          'criteria',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'criterion_id',c.code,'verdict',cr.verdict,'quote',cr.quote,'reason',cr.reason,
            'claim',c.claim,'max_points',cr.max_points,'awarded_points',cr.awarded_points)) order by c.position)
            from public.cpa_criterion_grade_results cr join public.cpa_criteria c on c.id=cr.criterion_id
            where cr.grading_run_id=gr.id and cr.subquestion_version_id=sv.id),'[]'::jsonb)) order by sv.position)
        from public.cpa_subquestion_grade_results sr
        join public.cpa_subquestion_versions sv on sv.id=sr.subquestion_version_id
        join public.cpa_subquestions s on s.id=sv.subquestion_id
        join public.cpa_attempt_answers a on a.attempt_id=sr.attempt_id and a.subquestion_version_id=sv.id
        join public.cpa_subquestion_answers ma on ma.subquestion_version_id=sv.id
        where sr.grading_run_id=gr.id),'[]'::jsonb)) into v_result
      from public.cpa_grading_runs gr where gr.id=v_attempt.current_grading_run_id and gr.status='completed';
    if v_result is null then raise exception 'Completed grading result missing'; end if;
  end if;
  return jsonb_build_object('attempt_id',v_attempt.id,'status',v_attempt.status,
    'submitted_at',v_attempt.submitted_at,'completed_at',v_attempt.completed_at,
    'expires_at',v_attempt.expires_at,'result',v_result);
end;
$$;

create or replace function public.cpa_initialize_learning_progress()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_count integer; v_release uuid;
begin
  if exists(select 1 from public.cpa_question_bank_releases where validation_report ? 'learning_progress_initialized_at') then return 0; end if;
  lock table public.cpa_users in share row exclusive mode;
  if exists(select 1 from public.cpa_question_bank_releases where validation_report ? 'learning_progress_initialized_at') then return 0; end if;
  select id into v_release from public.cpa_question_bank_releases where status='active' for update;
  if not found then raise exception 'An active question release is required for learning cutover'; end if;
  insert into public.cpa_xp_events(user_id,event_type,amount,event_key,credited_at)
    select u.id,'opening_balance',u.exp,'opening:'||u.id::text,clock_timestamp()
    from public.cpa_users u join auth.users au on au.id=u.id
    where not coalesce(au.is_anonymous,false) and u.role in ('MEMBER','PRO','ADMIN')
    on conflict do nothing;
  get diagnostics v_count=row_count;
  if not exists(select 1 from public.cpa_question_bank_releases where validation_report ? 'learning_progress_initialized_at') then
    perform set_config('cpa.learning_initialization_write','on',true);
    update public.cpa_question_bank_releases set validation_report=validation_report ||
      jsonb_build_object('learning_progress_initialized_at',clock_timestamp()) where id=v_release;
    perform set_config('cpa.learning_initialization_write','off',true);
  end if;
  return v_count;
end;
$$;

create or replace function public.cpa_complete_grading_run(
  p_attempt_id uuid,p_owner_user_id uuid,p_run_id uuid,p_lease_token uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_attempt public.cpa_attempts%rowtype;
  v_run public.cpa_grading_runs%rowtype;
  v_note public.cpa_review_items%rowtype;
  v_sub record;
  v_criterion record;
  v_jsub jsonb;
  v_jcriterion jsonb;
  v_raw jsonb := p_result->'raw_judgment';
  v_raw_sub jsonb;
  v_raw_criterion jsonb;
  v_verdict text;
  v_quote text;
  v_points integer;
  v_sub_score integer;
  v_total integer := 0;
  v_security text := p_result->>'security_flag';
  v_sub_security text;
  v_raw_injection boolean;
  v_raw_salad boolean;
  v_old_submitted timestamptz;
  v_old_attempt uuid;
  v_last_result_newer boolean;
  v_last_failure_newer boolean;
  v_reopen boolean;
  v_existing_exp bigint;
  v_event uuid;
  v_now timestamptz;
begin
  select * into v_attempt from public.cpa_attempts
    where id=p_attempt_id and owner_user_id=p_owner_user_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.expires_at<=clock_timestamp() then raise exception 'Submission expired'; end if;
  -- A duplicated completion never re-runs notebook processing or XP writes.
  if v_attempt.status='completed' then
    if v_attempt.current_grading_run_id<>p_run_id then raise exception 'Stale grading run'; end if;
    if not exists(select 1 from public.cpa_grading_runs where id=p_run_id and lease_token=p_lease_token)
      then raise exception 'Invalid grading lease'; end if;
    return public.cpa_get_attempt_result(p_attempt_id,p_owner_user_id);
  end if;
  select * into v_run from public.cpa_grading_runs where id=p_run_id and attempt_id=p_attempt_id for update;
  if not found or v_run.status<>'running' or v_run.lease_token is distinct from p_lease_token
    or v_run.lease_expires_at<=clock_timestamp() then raise exception 'Stale grading lease'; end if;
  if jsonb_typeof(p_result) is distinct from 'object'
    or p_result->>'question_set_id' is distinct from v_attempt.set_id
    or jsonb_typeof(p_result->'subquestions') is distinct from 'array'
    or v_security is null or v_security not in ('none','injection','keyword_salad') then
    raise exception 'Invalid grading result';
  end if;
  if jsonb_array_length(p_result->'subquestions')<>(select count(*) from public.cpa_subquestion_versions where set_version_id=v_attempt.set_version_id)
    or (select count(distinct j->>'subquestion_id') from jsonb_array_elements(p_result->'subquestions') j)
      <>jsonb_array_length(p_result->'subquestions') then raise exception 'Grading subquestion coverage mismatch'; end if;
  if p_result->'max_points' is distinct from to_jsonb(v_run.max_points)
    or (coalesce((v_raw->>'injection_detected')::boolean,false) and v_security<>'injection') then
    raise exception 'Grading maximum or security mismatch';
  end if;
  if v_attempt.actor_kind='member' then
    if not exists(select 1 from public.cpa_question_bank_releases where validation_report ? 'learning_progress_initialized_at') then
      raise exception 'Learning progress requires initialization'; end if;
    -- The same user-row lock is used by manual notebook edits and all completions.
    -- It also serializes opening balance initialization and cache increments.
    select exp into v_existing_exp from public.cpa_users where id=p_owner_user_id for update;
    if not found then raise exception 'Member profile required'; end if;
    if not exists(select 1 from public.cpa_xp_events where user_id=p_owner_user_id and event_type='opening_balance') then
      if v_existing_exp<>0 then raise exception 'Learning progress requires initialization'; end if;
      insert into public.cpa_xp_events(user_id,event_type,amount,event_key,credited_at)
        values(p_owner_user_id,'opening_balance',0,'opening:'||p_owner_user_id::text,clock_timestamp());
    end if;
  end if;
  for v_sub in select sv.*,s.code,a.answer_text from public.cpa_subquestion_versions sv
    join public.cpa_subquestions s on s.id=sv.subquestion_id
    join public.cpa_attempt_answers a on a.subquestion_version_id=sv.id and a.attempt_id=p_attempt_id
    where sv.set_version_id=v_attempt.set_version_id order by sv.position
  loop
    select j into v_jsub from jsonb_array_elements(p_result->'subquestions') j where j->>'subquestion_id'=v_sub.code;
    if v_jsub is null or jsonb_typeof(v_jsub->'criteria') is distinct from 'array'
      or v_jsub->'user_answer' is distinct from to_jsonb(v_sub.answer_text)
      or v_jsub->'max_points' is distinct from to_jsonb(v_sub.max_points) then
      raise exception 'Answer or subquestion maximum mismatch'; end if;
    if jsonb_array_length(v_jsub->'criteria')<>(select count(*) from public.cpa_criteria where subquestion_version_id=v_sub.id)
      or (select count(distinct j->>'criterion_id') from jsonb_array_elements(v_jsub->'criteria') j)
        <>jsonb_array_length(v_jsub->'criteria') then raise exception 'Criterion coverage mismatch'; end if;
    v_raw_sub := null;
    if jsonb_typeof(v_raw->'subquestions')='array' then
      select j into v_raw_sub from jsonb_array_elements(v_raw->'subquestions') j where j->>'subquestion_id'=v_sub.code;
    end if;
    v_raw_injection := coalesce((v_raw_sub->>'injection_detected')::boolean,false);
    v_raw_salad := coalesce((v_raw_sub->>'salad_detected')::boolean,false);
    v_sub_security := case when v_security='injection' or v_raw_injection then 'injection'
      when v_security='keyword_salad' or v_raw_salad then 'keyword_salad' else 'none' end;
    -- Parent result rows exist before their criterion children. Values are checked
    -- before completion and the whole call rolls back if any later check fails.
    insert into public.cpa_subquestion_grade_results(grading_run_id,attempt_id,set_version_id,
      subquestion_version_id,score,max_points,raw_injection_detected,raw_salad_detected,effective_security_flag)
    values(p_run_id,p_attempt_id,v_attempt.set_version_id,v_sub.id,0,v_sub.max_points,
      v_raw_injection,v_raw_salad,v_sub_security);
    v_sub_score := 0;
    for v_criterion in select * from public.cpa_criteria where subquestion_version_id=v_sub.id order by position loop
      select j into v_jcriterion from jsonb_array_elements(v_jsub->'criteria') j where j->>'criterion_id'=v_criterion.code;
      if v_jcriterion is null then raise exception 'Unknown or missing criterion'; end if;
      v_verdict := v_jcriterion->>'verdict';
      v_quote := nullif(v_jcriterion->>'quote','');
      if v_verdict is null or v_verdict not in ('met','partial','not_met','contradicted')
        or (v_verdict='partial' and v_criterion.partial_points is null)
        or (v_sub_security='injection' and v_verdict<>'not_met') then
        raise exception 'Criterion verdict violates grading contract'; end if;
      v_points := case v_verdict when 'met' then v_criterion.max_points when 'partial' then v_criterion.partial_points else 0 end;
      if v_jcriterion->'max_points' is distinct from to_jsonb(v_criterion.max_points)
        or v_jcriterion->'awarded_points' is distinct from to_jsonb(v_points) then
        raise exception 'Criterion points mismatch'; end if;
      if v_verdict='not_met' then
        if v_quote is not null then raise exception 'Unmet criterion must not retain a quote'; end if;
      elsif v_quote is null or public.cpa_normalize_answer_quote(v_quote)=''
        or strpos(public.cpa_normalize_answer_quote(v_sub.answer_text),public.cpa_normalize_answer_quote(v_quote))=0 then
        raise exception 'Criterion quote is not present in the submitted answer';
      end if;
      v_raw_criterion := null;
      if jsonb_typeof(v_raw_sub->'verdicts')='array' then
        select j into v_raw_criterion from jsonb_array_elements(v_raw_sub->'verdicts') j where j->>'criterion_id'=v_criterion.code;
      end if;
      insert into public.cpa_criterion_grade_results(grading_run_id,attempt_id,set_version_id,subquestion_version_id,
        criterion_id,raw_verdict,raw_quote,raw_reason,verdict,quote,quote_verified,reason,adjustment_code,awarded_points,max_points)
      values(p_run_id,p_attempt_id,v_attempt.set_version_id,v_sub.id,v_criterion.id,
        v_raw_criterion->>'verdict',v_raw_criterion->>'quote',coalesce(v_raw_criterion->>'reason',
          case when v_jcriterion->>'reason' not in ('이 criterion은 부분점수를 허용하지 않음','AI가 제시한 인용을 사용자 답안에서 확인할 수 없음') then v_jcriterion->>'reason' end),
        v_verdict,v_quote,v_quote is not null,
        case when v_verdict='not_met' and v_jcriterion->>'reason' in
          ('이 criterion은 부분점수를 허용하지 않음','AI가 제시한 인용을 사용자 답안에서 확인할 수 없음') then v_jcriterion->>'reason' end,
        case when v_raw_criterion is not null and (v_raw_criterion->>'verdict') is distinct from v_verdict
          then 'server_validation' else null end,v_points,v_criterion.max_points);
      v_sub_score := v_sub_score+v_points;
    end loop;
    if v_jsub->'score' is distinct from to_jsonb(v_sub_score) or v_sub_score>v_sub.max_points then
      raise exception 'Subquestion total mismatch'; end if;
    update public.cpa_subquestion_grade_results set score=v_sub_score where grading_run_id=p_run_id and subquestion_version_id=v_sub.id;
    v_total := v_total+v_sub_score;
  end loop;
  if p_result->'score' is distinct from to_jsonb(v_total) or v_total>v_run.max_points
    or (select count(*) from public.cpa_subquestion_grade_results where grading_run_id=p_run_id)
      <>(select count(*) from public.cpa_subquestion_versions where set_version_id=v_attempt.set_version_id)
  then raise exception 'Set total or answer coverage mismatch'; end if;

  v_now := clock_timestamp();
  update public.cpa_grading_runs set status='completed',score=v_total,security_flag=v_security,
    raw_injection_detected=(v_raw->>'injection_detected')::boolean,
    raw_salad_detected=(v_raw->>'salad_detected')::boolean,finished_at=v_now where id=p_run_id;
  update public.cpa_attempts set status='completed',completed_at=v_now,current_grading_run_id=p_run_id where id=p_attempt_id;

  if v_attempt.actor_kind='member' then
    for v_sub in select sv.id,sv.subquestion_id,sr.score,sr.max_points from public.cpa_subquestion_grade_results sr
      join public.cpa_subquestion_versions sv on sv.id=sr.subquestion_version_id where sr.grading_run_id=p_run_id loop
      if v_sub.score<v_sub.max_points then
        insert into public.cpa_review_items(user_id,subquestion_id,status,origin,memo,first_added_at,updated_at,state_changed_at)
        values(p_owner_user_id,v_sub.subquestion_id,'open','auto','',v_now,v_now,v_now)
        on conflict(user_id,subquestion_id) do nothing;
      end if;
      select * into v_note from public.cpa_review_items where user_id=p_owner_user_id and subquestion_id=v_sub.subquestion_id for update;
      if not found then continue; end if;
      select a.submitted_at,a.id into v_old_submitted,v_old_attempt from public.cpa_grading_runs r
        join public.cpa_attempts a on a.id=r.attempt_id where r.id=v_note.last_result_run_id;
      v_last_result_newer := not found or (v_attempt.submitted_at,v_attempt.id)>(v_old_submitted,v_old_attempt);
      select a.submitted_at,a.id into v_old_submitted,v_old_attempt from public.cpa_grading_runs r
        join public.cpa_attempts a on a.id=r.attempt_id where r.id=v_note.last_failed_run_id;
      v_last_failure_newer := v_sub.score<v_sub.max_points and
        (not found or (v_attempt.submitted_at,v_attempt.id)>(v_old_submitted,v_old_attempt));
      v_reopen := v_sub.score<v_sub.max_points and v_note.status<>'open' and
        (v_note.suppress_before is null or v_attempt.submitted_at>v_note.suppress_before);
      if v_last_result_newer or v_last_failure_newer or v_reopen then
        update public.cpa_review_items set
          last_result_run_id=case when v_last_result_newer then p_run_id else last_result_run_id end,
          last_result_subquestion_version_id=case when v_last_result_newer then v_sub.id else last_result_subquestion_version_id end,
          last_failed_run_id=case when v_last_failure_newer then p_run_id else last_failed_run_id end,
          last_failed_subquestion_version_id=case when v_last_failure_newer then v_sub.id else last_failed_subquestion_version_id end,
          status=case when v_reopen then 'open' else status end,
          state_changed_at=case when v_reopen then v_now else state_changed_at end,updated_at=v_now
        where id=v_note.id;
      end if;
    end loop;
    insert into public.cpa_xp_events(user_id,event_type,amount,source_attempt_id,source_grading_run_id,event_key,credited_at)
      values(p_owner_user_id,'submission_award',v_total,p_attempt_id,p_run_id,'submission:'||p_attempt_id::text,v_now)
      on conflict do nothing returning id into v_event;
    if v_event is null then raise exception 'Unexpected duplicate submission award'; end if;
    perform set_config('cpa.learning_progress_write','on',true);
    update public.cpa_users set exp=exp+v_total,level=1+(exp+v_total)/100 where id=p_owner_user_id;
    perform set_config('cpa.learning_progress_write','off',true);
  end if;
  return public.cpa_get_attempt_result(p_attempt_id,p_owner_user_id);
end;
$$;

create or replace function public.cpa_fail_grading_run(
  p_attempt_id uuid,p_owner_user_id uuid,p_run_id uuid,p_lease_token uuid,p_error_code text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_attempt public.cpa_attempts%rowtype; v_run public.cpa_grading_runs%rowtype;
begin
  select * into v_attempt from public.cpa_attempts where id=p_attempt_id and owner_user_id=p_owner_user_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.expires_at<=clock_timestamp() then raise exception 'Submission expired'; end if;
  if v_attempt.status='completed' then return jsonb_build_object('status','completed'); end if;
  select * into v_run from public.cpa_grading_runs where id=p_run_id and attempt_id=p_attempt_id for update;
  if not found or v_run.lease_token is distinct from p_lease_token or v_run.lease_expires_at<=clock_timestamp()
    then raise exception 'Stale grading lease'; end if;
  if v_run.status='failed' then return jsonb_build_object('status','failed'); end if;
  if v_run.status<>'running' then raise exception 'Grading run is not running'; end if;
  update public.cpa_grading_runs set status='failed',error_code=left(coalesce(p_error_code,'grading_failed'),100),
    finished_at=clock_timestamp() where id=p_run_id;
  update public.cpa_attempts set status='failed' where id=p_attempt_id;
  return jsonb_build_object('status','failed');
end;
$$;

create or replace function public.cpa_update_review_item(
  p_owner_user_id uuid,p_subquestion_id uuid,p_status text,p_memo text default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_note public.cpa_review_items%rowtype; v_now timestamptz;
begin
  if p_status is null or p_status not in ('open','resolved','removed') or length(p_memo)>10000 then
    raise exception 'Invalid review state or memo'; end if;
  perform 1 from public.cpa_users u join auth.users a on a.id=u.id
    where u.id=p_owner_user_id and not coalesce(a.is_anonymous,false) and u.role in ('MEMBER','PRO','ADMIN') for update of u;
  if not found then raise exception 'Member profile required'; end if;
  if not exists(select 1 from public.cpa_subquestion_versions sv
    join public.cpa_question_set_versions qv on qv.id=sv.set_version_id
    where sv.subquestion_id=p_subquestion_id and qv.sealed_at is not null)
    then raise exception 'Published subquestion required'; end if;
  v_now := clock_timestamp();
  insert into public.cpa_review_items(user_id,subquestion_id,status,origin,memo,first_added_at,updated_at,state_changed_at,suppress_before)
    values(p_owner_user_id,p_subquestion_id,p_status,'manual',coalesce(p_memo,''),v_now,v_now,v_now,
      case when p_status in ('resolved','removed') then v_now else null end)
    on conflict(user_id,subquestion_id) do update set status=excluded.status,
      memo=coalesce(p_memo,cpa_review_items.memo),updated_at=v_now,
      state_changed_at=case when cpa_review_items.status is distinct from excluded.status then v_now else cpa_review_items.state_changed_at end,
      suppress_before=case when cpa_review_items.status is distinct from excluded.status and p_status in ('resolved','removed')
        then v_now else cpa_review_items.suppress_before end
    returning * into v_note;
  return jsonb_build_object('id',v_note.id,'subquestion_id',v_note.subquestion_id,
    'status',v_note.status,'memo',v_note.memo,'updated_at',v_note.updated_at);
end;
$$;

create or replace function public.cpa_get_attempt_history(
  p_owner_user_id uuid,p_limit integer default 50,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language sql security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(h) order by h.submitted_at desc,h.id desc),'[]'::jsonb)
  from (select a.id,a.set_id as question_set_id,sv.title,a.submitted_at,a.status,r.score,
    sv.max_points,a.expires_at from public.cpa_attempts a
    join public.cpa_question_set_versions sv on sv.id=a.set_version_id
    left join public.cpa_grading_runs r on r.id=a.current_grading_run_id
    where a.owner_user_id=p_owner_user_id and (a.expires_at is null or a.expires_at>clock_timestamp())
      and (p_before is null or (p_before_id is null and a.submitted_at<p_before)
        or (p_before_id is not null and (a.submitted_at,a.id)<(p_before,p_before_id)))
    order by a.submitted_at desc,a.id desc limit greatest(1,least(coalesce(p_limit,50),100))) h;
$$;

create or replace function public.cpa_get_review_items(p_owner_user_id uuid,p_status text default 'open')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_result jsonb;
begin
  if p_status is null or p_status not in ('open','resolved','removed','all') then raise exception 'Invalid review state'; end if;
  if not exists(select 1 from public.cpa_users u join auth.users a on a.id=u.id
    where u.id=p_owner_user_id and not coalesce(a.is_anonymous,false) and u.role in ('MEMBER','PRO','ADMIN'))
    then raise exception 'Member profile required'; end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc,q.id),'[]'::jsonb) into v_result
  from (select n.id,n.subquestion_id,s.set_id as question_set_id,display.title,display.prompt,
      n.status,n.memo,n.updated_at,r.attempt_id as last_attempt_id,failed.attempt_id as last_failed_attempt_id
    from public.cpa_review_items n join public.cpa_subquestions s on s.id=n.subquestion_id
    left join public.cpa_grading_runs r on r.id=n.last_result_run_id
    left join public.cpa_grading_runs failed on failed.id=n.last_failed_run_id
    join lateral (select sv.prompt,qv.title from public.cpa_subquestion_versions sv
      join public.cpa_question_set_versions qv on qv.id=sv.set_version_id
      where sv.subquestion_id=n.subquestion_id and qv.sealed_at is not null
      order by (sv.id=n.last_failed_subquestion_version_id) desc nulls last,
        (sv.id=n.last_result_subquestion_version_id) desc nulls last,qv.revision desc limit 1) display on true
    where n.user_id=p_owner_user_id and (p_status='all' or n.status=p_status)) q;
  return v_result;
end;
$$;

create or replace function public.cpa_get_leaderboard(p_period text default 'all')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_start timestamptz; v_end timestamptz; v_result jsonb;
begin
  if p_period is null or p_period not in ('all','week','month') then raise exception 'Invalid ranking period'; end if;
  if p_period<>'all' then
    v_start := date_trunc(p_period,clock_timestamp() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
    v_end := ((v_start at time zone 'Asia/Seoul') + case when p_period='week' then interval '7 days' else interval '1 month' end) at time zone 'Asia/Seoul';
  end if;
  with totals as (
    select u.id,u.username,u.role,u.level,u.created_at,
      case when p_period='all' then u.exp else coalesce((select sum(e.amount) from public.cpa_xp_events e
        where e.user_id=u.id and e.event_type='submission_award' and e.credited_at>=v_start and e.credited_at<v_end),0) end as exp
    from public.cpa_users u join auth.users a on a.id=u.id
    where u.role in ('MEMBER','PRO','ADMIN') and not coalesce(a.is_anonymous,false)
  ), ranked as (
    select dense_rank() over(order by exp desc) as rank,username,role,level,exp,created_at,id
    from totals where p_period='all' or exp>0
  ), limited as (select * from ranked order by exp desc,created_at asc,id asc limit 10)
  select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'username',username,'role',role,'level',level,'exp',exp)
    order by exp desc,created_at asc,id asc),'[]'::jsonb) into v_result from limited;
  return v_result;
end;
$$;

create or replace function public.cpa_purge_expired_attempts(p_limit integer default 500)
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_count integer;
begin
  with expired as (select id from public.cpa_attempts where actor_kind='guest' and expires_at<=clock_timestamp()
    order by expires_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,500),5000)))
  delete from public.cpa_attempts a using expired e where a.id=e.id;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

-- Client policies cannot authorize mutable points. After the cutover even an old
-- deployment holding the service role cannot use its former direct UPDATE path.
create or replace function public.cpa_guard_progress_cache()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if (new.exp,new.level) is distinct from (old.exp,old.level)
    and exists(select 1 from public.cpa_question_bank_releases where validation_report ? 'learning_progress_initialized_at')
    and current_setting('cpa.learning_progress_write',true) is distinct from 'on' then
    raise exception 'Learning progress must be changed through the XP ledger';
  end if;
  return new;
end;
$$;
create trigger cpa_progress_cache_write before update of exp,level on public.cpa_users
for each row execute function public.cpa_guard_progress_cache();

create or replace function public.cpa_guard_learning_records()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row jsonb; v_attempt uuid; v_owner uuid; v_run uuid; v_ptr record;
begin
  if tg_op='DELETE' then v_row:=to_jsonb(old); else v_row:=to_jsonb(new); end if;
  if tg_table_name='cpa_attempts' then
    if tg_op='DELETE' then
      if not exists(select 1 from auth.users where id=old.owner_user_id)
        or (old.actor_kind='guest' and old.expires_at<=clock_timestamp()) then return old; end if;
      raise exception 'Retained attempts cannot be deleted directly';
    end if;
    if (to_jsonb(new)-'status'-'completed_at'-'current_grading_run_id') is distinct from
      (to_jsonb(old)-'status'-'completed_at'-'current_grading_run_id') then raise exception 'Submitted identity and answers are immutable'; end if;
    if old.status='completed' and new is distinct from old then raise exception 'Completed attempt is immutable'; end if;
    if new.status='completed' and not exists(select 1 from public.cpa_grading_runs r
      where r.id=new.current_grading_run_id and r.attempt_id=new.id and r.status='completed')
      then raise exception 'Completed run required'; end if;
  elsif tg_table_name='cpa_attempt_answers' then
    v_attempt:=(v_row->>'attempt_id')::uuid;
    if tg_op='DELETE' and not exists(select 1 from public.cpa_attempts where id=v_attempt) then return old; end if;
    if tg_op<>'INSERT' or exists(select 1 from public.cpa_attempts where id=v_attempt and status<>'queued')
      then raise exception 'Submitted answer is immutable'; end if;
  elsif tg_table_name in ('cpa_grading_runs','cpa_subquestion_grade_results','cpa_criterion_grade_results') then
    v_attempt:=(v_row->>'attempt_id')::uuid;
    if tg_op='DELETE' and not exists(select 1 from public.cpa_attempts where id=v_attempt) then return old; end if;
    if tg_table_name='cpa_grading_runs' then
      if tg_op='UPDATE' and ((to_jsonb(new)-'status'-'score'-'security_flag'-'raw_injection_detected'-'raw_salad_detected'-'error_code'-'finished_at'-'lease_expires_at')
        is distinct from (to_jsonb(old)-'status'-'score'-'security_flag'-'raw_injection_detected'-'raw_salad_detected'-'error_code'-'finished_at'-'lease_expires_at')) then
        raise exception 'Grading run identity is immutable'; end if;
      if tg_op<>'INSERT' and old.status in ('completed','failed') then raise exception 'Finished grading run is immutable'; end if;
    else
      v_run:=(v_row->>'grading_run_id')::uuid;
      if exists(select 1 from public.cpa_grading_runs where id=v_run and status<>'running')
        or (tg_op='UPDATE' and (to_jsonb(new)-'score') is distinct from (to_jsonb(old)-'score'))
        then raise exception 'Finished grading results are immutable'; end if;
    end if;
  elsif tg_table_name='cpa_review_items' then
    if tg_op='DELETE' then
      if not exists(select 1 from public.cpa_users where id=old.user_id)
        or not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
      raise exception 'Review removal must preserve its suppression state';
    end if;
    if tg_op='UPDATE' and (new.user_id,new.subquestion_id) is distinct from (old.user_id,old.subquestion_id) then
      raise exception 'Review identity is immutable'; end if;
    for v_ptr in select * from (values(new.last_result_run_id,new.last_result_subquestion_version_id),
      (new.last_failed_run_id,new.last_failed_subquestion_version_id)) pointers(run_id,sub_id) loop
      if v_ptr.run_id is not null and not exists(select 1 from public.cpa_subquestion_grade_results sr
        join public.cpa_attempts a on a.id=sr.attempt_id
        join public.cpa_subquestion_versions sv on sv.id=sr.subquestion_version_id
        where sr.grading_run_id=v_ptr.run_id and sv.id=v_ptr.sub_id and sv.subquestion_id=new.subquestion_id
          and a.owner_user_id=new.user_id and a.actor_kind='member') then raise exception 'Review result owner or question mismatch'; end if;
    end loop;
  elsif tg_table_name='cpa_xp_events' then
    if tg_op='DELETE' then
      if not exists(select 1 from public.cpa_users where id=old.user_id)
        or not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
      raise exception 'XP ledger is append-only';
    end if;
    if tg_op='UPDATE' then
      if old.created_by is not null and new.created_by is null and
        (to_jsonb(old)-'created_by')=(to_jsonb(new)-'created_by') then return new; end if;
      raise exception 'XP ledger is append-only';
    end if;
    if new.event_type='submission_award' and not exists(select 1 from public.cpa_attempts a
      join public.cpa_grading_runs r on r.id=a.current_grading_run_id
      where a.id=new.source_attempt_id and a.owner_user_id=new.user_id and a.actor_kind='member'
        and a.status='completed' and r.id=new.source_grading_run_id and r.score=new.amount) then
      raise exception 'XP award does not match a completed member result'; end if;
    if new.event_type='adjustment' and new.created_by is null then raise exception 'XP adjustment actor required'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger cpa_attempt_immutable before update or delete on public.cpa_attempts
for each row execute function public.cpa_guard_learning_records();
do $$
declare v_table text; v_function record;
begin
  foreach v_table in array array['cpa_attempt_answers','cpa_grading_runs','cpa_subquestion_grade_results','cpa_criterion_grade_results','cpa_review_items','cpa_xp_events'] loop
    execute format('create trigger cpa_learning_record_guard before insert or update or delete on public.%I for each row execute function public.cpa_guard_learning_records()',v_table);
  end loop;
  for v_function in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array['cpa_normalize_answer_quote','cpa_answer_utf16_length',
      'cpa_begin_attempt','cpa_claim_grading_run','cpa_complete_grading_run','cpa_fail_grading_run','cpa_get_attempt_result',
      'cpa_initialize_learning_progress','cpa_update_review_item','cpa_get_attempt_history','cpa_get_review_items',
      'cpa_get_leaderboard','cpa_purge_expired_attempts','cpa_guard_progress_cache','cpa_guard_learning_records'])
  loop
    execute format('revoke all on function %s from public,anon,authenticated',v_function.signature);
    execute format('grant execute on function %s to service_role',v_function.signature);
  end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
