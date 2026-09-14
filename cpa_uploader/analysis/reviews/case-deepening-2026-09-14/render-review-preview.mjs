import fs from 'node:fs';
import assert from 'node:assert/strict';
const R='cpa_uploader/analysis/reviews/case-deepening-2026-09-14';
const D='cpa_uploader/drafts/case-deepening-2026-09-14';
const sets=JSON.parse(fs.readFileSync(R+'/new-sets-v1.json'));
const grade=JSON.parse(fs.readFileSync(R+'/sealed-v1/summary.json'));
assert.equal(sets.length,6);assert.equal(grade.status,'passed');
const lines=['# 추가 사례형 문제·모범답안·부분점수 기준','',
 '기출·고급회계감사연습과 공식 기준서를 참고하여 별도로 구성한 연습 사례 6개·18물음이다. 아래 문항은 내용 검토와 대표 답안 53개의 실제 채점을 마친 고정 입력에서 생성했다. 게시·운영 반영 상태는 [검토 장부](../../analysis/reviews/case-deepening-2026-09-14/README.md)에서 확인한다.','',
 '부분점수는 맞힌 독립 기준의 정수 점수를 합산한다. 같은 뜻의 반복에는 추가 점수를 주지 않는다. 명시적 반대 결론은 해당 판단 점수를 받을 수 없지만, 별도로 맞는 근거의 점수는 유지한다.'];
for(const [index,set]of sets.entries()){
 lines.push('',`## ${index+1}. ${set.title}`,'',...set.shared_context.facts.flatMap(f=>[f.text,'']));
 for(const [i,q]of set.subquestions.entries()){
  const points=q.criteria.reduce((n,c)=>n+c.max_points,0);
  lines.push(`### 물음 ${i+1} (${points}점)`,'',q.prompt,'','**모범답안**','',...q.model_answer.map(a=>'- '+a),'','**부분점수 기준**','',...q.criteria.map(c=>`- ${c.max_points}점: ${c.claim}`),'');
  if(points===1)lines.push('이 물음은 하나의 구체적 조치를 요구하므로 0점 또는 1점으로 채점한다.','');
 }
}
fs.writeFileSync(D+'/review-preview.md',lines.join('\n')+'\n',{flag:'wx'});
console.log(D+'/review-preview.md');
