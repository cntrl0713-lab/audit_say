// 대상 78물음과 현재 정본의 다른 물음이 같은 공식 문장을 채점 근거로 쓰는지 찾는다(중복 후보 추출; 판정은 content-review.json).
// 공백을 지운 인용문 안에 다른 물음의 인용이 포함되거나 서로 겹치면 후보로 올린다.
//   node cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/overlap-check.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json',bank=read(bankFile),scope=read(R+'/scope.json');
const strip=t=>String(t).replace(/\s+/g,'');
const keyOf=(s,q)=>`${s.id}/${q.id}`;
const targets=new Set(scope.targets.map(t=>`${t.set_id}/${t.subquestion_id}`));
// 물음마다 criterion이 인용하는 원문(요구사항 인용)을 모은다. 표준 번호도 함께 둔다.
const quotesOf=(s,q)=>q.criteria.map(c=>{const r=q.requirements.find(r=>r.id===c.requirement_id);const ref=s.source_refs.find(x=>x.id===r?.source_ref_id);return{criterion:c.id,page:ref?.page??'',quote:strip(r?.source_quote??'')};}).filter(x=>x.quote.length>=15);
const all=bank.filter(s=>s.status==='published').flatMap(s=>s.subquestions.map(q=>({key:keyOf(s,q),style:q.question_style??null,page:[...new Set(s.source_refs.map(r=>r.page))],quotes:quotesOf(s,q),prompt:q.prompt})));
const byKey=new Map(all.map(x=>[x.key,x]));
const pairs=[];
for(const k of targets){
 const a=byKey.get(k);
 for(const b of all){
  if(b.key===k)continue;
  const shared=[];
  for(const qa of a.quotes)for(const qb of b.quotes){
   if(qa.page!==qb.page)continue;
   // 짧은 쪽이 긴 쪽에 포함되거나 앞 40자가 같으면 같은 원문 구간으로 본다.
   const [s1,s2]=qa.quote.length<=qb.quote.length?[qa.quote,qb.quote]:[qb.quote,qa.quote];
   if(s2.includes(s1)||s1.slice(0,40)===s2.slice(0,40))shared.push([qa.criterion,qb.criterion]);
  }
  if(shared.length)pairs.push({target:k,other:b.key,other_in_scope:targets.has(b.key),other_style:b.style,page:a.quotes[0]?.page,shared_criteria:shared.length,target_criteria:a.quotes.length,other_criteria:b.quotes.length,pairs:shared});
 }
}
const out={version:1,created_at:new Date().toISOString(),bank:{file:bankFile,sha256:sha(bankFile)},scope:{file:R+'/scope.json',sha256:sha(R+'/scope.json')},method:'같은 기준서 page의 요구사항 인용이 포함관계이거나 앞 40자가 같으면 후보. 의미 중복 여부는 사람이 읽는 발문·criterion 대조로 판정한다.',candidate_pairs:pairs};
fs.writeFileSync(R+'/overlap-candidates.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
const outside=pairs.filter(p=>!p.other_in_scope);
console.log(JSON.stringify({pairs:pairs.length,within_scope:pairs.length-outside.length,outside_scope:outside.length}));
for(const p of outside)console.log(p.target,'<->',p.other,p.other_style,p.page,`${p.shared_criteria}/${p.target_criteria} vs ${p.other_criteria}`);
