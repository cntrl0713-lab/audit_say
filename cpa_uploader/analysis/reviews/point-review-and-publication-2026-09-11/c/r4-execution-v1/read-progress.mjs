import fs from 'node:fs';
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const wave=`${D}/execution-resumes/resume-2026-09-12-v4/remaining`;
const json=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const jobs=json(`${wave}/manifest.json`).jobs.filter(j=>j.worker==='c');
const rows=jobs.map(j=>{
  const dir=`${wave}/semantic-c/${j.set_id}`,summaryFile=`${dir}/summary.json`,receiptFile=`${dir}/semantic.json`,chunksFile=`${receiptFile}.chunks.jsonl`;
  const summary=fs.existsSync(summaryFile)?json(summaryFile):null;
  const receipt=fs.existsSync(receiptFile)?json(receiptFile).reviews[0]:null;
  const lines=fs.existsSync(chunksFile)?fs.readFileSync(chunksFile,'utf8').split('\n').filter(l=>l.trim()):[];
  const chunks=[];let pendingLine=false;
  for(let i=0;i<lines.length;i++){try{chunks.push(JSON.parse(lines[i]));}catch(error){if(i===lines.length-1)pendingLine=true;else throw error;}}
  return {set_id:j.set_id,expected_units:j.semantic_units,status:summary?.outcome??(fs.existsSync(dir)?'running':'not_started'),completed_units:receipt?.units.length??new Set(chunks.filter(c=>c.response&&!c.error).map(c=>c.unit_id)).size,actual_response_records:chunks.filter(c=>c.response).length,error_records:chunks.filter(c=>c.error).length,pending_jsonl_line:pendingLine,nonpass_units:receipt?.units.filter(u=>Object.values(u.checks).some(v=>v!=='pass')).map(u=>({id:u.id,checks:u.checks,rationale:u.rationale}))??[],nonpass_cases:receipt?.cases.filter(c=>c.verdict!=='pass').map(c=>({unit_id:c.unit_id,kind:c.kind,verdict:c.verdict,rationale:c.rationale}))??[]};
});
console.log(JSON.stringify({sets:rows.length,expected_units:jobs.reduce((n,j)=>n+j.semantic_units,0),completed_sets:rows.filter(r=>!['running','not_started'].includes(r.status)).length,pass:rows.filter(r=>r.status==='pass').length,nonpass:rows.filter(r=>r.status==='semantic_nonpass').length,execution_errors:rows.filter(r=>r.status==='execution_error').length,running:rows.filter(r=>r.status==='running'),nonpass_details:rows.filter(r=>r.nonpass_units.length||r.nonpass_cases.length),completed_units:rows.reduce((n,r)=>n+r.completed_units,0),actual_response_records:rows.reduce((n,r)=>n+r.actual_response_records,0),error_records:rows.reduce((n,r)=>n+r.error_records,0),stop_exists:fs.existsSync(`${wave}/STOP`)},null,2));
