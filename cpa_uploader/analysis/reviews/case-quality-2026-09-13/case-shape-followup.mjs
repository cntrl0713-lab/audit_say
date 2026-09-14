import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='cpa_uploader/analysis/reviews/case-quality-2026-09-13';
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const catalogFile='cpa_uploader/data/learning-question-classifications.json';
const read=file=>JSON.parse(fs.readFileSync(file));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources=[bankFile,catalogFile].map(file=>({file,sha256:hash(file)}));
const bank=read(bankFile),catalog=read(catalogFile);
assert.equal(catalog.source_file_sha256,sources[0].sha256);
function census(sets,classification){
 const rows=[];
 for(const set of sets){
  const questions=set.subquestions.filter(q=>(q.question_style??classification.classifications.find(c=>c.source_set_id===set.id&&c.subquestion_id===q.id)?.question_style)==='case');
  if(!questions.length)continue;
  const facts=set.shared_context.facts.map(f=>({id:f.id,text:f.text}));
  const factText=facts.map(f=>f.text).join('\n');
  rows.push({set_id:set.id,title:set.title,case_question_count:questions.length,fact_count:facts.length,
   characters_with_spaces:[...factText].length,characters_without_whitespace:[...factText.replace(/\s/gu,'')].length,
   facts,questions:questions.map(q=>({id:q.id,prompt:q.prompt,points:q.criteria.reduce((sum,c)=>sum+c.max_points,0),model_answer:q.model_answer})),
   wiki_file:'cpa_uploader/wiki/questions/'+set.id+'.md'});
 }
 return rows.sort((a,b)=>a.characters_with_spaces-b.characters_with_spaces||a.set_id.localeCompare(b.set_id));
}
const rows=census(bank,catalog),prior=census(read(base+'/bank-before.json'),read(base+'/catalog-before.json'));
const summarize=items=>({case_parents:items.length,case_questions:items.reduce((n,r)=>n+r.case_question_count,0),
 question_distribution:Object.fromEntries([1,2,3,4].map(n=>[n,items.filter(r=>r.case_question_count===n).length])),
 length_at_most:Object.fromEntries([100,150,200,250,300].map(n=>[n,items.filter(r=>r.characters_with_spaces<=n).length])),
 single_question_at_most_200:items.filter(r=>r.case_question_count===1&&r.characters_with_spaces<=200).length,
 one_fact_block:items.filter(r=>r.fact_count===1).length,
 minimum_characters:Math.min(...items.map(r=>r.characters_with_spaces)),maximum_characters:Math.max(...items.map(r=>r.characters_with_spaces))});
let live={status:'not_read'};
if(process.argv.includes('--live')){
 const endpoint=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'');assert.equal(endpoint.hostname,'xvifzicrjmbfqaepcfpp.supabase.co');
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;assert(secret);
 const response=await fetch(new URL('/rest/v1/cpa_question_bank_releases?status=eq.active&select=id,source_file_hash',endpoint),{headers:{apikey:secret,Authorization:'Bearer '+secret},signal:AbortSignal.timeout(30000)});
 assert(response.ok,'Live release read failed');const releases=await response.json();assert.equal(releases.length,1);assert.equal(releases[0].source_file_hash,sources[0].sha256,'Live release differs from canonical snapshot');
 live={status:'active_release_source_hash_matches',checked_at:new Date().toISOString(),project_host:endpoint.hostname,release_id:releases[0].id,source_file_hash:releases[0].source_file_hash,remote_writes:0};
}
for(const source of sources)assert.equal(hash(source.file),source.sha256,'Input changed during inspection');
const report={checked_at:new Date().toISOString(),scope:'All current case learning units, excluding independent standard questions in the same source container',
 metric:'Unicode code points in shared_context.facts[].text joined by one newline; spaces included, title and question prompts excluded. Thresholds are descriptive screening ranges, not pass/fail rules.',
 sources,live,current:summarize(rows),before_previous_review:summarize(prior),rows,question_content_writes:0,model_api_calls:0};
if(process.argv.includes('--write'))fs.writeFileSync(base+'/case-shape-followup-v1.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({live,current:report.current,before_previous_review:report.before_previous_review,rows:rows.map(({set_id,title,case_question_count,fact_count,characters_with_spaces,characters_without_whitespace})=>({set_id,title,case_question_count,fact_count,characters_with_spaces,characters_without_whitespace}))},null,2));
