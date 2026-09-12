import fs from 'node:fs';
import {extendQa} from './extend-qa.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { specifications, edition, scopeExceptions } from './content-followup.mjs';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../../..');
const old = path.resolve(base, '../../frequency-priority-2026-09-10');
const rel = f => path.relative(root, f).replaceAll('\\','/');
const hash = value => createHash('sha256').update(value).digest('hex');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f,x) => fs.writeFileSync(path.join(base,f),JSON.stringify(x,null,2)+'\n');
const ledgerFile = path.join(root,'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json');
const ledger = Object.values(read(ledgerFile)).find(Array.isArray).filter(x=>x.package==='R01');
const lineage = [], patches = [], expectedChanges = [];
const points = q => q.criteria.reduce((sum,c)=>sum+c.max_points,0);
const officialFile='cpa_uploader/data/official/delegated-r01-kga-2025.txt';
const officialText=fs.readFileSync(path.join(root,officialFile),'utf8');
const catalog=buildSourceCatalog();
const supplemental=read(path.join(base,'sources/supplemental-input-quotes.json')).rows;

for (const item of ledger) {
  const originalFile = path.join(root,item.predecessor);
  const bytes = fs.readFileSync(originalFile);
  if(hash(bytes)!==item.predecessor_sha256) throw new Error(`Historical input changed: ${item.set_id}`);
  const original = JSON.parse(bytes), set = structuredClone(original);
  const sourceUnits=[];
  for(const ref of set.source_refs) {
    if(!officialText.includes(ref.source_quote))throw new Error(`Registered source lost quotation: ${set.id}/${ref.id}`);
    const unit=catalog.units.find(u=>u.file===officialFile && u.standard===ref.page && u.quote.includes(ref.source_quote));
    if(!unit)throw new Error(`No registered unit for ${set.id}/${ref.id}`);
    sourceUnits.push(unit);
    ref.file=officialFile;
    for(const q of set.subquestions)for(const req of q.requirements)if(req.source_ref_id===ref.id)req.source_span=`${ref.title}; ${unit.locator}`;
  }
  const spec = specifications.find(s=>s.id===item.set_id);
  set.shared_context.facts.unshift({id:'f0',text:'이 사례는 2026년 1월 1일부터 12월 31일까지의 보고기간에 대한 재무제표감사이다. 감사보고서일 후의 후속 업무는 2027년에 수행한다.',scoreable:false});
  set.verification.notes[0] = edition;
  set.verification.notes.push(`기존 ${rel(originalFile)}의 R01 검증용 후속본. 원본·정본·과거 receipt를 수정하지 않았다. 1차 작성자 원문 대조·정적검사 단계이며 최종 모델 의미검수·실제 채점은 아직 하지 않았다.`);
  for(const q of set.subquestions) {
    const sq = spec.questions.find(x=>x.id===q.id);
    q.type = sq.type;
    for(const [i,c] of q.criteria.entries()) {
      c.claim = sq.claims[i].gradingClaim;
      c.critical_facts[0].expected = c.claim;
      const guard = c.critical_facts.find(f=>f.type==='condition');
      if(sq.claims[i].guard && guard) guard.expected=sq.claims[i].guard;
    }
  }
  const file = `${item.set_id}.json`;
  write(file,set);
  const originalPlanFile = `${originalFile}.authoring-plan.json`;
  const plan = read(originalPlanFile).plans[0];
  const predecessorSourceIds=structuredClone(plan.source_unit_ids);
  plan.source_unit_ids=[...new Set(sourceUnits.map(u=>u.id))];
  plan.edition_assumption=edition;
  plan.scope.timing = ['2026년 1월 1일 개시·12월 31일 종료 보고기간. 필요한 감사보고서일 후 업무는 2027년.', ...set.shared_context.facts.slice(1).map(f=>f.text)];
  plan.scope.required_answers=set.subquestions.map(q=>q.prompt);
  plan.question_types=[...new Set(set.subquestions.map(q=>q.type))];
  const key = item.set_id.includes('04-')?'04':item.set_id.includes('10-')?'10':item.set_id.slice(6,12);
  plan.scope.exceptions=scopeExceptions[key];
  if(!plan.scope.exceptions) throw new Error(`No scope exceptions for ${key}`);
  plan.scope.exceptions=[...plan.scope.exceptions,...supplemental.filter(x=>x.plan_id===item.plan_id).map(x=>
    `의존 문맥의 공식 원문: ${x.standard}.${x.paragraph}, 2026 전문 PDF ${x.pdf_page}쪽 (${x.source_pdf}; SHA-256 ${x.source_pdf_sha256}). ${x.source_quote} 이 인용은 적용 경계를 확인하기 위한 것으로 발문의 독립 득점요건을 추가하지 않는다.`)];
  plan.scope.exclusions=plan.scope.exclusions.filter(s=>!s.includes('특정 미래 시험'));
  plan.scope.exclusions.push('금액 계산, 담당 12물음의 요구 확대, 정본 승급·게시·배포는 하지 않는다. 공식 판본과 2027 시험 목표의 관계는 총괄 정책으로 한정한다.');
  plan.existing_question_difference += ' 기존 초안을 같은 세트 ID·물음 ID·criterion ID·37점 범위로 계속한다. 원문 독립확인 및 명제 경계·QA 보완이며 신규 출제로 중복 집계하지 않는다.';
  if(item.plan_id==='T12-A') plan.existing_question_difference += ' q2.c1은 최초 일자 보존, q2.c2는 추가 일자의 한정 범위이므로 정답을 각각 달리 오답으로 만들 수 있다. 한 문장에 두 내용을 담으면 같은 인용으로 둘 다 인정한다.';
  if(item.plan_id==='T12-B') plan.existing_question_difference += ' q1.c1은 표명할 의견의 종류, q1.c5는 별도 단락에 비변형 사실을 명시하는 의무이다. 적정의견만 쓴 답은 c1만 충족하고, 별도 단락의 비변형 명시가 의견도 함축하면 둘 다 충족한다. 이는 동일 문장을 금지할 이유가 아니다.';
  write(`${file}.authoring-plan.json`,{artifact_type:'question_authoring_plan',version:1,plans:[plan]});
  write(`evidence-packet-${item.plan_id.toLowerCase()}.json`,{artifact_type:'r01_manual_source_evidence',version:1,set_id:set.id,
    automatic_source_packet:false,reason:'생성 계획해시가 없는 수동후속본. 이것은 자동 source-packet sidecar가 아니며 review CLI의 --packet 인자로 넘기지 않는다.',
    source_file:officialFile,source_file_sha256:hash(fs.readFileSync(path.join(root,officialFile))),source_refs:set.source_refs,
    source_units:sourceUnits.map(({id,standard,paragraph,locator,authority,edition,provenance,contentHash})=>({id,standard,paragraph,locator,authority,edition,provenance,contentHash})),
    predecessor_discovery_ids:predecessorSourceIds,comparison_evidence:rel(path.join(base,'sources/official-comparison.json')),
    edition_policy:'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md',
    formal_packet_limitations:'createSourcePacket 전체 의존확장 결과는 501/570 미등록 적용자료·문단미지정 및505 입력예산초과가 있어 자동완결이라고 표시하지 않는다. 필요한 직접·의존 문맥은 sources/dependency-context.json에서 독립 대조한다.'});
  const qaFile=path.join(old,`qa-${item.set_id.replace('draft-','')}.json`);
  const qa=read(qaFile);
  qa.draft_sha256=hash(fs.readFileSync(path.join(base,file)));
  qa.live_model_grading='not_run';
  qa.predecessor={file:rel(qaFile),sha256:hash(fs.readFileSync(qaFile))};
  qa.authoring_plan_id=item.plan_id;
  if(item.plan_id==='T09-B')for(const c of qa.cases)c.note=c.note.replace(' 이 물음의 직접 기출 빈도는 별도로 부여하지 않는다.',' 빈도 관계는 현행 계획의 element-611b85a03689277a 기출 1회와 별도 대조한다.');
  qa.interpretation='작성자가 원문·현행 함축 정책으로 선확정한 기대값이다. 모델 실측이나 정식 의미검수 receipt가 아니다. 과거 기대값 변경은 expected-value-changes.json에서 이유·이전값을 보존한다.';
  const add=(qid,suffix,answer,met,contradicted=[],note='')=>{
    const q=set.subquestions.find(q=>q.id===qid);
    qa.cases.push({id:`${qid}/${suffix}`,subquestion_id:qid,kind:suffix,answer,expected_points:met.length,note,
      expected_verdicts:q.criteria.map(c=>({criterion_id:c.id,verdict:contradicted.includes(c.id)?'contradicted':met.includes(c.id)?'met':'not_met',reason:note}))});
  };
  for(const q of set.subquestions) {
    add(q.id,'irrelevant-prefix',`이 회사의 사무실 벽은 흰색이다.\n${q.model_answer.join('\n')}`,q.criteria.map(c=>c.id),[],'무관한 사실 뒤 정답 전체를 평가한다. 추가 문장·항목수로 정상 명제 점수를 제한하지 않는다.');
  }
  if(item.plan_id==='T09-B') {
    add('q2','clear-omission','감사와 감사의견에 대한 시사점을 결정한다.',['q2.c2'],[],'505.13의 보고 영향만 답하고 대체절차의 증거 제공 능력에 관해서는 침묵한 명확한 누락. 과거 모호한 검수 사례를 대체할 새 입력이다.');
    add('q2','clear-opposite','회신 자체가 필요해도 대체절차만 수행하면 그 회신을 대신하는 충분하고 적합한 증거를 얻을 수 있다.',[],['q2.c1'],'505.13의 반대 결론을 명시한다. 단순히 다른 절차를 수행한다는 말과 구별한다.');
    add('q2','procedure-with-explicit-limitation','추가 절차를 수행할 수는 있지만 필수 회신을 대신하는 증거가 되지는 못한다. 따라서 감사와 의견에 대한 시사점을 결정한다.',['q2.c1','q2.c2'],[],'절차 수행 여부와 필수 회신의 증거 대체 가능성은 별개다. 대체 불가를 명시한 정상 답안이다.');
  }
  if(item.plan_id==='T12-A') {
    const tail=set.subquestions[1].model_answer.slice(2).join('\n');
    add('q2','true-omission-date-method',tail,['q2.c3','q2.c4','q2.c5'],[],'q2/omit-1은 추가 일자의 병존이 최초 일자 유지를 함축하여 5점이다. 진짜 누락에서는 이중 일자 방법 전체를 생략하며 c1·c2 모두 미충족이다.');
    add('q2','date-only','최초 감사보고서일은 유지한다.',['q2.c1'],[],'최초 일자 보존만으로 추가 일자가 뜻하는 절차 범위까지 설명한 것으로 확대하지 않는다.');
    add('q2','dual-date-one-sentence','기존 보고서일을 남겨 두고 해당 수정사항에만 한정된 추가 일자를 병기하여 그 뒤의 절차가 그 수정에만 해당함을 나타낸다.',['q2.c1','q2.c2'],[],'한 문장이 날짜 보존과 한정 범위라는 두 독립 명제를 모두 충족한다.');
  }
  if(item.plan_id==='T12-B') {
    const oldCase=qa.cases.find(c=>c.id==='q2/omit-1');
    expectedChanges.push({set_id:set.id,case_id:oldCase.id,answer:oldCase.answer,previous_expected_points:oldCase.expected_points,
      previous_expected_verdicts:structuredClone(oldCase.expected_verdicts),new_expected_points:3,
      reason:'답안이 한정의견근거 또는 부적정의견근거라는 두 형태를 명시하여 두 의견 범위를 분명히 함축한다. 570.23(a)(b)와 G1/G3 함축 정책에 따른 정정이며 새 모델 결과를 보고 맞춘 것이 아니다.',
      evidence:['docs/plans/주제-01-03-검토에-따른-수정-결정.md','cpa_uploader/drafts/frequency-priority-2026-09-10/sources/official-excerpts.txt']});
    oldCase.expected_points=3;oldCase.expected_verdicts.find(v=>v.criterion_id==='q2.c1').verdict='met';
    oldCase.note=expectedChanges.at(-1).reason;
    add('q2','true-omission-opinion-types','해당 의견근거 단락에 계속기업 존속능력에 유의적 의문을 초래할 수 있는 중요한 불확실성이 존재하고, 재무제표에 적절하게 공시되지 않았다고 명시한다.',['q2.c2','q2.c3'],[],'의견 종류·두 종류를 함축하는 단락 제목을 모두 생략한 진짜 누락 사례.');
    add('q1','opinion-only','적정의견을 표명한다.',['q1.c1'],[],'의견을 직접 답하면 c1 충족. 이 문장만으로 별도 단락의 기재 의무 c5를 충족시키지 않는다.');
    add('q1','paragraph-implies-opinion','계속기업 관련 중요한 불확실성 단락에 해당 사항과 관련하여 감사의견이 변형되지 않았음을 명시한다.',['q1.c1','q1.c2','q1.c5'],[],'단락 제목·별도 단락 기재 요구와 함축된 적정의견을 한 문장에서 모두 인정한다. 불확실성 존재 설명·주석 환기는 생략되었다.');
    add('q1','true-omission-opinion-and-nonmodification',set.subquestions[0].model_answer.slice(1,4).join('\n'),['q1.c2','q1.c3','q1.c4'],[],'의견 문장과 이를 함축하는 비변형 명시를 모두 빼야 c1의 실제 누락 사례가 된다.');
  }
  write(`qa-cases-${item.plan_id.toLowerCase()}.json`,extendQa(set,qa));
  const edits=[];
  const walk=(a,b,p='')=>{
    if(JSON.stringify(a)===JSON.stringify(b)) return;
    if(a && b && typeof a==='object' && typeof b==='object' && !Array.isArray(a) && !Array.isArray(b)) {
      for(const k of new Set([...Object.keys(a),...Object.keys(b)])) walk(a[k],b[k],`${p}/${k}`);
    } else edits.push({path:p,before:a,after:b});
  };
  walk(original,set);
  patches.push({original_file:rel(originalFile),original_sha256:hash(bytes),proposed_file:rel(path.join(base,file)),changes:edits});
  lineage.push({plan_id:item.plan_id,set_id:set.id,predecessor:rel(originalFile),predecessor_sha256:hash(bytes),actual_file:rel(path.join(base,file)),sha256:hash(fs.readFileSync(path.join(base,file))),
    plan_file:rel(path.join(base,`${file}.authoring-plan.json`)),qa_file:rel(path.join(base,`qa-cases-${item.plan_id.toLowerCase()}.json`)),
    evidence_packet_file:rel(path.join(base,`evidence-packet-${item.plan_id.toLowerCase()}.json`)),
    questions:item.questions.map((q,i)=>({...q,actual_id:set.subquestions[i].id,criterion_ids:set.subquestions[i].criteria.map(c=>c.id),points:points(set.subquestions[i])})),
    points:set.subquestions.reduce((n,q)=>n+points(q),0),qa_cases:qa.cases.length,stage:'candidate_prepared',semantic_review:'not_run',live_grading:'not_run'});
}
write('lineage.json',{artifact_type:'r01_lineage',ledger_file:rel(ledgerFile),ledger_sha256:hash(fs.readFileSync(ledgerFile)),sets:lineage});
write('patch-proposal.json',{artifact_type:'r01_patch_proposal',apply_status:'not_applied',canonical_source:rel(path.join(old,'content.mjs')),canonical_source_sha256:hash(fs.readFileSync(path.join(old,'content.mjs'))),
  local_authoring_overlay:rel(path.join(base,'content-followup.mjs')),local_builder:rel(path.join(base,'build-followup.mjs')),
  instruction:'후속 overlay·builder와 문항/QA를 함께 검토한다. 과거 content/build/보고서를 덮어쓰지 않으며 총괄이 새 후속 배치에서만 재현한다. 기존 generated JSON만 독립 수정하지 않는다.',changes:patches});
write('expected-value-changes.json',{artifact_type:'r01_expected_value_changes',changes:expectedChanges,live_model_grading:'not_run'});
console.log(JSON.stringify({sets:lineage.length,questions:lineage.reduce((n,s)=>n+s.questions.length,0),points:lineage.reduce((n,s)=>n+s.points,0),qa:lineage.reduce((n,s)=>n+s.qa_cases,0)}));
