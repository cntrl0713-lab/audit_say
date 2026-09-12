import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Select a sequential wave from one immutable full-bank execution inventory.
const root='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const masterFile=`${root}/execution-all-v2/manifest.json`;
const master=JSON.parse(fs.readFileSync(masterFile,'utf8'));
const mode=process.argv[2];
if(process.argv.length!==3||!['canary','remaining'].includes(mode))throw Error('Use canary or remaining.');
const ids=['pilot-08-007','pilot-05-008','draft-04-320-freq01'];
const output=`${root}/execution-${mode}-v2`;
if(fs.existsSync(output))throw Error('Choose a fresh output; existing waves are immutable.');
for(const row of [{file:master.bank_file,sha256:master.bank_sha256},...master.code_files])if(hash(row.file)!==row.sha256)throw Error(`Changed input: ${row.file}`);
const jobs=master.jobs.filter(job=>mode==='canary'?ids.includes(job.set_id):!ids.includes(job.set_id));
const workers=['a','b','c'].map(id=>({id,units:0}));
for(const job of [...jobs].sort((a,b)=>b.semantic_units-a.semantic_units||a.set_id.localeCompare(b.set_id))){
    workers.sort((a,b)=>a.units-b.units||a.id.localeCompare(b.id));
    job.worker=workers[0].id;workers[0].units+=job.semantic_units;
}
if(mode==='canary'&&jobs.length!==3)throw Error('Missing diagnostic set.');
fs.mkdirSync(output);
const manifest={...master,created_at:new Date().toISOString(),wave:mode,
    predecessor:{file:masterFile,sha256:hash(masterFile)},workers,jobs};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sets:jobs.length,units:jobs.reduce((n,j)=>n+j.semantic_units,0),workers,api_calls:0}));
