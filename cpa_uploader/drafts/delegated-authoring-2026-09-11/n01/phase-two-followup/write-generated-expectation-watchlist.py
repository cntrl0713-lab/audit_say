"""Read-only hypotheses before grading; does not change model receipts or expectations."""
from pathlib import Path
import hashlib
import json
import datetime

root=Path.cwd()
base=Path(__file__).resolve().parent
manifest=json.loads((root/'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v3/manifest.json').read_text(encoding='utf-8'))
entries={e['plan_id']:e for e in manifest['entries']}
locations={
 'T02-A':'n01/phase-two-v5/pilot-02-006/bank-v3-owned-resume-01/semantic.json',
 'T01-A':'n01/phase-two-v5/pilot-01-005/bank-v3-owned-02/semantic.json',
 'T16-B':'n06/phase-two-v5/pilot-16-011/bank-v3-after-refill-02/semantic.json'}
items=[
 ('T02-A','criterion:sub1:crit3','condition_boundary','contradicted','그 밖에는 비판적으로 평가하지 않는다고 명시하여 일반적인 비판적 평가를 부정한다. 단순 요소 누락과 구별할 필요가 있다.'),
 ('T01-A','criterion:sub3:crit7','condition_boundary','contradicted','서비스 내용을 알리지 않아도 안전장치를 충족한다고 명시한다. 두 인지 내용 중 하나를 단순히 쓰지 않은 답안과 다르다.'),
 ('T16-B','criterion:sub2:crit4','omission','contradicted','수정본 제출만으로 추가 조치 없이 종료한다고 명시한다. 수정 여부를 판단하는 필요한 절차를 단순히 언급하지 않은 답안과 다르다.'),
 ('T01-A','criterion:sub2:crit3','omission','requires_full_manual_review','양측 비중·경미성의 예외 조건이 충족되지 않는다는 설명이 담당자의 잘못된 허용 판단을 함축하는지 확인해야 한다. claim은 명확한 이유로 결론을 함축하는 것을 허용한다.'),
 ('T01-A','criterion:sub2:crit3','condition_boundary','requires_full_manual_review','반사실적 가정하의 올바른 예외 설명을 현행 사례 판단과의 명시 반대로 분류하는 것이 적절한지 확인해야 한다. 답안이 원사례를 판정했는지와 조건 규칙의 옳고 그름을 구별한다.'),
 ('T16-B','criterion:sub2:crit4','condition_boundary','requires_full_manual_review','실제 수정 여부 미확인 때문에 동의만으로 절차를 완료할 수 없다는 설명이 필요한 확인 절차를 충분히 함축하는지 원 발문·claim의 요구 수준으로 판단해야 한다.'),
]
records=[]
for pid,uid,kind,hypothesis,reason in items:
    path=root/'cpa_uploader/drafts/delegated-authoring-2026-09-11'/locations[pid]
    receipt=json.loads(path.read_text(encoding='utf-8'))['reviews'][0]
    sample=next(c for c in receipt['cases'] if c['unit_id']==uid and c['kind']==kind)
    e=entries[pid]; question=json.loads((root/e['file']).read_text(encoding='utf-8'))
    _,sid,cid=uid.split(':')
    sub=next(s for s in question['subquestions'] if s['id']==sid)
    criterion=next(c for c in sub['criteria'] if c['id']==cid)
    records.append({'plan_id':pid,'set_id':e['set_id'],'unit_id':uid,'kind':kind,
       'original_receipt':path.relative_to(root).as_posix(),'receipt_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
       'original_sample':sample,'prompt':sub['prompt'],'criterion':criterion,
       'source_requirements':[r for r in sub['requirements'] if r['source_ref_id'] in criterion['source_ref_ids']],
       'review_hypothesis':hypothesis,'reason':reason})
output=base/'generated-expectation-watchlist-pregrading.json'
assert not output.exists()
output.write_text(json.dumps({'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'status':'pregrading_readonly_hypotheses_not_accepted_corrections','records':records,
 'policy':'Run the original receipt cases with their original expected verdicts. Preserve all observations and repeat mismatches to three. Only a later complete unit/source/case manual_reasoned review may authorize a linked expectation follow-up. This is not that review.',
 'changed_question_files':0,'changed_model_receipts':0,'api_calls_for_this_review':0},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(str(output.relative_to(root)))
