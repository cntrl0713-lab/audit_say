import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildSourceCatalog, sourceUnitToRef } from '../../../questionSourceCatalog.mjs';
import { authoringPlanHash, validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const catalog = buildSourceCatalog({ repoDir: root });
const content = JSON.parse(fs.readFileSync(path.join(dir, 'content-proposal.json'), 'utf8'));
const officialFile = 'cpa_uploader/data/official/delegated-n01-kga200-210-230-2025.txt';
const ethicsFile = 'cpa_uploader/data/official/delegated-n01-ethics-2024.txt';
const supplementFile = 'cpa_uploader/data/official/delegated-n01-kga230-supplement-2025.txt';
const evidenceFile = 'cpa_uploader/data/official/kga500-2025-review08.txt';
const sourceByKey = new Map(catalog.units.filter(u => [officialFile, ethicsFile,supplementFile,evidenceFile].includes(u.file)).map(u => [
    `${u.standard === '공인회계사윤리기준' ? 'ethics' : (u.standard ?? '').replace('KGA ', '')}.${u.paragraph}`, u
]));
const contextKeys: Record<string,string[]> = {
    '02':['200.15','200.A22','200.A23'],
    '01':['ethics.290.104','ethics.290.105','ethics.290.134'],
    '03':['210.9','210.11','210.A11','210.A14','210.A20','210.A23','210.A24'],
    '04':['230.13','230.14','230.15','230.A1','230.A21','230.A23','230.A24'],
};
const outputs = [];
for (const item of content.sets) {
    const requiredKeys = [...new Set<string>(item.questions.flatMap((q:any) => q.criteria.map((c:any) => c.support)))];
    const keys = [...new Set([...requiredKeys,...contextKeys[item.topic_id]])];
    const officialIds = keys.map(key => { const u = sourceByKey.get(key); if (!u) throw new Error(`Missing official source ${key}`); return u.id; });
    const supplementaryContext=item.topic_id==='02' ? ['500.7','500.11'].map(key=>{
        const u=sourceByKey.get(key)!;
        const fileHash=createHash('sha256').update(fs.readFileSync(path.resolve(root,u.file))).digest('hex');
        return `수동 의존 문맥(별도 득점 대상 아님): ${key}; 등록 ID ${u.id}; 파일 ${u.file}; 파일 SHA-256 ${fileHash}; 위치 ${u.locator}; 확인한 원문: ${u.quote}`;
    }) : [];
    const plan:any = {
        version:1, topic_id:item.topic_id, mode:'adapt_existing_question', objective:item.objective,
        scope:{
            actors:[item.topic_id==='01' ? '회계법인 자체 및 서로 독립된 감사의뢰인 갑·을·병; 개인·네트워크 관계 제외' : '감사인·업무팀 및 기업 경영진; 필요한 기업 내부 관계자'],
            timing:[item.topic_id==='01' ? '2026-02-01 수임 판단, 2026-01-01 개시 보고기간' : '2026-01-01 개시 보고기간 감사; 문서화 후속업무는 2027년에 수행'],
            conditions:[...item.facts,...supplementaryContext],
            exceptions:[item.topic_id==='01' ? '친밀한 사업관계의 예외는 양측 모두 중요하지 않고 명백하게 경미한 관계인 경우; 주식보유의 금액 경미 예외를 만들지 않음. 저가보수 자체 금지 아님.' : item.topic_id==='03' ? '법규상 강제수임 및 법규가 조건을 충분히 상세히 정한 경우를 사례에서 제외한다.' : item.topic_id==='04' ? '보고서일 후 새로운·추가 절차 및 새 결론이 있는 230.13의 경우를 제외한다. 취합 완료 전과 후를 구별한다.' : '과거 경영진의 정직성에 관한 경험 자체를 무시할 의무는 없으나 의구심·증거 요구가 경감되지 않는다.'],
            required_answers:item.questions.map((q:any)=>q.prompt),
            exclusions:item.exclusions,
        },
        question_types:[...new Set(item.questions.map((q:any)=>q.type))],
        source_unit_ids:[...new Set([...item.source_ids,...officialIds])],
        existing_question_difference:item.difference,
        edition_assumption:item.topic_id==='01'
            ? '2027년 CPA 시험 대비이며 사례는 2026-02-01의 수임 판단이다. 한국공인회계사회 2024-12-19 의결 전문(2025-01-01 시행 개정 반영)의 240.1~2,290.113,290.132를 사용한다. 2026-09-02 공개초안은 확정 기준이 아니므로 답안 의무에 적용하지 않는다. 금융위원회 2027 출제범위 공고는 개별 판본을 지정하지 않았다. 향후 최종 개정·시험 판본 지정은 재대조할 조건이며 본 사례 시점의 요구는 확보된 공식 본문에 한정한다. 법제처 공인회계사법33(1)·시행령15의2(1)(3),14(1)(5)는 별도 출처 장부의 교차 확인으로 보존하고 별도 득점으로 요구하지 않는다.'
            : '2027년 CPA 시험 대비이며 사례는 2026-01-01 개시 보고기간이다. KICPA 2025년11월 전문의 2026 시행 요구를 사용하고 2026년7월 전문의 해당 본문·하위항목·적용자료와 대조했다. 2026 전문의 연계 품질관리 문구는 개정220의 미래 시행과 구별한다. 직접 채점 명제는 두 전문에서 유지됨을 확인했으며, 210.10은 공식 양 판본 모두 (a)~(f)의 여섯 항목이다. 금융위원회 공고가 개별 판본을 지정했다는 주장은 하지 않는다.',
        unresolved_items:[],status:'ready',
    };
    const errs=validateQuestionAuthoringPlan(plan); if(errs.length)throw new Error(errs.join(';'));
    const usedIds = new Set(keys.map(key=>sourceByKey.get(key)!.id));
    // This is a manual authoring path, not an automatic source packet. The failed
    // packet attempt produced no draft; exact excerpts and dependencies are
    // reviewed in manual-source-evidence.md and are not marked packet-complete.
    const refs = catalog.units.filter(u=>usedIds.has(u.id)).map(sourceUnitToRef).map(ref=>{
        const unit=catalog.units.find(u=>u.id===ref.id)!;
        let quote=ref.source_quote;
        if(unit.standard==='KGA 200' && unit.paragraph==='13') quote=quote.slice(quote.indexOf('(l)'),quote.indexOf('(m)')).trim();
        if(unit.standard==='KGA 200' && unit.paragraph==='A25') quote=quote.split('전문가적 판단 (문단 16 참조)')[0].trim();
        if(unit.standard==='KGA 210' && unit.paragraph==='6') quote=quote.split('감사업무 수임 전의 범위제한')[0].trim();
        if(unit.standard==='KGA 210' && unit.paragraph==='8') quote=quote.split('## PDF PAGE 35')[0].trim();
        if(unit.standard==='KGA 230' && unit.paragraph==='16') quote=quote.split('적용 및 기타 설명자료')[0].trim();
        if(!quote || !unit.quote.includes(quote)) throw new Error(`Manual exact excerpt failed: ${ref.id}`);
        const fileText=fs.readFileSync(path.resolve(root,ref.file),'utf8');
        const start=fileText.indexOf(quote);
        if(start<0) throw new Error(`Manual locator not found: ${ref.id}`);
        const firstLine=fileText.slice(0,start).split('\n').length;
        const lastLine=firstLine+quote.split('\n').length-1;
        const pageLabels=[...fileText.slice(0,start+quote.length).matchAll(/^## PDF PAGE (\d+)/gm)].map(m=>({page:m[1],offset:m.index!}));
        const firstPage=pageLabels.filter(p=>p.offset<=start).at(-1)?.page;
        const lastPage=pageLabels.at(-1)?.page;
        return {...ref,source_quote:quote,source_span:`L${firstLine}-L${lastLine}; ${unit.standard} 문단 ${unit.paragraph}${unit.standard==='KGA 200'&&unit.paragraph==='13'?'(l)':''}; ${firstPage?`PDF ${firstPage}${lastPage!==firstPage?'-'+lastPage:''}쪽`:unit.locator}; 수동 확인한 연속 인용`};
    });
    const byId=new Map(refs.map(r=>[r.id,r]));
    let criterionIndex=0;
    const subs=item.questions.map((q:any, index:number)=>{
        const reqIds=[...new Set<string>(q.criteria.map((c:any)=>sourceByKey.get(c.support)!.id))];
        const reqMap=new Map(reqIds.map((id,i)=>[id,`sub${index+1}.req${i+1}`]));
        return {
            id:`sub${index+1}`,type:q.type,prompt:q.prompt,
            constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},decision:q.decision,
            model_answer:q.model_answer,
            requirements:reqIds.map(id=>({id:reqMap.get(id),source_ref_id:id,source_quote:byId.get(id)!.source_quote,source_span:byId.get(id)!.source_span})),
            criteria:q.criteria.map((c:any)=>{
                const id=`crit${++criterionIndex}`; const src=sourceByKey.get(c.support)!.id;
                const sourceIds=item.plan_id==='T04-B' && index===0 && c.support==='230.A22' ? [src,sourceByKey.get('230.7')!.id] : [src];
                return {id,requirement_id:reqMap.get(src),claim:c.claim,
                    critical_facts:[{id:`${id}.fact`,type:c.critical_type,expected:c.claim}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:sourceIds};
            })
        };
    });
    const hash=authoringPlanHash(plan);
    const set={schema_version:'3.0',id:item.id,type:'linked_question_set',status:'needs_review',title:item.title,
        classification:{topic_id:item.topic_id,part:'PART1',chapter:item.chapter,domain:item.domain,standards:item.standards,tags:item.tags},
        source_refs:refs.map(({source_span,...r})=>r),
        shared_context:{facts:item.facts.map((text:string,i:number)=>({id:`f${i+1}`,text,scoreable:false}))},
        learning_order:subs.map((q:any)=>q.id),subquestions:subs,
        verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[
            `계획 ID: ${item.plan_id}; 수동 제작, 총괄 배정 ID 사용.`,
            '사례·발문·답안을 수동으로 재구성하였다. 등록된 source ID와 공식 파일을 사용하며 인용은 해당 카탈로그 문단 전체 또는 정확한 연속 부분이다. 수동 인용·의존 문맥·판본 대조는 manual-source-evidence.md에 기록한다.',
            plan.edition_assumption,
            '수동 저작 version 1 계획을 sidecar로 유지한다. 자동 생성 packet을 사용하거나 완전하다고 선언하지 않는다. 실패한 예비 packet 실행은 문항 파일을 생성하지 않았다.',
            'source_refs에는 직접 requirement 근거 외에 명시적인 주변 문맥도 포함하여 모델 검수 입력에 전달한다. 요구사항·criterion으로 연결하지 않은 주변 문단은 숨은 배점 요건이 아니다.',
            '초안 준비 단계. 형상·인용 검사는 의미검수·실제 모델 채점·사람 승인과 별개이다.'
        ]}}
    const file=`draft-${item.id}.json`;
    fs.writeFileSync(path.join(dir,file),JSON.stringify(set,null,2)+'\n');
    fs.writeFileSync(path.join(dir,file+'.authoring-plan.json'),JSON.stringify({artifact_type:'question_authoring_plan',version:1,plans:[{...plan,set_id:item.id}]},null,2)+'\n');
    outputs.push({plan_id:item.plan_id,set_id:item.id,file,source_map:Object.fromEntries(requiredKeys.map(k=>[k,sourceByKey.get(k)!.id])),questions:subs.length,criteria:criterionIndex,manual_plan_hash:hash,catalog_fingerprint_at_build:catalog.fingerprint});
}
fs.writeFileSync(path.join(dir,'build-manifest.json'),JSON.stringify({artifact_type:'n01_manual_build',outputs},null,2)+'\n');
console.log(outputs);
