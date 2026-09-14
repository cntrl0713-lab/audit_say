// content.mjs의 수동 제작 입력으로 초안 JSON·계획·문제지·모범답안·agent 검토 장부·대표답안을 생성한다.
//   node cpa_uploader/drafts/standard-priority-2026-09-14/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../questionSourceCatalog.mjs';
import {groups,contextRanges} from './content.mjs';
export const batch='cpa_uploader/drafts/standard-priority-2026-09-14';
const raw='cpa_uploader/raw/originals/standard-priority-2026-09-14';
const hash=v=>createHash('sha256').update(v).digest('hex');
const sha=f=>hash(fs.readFileSync(f));
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');};
const immutable=(f,v)=>{if(fs.existsSync(f)&&fs.readFileSync(f,'utf8')!==v)throw Error(`보존본 불일치 ${f}`);if(!fs.existsSync(f))write(f,v);};
const inputs={KGA:'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',LAW:'cpa_uploader/drafts/delegated-authoring-2026-09-11/s06/sources/external-audit-law-text.txt'};
const urls={KGA:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06',LAW:'https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=270309&efYd=20250401'};
const editions={KGA:'KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다.',LAW:'국가법령정보센터 외부감사법 전문(법률 제20896호, 2025-04-01 시행). 2026-09-11 수집 전문 추출본을 사용했고 2026-09-14 조문 페이지에서 같은 법률번호·시행일이 현행임을 확인했다. 대통령령 위임사항은 출제하지 않는다.'};
const category=s=>/^\d+$/.test(s)?'KGA':s;
const lines=Object.fromEntries(Object.entries(inputs).map(([k,f])=>[k,fs.readFileSync(f,'utf8').split(/\r?\n/u)]));
const quote=(s,[a,b])=>lines[category(s)].slice(a-1,b).join('\n');
const source=`${batch}/sources/official-excerpts.txt`;
let text='직접 공식 원문 발췌. 원문 행 내용은 바꾸지 않고 LF로 연결했다. 탐색 제목·원행 위치만 추가했다.\n';
for(const [s,ranges] of Object.entries(contextRanges)){
 text+=`\n# ${category(s)==='KGA'?`KGA ${s}`:'LAW: 외부감사법'}: 직접 근거와 의존 문맥\n`;
 for(const range of ranges)text+=`\n원 추출본 ${inputs[category(s)]} L${range[0]}–L${range[1]}\n${quote(s,range)}\n`;
}
immutable(`${raw}/official-excerpts.txt`,text);immutable(source,text);
const bankPath='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(bankPath,'utf8'));
const classificationFile='cpa_uploader/data/learning-question-classifications.json';
const classifications=JSON.parse(fs.readFileSync(classificationFile,'utf8'));
const topics=classifications.topics;
const catalog=buildSourceCatalog();
const styleOf=new Map(classifications.classifications.map(c=>[`${c.source_set_id}/${c.subquestion_id}`,c]));
const inventory={version:1,artifact_type:'comparison_inventory',created_from:{bank:{file:bankPath,sha256:sha(bankPath)},classifications:{file:classificationFile,sha256:sha(classificationFile)}},note:'현재 정본 전 물음의 발문 목록. 후보와 가까운 물음은 발문·모범답안·criterion을 직접 대조하고 그 결과를 research.json에 적었다. 병행 중인 case-additional-2026-09-14 사례형 초안은 기준서형 중복 대상이 아니어서 비교 목록에 넣지 않았다.',questions:bank.flatMap(s=>s.subquestions.map(q=>({key:`${s.id}/${q.id}`,style:styleOf.get(`${s.id}/${q.id}`)?.question_style??null,topics:styleOf.get(`${s.id}/${q.id}`)?.topic_ids??[],prompt_sha256:hash(q.prompt),prompt:q.prompt})))};
write(`${batch}/comparison-inventory.json`,inventory);
const selectedElements=groups.flatMap(g=>g.elements);
const elementData=JSON.parse(fs.readFileSync('cpa_uploader/analysis/question-elements/question-elements.json','utf8'));
for(const id of selectedElements)if(!elementData.elements.some(e=>e.id===id))throw Error(`요소 없음 ${id}`);
const priorResearch='cpa_uploader/analysis/reviews/standard-question-gaps-2026-09-14/evidence.json';
const research={date:'2026-09-14',bank_sha256:sha(bankPath),comparison_inventory_sha256:sha(`${batch}/comparison-inventory.json`),comparison_scope:{canonical_sets:bank.length,canonical_questions:inventory.questions.length,prior_research:{file:priorResearch,sha256:sha(priorResearch)}},selection_policy:'2026-09-14 조사의 P1 후보 중 사용자가 윤리 판본 결정과 무관하게 먼저 제작하도록 선택한 L1·L2·S1·S2·S4를 제작한다. 은행 기준서형·사례형 물음의 발문·모범답안·criterion과 직접 대조하여 새 요구만 배점한다.',edition_policy:editions,excluded_candidates:[{topic:'윤리기준 E1–E6',reason:'2026-09-02 공개초안(2027-01-01 시행 제안)에 따른 판본 결정 전이므로 이번 제작에서 제외'},{topic:'외부감사법 제11·13·15조, 제6조, 공인회계사법 제21조',reason:'사유·세부 행위가 시행령 위임이거나 원문 미확보여서 P2로 보류'},{topic:'원인별 감사범위 제한 예시(705.A10–A12)',reason:'예시 일부를 고르게 하면 모두 작성 원칙과 충돌하므로 원인과 시사점만 출제'},{topic:'600.40의 업무·활용·보고 형식·부문중요성·그룹업무팀 식별 유의적 위험',reason:'pilot-14-002/sub2가 이미 다룸'}],groups:groups.map(g=>({id:g.id,research_candidate:g.research,title:g.title,neighbors:g.neighbors,difference:g.difference,source_unit_ids:g.units,elements:g.elements})),elements:elementData.elements.filter(e=>selectedElements.includes(e.id)),frequency_note:'요소별 기출 고유물음과 모의 빈도를 분리해 유지한다. 직접·일부 대응과 인접 관계는 coverage-review.json의 관계 판정을 따른다. 교재 재수록은 추가 횟수로 합하지 않았고, 새 요구 전체의 미출제를 확정하지 않았다.'};
write(`${batch}/research.json`,research);
const index=[];const semantics=[];const cases=[];let num=0;
let problems='# 기준서형 우선 추가 물음 10선\n\n각 물음은 다른 물음이나 회사별 사례 없이 독립적으로 풉니다. 물음에서 정한 범위는 모두 답하되, 순서·문장 수는 점수에 영향을 주지 않습니다.\n\n';
let answers='# 기준서형 우선 추가 물음 10선 — 모범답안·배점\n\n각 독립 채점기준은 1점이며 의미가 같은 자연스러운 표현을 인정합니다. 아래 번호는 정답 순서를 강제하지 않습니다.\n\n';
for(const g of groups){
 const topic=topics.find(t=>t.id===g.topic);if(!topic)throw Error('주제 없음');
 for(const id of g.units)if(!catalog.units.some(u=>u.id===id))throw Error(`카탈로그 ID 없음 ${id}`);
 const setId=`draft-standard-priority-20260914-${g.id.toLowerCase()}`;
 const file=`${batch}/${g.id.toLowerCase()}.json`;const refs=[];
 const refFor=span=>{const id=`src-${g.standard.toLowerCase()}-${span.join('-')}`;const q=quote(g.standard,span);if(!text.includes(q))throw Error(`발췌에 없는 인용 ${id}`);if(!refs.some(r=>r.id===id))refs.push({id,file:source,title:`${editions[category(g.standard)]} 원 추출본 L${span[0]}–L${span[1]}`,page:category(g.standard)==='KGA'?`KGA ${g.standard}`:g.lawArticle,source_quote:q,role:'standard',content_hash:hash(q)});return id;};
 const subs=g.questions.map((q,qi)=>{
  num++;const id=`sub${qi+1}`;const req=[];
  const criteria=q.items.map((item,ci)=>{const ref=refFor(item.source),rid=`req-${item.source.join('-')}`;if(!req.some(r=>r.id===rid))req.push({id:rid,source_ref_id:ref,source_quote:quote(g.standard,item.source),source_span:`${category(g.standard)==='KGA'?`KGA ${g.standard}`:g.lawArticle} ${q.paragraph}; 추출본 L${item.source[0]}–L${item.source[1]}`});return {id:`crit${ci+1}`,requirement_id:rid,claim:item.answer+(item.note?` ${item.note}`:''),critical_facts:[{id:`fact${ci+1}`,type:q.type==='judgment'&&ci===0?'conclusion':'action',expected:item.answer}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[ref]};});
  const models=q.items.map(i=>i.answer);const sub={id,type:q.type,question_style:'standard',topic_ids:q.topics,prompt:q.prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},model_answer:models,requirements:req,criteria};
  for(const role of ['model','partial','wrong']){const met=role==='model'?criteria.map((_,i)=>i+1):role==='partial'?q.met:[];cases.push({id:`${g.id.toLowerCase()}-${id}-${role}`,set_file:file,set_id:setId,subquestion_id:id,role,answer:role==='model'?models.join('\n'):q[role],expected_score:met.length,expected_criteria:criteria.map((c,i)=>({criterion_id:c.id,verdict:met.includes(i+1)?'met':role==='wrong'&&q.opposed.includes(i+1)?'contradicted':'not_met',reason:met.includes(i+1)?`답안이 충족하는 독립 의미: ${q.items[i].answer}`:`정답 의미의 누락 또는 명시적 부정: ${q.items[i].answer}`})),selection_reason:role==='model'?'저장 모범답안 그대로':role==='partial'?'발문·공식 근거에서 미리 확정한 일부 독립 명제만 충족하는 자연어 답안':'모든 기준의 정답 의미가 없는 오답/조건 경계 답안'});}
  semantics.push({question:`${setId}/${id}`,number:num,reviewer_kind:'authoring_agent',transport:'agent_content_review',human_review:false,question_style:'standard',style_reason:'회사 고유 사실을 해석하지 않고 일반 적용 조건과 공식 요구만으로 독립적으로 답할 수 있다.',topics:q.topics,topic_reason:g.title,minimum_sufficient_answer:models,points:criteria.length,point_decision:'유지',point_rationale:q.rationale,comparison:{neighbor_keys:g.neighbors,reason:g.difference,inventory:`${batch}/comparison-inventory.json`},source_review:q.items.map((item,i)=>({criterion_id:criteria[i].id,source_file:source,original:inputs[category(g.standard)],source_span:item.source,quote_sha256:hash(quote(g.standard,item.source)),direct_support:item.answer,decision:'supported',meaning_note:item.note||'조건·대상·부정 방향을 발문·답안·공식 원문과 직접 대조.'})),local_semantic_variants:{complete:models.join('\n'),partial:q.partial,partial_met:q.met.map(n=>`crit${n}`),wrong:q.wrong,empty:'',reverse_complete:[...models].reverse().join(' '),reverse_expected_score:criteria.length,duplicate_first:`${models[0]} ${models[0]}`,duplicate_rule:'같은 의미 반복으로 추가점수 없음',omission_review:'남은 답안 전체에서 직접 또는 함축하여 충족하는 의미를 검토한다. 문장 수만으로 감점하지 않는다.'},unresolved_items:[],status:'content_reviewed'});
  const label=category(g.standard)==='KGA'?`KGA ${g.standard}`:g.lawArticle.replace(/ 제\d+조$/,'');
  problems+=`## ${num}. ${g.title}${g.questions.length>1?` (${qi+1})`:''} — ${criteria.length}점\n\n${q.prompt}\n\n`;
  answers+=`## ${num}. ${g.title}${g.questions.length>1?` (${qi+1})`:''} — ${criteria.length}점\n\n${q.prompt}\n\n${models.map((m,i)=>`${i+1}. ${m}`).join('\n')}\n\n배점: ${q.rationale}\n\n근거: ${label} ${q.paragraph}. [공식 원문](${urls[category(g.standard)]}) · [보존 발췌](sources/official-excerpts.txt).\n\n문항 ID: \`${setId}/${id}\`.\n\n`;
  return sub;
 });
 const set={schema_version:'3.0',id:setId,type:'linked_question_set',status:'needs_review',title:g.title,classification:{topic_id:g.topic,part:topic.part,chapter:topic.title,domain:'audit',standards:category(g.standard)==='KGA'?[`KGA ${g.standard}`]:[],tags:['기준서형','추가 출제',g.title]},source_refs:refs,shared_context:{facts:[]},learning_order:subs.map(q=>q.id),subquestions:subs,verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[editions[category(g.standard)],'담당 agent 의미검수와 실제 Luna 채점은 배치 증거로 구분한다. 사람 확인·정본 편입·게시를 의미하지 않는다.']}};
 write(file,set);
 write(`${file}.authoring-plan.json`,{version:1,artifact_type:'question_authoring_plan',plans:[{set_id:setId,version:1,topic_id:g.topic,mode:'new_from_standard',objective:g.title,scope:{actors:['감사인·그룹업무팀·부문감사인 또는 회사; 발문에 명시한 경영진·지배기구·감사위원회·감사'],timing:[g.timing],conditions:subs.map(q=>q.prompt),exceptions:['각 발문에 명시된 일반 조건·예외·법규상 가능성과 조치의 선택관계를 보존한다.'],required_answers:subs.flatMap(q=>q.model_answer),exclusions:[g.exclusions]},question_types:[...new Set(subs.map(q=>q.type))],source_unit_ids:g.units,existing_question_difference:g.difference,edition_assumption:editions[category(g.standard)],unresolved_items:[],status:'ready'}]});
 index.push({group:g.id,research_candidate:g.research,file,set_id:setId,question_ids:subs.map(q=>q.id),points:subs.map(q=>q.criteria.length),source_unit_ids:g.units,catalog_usage:'실재하는 기존 카탈로그 탐색·계획 연결. 직접 정답 근거는 이번에 대조한 공식 원문 발췌이며 학습자료를 공식 원문으로 표시하지 않는다.',elements:g.elements});
}
if(num!==10)throw Error(`물음 수 ${num}`);
write(`${batch}/문제.md`,problems);write(`${batch}/모범답안-배점.md`,answers);
write(`${batch}/agent-review.json`,{version:1,artifact_type:'draft_agent_content_review',review_date:'2026-09-14',reviewer_kind:'authoring_agent',separate_paid_semantic_review:false,human_content_review:false,canonical_publication:false,input_hashes:{bank:sha(bankPath),source:sha(source),content:sha(`${batch}/content.mjs`),research:sha(`${batch}/research.json`)},questions:semantics});
write(`${batch}/qa-representatives.json`,{version:1,artifact_type:'draft_grading_cases',selected_before_execution:true,model:'gpt-5.6-luna',policy:{tolerance_points:1,target_rate:0.95,budget_usd:null,budget_note:'사용자 지정 금액 상한 없음. 대표 30건으로 초기 실행을 제한하고 제공자 한도 오류에서 중단한다. 내용 오류·허용범위 밖 점수에만 필요한 추가 검사를 한다.',representative_jobs:cases.length,extra_semantic_api_calls:0},cases});
const originals={KGA:'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf',LAW:'cpa_uploader/drafts/delegated-authoring-2026-09-11/s06/sources/external-audit-law-view.html'};
const provenance={version:1,checked_on:'2026-09-14',urls,editions,inputs:Object.entries(inputs).map(([kind,file])=>({kind,file,sha256:sha(file)})),originals:Object.entries(originals).map(([kind,file])=>({kind,file,sha256:sha(file),prior_collection:'cpa_uploader/raw/collections/2026-09-11-initial/manifest.json'})),current_law_check:{checked_on:'2026-09-14',url:'https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1028002685',observed:'주식회사 등의 외부감사에 관한 법률 [시행 2025. 4. 1.] [법률 제20896호, 2025. 4. 1., 일부개정]',method:'국가법령정보센터 조문 페이지 조회. 보존 전문 추출본과 같은 법률번호·시행일임을 확인했다.'},derivation:{KGA:'보존된 PyMuPDF 전문의 지정 행을 LF로 연결',LAW:'2026-09-11 국가법령정보센터 외부감사법 본문 HTML에서 추출한 보존 텍스트의 지정 행을 LF로 연결'},context_ranges:contextRanges,working_source:source,raw_excerpt:`${raw}/official-excerpts.txt`,excerpt_sha256:sha(source)};
write(`${batch}/sources/provenance.json`,provenance);
const entries=[{original_path:inputs.LAW,category:'verification',role:'official_text_extraction',source_url:urls.LAW,edition:editions.LAW},{original_path:`${raw}/official-excerpts.txt`,category:'verification',role:'official_text_excerpt'},{original_path:source,category:'verification',role:'working_source_copy',derived_from:`${raw}/official-excerpts.txt`}].map(e=>({...e,sha256:sha(e.original_path),provenance_record:`${batch}/sources/provenance.json`}));
write(`${batch}/sources/raw-inventory.json`,{version:1,entries});
write(`${batch}/index.json`,{version:1,artifact_type:'draft_batch_index',sets:index,source:provenance,counts:{sets:index.length,questions:num,points:semantics.reduce((n,q)=>n+q.points,0),grading_cases:cases.length}});
console.log(JSON.stringify({sets:index.length,questions:num,points:semantics.reduce((n,q)=>n+q.points,0),cases:cases.length}));
