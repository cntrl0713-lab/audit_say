import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const C='cpa_uploader/drafts/case-trio-next-2026-09-14/c',R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14';
const names=['build.mjs','sets.json','design.json','review.json','qa.json','qa-boundaries.json','local-checks.json'];
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const before=R+'/c-before-scope-refinement';fs.mkdirSync(before);
for(const n of names)fs.copyFileSync(C+'/'+n,before+'/'+n,fs.constants.COPYFILE_EXCL);
const rows=[
 ['경비 영역의 평가된 위험은 낮지만 장기계약 영역은 유의적 위험으로 식별되었고, 계약변경의 실질과 증거를 평가할 때 많은 판단이 필요하다.','경비 영역의 평가된 위험은 낮지만 장기계약 영역은 유의적 위험으로 식별되었다.'],
 ['사례의 위험과 판단 부담을 근거로 설명하시오.','사례의 위험 수준 차이를 근거로 설명하시오.'],
 ['장기계약은 유의적 위험이 식별되었고 계약변경의 실질과 증거 평가에 많은 판단이 필요하므로,','장기계약은 소액 경비와 달리 유의적 위험으로 식별되어 더 설득력 있는 감사증거가 필요하므로,'],
 ['장기계약의 유의적 위험과 계약변경 실질·증거 평가에 수반되는 많은 판단을 동일한 활용계획이 부적합한 근거로 연결한다. 위험 또는 판단 부담이라는 추상적인 명칭만 나열하면 인정하지 않으며 사례의 두 특성을 연결하면 한 문장으로도 인정한다.','장기계약의 유의적 위험 때문에 낮은 위험의 소액 경비보다 더 설득력 있는 증거가 필요하여 같은 업무 활용계획을 적용할 수 없다고 설명한다. 위험 수준 차이를 두 영역의 활용 범위 차이에 연결하면 충분하며, 많은 판단이라는 별도 근거를 숨은 요건으로 요구하지 않는다.'],
 ['두 업무의 위험과 판단 부담 차이를 적용한 근거1점','두 업무의 위험 수준 차이를 적용한 근거1점'],
 ['두 영역은 위험과 판단 부담이 동일하다.','두 영역의 위험 수준은 동일하다.'],
 ['유의적 판단의 수행주체·유의적 위험에서 활용할 절차의 한계를 별도로 묻지 않아','판단 부담에 따른 별도 조정·유의적 판단의 수행주체·유의적 위험에서 활용할 절차의 한계를 묻지 않아']
];
for(const n of names){
 if(n==='local-checks.json')continue;
 let text=fs.readFileSync(C+'/'+n,'utf8');for(const [from,to] of rows)text=text.replaceAll(from,to);fs.writeFileSync(C+'/'+n,text);
}
const sets=JSON.parse(fs.readFileSync(C+'/sets.json')),set=sets[0];assert(!set.shared_context.facts[2].text.includes('많은 판단'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const plan=JSON.parse(fs.readFileSync(C+'/design.json'));plan[0].facts_chars=[...set.shared_context.facts.map(f=>f.text).join('\n')].length;
fs.writeFileSync(C+'/design.json',JSON.stringify(plan,null,2)+'\n');
const reviews=JSON.parse(fs.readFileSync(C+'/review.json'));
for(const r of reviews){r.set_content_sha256=hash(set);r.question_content_sha256=hash(set.subquestions.find(q=>q.id===r.subquestion_id));}
fs.writeFileSync(C+'/review.json',JSON.stringify(reviews,null,2)+'\n');
fs.writeFileSync(R+'/c-scope-refinement.json',JSON.stringify({method:'root_content_scope_refinement_before_actual_grading',reason:'sub2의 요구를 위험 수준의 차이에 따른 두 업무범위 조정으로 한정한다. 별도 판단부담 근거를 같은1점에 묶지 않도록 사실·발문·답안·criterion을 함께 조정했다. 총점3점은 활용축소/직접업무확대/위험에근거한이유 각각1점이다.',before:names.map(n=>ref(before+'/'+n)),after:names.filter(n=>n!=='local-checks.json').map(n=>ref(C+'/'+n)),actual_model_calls:0,old_qa_preserved:true,human_review_performed:false},null,2)+'\n',{flag:'wx'});
console.log({facts_chars:plan[0].facts_chars,points:7});
