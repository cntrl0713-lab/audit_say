import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { groups, contextRanges } from './content.mjs';

const batch='cpa_uploader/drafts/standard-gap-2026-09-13';
const original='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf';
const extraction='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const sourceFile=`${batch}/sources/kga-2026-excerpts.txt`;
const rawFile='cpa_uploader/raw/originals/standard-gap-2026-09-13/kga-2026-excerpts.txt';
const collection='cpa_uploader/raw/collections/2026-09-13-standard-gap';
const url='https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06';
const edition='한국공인회계사회 보관 2026년 7월 개정 전문을 출제 근거 판본으로 고정한다. 별도 시험 적용연도는 지정하지 않으며 2027년 시험 적용을 확정하지 않는다. 문단 580.5의 2026-01-01 이후 개시 보고기간 시행 문구를 확인했다.';
export const hash=b=>createHash('sha256').update(b).digest('hex');
const fileHash=f=>hash(fs.readFileSync(f));
const write=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');};
const immutable=(f,v)=>{if(fs.existsSync(f)&&fs.readFileSync(f,'utf8')!==v)throw Error(`보존본 변경 금지: ${f}`); if(!fs.existsSync(f))write(f,v);};
if(fileHash(original)!=='59020bf1eba001c1fd0612f3af1098dbef4ca11dc22777b7266c80d39a615f84')throw Error('원본 PDF 변경');
if(fileHash(extraction)!=='f0914795b909ea38e6ab2d4db83a7cc0e3519730ae30c7925fca034bf5975568')throw Error('전문 추출본 변경');
const lines=fs.readFileSync(extraction,'utf8').split(/\r?\n/u);
const quote=([a,b])=>lines.slice(a-1,b).join('\n');
let source='수동 발췌: 2026년 전문의 원문 행을 그대로 연결. 제목·원행 위치는 탐색용 추가 메타데이터이다.\n';
for(const [standard,ranges] of Object.entries(contextRanges)) {
 source+=`\n# KGA ${standard}: 2026년 전문 발췌\n`;
 for(const span of ranges) source+=`\n원 추출본 L${span[0]}–L${span[1]}\n${quote(span)}\n`;
}
immutable(rawFile,source); // 새 파생 원자료는 raw에 먼저 보존한다.
immutable(sourceFile,source);
const provenance={version:1,review_date:'2026-09-13',source_url:url,edition,original_pdf:{file:original,sha256:fileHash(original)},extracted_text:{file:extraction,sha256:fileHash(extraction)},prior_collection:'cpa_uploader/raw/collections/2026-09-11-initial/manifest.json',derivation:'기존 PyMuPDF 전문 추출본에서 명시한 원행 범위를 줄 내용 변경 없이 LF로 연결; KGA 탐색 제목과 위치만 추가',ranges:contextRanges,raw_file:rawFile,working_copy:sourceFile,sha256:fileHash(rawFile),visual_review:{method:'Poppler 렌더 후 담당 agent 직접 확인',pdf_pages:[277,565,909],findings:['315.A190의 거래·기말잔액 각 여섯 주장과 공시 범위 확인','560.15–17의 통보조치·보고일 하한·문단 언급·미조치 후 대응 확인','1100.A28–A29의 사고과정 성격 및 일곱 항목 확인']}};
write(`${batch}/sources/provenance.json`,provenance);
write(`${batch}/sources/raw-inventory.json`,{version:1,entries:[{original_path:rawFile,category:'verification',role:'official_text_excerpt',sha256:fileHash(rawFile),source_url:url,edition,extraction_method:provenance.derivation,derived_from:extraction,provenance_record:`${batch}/sources/provenance.json`},{original_path:sourceFile,category:'verification',role:'working_source_copy',sha256:fileHash(sourceFile),source_url:url,edition,derived_from:rawFile}]});

const topics=JSON.parse(fs.readFileSync('cpa_uploader/data/learning-question-classifications.json','utf8')).topics;
const gapPath='cpa_uploader/analysis/reviews/standard-question-gaps-2026-09-13/evidence.json';
const gaps=JSON.parse(fs.readFileSync(gapPath,'utf8')).candidates;
const bankPath='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(bankPath,'utf8'));
const registry=JSON.parse(fs.readFileSync('cpa_uploader/analysis/coverage/registry.json','utf8'));
const catalogIds=new Set(registry.source_units.map(u=>u.id));
let number=0; const semantic=[]; const cases=[]; const index=[];
let questions='# 기준서형 추가 물음\n\n각 물음은 다른 물음이나 공통 사례 없이 독립적으로 풉니다. 발문에서 정한 범위는 모두 답하되 나열 순서·줄 수는 점수에 영향을 주지 않습니다.\n\n';
let answers='# 기준서형 추가 물음 — 모범답안과 배점\n\n독립 채점 기준은 각 1점입니다. 같은 의미의 자연스러운 표현을 인정하며 충족한 기준의 정수 점수를 합산합니다.\n\n';
for(const group of groups) {
 const topic=topics.find(t=>t.id===group.topic);
 const gap=gaps.find(g=>g.id===group.id);
 if(!topic||group.units.some(id=>!catalogIds.has(id)))throw Error(`주제/원자료 ID 없음: ${group.id}`);
 const setId=`draft-standard-gap-20260913-${group.id.toLowerCase()}`;
 const file=`${batch}/${group.id.toLowerCase()}.json`;
 const refs=[];
 const refFor=span=>{
  const id=`src-${group.standard}-${span.join('-')}`;
  if(!refs.some(s=>s.id===id))refs.push({id,file:sourceFile,title:`한국공인회계사회 2026년 7월 개정 전문; 원문 L${span[0]}–${span[1]}`,page:`KGA ${group.standard}`,source_quote:quote(span),role:'standard',content_hash:hash(quote(span))});
  return id;
 };
 const subs=group.questions.map((q,qi)=>{
  number++; const subId=`sub${qi+1}`;
  const models=q.items.map(i=>q.assertions?i.answer.replace('|',': '):i.answer);
  const specs=q.items.flatMap(i=>{
   if(!q.assertions)return [{...i,claim:i.answer}];
   const [name,meaning]=i.answer.split('|');
   return [{...i,claim:`경영진주장의 명칭으로 '${name}' 또는 동등한 명칭을 제시한다. 명칭 자체의 점수이며 정의 설명을 요구하지 않는다.`,answer:name,note:'A189의 대체 표현을 허용한다. 정의가 맞으면 별도 의미 criterion으로 채점한다.'},{...i,claim:meaning,answer:meaning,note:`${name}의 의미를 설명하는 점수다. 명칭만 적은 답에는 이 의미 점수를 주지 않는다. 문구 일치가 아니라 이 정의가 뜻하는 전체 측면을 확인한다.`}];
  });
  const requirements=[];
  const criteria=specs.map((i,ci)=>{
   const refId=refFor(i.source); const reqId=`req-${i.source.join('-')}`;
   if(!requirements.some(r=>r.id===reqId))requirements.push({id:reqId,source_ref_id:refId,source_quote:quote(i.source),source_span:`2026 전문 L${i.source[0]}–${i.source[1]}`});
   return {id:`crit${ci+1}`,requirement_id:reqId,claim:i.claim+(i.note?` ${i.note}`:''),critical_facts:[{id:`fact${ci+1}`,type:q.type==='enumeration'||q.assertions?'conclusion':'action',expected:i.answer}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[refId]};
  });
  const sub={id:subId,type:q.type,question_style:'standard',topic_ids:q.topics,prompt:q.prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},model_answer:models,requirements,criteria};
  const key=`${setId}/${subId}`;
  const metIds=q.met.map(i=>`crit${i}`);
  for(const role of ['model','partial','wrong']) {
   const selected=role==='model'?criteria.map(c=>c.id):role==='partial'?metIds:[];
   const opposites={'G01/sub1':[1],'G03/sub1':[2,3],'G04/sub1':[1,2,3,5],'G04/sub2':[1,2],'G07/sub1':[1,2,3,4],'G09/sub1':[1,2,3],'G09/sub2':[1,2],'G10/sub1':[1,2,5,7]};
   const contradicted=role==='wrong'?(opposites[`${group.id}/${subId}`]||[]).map(n=>`crit${n}`):[];
   cases.push({id:`${group.id.toLowerCase()}-${subId}-${role}`,set_file:file,set_id:setId,subquestion_id:subId,role,answer:role==='model'?models.join('\n'):q[role],expected_score:selected.length,expected_criteria:criteria.map(c=>({criterion_id:c.id,verdict:selected.includes(c.id)?'met':contradicted.includes(c.id)?'contradicted':'not_met',reason:selected.includes(c.id)?`답안에서 직접 충족하는 요구: ${c.claim}`:contradicted.includes(c.id)?`답안이 다음 요구의 의무·조건·결론을 명시적으로 부정함: ${c.claim}`:`이 답안에는 다음 독립 요구의 정답 의미가 없음: ${c.claim}`})),selection_reason:role==='model'?'저장 모범답안 바이트 그대로 독립 물음 투영에서 검증':role==='partial'?'다른 정답 요구를 생략하고 명시적으로 옳은 일부 요구만 유지; 기준서·발문에서 기대값을 먼저 정함':'무관하거나 명시적으로 반대인 답안; 모든 criterion의 정답 의미가 없는 0점 대표'});
  }
  semantic.push({question:key,group:group.id,number,reviewer_kind:'authoring_agent',transport:'agent_content_review',human_review:false,question_style:'standard',style_reason:'기업 고유 사실이나 다른 물음의 정보 없이 발문에 있는 기준서의 일반 조건만으로 모범답안이 성립한다.',topics:q.topics,topic_reason:group.title,minimum_sufficient_answer:models,points:criteria.length,point_decision:'유지/분리',point_rationale:q.rationale,comparison:{neighbor_keys:gap.neighbors,reason:gap.gap,prior_gap_evidence:gapPath},source_review:specs.map((i,ci)=>({criterion_id:criteria[ci].id,source_file:sourceFile,source_span:i.source,quote_sha256:hash(quote(i.source)),direct_support:i.answer,decision:'supported',meaning_note:i.note||'원문의 독립 요구를 보존했다. 조건·대상·부정의 방향을 발문과 답안에서 대조했다.'})),local_semantic_variants:{complete:models.join('\n'),partial:q.partial,partial_met:metIds,wrong:q.wrong,empty:'',reverse_complete:[...models].reverse().join(' '),reverse_expected_score:criteria.length,duplicate_first:`${models[0]} ${models[0]}`,duplicate_rule:'같은 의미 반복으로 추가 점수 없음',omission_review:'남은 답안 전체의 의미로 판단한다. 특히 명칭과 의미의 분리 및 조건의 생략을 검토했으며 자동으로 삭제 문장 수만큼 감점하지 않는다.'},boundary_notes:q.rationale,unresolved_items:[],status:'content_reviewed'});
  questions+=`## ${number}. ${group.title}${group.questions.length>1?` (${qi+1})`:''} — ${criteria.length}점\n\n${q.prompt}\n\n`;
  answers+=`## ${number}. ${group.title}${group.questions.length>1?` (${qi+1})`:''} — ${criteria.length}점\n\n${q.prompt}\n\n${models.map((a,i)=>`${i+1}. ${a}`).join('\n')}\n\n배점: ${q.rationale}\n\n근거: KGA ${group.standard}, [공식 전문 발췌](sources/kga-2026-excerpts.txt). 문항 ID: \`${key}\`.\n\n`;
  return sub;
 });
 const set={schema_version:'3.0',id:setId,type:'linked_question_set',status:'needs_review',title:group.title,classification:{topic_id:group.topic,part:topic.part,chapter:topic.title,domain:group.topic==='17'?'internal_control':'audit',standards:[`KGA ${group.standard}`],tags:['기준서형','공백 보완',group.title]},source_refs:refs,shared_context:{facts:[]},learning_order:subs.map(q=>q.id),subquestions:subs,verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[edition,'수동 독립 초안. agent 내용 검토와 실제 채점 증거는 배치 장부에 별도 보존한다. 사람 내용 확인·정본 승급·게시 상태를 나타내지 않는다.']}};
 write(file,set);
 const plan={version:1,topic_id:group.topic,mode:'new_from_standard',objective:group.title,scope:{actors:['감사인; 물음이 명시하는 경영진·지배기구'],timing:[group.timing],conditions:subs.map(q=>q.prompt),exceptions:[group.id==='G04'?'560.12 한정절차 제외; 17의 지배기구 전원 경영참여 시 통보 예외 보존':'원문에 명시된 조건은 각 독립 물음에 포함; 별도 법규·회사 고유 예외를 추가하지 않음'],required_answers:subs.flatMap(q=>q.model_answer),exclusions:[group.exclusions]},question_types:[...new Set(subs.map(q=>q.type))],source_unit_ids:group.units,existing_question_difference:gap.gap,edition_assumption:edition,unresolved_items:[],status:'ready'};
 write(`${file}.authoring-plan.json`,{version:1,artifact_type:'question_authoring_plan',plans:[{set_id:setId,...plan}]});
 index.push({group:group.id,file,set_id:setId,question_ids:subs.map(q=>q.id),points:subs.map(q=>q.criteria.length),source_unit_ids:group.units,catalog_usage:'기존 카탈로그 ID는 탐색·계획 연결이다. 직접 출제·검수 근거는 별도 보존한 2026 전문 발췌이며 학습자료 ID를 공식 원문으로 표시하지 않는다.',elements:gap.elements});
}
write(`${batch}/문제.md`,questions);
write(`${batch}/모범답안-배점.md`,answers);
write(`${batch}/qa-representatives.json`,{version:1,artifact_type:'draft_grading_cases',selected_before_execution:true,model:'gpt-5.6-luna',policy:{tolerance_points:1,target_rate:0.95,budget_usd:null,budget_note:'사용자 지정 금액 상한 없음; 이전 배치의 20달러 상한을 승계하거나 승인으로 표시하지 않는다. 대표 42건으로 실행을 제한하고 제공자 한도 오류 시 중단한다.',representative_jobs:cases.length,extra_semantic_api_calls:0},cases});
write(`${batch}/agent-review.json`,{version:1,artifact_type:'draft_agent_content_review',review_date:'2026-09-13',reviewer_kind:'authoring_agent',separate_paid_semantic_review:false,human_content_review:false,canonical_publication:false,input_hashes:{bank:fileHash(bankPath),gap_evidence:fileHash(gapPath),source:fileHash(sourceFile),content:fileHash(`${batch}/content.mjs`)},questions:semantic});
write(`${batch}/index.json`,{version:1,artifact_type:'draft_batch_index',sets:index,source:provenance,counts:{sets:index.length,questions:number,points:semantic.reduce((s,q)=>s+q.points,0),grading_cases:cases.length}});
console.log(JSON.stringify({sets:index.length,questions:number,points:semantic.reduce((s,q)=>s+q.points,0),cases:cases.length}));
