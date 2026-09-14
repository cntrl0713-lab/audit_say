import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14',D='cpa_uploader/drafts/case-trio-next-2026-09-14';
const sha=v=>createHash('sha256').update(v).digest('hex'),fh=f=>sha(fs.readFileSync(f));
const inputs=['a','b','c'].map(x=>`${D}/${x}/sets.json`),before=Object.fromEntries(inputs.map(f=>[f,fh(f)]));
const sets=inputs.flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8'))),points=q=>q.criteria.reduce((n,c)=>n+c.max_points,0);
if(sets.length!==3||sets.some(s=>s.subquestions.length!==3))throw Error('Preview scope must be three cases with three questions each');
const rows=sets.map(s=>({id:s.id,title:s.title,facts_chars:[...s.shared_context.facts.map(f=>f.text).join('\n')].length,questions:s.subquestions.length,points:s.subquestions.reduce((n,q)=>n+points(q),0)}));
for(const s of sets)for(const q of s.subquestions){if(q.question_style!=='case')throw Error('Not a case question');for(const c of q.criteria)if(!Number.isInteger(c.max_points)||!['met','not_met','contradicted'].every(k=>Number.isInteger(c.scores[k])))throw Error('Invalid integer scores');}
const totalQ=rows.reduce((n,r)=>n+r.questions,0),totalP=rows.reduce((n,r)=>n+r.points,0),parts=[],blocks=[];
const link=(label,file)=>`[${label}](<${path.resolve(file).replaceAll('\\','/')}>)`,put=x=>parts.push(x);
const raw=(pointer,text)=>{if(typeof text!=='string'||text.includes('<!-- preview-'))throw Error(`Invalid text ${pointer}`);const id=`source-text-${blocks.length+1}`;blocks.push({id,pointer,text,sha256:sha(text)});put(`<!-- preview-begin:${id} -->\n${text}\n<!-- preview-end:${id} -->`);};
put('# 사례 3개 검토용 초안');
put(`검토용 초안입니다. 실제 채점·정본·공개본·운영 DB 반영 상태는 ${link('검토 배치 README',`${R}/README.md`)}에서 별도로 확인합니다.`);
put(`입력된 사례 ${sets.length}개, 물음 ${totalQ}개, 총 ${totalP}점입니다. 이 문서의 생성은 실제 모델 채점이나 게시 완료를 의미하지 않습니다.`);
put('물음별로 충족한 독립 기준의 정수 점수를 합산합니다. 판단의 함축 인정과 명시적 반대 결론의 처리는 각 채점 기준에 따릅니다. 같은 의미를 반복하여 점수를 더하지 않습니다.');
put('| 사례 | 물음 수 | 배점 | 사실관계 글자 수 |\n| --- | ---: | ---: | ---: |\n'+rows.map((r,i)=>`| ${i+1}. ${r.title} | ${r.questions} | ${r.points}점 | ${r.facts_chars}자 |`).join('\n'));
put('글자 수는 원본 facts의 text를 줄바꿈(LF)으로 연결하여 공백을 포함한 유니코드 문자 수로 계산했습니다. 사실관계·발문·모범답안·채점 기준의 문구는 입력 배열에서 그대로 가져왔습니다.');
for(const [si,s]of sets.entries()){
 put(`## 사례 ${si+1}. ${s.title}`);put(`사례 ID: \`${s.id}\` · ${rows[si].points}점 · 사실관계 ${rows[si].facts_chars}자`);put('### 사실관계');
 for(const[fi,f]of s.shared_context.facts.entries())raw(`/${si}/shared_context/facts/${fi}/text`,f.text);
 for(const[qi,q]of s.subquestions.entries()){
  put(`### 물음 ${qi+1} · ${points(q)}점`);raw(`/${si}/subquestions/${qi}/prompt`,q.prompt);put('**모범답안**');
  for(const[ai,a]of q.model_answer.entries())raw(`/${si}/subquestions/${qi}/model_answer/${ai}`,a);
  put('**부분점수 기준**');
  for(const[ci,c]of q.criteria.entries()){
   put(`**기준 ${ci+1} · ${c.max_points}점** (\`${c.id}\`)`);raw(`/${si}/subquestions/${qi}/criteria/${ci}/claim`,c.claim);const seen=new Set([c.claim]);
   for(const[fi,f]of (c.critical_facts??[]).entries()){if(seen.has(f.expected))continue;seen.add(f.expected);put(f.type==='condition'?'인정 범위 및 조건:':'핵심 확인 내용:');raw(`/${si}/subquestions/${qi}/criteria/${ci}/critical_facts/${fi}/expected`,f.expected);}
   put(`충족 ${c.scores.met}점 · 미충족 ${c.scores.not_met}점 · 반대 의미 ${c.scores.contradicted}점`);
  }
 }
}
const output=`${D}/review-preview.md`,validationFile=`${R}/review-preview-validation.json`;
put('## 입력과 대조 기록');put(inputs.map((f,i)=>`- ${link(`사례 ${i+1} 입력 배열`,f)} · SHA-256: \`${before[f]}\``).join('\n'));put(link('이 문서의 원문 대조 기록',validationFile));
const markdown=parts.join('\n\n')+'\n',equality=[];let previous=-1;
for(const b of blocks){const start=`<!-- preview-begin:${b.id} -->\n`,end=`\n<!-- preview-end:${b.id} -->`,at=markdown.indexOf(start),to=markdown.indexOf(end,at+start.length);if(at<=previous||to<at||markdown.slice(at+start.length,to)!==b.text)throw Error(`Roundtrip mismatch ${b.pointer}`);previous=at;equality.push({pointer:b.pointer,sha256:b.sha256,exact_text_equal:true});}
for(const f of inputs)if(fh(f)!==before[f])throw Error(`Input changed ${f}`);
fs.writeFileSync(output,markdown);if(fs.readFileSync(output,'utf8')!==markdown)throw Error('Output write mismatch');
const original='cpa_uploader/analysis/reviews/case-trio-2026-09-14/render-review-preview.mjs',copy=`${R}/render-review-preview-source.mjs.txt`;
if(fh(original)!==fh(copy))throw Error('Prior renderer source copy mismatch');
const validation={version:1,created_at:new Date().toISOString(),method:'deterministic_markdown_render_and_source_text_roundtrip',status:'pass',renderer:{file:`${R}/render-review-preview.mjs`,sha256:fh(`${R}/render-review-preview.mjs`),previous_renderer:{file:original,sha256:fh(original),preserved_copy:copy,copy_sha256:fh(copy)},adaptation:'이전 표시·원문대조 방식을 재사용하되 입력은 현 배치 a/b/c 초안이고, 이전 봉인·실측 수치와 완료 상태를 옮기지 않았다.'},inputs:inputs.map(file=>({file,sha256:before[file],unchanged_after:true})),output:{file:output,sha256:fh(output),bytes:fs.statSync(output).size},counts:{sets:sets.length,questions:totalQ,points:totalP,case_rows:rows,exact_text_blocks:equality.length},source_text_roundtrip:equality,critical_fact_duplicate_policy:'claim과 바이트가 같은 expected만 중복 표시하지 않는다. 다른 인정범위는 모두 표시한다.',publication_state:'draft_preview_only',actual_grading_claimed:false,readme:{file:`${R}/README.md`,exists_at_render:fs.existsSync(`${R}/README.md`),owner:'root'},api_calls:0,canonical_writes:0,db_writes:0,input_files_modified:false};
fs.writeFileSync(validationFile,JSON.stringify(validation,null,2)+'\n');console.log(JSON.stringify({file:output,sha256:fh(output),validation_file:validationFile,validation_sha256:fh(validationFile),counts:validation.counts},null,2));
