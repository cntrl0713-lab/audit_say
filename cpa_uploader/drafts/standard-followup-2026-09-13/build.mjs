import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../questionSourceCatalog.mjs';
import {groups,contextRanges} from './content.mjs';
export const batch='cpa_uploader/drafts/standard-followup-2026-09-13';
const raw='cpa_uploader/raw/originals/standard-followup-2026-09-13';
const hash=v=>createHash('sha256').update(v).digest('hex');
const sha=f=>hash(fs.readFileSync(f));
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');};
const immutable=(f,v)=>{if(fs.existsSync(f)&&fs.readFileSync(f,'utf8')!==v)throw Error(`保존본 불일치 ${f}`);if(!fs.existsSync(f))write(f,v);};
const inputs={KGA:'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',ETHICS:'cpa_uploader/raw/originals/standard-expansion-2026-09-13/ethics-2024-complete.txt',LAW:`${raw}/external-audit-act-article22.txt`};
const urls={KGA:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06',ETHICS:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=ethstd03&bltnNo=11735541549550&fileSeq=2&subId=sub06',LAW:'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027658713'};
const editions={KGA:'KICPA 2026년 7월 개정 전문. 해당 기준의 일반 요구를 출제하며 시험 적용연도는 별도로 확정하지 않는다.',ETHICS:'공인회계사윤리기준 2024-12-19 의결 전문. 2026-09-13 개정 공고 및 공개초안 목록 확인; 2026-09-02 공개초안은 확정 본문으로 적용하지 않는다.',LAW:'국가법령정보센터 현행 제22조: 법률 제20896호, 2025-04-01 시행. 2026-09-13 직접 확인. 제22조제1항부터 제7항까지 직접 대조한다.'};
const category=s=>/^\d+$/.test(s)?'KGA':s;
const lines=Object.fromEntries(Object.entries(inputs).map(([k,f])=>[k,fs.readFileSync(f,'utf8').split(/\r?\n/u)]));
const quote=(s,[a,b])=>lines[category(s)].slice(a-1,b).join('\n');
const source=`${batch}/sources/official-excerpts.txt`;
let text='직접 공식 원문 발췌. 원문 행 내용은 바꾸지 않고 LF로 연결했다. 탐색 제목·원행 위치만 추가했다.\n';
for(const [s,ranges] of Object.entries(contextRanges)){
 text+=`\n# ${category(s)==='KGA'?`KGA ${s}`:s==='ETHICS'?'ETHICS: 공인회계사윤리기준':'LAW: 외부감사법'}: 직접 근거와 의존 문맥\n`;
 for(const range of ranges)text+=`\n원 추출본 ${inputs[category(s)]} L${range[0]}–L${range[1]}\n${quote(s,range)}\n`;
}
immutable(`${raw}/official-excerpts.txt`,text);immutable(source,text);
const bankPath='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(bankPath,'utf8'));
const topics=JSON.parse(fs.readFileSync('cpa_uploader/data/learning-question-classifications.json','utf8')).topics;
const catalog=buildSourceCatalog();
const inv=JSON.parse(fs.readFileSync(`${batch}/comparison-inventory.json`,'utf8'));
const selectedElements=groups.flatMap(g=>g.elements);
const elementData=JSON.parse(fs.readFileSync('cpa_uploader/analysis/question-elements/question-elements.json','utf8'));
const research={date:'2026-09-13',bank_sha256:sha(bankPath),comparison_inventory_sha256:sha(`${batch}/comparison-inventory.json`),comparison_scope:{canonical_sets:bank.length,canonical_questions:bank.flatMap(s=>s.subquestions).length,draft_and_bank_variants:inv.variants.length,prior_batches:['cpa_uploader/drafts/standard-gap-2026-09-13/index.json','cpa_uploader/drafts/standard-expansion-2026-09-13/index.json']},selection_policy:'기존·진행 중 초안의 요구와 직접 비교. 미연결 또는 낮은 문구 유사도를 미출제 확정으로 사용하지 않음. 지침상 학습 순서를 따라 윤리·부정 및 법규·감사증거·표본감사·보고 순서로 배열.',edition_policy:editions,excluded_candidates:[{topic:'낮은 감사보수',reason:'pilot-01-005/sub3이 위협과 안전장치를 이미 다룸'},{topic:'계약서 내용',reason:'pilot-03-005/sub2와 중복'},{topic:'통제무력화 기본 절차',reason:'pilot-05-002, pilot-05-009가 이미 다룸'},{topic:'계정·거래 경영진주장 및 중요성 지표',reason:'직전 standard-gap 배치와 중복'},{topic:'전문가·내부감사·서비스조직 이용',reason:'pilot-13-002·003·009·010·011에서 해당 요구가 이미 구체적으로 다뤄져 제외'},{topic:'이해상충·제2의견·감사인 교체',reason:'직전 standard-expansion 배치의 15물음과 중복되어 제외'},{topic:'개정 윤리기준 공개초안',reason:'확정 규정이 아니므로 배제'}],groups:groups.map(g=>({id:g.id,title:g.title,neighbors:g.neighbors,difference:g.difference,source_unit_ids:g.units,elements:g.elements})),elements:elementData.elements.filter(e=>selectedElements.includes(e.id)),frequency_note:'개별 요소의 기출 고유물음 빈도와 모의 빈도를 별도로 유지한다. 성공보수 안전장치, 통계적 표본감사의 특성, 임의추출 적용의 구체적인 요구를 원발문과 대조했다. 같은 시험의 재수록은 추가 횟수로 합하지 않는다. 기타 새 기준서 요구의 직접 기출빈도는 확정하지 않았다.'};
write(`${batch}/research.json`,research);
const index=[];const semantics=[];const cases=[];let num=0;
let problems='# 기준서형 추가 물음 14선\n\n각 물음은 다른 물음이나 회사별 사례 없이 독립적으로 풉니다. 물음에서 정한 범위는 모두 답하되, 순서·문장 수는 점수에 영향을 주지 않습니다.\n\n';
let answers='# 기준서형 추가 물음 14선 — 모범답안·배점\n\n각 독립 채점기준은 1점이며 의미가 같은 자연스러운 표현을 인정합니다. 아래 번호는 정답 순서를 강제하지 않습니다.\n\n';
for(const g of groups){
 const topic=topics.find(t=>t.id===g.topic);if(!topic)throw Error('주제 없음');
 for(const id of g.units)if(!catalog.units.some(u=>u.id===id))throw Error(`카탈로그 ID 없음 ${id}`);
 const setId=`draft-standard-followup-20260913-${g.id.toLowerCase()}`;
 const file=`${batch}/${g.id.toLowerCase()}.json`;const refs=[];
 const refFor=span=>{const id=`src-${g.standard.toLowerCase()}-${span.join('-')}`;const q=quote(g.standard,span);if(!text.includes(q))throw Error(`발췌에 없는 인용 ${id}`);if(!refs.some(r=>r.id===id))refs.push({id,file:source,title:`${editions[category(g.standard)]} 원 추출본 L${span[0]}–L${span[1]}`,page:category(g.standard)==='KGA'?`KGA ${g.standard}`:g.standard==='ETHICS'?'공인회계사윤리기준':'외부감사법 제22조',source_quote:q,role:'standard',content_hash:hash(q)});return id;};
 const subs=g.questions.map((q,qi)=>{
  num++;const id=`sub${qi+1}`;const req=[];
  const criteria=q.items.map((item,ci)=>{const ref=refFor(item.source),rid=`req-${item.source.join('-')}`;if(!req.some(r=>r.id===rid))req.push({id:rid,source_ref_id:ref,source_quote:quote(g.standard,item.source),source_span:`${g.standard} ${q.paragraph}; 추출본 L${item.source[0]}–L${item.source[1]}`});return {id:`crit${ci+1}`,requirement_id:rid,claim:item.answer+(item.note?` ${item.note}`:''),critical_facts:[{id:`fact${ci+1}`,type:q.type==='judgment'&&ci===0?'conclusion':'action',expected:item.answer}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[ref]};});
  const models=q.items.map(i=>i.answer);const sub={id,type:q.type,question_style:'standard',topic_ids:q.topics,prompt:q.prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},model_answer:models,requirements:req,criteria};
  for(const role of ['model','partial','wrong']){const met=role==='model'?criteria.map((_,i)=>i+1):role==='partial'?q.met:[];cases.push({id:`${g.id.toLowerCase()}-${id}-${role}`,set_file:file,set_id:setId,subquestion_id:id,role,answer:role==='model'?models.join('\n'):q[role],expected_score:met.length,expected_criteria:criteria.map((c,i)=>({criterion_id:c.id,verdict:met.includes(i+1)?'met':role==='wrong'&&q.opposed.includes(i+1)?'contradicted':'not_met',reason:met.includes(i+1)?`답안이 충족하는 독립 의미: ${q.items[i].answer}`:`정답 의미의 누락 또는 명시적 부정: ${q.items[i].answer}`})),selection_reason:role==='model'?'저장 모범답안 그대로':role==='partial'?'발문·공식 근거에서 미리 확정한 일부 독립 명제만 충족하는 자연어 답안':'모든 기준의 정답 의미가 없는 오답/조건 경계 답안'});}
  semantics.push({question:`${setId}/${id}`,number:num,reviewer_kind:'authoring_agent',transport:'agent_content_review',human_review:false,question_style:'standard',style_reason:'회사 고유 사실을 해석하지 않고 일반 적용 조건과 공식 요구만으로 독립적으로 답할 수 있다.',topics:q.topics,topic_reason:g.title,minimum_sufficient_answer:models,points:criteria.length,point_decision:'유지',point_rationale:q.rationale,comparison:{neighbor_keys:g.neighbors,reason:g.difference,inventory:`${batch}/comparison-inventory.json`},source_review:q.items.map((item,i)=>({criterion_id:criteria[i].id,source_file:source,original:inputs[category(g.standard)],source_span:item.source,quote_sha256:hash(quote(g.standard,item.source)),direct_support:item.answer,decision:'supported',meaning_note:item.note||'조건·대상·부정 방향을 발문·답안·공식 원문과 직접 대조.'})),local_semantic_variants:{complete:models.join('\n'),partial:q.partial,partial_met:q.met.map(n=>`crit${n}`),wrong:q.wrong,empty:'',reverse_complete:[...models].reverse().join(' '),reverse_expected_score:criteria.length,duplicate_first:`${models[0]} ${models[0]}`,duplicate_rule:'같은 의미 반복으로 추가점수 없음',omission_review:'남은 답안 전체에서 직접 또는 함축하여 충족하는 의미를 검토한다. 문장 수만으로 감점하지 않는다.'},unresolved_items:[],status:'content_reviewed'});
  problems+=`## ${num}. ${g.title}${g.questions.length>1?` (${qi+1})`:''} — ${criteria.length}점\n\n${q.prompt}\n\n`;
  answers+=`## ${num}. ${g.title}${g.questions.length>1?` (${qi+1})`:''} — ${criteria.length}점\n\n${q.prompt}\n\n${models.map((m,i)=>`${i+1}. ${m}`).join('\n')}\n\n배점: ${q.rationale}\n\n근거: ${g.standard==='ETHICS'?'공인회계사윤리기준':g.standard==='LAW'?'외부감사법':`KGA ${g.standard}`} ${q.paragraph}. [공식 원문](${urls[category(g.standard)]}) · [보존 발췌](sources/official-excerpts.txt).\n\n문항 ID: \`${setId}/${id}\`.\n\n`;
  return sub;
 });
 const set={schema_version:'3.0',id:setId,type:'linked_question_set',status:'needs_review',title:g.title,classification:{topic_id:g.topic,part:topic.part,chapter:topic.title,domain:'audit',standards:category(g.standard)==='KGA'?[`KGA ${g.standard}`]:[],tags:['기준서형','추가 출제',g.title]},source_refs:refs,shared_context:{facts:[]},learning_order:subs.map(q=>q.id),subquestions:subs,verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[editions[category(g.standard)],'담당 agent 의미검수와 실제 Luna 채점은 배치 증거로 구분한다. 사람 확인·정본 편입·게시를 의미하지 않는다.']}};
 write(file,set);
 write(`${file}.authoring-plan.json`,{version:1,artifact_type:'question_authoring_plan',plans:[{set_id:setId,version:1,topic_id:g.topic,mode:'new_from_standard',objective:g.title,scope:{actors:['감사인 또는 개업공인회계사; 발문에 명시한 경영진·지배기구·의뢰인'],timing:[g.timing],conditions:subs.map(q=>q.prompt),exceptions:['각 발문에 명시된 일반 조건·예외 및 조치의 선택 가능성을 보존한다.'],required_answers:subs.flatMap(q=>q.model_answer),exclusions:[g.exclusions]},question_types:[...new Set(subs.map(q=>q.type))],source_unit_ids:g.units,existing_question_difference:g.difference,edition_assumption:editions[category(g.standard)],unresolved_items:[],status:'ready'}]});
 index.push({group:g.id,file,set_id:setId,question_ids:subs.map(q=>q.id),points:subs.map(q=>q.criteria.length),source_unit_ids:g.units,catalog_usage:'실재하는 기존 카탈로그 탐색·계획 연결. 직접 정답 근거는 이번에 대조한 공식 원문 발췌이며 학습자료를 공식 원문으로 표시하지 않는다.',elements:g.elements});
}
if(num!==14)throw Error(`물음 수 ${num}`);
write(`${batch}/문제.md`,problems);write(`${batch}/모범답안-배점.md`,answers);
write(`${batch}/agent-review.json`,{version:1,artifact_type:'draft_agent_content_review',review_date:'2026-09-13',reviewer_kind:'authoring_agent',separate_paid_semantic_review:false,human_content_review:false,canonical_publication:false,input_hashes:{bank:sha(bankPath),source:sha(source),content:sha(`${batch}/content.mjs`),research:sha(`${batch}/research.json`)},questions:semantics});
write(`${batch}/qa-representatives.json`,{version:1,artifact_type:'draft_grading_cases',selected_before_execution:true,model:'gpt-5.6-luna',policy:{tolerance_points:1,target_rate:0.95,budget_usd:null,budget_note:'사용자 지정 금액 상한 없음. 대표 42건으로 초기 실행을 제한하고 제공자 한도 오류에서 중단한다. 내용 오류·허용범위 밖 점수에만 필요한 추가 검사를 한다.',representative_jobs:cases.length,extra_semantic_api_calls:0},cases});
const pdfs={KGA:'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf',ETHICS:'cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/sources/ethics-2024-full.pdf'};
const provenance={version:1,checked_on:'2026-09-13',urls,editions,inputs:Object.entries(inputs).map(([kind,file])=>({kind,file,sha256:sha(file)})),originals:Object.entries(pdfs).map(([kind,file])=>({kind,file,sha256:sha(file),prior_collection:'cpa_uploader/raw/collections/2026-09-11-initial/manifest.json'})),law_html:{file:`${raw}/external-audit-act-article22.html`,sha256:sha(`${raw}/external-audit-act-article22.html`)},derivation:{KGA:'보존된 PyMuPDF 전문의 지정 행을 LF로 연결',ETHICS:'pypdf의 페이지별 직접 추출본 지정 행; 페이지 제목만 추가',LAW:'공식 HTML 원본에서 Python 표준 HTMLParser로 script/style을 제외한 텍스트 노드를 추출; 법령 링크 경계가 줄바꿈으로 남음'},context_ranges:contextRanges,working_source:source,raw_excerpt:`${raw}/official-excerpts.txt`,excerpt_sha256:sha(source)};
write(`${batch}/sources/provenance.json`,provenance);
const entries=[...Object.entries(inputs).filter(([k])=>k!=='KGA').map(([k,f])=>({original_path:f,category:'verification',role:'official_text_extraction',source_url:urls[k],edition:editions[k]})),{original_path:`${raw}/external-audit-act-article22.html`,category:'verification',role:'official_html_original',source_url:urls.LAW,edition:editions.LAW},{original_path:`${raw}/official-excerpts.txt`,category:'verification',role:'official_text_excerpt'},{original_path:source,category:'verification',role:'working_source_copy',derived_from:`${raw}/official-excerpts.txt`}].map(e=>({...e,sha256:sha(e.original_path),provenance_record:`${batch}/sources/provenance.json`}));
write(`${batch}/sources/raw-inventory.json`,{version:1,entries});
write(`${batch}/index.json`,{version:1,artifact_type:'draft_batch_index',sets:index,source:provenance,counts:{sets:index.length,questions:num,points:semantics.reduce((n,q)=>n+q.points,0),grading_cases:cases.length}});
console.log(JSON.stringify({sets:index.length,questions:num,points:semantics.reduce((n,q)=>n+q.points,0),cases:cases.length}));
