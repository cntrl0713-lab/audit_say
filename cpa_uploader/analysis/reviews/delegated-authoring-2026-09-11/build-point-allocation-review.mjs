import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const manifestFile=`${root}/final-153-v3/manifest.json`;
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=read(manifestFile);
const reviewerFiles=[
 'cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/phase-two-followup/scoring-demand-review-18.json',
 'cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/phase-two-v5/point-allocation-candidates.json',
 'cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/evidence/phase2/scoring-review-15-sets-inputs.json',
];
const entries=manifest.entries.map(entry=>{
 if(hash(entry.file)!==entry.sha256)throw Error(`Current question changed: ${entry.plan_id}`);
 const raw=read(entry.file),set=Array.isArray(raw)?raw[0]:raw;
 const questions=set.subquestions.map(question=>({id:question.id,prompt:question.prompt,
  model_answer_nonwhitespace_characters:[...question.model_answer.join('').replace(/\s/gu,'')].length,
  points:question.criteria.reduce((sum,criterion)=>sum+criterion.max_points,0),
  criteria:question.criteria.map(criterion=>({id:criterion.id,points:criterion.max_points,claim:criterion.claim}))}));
 const points=questions.reduce((sum,question)=>sum+question.points,0);
 const answerCharacters=questions.reduce((sum,question)=>sum+question.model_answer_nonwhitespace_characters,0);
 return{plan_id:entry.plan_id,set_id:entry.set_id,topic_id:entry.topic_id,package:entry.package,file:entry.file,sha256:entry.sha256,
  points,answer_nonwhitespace_characters:answerCharacters,answer_characters_per_point:answerCharacters/points,questions};
});
const ranked=[...entries].sort((a,b)=>b.answer_characters_per_point-a.answer_characters_per_point);
const points=entries.reduce((sum,entry)=>sum+entry.points,0);
const questions=entries.reduce((sum,entry)=>sum+entry.questions.length,0);
const criteria=entries.reduce((sum,entry)=>sum+entry.questions.reduce((n,q)=>n+q.criteria.length,0),0);
if(entries.length!==49||questions!==131||points!==433||criteria!==433)throw Error('Expected fixed scope changed');
const artifact={recorded_at:new Date().toISOString(),status:'read_only_allocation_review_not_implemented',actual_api_calls:0,
 manifest:{file:manifestFile,sha256:hash(manifestFile)},reviewer_files:reviewerFiles.map(file=>({file,sha256:hash(file)})),
 scope:{sets:entries.length,questions,criteria,points},
 metric_description:'저장 model_answer의 공백을 제외한 Unicode code point 수/현행 점수. 해설·대안·허용표현을 포함하므로 필요한 답안 길이 또는 실제 시험시간으로 간주하지 않는다.',
 median_set_answer_characters_per_point:ranked[Math.floor(ranked.length/2)].answer_characters_per_point,
 topic19_rank:ranked.findIndex(entry=>entry.plan_id==='T19-A')+1,
 highest_answer_characters_per_point:ranked.slice(0,10).map(({plan_id,points,answer_nonwhitespace_characters,answer_characters_per_point})=>({plan_id,points,answer_nonwhitespace_characters,answer_characters_per_point})),
 proposed_topic19:{current:[2,1,2],proposed:[2,1,3],current_total:5,proposed_total:6,
  reason:'sub3의 중요성 판단 근거와 확신·미발견위험과의 구별을 독립 채점. 결론·주어진 사실·동일 의무 반복에는 추가 점수 없음.',implemented:false},entries};
fs.writeFileSync(`${root}/point-allocation-review.json`,JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
const rows=entries.map(entry=>`| ${entry.plan_id} | ${entry.set_id} | ${entry.questions.map(q=>q.points).join(' / ')} | ${entry.points} | ${entry.answer_nonwhitespace_characters} | ${entry.answer_characters_per_point.toFixed(1)} |`).join('\n');
fs.writeFileSync(`${root}/point-allocation-inventory.md`,
 '# 49세트 배점·저장 답안 길이 대조\n\n문항 파일의 실제 SHA-256, 모든 131물음·433criterion, 계산 정의와 담당 검토 파일은 [검토 입력](point-allocation-review.json)에 보존했다. 문자 수는 공백 제외 저장 답안 전체이며 필요한 서술량이나 시험시간의 실측값이 아니다. 실제 문항·배점은 변경하지 않았다.\n\n| 계획 | 세트 ID | 물음별 점수 | 총점 | 저장 답안 문자 | 점당 문자 |\n|---|---|---|---:|---:|---:|\n'+rows+'\n',{flag:'wx'});
console.log(JSON.stringify({sets:entries.length,questions,criteria,points,median:artifact.median_set_answer_characters_per_point,topic19_rank:artifact.topic19_rank}));
