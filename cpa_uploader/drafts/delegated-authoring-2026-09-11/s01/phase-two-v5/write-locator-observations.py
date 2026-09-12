from pathlib import Path
import datetime
import hashlib
import json

root=Path.cwd()
base=Path(__file__).resolve().parent
run=base/'pilot-01-006/bank-v3-after-refill-03'
assert (run/'summary.json').exists()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
log=run/'semantic.json.chunks.jsonl'
rows=[json.loads(x) for x in log.read_text(encoding='utf-8').splitlines() if x.strip()]
source=root/'cpa_uploader/data/official/delegated-s01-kga200-210-220-320-2025.txt'
lines=source.read_text(encoding='utf-8').splitlines()
observations=[]
for i,row in enumerate(rows,1):
    if not row.get('error') and any(x!='pass' for x in row['response']['checks'].values()):
        observations.append({'unit_id':row['unit_id'],'line':i,'attempt':row['attempt'],
         'input_hash':row['input_hash'],'schema_hash':row['schema_hash'],'instructions_hash':row['instructions_hash'],
         'checks':row['response']['checks'],'rationale':row['response']['rationale']})
assert len(observations)==6
data={'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'status':'first_actual_observation_and_manual_source_check_pending_two_exact_repeats',
 'set_id':'pilot-01-006','plan_id':'T01-B','original_log':str(log.relative_to(root)).replace('\\','/'),
 'original_log_sha256':sha(log),'source':str(source.relative_to(root)).replace('\\','/'),'source_sha256':sha(source),
 'observations':observations,
 'source_boundary_evidence':[{'range':'L314-L330','lines':[{'line':i+1,'text':lines[i]} for i in range(313,330)]},
                             {'range':'L363-L378','lines':[{'line':i+1,'text':lines[i]} for i in range(362,378)]}],
 'finding':'문단 20의 본문은 앞선 PDF PAGE 58 뒤에 있으며 인용 끝의 PDF PAGE 59는 다음 문단21의 표지이다. 문단25는 PDF PAGE59 뒤에 있으며 끝의 PDF PAGE66은 다음 발췌 A23의 표지이다. 현재 source_span의 58/59는 올바르다. 모델은 인용 말미의 다음 발췌 페이지 표지를 현재 문단의 페이지로 오인했다.',
 'decision':'현재 문항/원전/plan/source_span을 59/66으로 바꾸지 않는다. 실제 유효 첫 응답은 보존하고 같은 input/schema/instructions/model에서 각 단위 두 번 추가 검수한 뒤 수동 후속 근거와 연결한다.',
 'api_calls_for_this_record':0,'question_changes':0}
output=base/'pilot-01-006/locator-first-observations.json'
assert not output.exists()
output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'observations':len(observations),'output':str(output.relative_to(root))},ensure_ascii=False))
