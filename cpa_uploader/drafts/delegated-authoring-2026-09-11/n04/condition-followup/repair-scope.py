"""Targeted correction; prior artifacts and failed validation remain preserved."""
from pathlib import Path

base = Path(__file__).resolve().parent.parent
prior_content = base / 'condition-followup/attempt1-content.mjs.txt'
(base / 'content.mjs').write_bytes(prior_content.read_bytes())
builder_path = base / 'build-package.mjs'
builder = builder_path.read_text(encoding='utf-8')
old = 'source_span:unit(c.key).locator}'
new = "source_span:unit(c.key).locator+(s.plan_id==='T13-A'&&qi===2&&c.scope?'; 채점해석: '+c.scope:'')}"
assert builder.count(old) == 1
builder = builder.replace(old, new)
old = "expected:c.claim},...(c.scope?["
new = "expected:s.plan_id==='T13-A'&&qi===2&&i>=3?c.claim.replace(/^전문가의 업무가 유의적인 (가정|방법)을 수반한다면 해당 상황에서 그 /,'').replace(/^전문가의 업무에 유의적인 원천데이터 사용이 수반된다면 그 /,''):c.claim},...(c.scope&&!(s.plan_id==='T13-A'&&qi===2)?["
assert builder.count(old) == 1
builder = builder.replace(old, new)
old = ' const priorEvidence=frequency.elements.filter(e=>e.plan_id===s.plan_id);'
new = " if(s.plan_id==='T13-A')exceptions.push(s.questions[2].claims[3].scope);\n" + old
assert builder.count(old) == 1
builder_path.write_text(builder.replace(old, new), encoding='utf-8', newline='\n')

verify_path = base / 'condition-followup/verify.ts'
verify = verify_path.read_text(encoding='utf-8')
verify = verify.replace("['model_answer','requirements','type','selection','constraints','decision']", "['model_answer','type','selection','constraints','decision']")
old = " if(i>=3&&!c.critical_facts.some((f:any)=>f.type==='condition'&&f.expected.includes('별도 득점요건이 아니며 답안에서 반복할 필요가 없다')&&f.expected.includes('명시적 반대 답안')))errors.push('Missing uniform scope '+c.id);"
new = """ const req=q.requirements[i],oldReq=oldQ.requirements[i];
 for(const key of ['id','source_ref_id','source_quote'])if(req[key]!==oldReq[key])errors.push('Requirement binding changed '+req.id);
 if(i<3&&JSON.stringify(req)!==JSON.stringify(oldReq))errors.push('Unrelated requirement changed');
 if(i>=3){
  if(!req.source_span.startsWith(oldReq.source_span+'; 채점해석: ')||!req.source_span.includes('별도 득점요건이 아니며 답안에서 반복할 필요가 없다')||!req.source_span.includes('명시적 반대 답안'))errors.push('Missing interpretation in requirement '+req.id);
  const expected=['가정의 관련성을 평가한다.','가정의 합리성을 평가한다.','방법의 관련성을 평가한다.','방법의 합리성을 평가한다.','원천데이터의 관련성을 평가한다.','원천데이터의 완전성을 평가한다.','원천데이터의 정확성을 평가한다.'][i-3];
  if(c.critical_facts.length!==1||c.critical_facts[0].type!=='action'||c.critical_facts[0].expected!==expected)errors.push('Critical fact contains more than actual evaluation '+c.id);
 }"""
assert verify.count(old) == 1
verify = verify.replace(old, new)
old = 'const validation=validateQuestionSetV3'
new = "if(!plan.scope.exceptions.some((e:string)=>e.includes('별도 득점요건이 아니며 답안에서 반복할 필요가 없다')&&e.includes('명시적 반대 답안')))errors.push('Missing shared plan interpretation');\nconst validation=validateQuestionSetV3"
assert verify.count(old) == 1
verify_path.write_text(verify.replace(old, new), encoding='utf-8', newline='\n')
