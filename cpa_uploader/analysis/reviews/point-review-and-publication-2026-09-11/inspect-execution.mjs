import fs from 'node:fs';
import path from 'node:path';
const directory=process.argv[2];
if(!directory)throw Error('Provide an execution directory. Read-only inspection.');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const manifest=read(path.join(directory,'manifest.json'));
const rows=[];
for(const worker of ['a','b','c']){
  const root=path.join(directory,`semantic-${worker}`);
  const assigned=manifest.jobs.filter(job=>job.worker===worker);
  const row={worker,sets:assigned.length,planned_units:assigned.reduce((sum,job)=>sum+job.semantic_units,0),
    completed_sets:0,pass_sets:0,nonpass_sets:[],recorded_attempts:0,successful_units:0,errors:[],active_sets:[],provisional_nonpass_units:[]};
  for(const job of assigned){
    const folder=path.join(root,job.set_id),receipt=path.join(folder,'semantic.json'),chunks=`${receipt}.chunks.jsonl`;
    if(fs.existsSync(chunks)){
      const lines=fs.readFileSync(chunks,'utf8').split('\n');if(lines.at(-1)!=='')lines.pop();
      const events=lines.filter(Boolean).map(line=>JSON.parse(line));
      row.recorded_attempts+=events.length;
      row.successful_units+=new Set(events.filter(event=>!event.error).map(event=>event.unit_id)).size;
      for(const event of events.filter(event=>event.error))row.errors.push({set_id:job.set_id,unit_id:event.unit_id,error:event.error});
      for(const event of events.filter(event=>!event.error)){
        const response=event.response;
        const units=response?.units??(response?.unit?[response.unit]:response?.checks?[response]:[]);
        const failed=units.filter(unit=>Object.values(unit.checks??{}).some(verdict=>verdict!=='pass'));
        if(failed.length)row.provisional_nonpass_units.push({set_id:job.set_id,unit_id:event.unit_id,checks:failed.map(unit=>unit.checks)});
      }
    }
    if(fs.existsSync(receipt)){
      const review=read(receipt).reviews[0];row.completed_sets++;
      if(review.verdict==='pass')row.pass_sets++;else row.nonpass_sets.push({set_id:job.set_id,verdict:review.verdict});
    }else if(fs.existsSync(folder))row.active_sets.push(job.set_id);
  }
  rows.push(row);
}
console.log(JSON.stringify({checked_at:new Date().toISOString(),directory,rows},null,2));
