from pathlib import Path
import datetime
import hashlib
import json

root=Path.cwd()
base=root/'cpa_uploader/drafts/delegated-authoring-2026-09-11'
out=base/'n01/phase-two-v5'
control=root/'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11'
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
rel=lambda p:Path(p).relative_to(root).as_posix()
manifest=read(control/'final-153-v3/manifest.json')
entries=[e for e in manifest['entries'] if e['package'] in {'N01','N06','S01','S05','S06'}]
labels={'T02-A':'bank-v3-owned-resume-01','T01-A':'bank-v3-owned-02','T03-A':'bank-v3-after-refill-01',
 'T04-B':'bank-v3-after-refill-01','T16-A':'bank-v3-after-refill-02','T16-B':'bank-v3-after-refill-02',
 'T17-A':'bank-v3-after-refill-02','T02-B':'bank-v3-after-refill-02',
 'T01-B':'bank-v3-after-refill-03','T03-B':'bank-v3-after-refill-03','T04-C':'bank-v3-after-refill-03',
 'T15-A':'bank-v3-after-refill-03','T15-B':'bank-v3-after-refill-03','T16-C':'bank-v3-after-refill-03'}
allrows=[];runs=[];reuses=[];latest=[];nonpass=[]
for e in entries:
    folder=base/e['package'].lower()/'phase-two-v5'/e['set_id']
    question=read(root/e['file'])
    expected=[uid for sub in question['subquestions'] for uid in ['subquestion:'+sub['id'],*['criterion:'+sub['id']+':'+c['id'] for c in sub['criteria']]]]
    valid={};attempted=set()
    if folder.exists():
        for log in sorted(folder.glob('bank-v3-*/semantic.json.chunks.jsonl')):
            summary_file=log.parent/'summary.json'
            assert summary_file.exists(), 'No in-progress API process expected'
            summary=read(summary_file)
            rows=[json.loads(x) for x in log.read_text(encoding='utf-8').splitlines() if x.strip()]
            runs.append({'plan_id':e['plan_id'],'output':rel(log.parent),'summary':rel(summary_file),'summary_sha256':sha(summary_file),
                         'status':summary['status'],'raw_requests':len(rows),'complete_receipt':summary.get('status')=='receipt_created'})
            for line,row in enumerate(rows,1):
                assert row.get('record_kind')=='new_actual_model_request' and row.get('transport')=='model'
                isvalid=not row.get('error') and row.get('response') is not None
                actual={'plan_id':e['plan_id'],'set_id':e['set_id'],'log':rel(log),'log_sha256':sha(log),'line':line,
                        'performed_at':row['performed_at'],'unit_id':row['unit_id'],'attempt':row['attempt'],
                        'valid_grounded_response':isvalid,'response_received':row.get('response') is not None,
                        'http_status':row.get('http_status'),'request_id':row.get('request_id'),
                        'provider_error':row.get('provider_error'),'error_details':row.get('error_details'),'error':row.get('error'),
                        'input_hash':row['input_hash'],'schema_hash':row['schema_hash'],'instructions_hash':row['instructions_hash'],
                        'after_refill':log.parent.name.startswith('bank-v3-after-refill-')}
                allrows.append(actual);attempted.add(row['unit_id'])
                if isvalid:
                    assert row['unit_id'] not in valid, 'Unexpected duplicated valid unit; cannot silently select one'
                    valid[row['unit_id']]={**actual,'response':row['response']}
                    if any(v!='pass' for v in row['response']['checks'].values()) or any(c['verdict']!='pass' for c in row['response'].get('cases',[])):
                        nonpass.append({**actual,'checks':row['response']['checks'],'rationale':row['response']['rationale']})
            reuse=log.parent/'reused-actual-model-evidence.jsonl'
            if reuse.exists():
                for line,row in enumerate([json.loads(x) for x in reuse.read_text(encoding='utf-8').splitlines() if x.strip()],1):
                    assert row.get('new_api_request') is False
                    reuses.append({'plan_id':e['plan_id'],'file':rel(reuse),'line':line,'unit_id':row['unit_id'],
                                   'original_log':row['original_log'],'original_line':row['original_line'],'after_refill':log.parent.name.startswith('bank-v3-after-refill-')})
    active=folder/labels[e['plan_id']] if e['plan_id'] in labels else None
    active_summary=read(active/'summary.json') if active else None
    status=active_summary['status'] if active_summary else 'not_restarted_after_refill'
    latest.append({'plan_id':e['plan_id'],'set_id':e['set_id'],'package':e['package'],'status':status,
                   'receipt_verdict':active_summary.get('receipt_verdict') if active_summary else None,
                   'latest_output':rel(active) if active else None,'expected_units':len(expected),'unique_valid_units':len(valid),
                   'generated_cases_in_valid_units':sum(len(v['response'].get('cases',[])) for v in valid.values()),
                   'units_with_no_valid_response':[uid for uid in expected if uid not in valid],
                   'never_attempted_units':[uid for uid in expected if uid not in attempted],
                   'valid_nonpass_units':[v['unit_id'] for v in nonpass if v['plan_id']==e['plan_id']]})

allrows.sort(key=lambda r:(r['performed_at'],r['log'],r['line']))
after=[r for r in allrows if r['after_refill']]
last_success=next(r for r in reversed(allrows) if r['valid_grounded_response'])
last_failure=allrows[-1]
assert last_failure['plan_id']=='T16-C' and not last_failure['valid_grounded_response']
assert last_failure['provider_error']['code']=='credit_balance_exhausted'
stop='2026-09-11T04:51:02.280377+00:00'
assert all(datetime.datetime.fromisoformat(r['performed_at'].replace('Z','+00:00')) < datetime.datetime.fromisoformat(stop) for r in allrows)
totals={'assigned_sets':18,'expected_units':sum(r['expected_units'] for r in latest),
 'complete_pass_receipts':sum(r['receipt_verdict']=='pass' for r in latest),
 'complete_nonpass_receipts':sum(r['receipt_verdict'] not in {None,'pass'} for r in latest),
 'partial_all_independent_units_finished':sum(r['status']=='partial_units_completed' for r in latest),
 'unique_valid_units':sum(r['unique_valid_units'] for r in latest),
 'never_attempted_units':sum(len(r['never_attempted_units']) for r in latest),
 'units_without_valid_response':sum(len(r['units_with_no_valid_response']) for r in latest),
 'valid_nonpass_units_pending_two_exact_repeats':len(nonpass),
 'generated_cases_valid_units':sum(r['generated_cases_in_valid_units'] for r in latest),
 'actual_generated_case_grading':0,
 'all_bank_v3_actual_requests':len(allrows),'all_bank_v3_valid_responses':sum(r['valid_grounded_response'] for r in allrows),
 'all_bank_v3_failed_requests_or_grounding':sum(not r['valid_grounded_response'] for r in allrows),
 'all_bank_v3_reuse_applications_without_api':len(reuses),
 'after_refill_actual_requests':len(after),'after_refill_valid_responses':sum(r['valid_grounded_response'] for r in after),
 'after_refill_failed_requests_or_grounding':sum(not r['valid_grounded_response'] for r in after),
 'after_refill_reuse_applications_without_api':sum(r['after_refill'] for r in reuses),
 'new_requests_after_fatal_provider_stop':0}
record={'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'api_stopped_credit_exhausted_local_work_only',
 'runtime_lock':'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/runtime-v5-bank-v3-after-refill-01/runtime-lock.json',
 'runtime_lock_sha256':sha(control/'runtime-v5-bank-v3-after-refill-01/runtime-lock.json'),
 'fatal_stop_time':stop,'last_successful_actual_response':last_success,'last_failed_request':last_failure,
 'totals':totals,'latest_by_set':latest,'valid_nonpass_observations':nonpass,
 'all_run_outputs':runs,'all_incomplete_run_outputs':[r for r in runs if not r['complete_receipt']],
 'actual_observations':allrows,'reuse_applications':reuses,
 'policy':'Nested credit code was detected on the first post-refill exhaustion and stopped the whole queue before any retry or next set. Original first-exhaustion audit, refilled runs, author QA and generated grading remain separate. No selected pass replaces a non-pass observation.',
 'author_qa':{'unique_cases':808,'observations':834,'live_api':783,'production_blank':51,'unresolved_variance_cases':5,
              'evidence':'cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/phase-two-v4/owned-author-qa-evidence-index.json'}}
output=out/'after-refill-stop-audit.json'
assert not output.exists()
output.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# 추가 충전 후 API 중단 및 담당 18세트 증거','',
 '2026-09-11 04:51:02.280 UTC에 T16-C 첫 요청에서 `credit_balance_exhausted`를 확인하여 전체 큐를 즉시 중단했다. 그 요청 이후의 재시도·다음 세트 호출은 0회이다. 실행 프로세스는 종료했으며 HALT를 유지한다. 모델을 통한 잔액 확인도 수행하지 않는다.','',
 f"충전 후 실제 요청 {totals['after_refill_actual_requests']}회 중 유효 응답 {totals['after_refill_valid_responses']}회와 실패 {totals['after_refill_failed_requests_or_grounding']}회를 보존했다. 정확한 기존 응답 재사용 {totals['after_refill_reuse_applications_without_api']}단위는 신규 API 요청에 넣지 않았다.",'',
 f"새 은행 v3 전체 이력은 실제 요청 {totals['all_bank_v3_actual_requests']}회, 유효 응답 {totals['all_bank_v3_valid_responses']}회, 실패 {totals['all_bank_v3_failed_requests_or_grounding']}회 및 무호출 재사용 {len(reuses)}건이다. 첫 잔액 소진 전에 상위 transport 분류로 계속했던 이력은 기존 credit-stop-audit.json에 그대로 남아 있다. 이번에는 nested provider 코드를 우선하여 즉시 중단했다.",'',
 '| 계획 | 최신 상태 | 유효 단위 / 전체 | 미도달 단위 |','| --- | --- | ---: | ---: |']
for r in latest:
    lines.append(f"| {r['plan_id']} | {r['receipt_verdict'] or r['status']} | {r['unique_valid_units']} / {r['expected_units']} | {len(r['never_attempted_units'])} |")
lines += ['',f"정식 pass receipt {totals['complete_pass_receipts']}세트, 정식 non-pass receipt {totals['complete_nonpass_receipts']}세트다. 전체 독립 단위의 실행범위를 확보한 partial evidence {totals['partial_all_independent_units_finished']}세트는 정식 receipt가 아니다. 총 {totals['expected_units']}단위 중 유효 응답 {totals['unique_valid_units']}단위와 그 안의 생성 사례 {totals['generated_cases_valid_units']}개를 보존했다.",'',
 f"남은 실제 작업은 미도달 {totals['never_attempted_units']}단위, 형상·전송 실패 등 아직 유효 응답이 없는 단위, 유효 non-pass {len(nonpass)}단위의 동일 조건 추가 2회 확인, 담당18세트의 생성 사례 채점이다. 생성 사례 실제 채점은 아직 0회이며 작성자 QA 808사례의 완료와 합산하지 않는다.",'',
 '작성자 QA는 현재 동일 grader에서 808고유사례·834관측(실제783, 생산 빈답안51)을 완료했고, 변동5사례는 원래 올바른 기대값과 함께 별도 유지했다. 배점 검토 보고와 생성 사례의 사전 기대분류 의심은 로컬 제안일 뿐 현재 문항·QA·receipt를 바꾸지 않았다.','',
 '정확한 모든 성공·실패·재사용 원시 경로, SHA, 단위, 요청 시각, 현재 상태와 최종 성공 응답은 [기계 장부](after-refill-stop-audit.json)에 기록했다. 원문 기반 수동 조사만 계속하며 새 호출은 명시적인 재개 지시 이후로 제한한다.','']
(out/'after-refill-stop-handoff.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps(totals,ensure_ascii=False,indent=2))
