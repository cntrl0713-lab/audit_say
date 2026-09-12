import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../../../questionSourceCatalog.mjs';
import {notes, overlaps} from './scope-notes.mjs';

const base='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const out=base+'/c/review-plans';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const fileInfo=f=>({file:f,sha256:sha(fs.readFileSync(f))});
const save=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const bankFile=base+'/prepared-reviewed-v3/candidate-authoring.json';
const bank=read(bankFile), old=read(base+'/canonical-before.json');
const changed=read(base+'/prepared-reviewed-v1/summary.json').canonical.changed_sets;
const audits=['a','b','c'].flatMap(owner=>read(base+'/'+owner+'/audit.json').entries.map(e=>({...e,owner})));
const splitEntries=read(base+'/root/lineage.json').entries;
const reg=read(base+'/a/source-registration-evidence-2026-09-11.json');
const catalog=buildSourceCatalog(), units=catalog.units;
const idmap=new Map(units.map(u=>[u.id,u]));
const norm=s=>s.normalize('NFC').replace(/\s+/gu,'').toLowerCase();
const normunits=units.filter(u=>u.kind==='standard').map(u=>({u,n:norm(u.quote)}));
const promotions=read('cpa_uploader/data/cpa_question_sets_v3.promotions.json').entries;
const policyFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md';
const pointFile='docs/물음별-학습-단위와-분류-계약.md';
const sourceMappings=[], pending=[], entries=[];
const totals=s=>s.subquestions.reduce((n,q)=>n+q.criteria.reduce((n,c)=>n+c.max_points,0),0);
const actors={
 '01':['업무수행이사·업무팀·회계법인','경영진·감사인측 외부전문가(해당 물음에 한함)'],
 '02':['독립된 재무제표 감사인','재무제표를 작성하는 경영진'],
 '03':['감사 업무 수임·유지 여부와 조건을 판단하는 감사인','책임을 인정하고 업무조건을 합의하는 경영진·적절한 지배기구'],
 '04':['감사전략·계획·중요성·감사문서를 작성하고 검토하는 감사인'],
 '05':['부정위험·미비점을 평가하는 감사인','경영진 및 별도 지배기구, 요구되는 경우 외부 수신자'],
 '06':['기업 및 내부통제를 이해하고 위험을 평가하는 감사인·업무팀','기업의 경영진 및 적절한 정보 제공자'],
 '07':['평가된 위험에 대응할 감사절차를 설계·실행하는 감사인'],
 '08':['감사증거를 입수·평가하는 감사인','해당 물음에서 활용하는 경영진측 전문가'],
 '09':['조회·재고·소송 절차를 수행하는 감사인','경영진·외부 조회 수신인·법률고문은 해당 물음의 지정 역할에 한함'],
 '10':['표본 또는 분석적절차를 설계하고 결과를 평가하는 감사인','설명을 제공하는 경영진은 해당 물음에 한함'],
 '11':['회계추정·특수관계자 거래 위험에 대응하는 감사인','추정치와 관련 거래를 식별·보고하는 경영진'],
 '12':['감사종료 시점 평가와 후속사건·서면진술을 다루는 감사인','경영진 및 지배기구는 각 전달 요구의 상대방'],
 '13':['외부감사인 또는 이용자기업 감사인','감사인측 전문가·내부감사기능·서비스조직은 물음마다 구별된 역할'],
 '14':['그룹업무수행이사·그룹업무팀','부문감사인·그룹 및 부문 경영진·그룹 지배기구'],
 '15':['재무제표 의견을 형성하고 보고서를 발행하는 감사인','재무제표 작성 책임이 있는 경영진 및 커뮤니케이션 상대 지배기구'],
 '16':['감사보고서·기타정보·비교정보를 다루는 감사인','경영진과 지배기구는 각 수정·전달 요구의 상대방'],
 '17':['재무제표·내부회계관리제도 통합감사를 수행하는 감사인','경영진과 지배기구는 통제 및 보고 책임에 따라 구별'],
 '18':['중소기업 감사기준의 적용·전환·문서화를 판단하는 감사인','업무조건 변경에 합의하는 경영진 또는 적절한 지배기구'],
 '19':['해당 인증·검토·합의된 절차 업무 수행자','업무 책임당사자·의도된 이용자 등 발문이 묻는 각 당사자']
};
const timing={
 '01':'감사 전 과정 및 보고서 발행 전 윤리·독립성·업무팀 역량 평가 시점',
 '02':'재무제표 감사를 계획·수행하고 증거를 평가하는 전 과정; 특정 달력 일자는 정의의 추가 정답이 아니다.',
 '03':'신규 수임 전 감사 전제조건 합의 또는 반복감사·업무조건 변경 검토 시점',
 '04':'감사 초기 계획, 감사 진행 중 변경, 적시 문서 작성 및 최종 파일 취합·보존 단계는 발문별로 구별한다.',
 '05':'부정·미비점을 식별하고 대응하는 감사 중 시점, 탈퇴 판단과 결정 후 단계는 구별한다.',
 '06':'기업 이해와 중요왜곡표시위험 식별·평가 및 추가절차 설계 전후의 관련 단계',
 '07':'평가된 재무제표 수준·주장 수준 위험에 대응하여 절차를 설계·실행하는 단계',
 '08':'증거를 선택·입수하고 목적상 적합성·일관성·신뢰성을 평가하는 단계',
 '09':'조회 요청 전 통제, 비회신·차이·거부·신뢰성 의심 후 대응, 재고 입회 및 보고 판단을 각 조건에 따라 구별한다.',
 '10':'표본 및 실증적 분석절차의 설계·수행·결과 평가 단계; 다른 단계의 의무를 합치지 않는다.',
 '11':'당기 추정치·거래 위험평가와 대응 절차; 전기 자료의 소급 검토는 당기 판단을 위한 정보로 취급한다.',
 '12':'재무제표일·감사보고서일·발행일의 선후관계와 계속기업 평가기간 및 서면진술 일자를 해당 물음별로 보존한다.',
 '13':'타인의 업무를 활용하기 전 이해·평가·합의, 활용 후 결과 평가·추가 업무 단계',
 '14':'그룹 수임·유지 판단, 부문 업무 지시, 연결 과정 및 최종 그룹 증거·의견 평가 단계',
 '15':'감사 종료 시 의견 형성과 보고서 작성·발행 전 커뮤니케이션 단계',
 '16':'의견 형성·보고서 작성 시점과 보고서일 전·후 기타정보 입수 시점, 전기·당기 비교정보를 구별한다.',
 '17':'내부통제 감사 수행·미비점 평가 및 각 감사보고서 발행 전 커뮤니케이션 단계',
 '18':'기준 적용 판단 및 감사 진행 중 요건 상실, 수행 중 문서화·종료 후 취합보존·추가변경 단계',
 '19':'각 업무의 수임·수행·증거 평가·결론 보고 단계; 정의·요소 명칭에 특정 회사 기간을 덧붙이지 않는다.'
};

function matchSource(set,ref){
 const forced=reg.source_ref_mappings.find(m=>m.set_id===set.id&&m.source_ref_id===ref.id);
 let selected=[], method='';
 if(forced){ selected=forced.actual_source_unit_ids.map(id=>idmap.get(id));method='registered_official_mapping'; }
 else {
  const n=norm(ref.source_quote);
  const standardLabel=ref.page?.match(/KGA\s*\d+/u)?.[0]?.replace(/\s+/gu,' ');
  const explicitParagraphs=[...ref.source_quote.matchAll(/^\s*(A?\d{1,3})\.\s+/gm)].map(m=>m[1]);
  const matching=normunits.filter(({u,n:uq})=>(uq.length>5&&n.length>5)&&(!standardLabel||u.standard===standardLabel)&&(uq.includes(n)||n.includes(uq)||(explicitParagraphs.includes(u.paragraph)&&uq.length>=50&&n.includes(uq.slice(0,50)))));
  const full=matching.filter(m=>m.n.includes(n));
  const rank=m=>(m.u.authority==='official_transcription'?0:1000000)+(m.u.file===ref.file?0:100000)+Math.abs(m.n.length-n.length);
  if(full.length){selected=[full.sort((a,b)=>rank(a)-rank(b))[0].u];method='normalized_source_quote_contained_in_unit';}
  else if(matching.length){
   // Preserve all substantive paragraph parts in the best authority/file group.
   const official=matching.filter(m=>m.u.authority==='official_transcription');
   const pool=official.length?official:matching;
   const chosenFile=pool.sort((a,b)=>rank(a)-rank(b))[0].u.file;
   const unique=new Map();
   for(const m of pool.filter(m=>m.u.file===chosenFile).sort((a,b)=>a.u.startLine-b.u.startLine)){
    const key=m.u.standard+'|'+m.u.paragraph+'|'+m.n;
    if(!unique.has(key))unique.set(key,m.u);
   }
   selected=[...unique.values()];method='direct_paragraph_part_or_prefix_comparison';
  }
  // KGA 240.39 spans a PDF marker and the following section title in the historical excerpt.
  if(set.id==='pilot-05-007'&&ref.id==='src240-39') {selected=[idmap.get('src-4cd052b5b68ae2e2b6')];method='direct_paragraph_comparison_240_39';}
 }
 if(!selected.length||selected.some(u=>!u)) pending.push({set_id:set.id,source_ref_id:ref.id,file:ref.file,title:ref.title});
 const row={set_id:set.id,source_ref_id:ref.id,source_file:ref.file,source_quote_sha256:sha(ref.source_quote),method,units:selected.filter(Boolean).map(u=>({id:u.id,file:u.file,authority:u.authority,standard:u.standard,paragraph:u.paragraph,page:u.page,startLine:u.startLine,endLine:u.endLine,quote_sha256:sha(u.quote),quote_relation:norm(u.quote).includes(norm(ref.source_quote))?'catalog_contains_source_quote':norm(ref.source_quote).includes(norm(u.quote))?'source_contains_catalog_quote':'same_paragraph_direct_boundary_comparison'}))};
 sourceMappings.push(row);return row;
}

for(const id of changed){
 const set=bank.find(s=>s.id===id), before=old.find(s=>s.id===id), n=notes[id];
 if(!set||!before||!n)throw new Error('missing explicit scope '+id);
 const topic=set.classification.topic_id, ownAudit=audits.filter(a=>a.set_id===id);
 const split=splitEntries.find(s=>s.set_id===id);
 const rel=overlaps.filter(o=>o.a===id||o.b===id);
 for(const o of rel)if(!bank.some(s=>s.id===o.a)||!bank.some(s=>s.id===o.b))throw new Error('missing peer '+JSON.stringify(o));
 const mappings=set.source_refs.map(r=>matchSource(set,r));
 const ids=[...new Set(mappings.flatMap(m=>m.units.map(u=>u.id)))];
 const official=mappings.filter(m=>m.units.some(u=>u.authority==='official_transcription'));
 const learning=mappings.filter(m=>m.units.every(u=>u.authority==='learning_material'));
 const prior=promotions.filter(e=>e.set_id===id&&e.semantic_review?.context?.authoring_plan?.set_id===id).at(-1)?.semantic_review.context.authoring_plan;
 const reasons=ownAudit.map(a=>`${id}/${a.subquestion_id}: ${a.before_points}→${a.after_points}점. ${a.reason}`);
 const splitNote=split ? ` 독립 물음 분리: 원 ${id}/${split.source_subquestion_id}의 명제 ID와 총점을 유지하여 ${split.parts.map(p=>`${p.subquestion_id}(${p.points??p.after_points??set.subquestions.find(q=>q.id===p.subquestion_id)?.criteria.reduce((a,c)=>a+c.max_points,0)}점)`).join(', ')}으로 재배치한다. ${split.reason}`:'';
 const edition=`2027년 CPA 시험 대비라는 사용자의 선택을 따른 기존 배치의 범위 보완이다. ${policyFile} 및 docs/archive/과거-검토-증거/reports/question-review-2027/개정-감사기준서-220-시행일-별도-기록.md에 따라 기본 사례는 2026-01-01 개시 보고기간과 2027년 후속 감사로 한정하고, 개정 품질관리체계를 선제 적용하지 않는 종전 정책·절차 체계를 사용한다. 일반 정의·절차 물음에는 필요 없는 특정 회사·기간을 새 정답 조건으로 붙이지 않는다. 2025 공식 전문과 대응 2026 본문 및 시행 문맥을 대조한 배치의 선택 정책이며, 금융위원회 2026-284 시험 공고가 모든 기준서 판본을 확정했다는 주장은 하지 않는다. 국제 개정 ISA 또는 시험 실시 연도만으로 국내 시행을 앞당기지 않는다. KGA 620의 품질관리 문구 선택은 종전체계 사례 설계의 해석이며 별도 일괄 시행일을 확정한 것이 아니다. ${topic==='19'?'인증·검토·합의된 절차는 각 source_refs에 지정된 업무별 기준과 국내 공식 발췌의 판본을 적용하며 일반 재무제표 감사 기준의 최신 문구를 자동 대입하지 않는다. ':''}최종 시험의 별도 판본 지정이나 새 시행 공고가 확인되면 그때 영향 범위를 다시 확인한다. 이는 현재 경계가 정해진 검수용 가정이며 최종 시험 판본의 무조건적 보증이 아니다.`;
 const plan={version:1,set_id:id,topic_id:topic,mode:'adapt_existing_question',
  objective:`기존 ${id} 「${set.title}」의 실제 요구를 유지하며 열거 요소와 서술의 독립 내용 단위에 정수 부분점수를 복원한다. ${n.condition} 기존 ${before.subquestions.length}물음 ${totals(before)}점에서 후보 ${set.subquestions.length}물음 ${totals(set)}점으로 보완하며 새 커버리지 추가를 목표로 하지 않는다.${splitNote}`,
  scope:{
   actors:actors[topic],
   timing:[timing[topic],'기본 2026-01-01 개시 보고기간·2027 후속 감사의 선택 판본 가정은 edition_assumption을 따른다. 발문 자체의 기간·이전/이후 조건이 구체적이면 그 조건을 우선한다.'],
   conditions:[n.condition,...(set.shared_context?.facts||[]).map(f=>`부모 사실 ${f.id}: ${f.text} [이미 주어진 사실은 반복만으로 배점하지 않는다. 기준서형에는 독립 발문의 일반 조건만 적용한다.]`),
    '사례형은 구체 사실 해석이 필요한 명제에서 그 사실과 연결한다. 기준서형은 부모 사실·다른 물음 없이 저장된 독립 발문의 요구만으로 풀이한다. 명칭 요구에 설명·사례 적용을 추가하지 않으며, 설명 요구는 핵심 행위·관계가 충족되어야 한다.',
    `직접 근거는 현재 후보의 source_refs/requirements와 그 실제 원문이다. 이 계획의 catalog 연결 ${official.length}개 source_ref는 official_transcription, ${learning.length}개는 learning_material이다. 학습자료 연결은 탐색과 기존 범위 추적이며 그 자체를 공식 원문 권위나 최신 시행 확인으로 승격하지 않는다. 출처별 실제 단위·권위는 source_mapping_evidence 메타데이터에 보존한다.`,
    ...(id==='pilot-06-005'?['KGA 330.8의 실제 원전은 2025 전문 PDF 314쪽, 원 추출본 L13508–13517이다. 새 공식 사본 point-review-a-supplement-2026-09-11.txt L130–136 / src-c559bb8c48bd39cea0의 본문과 대조되며, a/source-registration-330-page-followup.json을 근거로 삼는다. 카탈로그 page=null은 보존하고 문단 번호 8을 PDF 쪽수로 쓰지 않는다.']:[])],
   exceptions:[n.exception,'조건·부정·주체·시간·대안 관계는 각 criterion 원문을 유지한다. 전체 답안에서 판단이 명확히 함축되면 인정하고, 명시 반대는 해당 명제에서 구별한다. 한쪽의 오류를 독립된 이웃 명제 전체의 오류로 전파하지 않는다.'],
   required_answers:set.subquestions.map(q=>`${id}/${q.id} [${q.type}, ${q.criteria.reduce((n,c)=>n+c.max_points,0)}점] 발문: ${q.prompt}\n독립 요구: ${q.criteria.map(c=>`${c.id}(${c.max_points}점): ${c.claim}`).join(' / ')}`),
   exclusions:[n.exclusion,'새 물음 영역·미출제·빈도 공백 해소 주장은 하지 않는다. 이미 주어진 판단·조건이나 해설의 부가 지식을 숨은 점수로 추가하지 않는다. 같은 명제의 동의어 반복을 중복 배점하거나 같은 행위의 언어 조각을 기계적으로 나누지 않는다.','계획 ready는 범위가 정해졌다는 뜻이다. 의미검수 pass·실제 채점 통과·사람 확인·정본 반영·게시·DB 배포와 같지 않다. 현재 sidecar 작성 단계의 API 호출은 0회이다.']
  },
  question_types:[...new Set(set.subquestions.map(q=>q.type))],source_unit_ids:ids,
  existing_question_difference:[`이 계획은 ${id}의 원 ID 보완이다. 원물음의 요구·독립성 검토:`,...reasons,splitNote,
   ...(rel.length?rel.map(o=>`비교 ${o.a} ↔ ${o.b}: ${o.text}`):['현재 범위는 원 ID 요구의 배점·부분정답 보완이며, 동일 주제의 다른 세트를 넘어 신규 범위라고 주장하지 않는다. 은행 대조에서 같은 구체 요구가 추가 발견되면 기존 복습 또는 실제 내용 중복으로 기록한다.']),
   '위의 세트 간 반복은 기존 학습의 의도된 복습임을 현재 후속 계획에서 명시한 것이다. 과거부터 모든 반복을 명시했다고 소급하지 않는다. 같은 물음 안에서 동일 요구를 두 criterion으로 중복 가점하는 결함은 이 복습 설명으로 허용하지 않는다. 원본의 같은 ID를 비교 대상으로 잡아 수정 자체를 신규 중복 출제로 오판하지 않는다.'
  ].filter(Boolean).join('\n'),
  edition_assumption:edition, unresolved_items:pending.filter(p=>p.set_id===id).map(p=>`출처 ${p.source_ref_id}의 실제 카탈로그 단위를 확인할 수 없음`),status:pending.some(p=>p.set_id===id)?'draft':'ready',
  metadata:{purpose:'existing_question_point_remediation_semantic_review_sidecar',api_calls:0,model_review_status:'not_run_by_this_plan_task',
   input_scope:{set_id:id,original_subquestion_ids:before.subquestions.map(q=>q.id),current_subquestion_ids:set.subquestions.map(q=>q.id),original_points:totals(before),current_points:totals(set)},
   source_mapping_evidence:mappings, owner_audit:{file:base+'/'+ownAudit[0].owner+'/audit.json',entries:ownAudit.map(a=>a.subquestion_id)},
   split_lineage:split?{file:base+'/root/lineage.json',source_subquestion_id:split.source_subquestion_id,new_subquestion_ids:split.parts.map(p=>p.subquestion_id)}:null,
   prior_promoted_plan:prior?{file:'cpa_uploader/data/cpa_question_sets_v3.promotions.json',set_id:prior.set_id,version:prior.version,source_unit_ids:prior.source_unit_ids,all_old_source_ids_exist:prior.source_unit_ids.every(x=>idmap.has(x)),usage:'정확한 set_id 계보 및 원래 범위 참고만 사용. 과거 검수의 새 후보 승계나 과거 단위의 공식 권위 승격은 하지 않음.'}:null,
   policies:[policyFile,pointFile,'.agents/skills/audit-question-review/SKILL.md'],
   candidate_note:'prepared-reviewed-v3에서 실제 요구를 읽었다. source_quote의 개행·공백·해시 또는 직접 원문 위치 후속 정확화가 요구·criterion을 바꾸지 않으면 이 계획 범위는 유지될 수 있으나 실행 시 최종 후보·출처·계획 해시를 새로 고정해야 한다.'}
 };
 const f=out+'/'+id+'.json';save(f,plan);entries.push({set_id:id,...fileInfo(f)});
}
save(out+'/index.json',{entries});
save(out+'/source-mapping-evidence.json',{version:1,catalog_unit_count:units.length,source_registration:fileInfo(base+'/a/source-registration-evidence-2026-09-11.json'),entries:sourceMappings,unresolved:pending});
save(out+'/input-snapshot.json',{version:1,purpose:'scope_read_snapshot_not_review_approval',files:[bankFile,base+'/canonical-before.json',base+'/prepared-reviewed-v1/summary.json',...['a','b','c'].map(o=>base+'/'+o+'/audit.json'),base+'/root/lineage.json',policyFile,pointFile].map(fileInfo)});
console.log(JSON.stringify({plans:entries.length,ready:entries.length-new Set(pending.map(p=>p.set_id)).size,pending,source_refs:sourceMappings.length,catalog_units:units.length,index:fileInfo(out+'/index.json')},null,2));
