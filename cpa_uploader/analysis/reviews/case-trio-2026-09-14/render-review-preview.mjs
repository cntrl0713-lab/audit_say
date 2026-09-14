import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const R='cpa_uploader/analysis/reviews/case-trio-2026-09-14';
const D='cpa_uploader/drafts/case-trio-2026-09-14';
const inputFile=`${R}/new-sets-v1.json`;
const summaryFile=`${R}/sealed-v1/summary.json`;
const readinessFile=`${R}/sealed-v1/readiness.json`;
const outputFile=`${D}/review-preview.md`;
const validationFile=`${R}/review-preview-validation.json`;
const sha=value=>createHash('sha256').update(value).digest('hex');
const fh=file=>sha(fs.readFileSync(file));
const inputFiles=[inputFile,summaryFile,readinessFile];
const before=Object.fromEntries(inputFiles.map(file=>[file,fh(file)]));
const sets=JSON.parse(fs.readFileSync(inputFile,'utf8'));
const summary=JSON.parse(fs.readFileSync(summaryFile,'utf8'));
const readiness=JSON.parse(fs.readFileSync(readinessFile,'utf8'));
const link=(label,file)=>`[${label}](<${path.resolve(file).replaceAll('\\','/')}>)`;
const points=q=>q.criteria.reduce((sum,c)=>sum+c.max_points,0);
const rows=sets.map(s=>({id:s.id,title:s.title,facts_chars:[...s.shared_context.facts.map(f=>f.text).join('\n')].length,questions:s.subquestions.length,points:s.subquestions.reduce((sum,q)=>sum+points(q),0)}));
const totalQuestions=rows.reduce((sum,r)=>sum+r.questions,0);
const totalPoints=rows.reduce((sum,r)=>sum+r.points,0);
if(!readiness.ready||readiness.errors.length||summary.status!=='passed')throw Error('Content/grading seal is not ready');
if(summary.target_sets!==sets.length||summary.target_questions!==totalQuestions)throw Error('Seal target counts differ');
if(summary.fixed_evaluated_answers!==summary.scores.length)throw Error('Seal score denominator mismatch');
for(const score of summary.scores){
 const set=sets.find(s=>s.id===score.source_set_id);
 const q=set?.subquestions.find(q=>q.id===score.subquestion_id);
 if(!q||!score.evaluated||score.expected_points<0||score.expected_points>points(q))throw Error('Unbound or invalid sealed score');
}
if(summary.exact_score_matches!==summary.scores.filter(s=>s.actual_points===s.expected_points).length)throw Error('Seal exact score count mismatch');
for(const s of sets)for(const q of s.subquestions){
 if(q.question_style!=='case')throw Error('Preview scope is case questions only');
 for(const c of q.criteria)if(!Number.isInteger(c.max_points)||c.max_points<=0||!['met','not_met','contradicted'].every(k=>Number.isInteger(c.scores[k])))throw Error('Invalid integer scoring data');
}

const parts=[],sourceBlocks=[];
const put=text=>parts.push(text);
const raw=(pointer,text)=>{
 if(typeof text!=='string')throw Error(`Missing text ${pointer}`);
 const id=`source-text-${sourceBlocks.length+1}`;
 if(text.includes('<!-- preview-'))throw Error('Unexpected marker in source');
 sourceBlocks.push({id,pointer,text,sha256:sha(text)});
 put(`<!-- preview-begin:${id} -->\n${text}\n<!-- preview-end:${id} -->`);
};
put('# 사례 3개 검토용 문제·답안');
put(`내용·대표채점 완료. 게시 상태는 ${link('검토 배치 README',`${R}/README.md`)}에서 확인합니다.`);
put(`확정 입력 기준 사례 ${sets.length}개, 물음 ${totalQuestions}개, 총 ${totalPoints}점입니다. 대표채점 ${summary.actual_sdk_calls}회에서 답안 ${summary.fixed_evaluated_answers}개 중 ${summary.exact_score_matches}개의 점수가 기대값과 정확히 일치했습니다. 이는 이 문서의 게시·운영 DB 반영을 뜻하지 않습니다.`);
put('각 물음은 충족한 독립 기준의 정수 점수를 합산합니다. 같은 의미를 반복하여 점수를 더하지 않으며, 판단의 함축 인정과 반대 결론의 처리는 각 기준의 문구를 따릅니다.');
put('| 사례 | 물음 수 | 배점 | 사실관계 글자 수 |\n| --- | ---: | ---: | ---: |\n'+rows.map((r,i)=>`| ${i+1}. ${r.title} | ${r.questions} | ${r.points}점 | ${r.facts_chars}자 |`).join('\n'));
put('글자 수는 원본 facts의 text를 줄바꿈(LF)으로 연결하여 공백을 포함한 유니코드 문자 수로 계산했습니다. 사실관계·발문·모범답안·채점 기준은 확정 배열에서 가져왔으며, 문구를 수정하거나 축약하지 않았습니다.');
for(const [si,s]of sets.entries()){
 put(`## 사례 ${si+1}. ${s.title}`);
 put(`사례 ID: \`${s.id}\` · ${rows[si].points}점 · 사실관계 ${rows[si].facts_chars}자`);
 put('### 사실관계');
 for(const [fi,f]of s.shared_context.facts.entries())raw(`/${si}/shared_context/facts/${fi}/text`,f.text);
 for(const [qi,q]of s.subquestions.entries()){
  put(`### 물음 ${qi+1} · ${points(q)}점`);
  raw(`/${si}/subquestions/${qi}/prompt`,q.prompt);
  put('**모범답안**');
  for(const [ai,answer]of q.model_answer.entries())raw(`/${si}/subquestions/${qi}/model_answer/${ai}`,answer);
  put('**부분점수 기준**');
  for(const [ci,c]of q.criteria.entries()){
   put(`**기준 ${ci+1} · ${c.max_points}점** (\`${c.id}\`)`);
   raw(`/${si}/subquestions/${qi}/criteria/${ci}/claim`,c.claim);
   const seen=new Set([c.claim]);
   for(const [fi,fact]of c.critical_facts.entries()){
    if(seen.has(fact.expected))continue;
    seen.add(fact.expected);
    put(fact.type==='condition'?'인정 범위 및 조건:':'핵심 확인 내용:');
    raw(`/${si}/subquestions/${qi}/criteria/${ci}/critical_facts/${fi}/expected`,fact.expected);
   }
   put(`충족 ${c.scores.met}점 · 미충족 ${c.scores.not_met}점 · 반대 의미 ${c.scores.contradicted}점`);
  }
 }
}
put('## 입력과 검증 근거');
put(`- ${link('확정 사례 배열',inputFile)}\n- ${link('봉인된 대표채점 요약',summaryFile)}\n- ${link('내용·채점 증거 준비 상태',readinessFile)}\n- ${link('이 문서의 원문 대조 기록',validationFile)}`);
put(`입력 SHA-256: \`${before[inputFile]}\`\n\n대표채점 요약 SHA-256: \`${before[summaryFile]}\``);
const markdown=parts.join('\n\n')+'\n';

const equality=[];
let previous=-1;
for(const block of sourceBlocks){
 const start=`<!-- preview-begin:${block.id} -->\n`;
 const end=`\n<!-- preview-end:${block.id} -->`;
 const position=markdown.indexOf(start);
 const stop=markdown.indexOf(end,position+start.length);
 const extracted=markdown.slice(position+start.length,stop);
 if(position<=previous||stop<position||extracted!==block.text)throw Error(`Source text mismatch ${block.pointer}`);
 previous=position;
 equality.push({pointer:block.pointer,sha256:block.sha256,exact_text_equal:true});
}
for(const file of inputFiles)if(fh(file)!==before[file])throw Error(`Frozen input changed ${file}`);
fs.writeFileSync(outputFile,markdown);
if(fs.readFileSync(outputFile,'utf8')!==markdown)throw Error('Output write mismatch');
const validation={version:1,method:'deterministic_markdown_render_and_source_text_roundtrip',status:'pass',created_at:new Date().toISOString(),renderer:{file:`${R}/render-review-preview.mjs`,sha256:fh(`${R}/render-review-preview.mjs`)},inputs:inputFiles.map(file=>({file,sha256:before[file],unchanged_after:true})),output:{file:outputFile,sha256:fh(outputFile),bytes:fs.statSync(outputFile).size},counts:{sets:sets.length,questions:totalQuestions,points:totalPoints,case_rows:rows,exact_text_blocks:equality.length},grading_summary:{status:summary.status,actual_sdk_calls:summary.actual_sdk_calls,fixed_evaluated_answers:summary.fixed_evaluated_answers,exact_score_matches:summary.exact_score_matches},publication_state:'내용·대표채점 완료, 게시 상태는 R/README에서 확인',source_text_roundtrip:equality,critical_fact_duplicate_policy:'claim 또는 앞선 expected와 바이트가 정확히 같은 expected는 중복 표시하지 않는다. 서로 다른 조건·허용 표현은 모두 별도 표시한다.',readme_link:{file:`${R}/README.md`,exists_at_render:fs.existsSync(`${R}/README.md`),owner:'root; 생성 또는 상태 갱신은 본 작업 범위 밖'},canonical_writes:0,db_writes:0,api_calls:0,frozen_authoring_files_modified:false};
fs.writeFileSync(validationFile,JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify({status:'pass',output:validation.output,validation_file:validationFile,validation_sha256:fh(validationFile),counts:validation.counts}));
