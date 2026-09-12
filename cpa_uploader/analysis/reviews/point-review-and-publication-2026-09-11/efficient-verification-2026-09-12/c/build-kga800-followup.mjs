import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11',E=`${D}/efficient-verification-2026-09-12/c`,O=`${E}/kga800-followup-v1/pilot-19-003`;
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),copy=structuredClone,hash=x=>crypto.createHash('sha256').update(x).digest('hex'),fh=f=>hash(fs.readFileSync(f)),write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const j=read(`${D}/a/execution-all-v9/manifest.json`).jobs.find(j=>j.set_id==='pilot-19-003'),raw=read(j.file),old=Array.isArray(raw)?raw[0]:raw,s=copy(old),reg=read(`${E}/kga800-followup-v1/registration.json`),unit=p=>{const u=reg.units.find(u=>u.paragraph===p);assert(u);return u;};
const sourceText=fs.readFileSync(reg.file,'utf8');assert.equal(hash(sourceText),reg.sha256);for(const u of reg.units)assert.equal(hash(u.quote),u.contentHash);
const prov='한국공인회계사회 2020-09-25 공고(의결2020-09-23), 공식 DOCX fileSeq1. 문단4:2020-12-31 이후 개시 보고기간부터 시행, 조기적용 가능. DOCX 원 XMLP와 전사35문단 독립 대조 완료. 2027 시험공고가800 개별판본을 지정했다는 뜻은 아니며 2026-01-01 개시 보고기간이 실제 시행 이후임을 확인했다.';
function ref(id,p){const u=unit(p);return {id,file:reg.file,title:`한국공인회계사회 감사기준서800(2020 개정) 문단${p}`,page:`DOCX XML 문단; 전사 L${u.startLine}–L${u.endLine}`,source_quote:u.quote,role:'standard',content_hash:u.contentHash,source_span:`KGA800.${p}; ${u.locator}; ${prov}`};}
const src1=ref('src1','8'),src4=ref('src4','9'),a9=ref('src-kga800-a9','A9');s.source_refs=s.source_refs.map(r=>r.id==='src1'?src1:r.id==='src4'?src4:r);s.source_refs.push(a9);
s.classification.standards.push('KGA 800');s.classification.tags=s.classification.tags.map(t=>t==='ISA 800'?'KGA 800':t);
for(const q of s.subquestions)for(const r of q.requirements){if(r.source_ref_id==='src1'||r.source_ref_id==='src4'){const source=s.source_refs.find(x=>x.id===r.source_ref_id);r.source_quote=source.source_quote;r.source_span=source.source_span;}if(r.id==='req2')r.source_span='KGA200.18, PDF11; 국내 KGA800.9 및 A9와 직접 대조';}
const q2=s.subquestions.find(q=>q.id==='sub2');q2.requirements.push({id:'req-kga800-a9',source_ref_id:a9.id,source_quote:a9.source_quote,source_span:a9.source_span});for(const c of q2.criteria)c.source_ref_ids.push(a9.id);
const reason='국내800 공식2020 개정 본문8(a)~(c)가 작성목적·의도된 이용자·경영진의 수용가능성 결정조치 세 요구를 직접 확인한다. 9/A9는 관련 기준 준수와 예외적 이탈·대체절차의 문맥이다. 특정 절차의 비효과성이라는 제한은 기존200.23 직접 근거를 유지한다.800.14의 강조사항·A21의 이용제한은 발문 밖이므로 새 득점으로 추가하지 않는다. 두 발문·모범답안·claim·6점과 분류 결정을 유지한다. 과거 ISA 대조와 당시 국내 미확인 기록은 이전 판본의 사실로 보존한다.';
s.verification.notes.push(`2026-09-12 국내800 후속 직접 대조: ${reason} ${prov}`);
const planRaw=read(j.plan_file),p=planRaw.plans?.find(p=>p.set_id===s.id)??planRaw;
p.source_unit_ids=[...new Set([...p.source_unit_ids,...['4','8','9','A5','A6','A7','A8','A9'].map(x=>unit(x).id)])];
p.edition_assumption=prov+' KGA200은 기존 공식2025 전문 직접 인용을 유지하며, 국제ISA 전체를 국내판본과 동등하다고 단정하지 않는다.';
p.scope.conditions.push('특정목적 재무제표 감사의 일반적인 수임 및 계획·수행 원칙을 묻는다. 국내800.8(a)~(c)와9/A9를 직접 적용하며, 구체 비효과성 예외는200.23을 함께 적용한다.');
p.scope.exclusions.push('국내800.14/A20/A21 보고·강조사항·배포 또는 이용 제한의 별도 요구를 추가하지 않는다.');
p.existing_question_difference+=' 2026-09-12 후속 원문 확인: '+reason;
p.metadata={...(p.metadata??{}),domestic_kga800_followup:{provenance:prov,source_registration:`${E}/kga800-followup-v1/registration.json`,xml_check:`${E}/kga800-followup-v1/xml-independent-check.json`,historical_unconfirmed_note_retained_in_old_version:true}};
const qa=read(j.qa_file);assert.deepEqual(qa,read(j.qa_file));assert.deepEqual(s.shared_context,old.shared_context);
assert.deepEqual(s.subquestions.map(q=>[q.id,q.prompt,q.model_answer,q.criteria.map(c=>[c.id,c.claim,c.critical_facts,c.max_points,c.scores])]),old.subquestions.map(q=>[q.id,q.prompt,q.model_answer,q.criteria.map(c=>[c.id,c.claim,c.critical_facts,c.max_points,c.scores])]));
fs.mkdirSync(O,{recursive:true});write(`${O}/question.json`,[s]);write(`${O}/authoring-plan.json`,p);write(`${O}/qa.json`,qa);
const classifications=read(`${D}/c/prepared-reviewed-v8/learning-question-classifications.json`).classifications.filter(c=>c.source_set_id===s.id);write(`${O}/classification.json`,{version:1,classifications});
const entry={set_id:s.id,file:`${O}/question.json`,sha256:fh(`${O}/question.json`),plan_file:`${O}/authoring-plan.json`,plan_sha256:fh(`${O}/authoring-plan.json`),qa_file:`${O}/qa.json`,qa_sha256:fh(`${O}/qa.json`)};
write(`${O}/changes.json`,{version:1,reviewer:'agent',reason,before:j,after:entry,source_comparisons:[{source_ref_id:'src1',before:old.source_refs.find(r=>r.id==='src1'),after:src1,reason:'공식 국내800.8의세 요구가 기존ISA8 번역답안과 동일하다.'},{source_ref_id:'src4',before:old.source_refs.find(r=>r.id==='src4'),after:src4,reason:'관련감사기준준수의 국내800.9 직접본문으로 교체한다.'},{source_ref_id:a9.id,before:null,after:a9,reason:'국내800.A9의 이탈·대체절차 의존문맥을 명시적으로 입력에 포함한다.'}],unchanged:{prompt:true,answers:true,claims:true,critical_facts:true,points:true,question_ids:true,existing_source_ref_ids:true,classification_decisions:true,all_qa_answers_and_expectations:true,shared_context:true},qa_count:qa.cases.length,source_registration:`${E}/kga800-followup-v1/registration.json`,api_calls:0});
write(`${E}/kga800-followup-v1/index.json`,{version:1,entries:[entry]});console.log(JSON.stringify(entry));
