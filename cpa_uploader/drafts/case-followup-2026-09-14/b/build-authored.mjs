import fs from 'node:fs';
import {createHash} from 'node:crypto';
import specs from './authoring-spec.mjs';
const dir='cpa_uploader/drafts/case-followup-2026-09-14/b';
const batch='cpa_uploader/drafts/case-followup-2026-09-14';
const catalogFile=`${batch}/source-catalog-v3.json`;
const catalog=JSON.parse(fs.readFileSync(catalogFile,'utf8'));
const bankFile=`${batch}/bank-before.json`,bank=JSON.parse(fs.readFileSync(bankFile,'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const unit=id=>{const u=catalog.units.find(u=>u.id===id);if(!u)throw Error(`missing source ${id}`);return u;};
const readLines=(file,start,end)=>fs.readFileSync(file,'utf8').split(/\r?\n/).slice(start-1,end).join('\n');
const latest='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const edition='2026년 1월 1일 개시 재무제표감사로 한정하여 2026 공식 전문의 해당 본문·시행일을 직접 대조하였다. 기출 교재와 고급연습은 원발문·사례 설계의 학습자료이며 공식 시험 원본의 무변형 사본으로 간주하지 않는다. 새 KGA540 전사는 원문 어구의 지정 fragment 모음이며 위치표시·각주 이동은 별도 provenance-v2에 기록했다. 새 문항과 사례는 재구성하였다.';
const sets=[],design=[],review=[],qa=[];
for(const spec of specs){
 const source_refs=spec.official.map(id=>{const u=unit(id);if(!fs.readFileSync(u.file,'utf8').includes(u.quote))throw Error(`quote mismatch ${id}`);return{id,file:u.file,title:`${u.standard} 문단 ${u.paragraph}; ${u.edition}; ${u.locator}`,page:u.standard,source_quote:u.quote,role:'standard',content_hash:hash(u.quote)};});
 const set={schema_version:'3.0',id:spec.id,type:'linked_question_set',status:'needs_review',title:spec.title,classification:{topic_id:spec.topic,part:spec.part,chapter:spec.chapter,domain:'audit',standards:[...new Set(spec.official.map(id=>unit(id).standard))],tags:[spec.chapter,'사례형','기출·연습 응용']},source_refs,shared_context:{facts:spec.facts.map((text,i)=>({id:`fact${i+1}`,text,scoreable:false}))},learning_order:spec.questions.map(q=>q.id),subquestions:[],verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[edition,'수동 제작과 작성자 내용검토를 수행하였다. 실제 Luna 채점·독립 검수·정본 게시 상태는 상위 배치의 후속 증거로 별도 확인한다.','모든 물음은 사례의 사실을 해석·적용해야 하며 판단을 함축하는 근거·조치도 인정한다. 정수의 독립 의미 단위 부분점수를 합산한다.']}};
 for(const q of spec.questions){
  const sub={id:q.id,type:q.type,question_style:'case',topic_ids:q.topics??[spec.topic],prompt:q.prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},decision:null,answer_slots:[{id:`${q.id}.answer`,label:'답안',input:'textarea'}],model_answer:q.criteria.map(c=>c[0]),requirements:[],criteria:[]};
  q.criteria.forEach(([claim,sourceId,condition,extra],i)=>{
   const u=unit(sourceId);const id=`${q.id}.c${i+1}`,rid=`${q.id}.r${i+1}`;
   sub.requirements.push({id:rid,source_ref_id:sourceId,source_quote:u.quote,source_span:`${u.locator}; 적용범위: ${condition}`});
   sub.criteria.push({id,requirement_id:rid,claim,critical_facts:[{id:`${id}.claim`,type:'action',expected:claim},{id:`${id}.scope`,type:'condition',expected:condition}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[sourceId,...(extra?[extra]:[])]});
  });
  set.subquestions.push(sub);
  const examples=['partial','wrong'].map(kind=>{const [answer,indices,reason]=q[kind];const row={set_id:set.id,subquestion_id:q.id,kind,answer,expected_points:indices.length,met_criterion_ids:indices.map(i=>`${q.id}.c${i}`),reason};if(kind==='partial'&&(indices.length<=0||indices.length>=sub.criteria.length))throw Error(`invalid partial ${set.id}/${q.id}`);qa.push(row);return row;});
  review.push({set_id:set.id,subquestion_id:q.id,reviewer_id:'agent:/root/followup_sources_b',method:'agent_content_review',human_review_performed:false,actual_model_grading:'not_run',rationale:q.rationale,point_decision:q.point,max_points:sub.criteria.length,fact_ids:q.facts,question_style:'case',topic_ids:q.topics??[spec.topic],minimal_sufficient_answer:sub.model_answer,source_checks:sub.requirements.map(r=>({requirement_id:r.id,source_ref_id:r.source_ref_id,source_span:r.source_span,exact_quote_checked:true,source_quote_sha256:hash(r.source_quote),verdict:'pass'})),criterion_checks:sub.criteria.map((c,i)=>({criterion_id:c.id,claim:c.claim,source_ref_ids:c.source_ref_ids,independent_points:1,verdict:'pass',rationale:q.criteria[i][2]})),representative_qa_checks:examples,empty_answer:{expected_points:0,reason:'어떠한 정답 명제도 제시하지 않은 답안'},unresolved_content_findings:[]});
 }
 const comparisons=spec.comparison.map(([id,difference])=>{const s=bank.find(s=>s.id===id);if(!s)throw Error(`missing comparison ${id}`);return{set_id:id,title:s.title,reviewed_content_hash:hash(JSON.stringify(s)),difference,questions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criterion_ids:q.criteria.map(c=>c.id),points:q.criteria.reduce((a,c)=>a+c.max_points,0)}))};});
 const learning_reading=spec.learning.map(([id,start,end,description])=>{const u=unit(id);const quote=readLines(u.file,start,end);return{source_unit_id:id,file:u.file,page:u.page,start_line:start,end_line:end,description,quote,quote_sha256:hash(quote),file_sha256:hash(fs.readFileSync(u.file)),authority:u.authority,original_exam_pdf:'별도 공식 시험 PDF 원본 미보관; 교재 수록 원발문·기출변형에 근거함',frequency_treatment:'교재 재수록은 별도 출제로 세지 않는다. 기출·모의의 요구 범위 차이를 기록하며 빈도를 합산하지 않는다.'};});
 const latestSpans=spec.latest.map(([start,end,paragraphs])=>({file:latest,file_sha256:hash(fs.readFileSync(latest)),start_line:start,end_line:end,paragraphs,quote:readLines(latest,start,end),comparison_result:'해당 본문·조건·예외를 실제 읽어 정답·criterion과 대조했다.'}));
 const plan={version:1,topic_id:spec.topic,mode:'adapt_existing_question',objective:spec.objective,scope:{actors:['재무제표 감사업무팀과 지문에 제시된 회사·부문감사인'],timing:['2026-01-01 개시 재무제표감사의 계획·수행·종결 중 각 사실에서 명시한 시점'],conditions:spec.facts,exceptions:[spec.topic==='11'?'과거 당시 정보를 적합하게 고려한 B형 추정은 사후 결과만으로 왜곡표시로 단정하지 않는다. 편의징후와 확정 왜곡표시를 구별한다.':spec.topic==='10'?'적법 취소로 이탈이 아닌 항목과 적절한 대체적 절차도 불가능한 실제 거래를 구별한다. 최초 평가를 뒷받침하는 추가 증거가 없는 조건에 한정하여 높은 이탈률을 평가한다.':'부문감사인 독립성·적격성과 접근 제한은 문제되지 않는다. 추가절차와 그 수행자는 해당 상황에서 결정한다. 의견 종류 자체는 요구하지 않는다.'],required_answers:spec.questions.map(q=>q.prompt),exclusions:[spec.exclusions]},question_types:[...new Set(spec.questions.map(q=>q.type))],source_unit_ids:[...new Set([...spec.official,...spec.learning.map(x=>x[0])])],existing_question_difference:comparisons.map(c=>`${c.set_id}: ${c.difference}`).join(' '),edition_assumption:edition,unresolved_items:[],status:'ready'};
 design.push({set_id:spec.id,version:1,reviewer_id:'agent:/root/followup_sources_b',reviewed_content_hash:hash(JSON.stringify(set)),plan,basis:{bank_file:bankFile,bank_sha256:hash(fs.readFileSync(bankFile)),source_catalog_file:catalogFile,source_catalog_sha256:hash(fs.readFileSync(catalogFile)),source_catalog_fingerprint:catalog.fingerprint,comparison_inventory_file:`${dir}/comparison-inventory.json`,comparison_inventory_sha256:hash(fs.readFileSync(`${dir}/comparison-inventory.json`))},lineage:{kind:'new_case_adaptation',previous_set_id:null,previous_question_ids:[],new_subquestion_ids:['sub1','sub2','sub3'],preserves_existing_bank:true},compared_existing_sets:comparisons,learning_source_reading:learning_reading,official_current_edition_comparison:latestSpans,source_evidence:source_refs.map(r=>({source_unit_id:r.id,file:r.file,file_sha256:hash(fs.readFileSync(r.file)),quote_sha256:hash(r.source_quote),locator:unit(r.id).locator,page:unit(r.id).page,authority:unit(r.id).authority})),mapping:spec.questions.map(q=>({subquestion_id:q.id,fact_ids:q.facts,objective:q.rationale,prompt:q.prompt,minimal_sufficient_answer:q.criteria.map(c=>c[0]),point_decision:q.point,question_style:'case',topic_ids:q.topics??[spec.topic]})),unresolved_content_findings:[]});
 if(spec.topic==='11'){
  design.at(-1).source_boundaries={
   past_exam_variant:'연도별 A p211 L8170–8191은 2022 문제8 물음2의 기출변형이며, 항목②가 소급검토이다. 연도별 B p72 L3722–3757에서 같은 원물음 항목②는 예상 배상금액과 사업계획의 일관성 검토로 다르다. 따라서 소급검토를 실제 원시험의 동일 요구로 확정하지 않는다. 기존 분석의 B occurrence 연결은 이번 신규 직접 빈도의 근거로 사용하지 않는다.',
   practice_reprint:'고급연습 p194–197의 2025 GS1 문제5와 부록 p364는 같은 모의 물음의 재수록이며 별도 출제로 더하지 않는다.',
   manual_dependencies:'540.32의 문단 참조가 원문 줄바꿈으로 자동 parser에서 누락되므로 32와 A133–A136을 수동으로 계획 source IDs에 포함하고 실제 원문을 확인하였다. A135의 700 참조는 이번 발문에서 감사의견 종류를 묻는 근거로 사용하지 않는다. A136 각주56의 원문 240 문단33(b) 표기를 보존하였다.',
   transcript_fidelity:'등록 전사는 선택한 원문 fragment의 모음이다. PDF PAGE 위치표시는 작성자가 추가했고 A57의 각주38을 해당 문단 말미로 이동하였다. 연속 PDF 원문 전체를 변형 없이 복제했다고 표시하지 않는다.'
  };
 }
 sets.push(set);
}
for(const [file,data]of[['sets.json',sets],['design.json',design],['review.json',review],['qa.json',qa]])fs.writeFileSync(`${dir}/${file}`,JSON.stringify(data,null,2)+'\n',{flag:process.argv.includes('--replace-draft')?'w':'wx'});
console.log(JSON.stringify({sets:sets.map(s=>({id:s.id,fact_chars:[...s.shared_context.facts.map(f=>f.text).join('\n')].length,questions:s.subquestions.length,points:s.subquestions.reduce((a,q)=>a+q.criteria.length,0)})),review_rows:review.length,qa_rows:qa.length}));
