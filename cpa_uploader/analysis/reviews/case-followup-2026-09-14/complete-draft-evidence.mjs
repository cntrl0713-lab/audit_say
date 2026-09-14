import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/case-followup-2026-09-14',D='cpa_uploader/drafts/case-followup-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const original=read(R+'/draft-evidence.json');for(const e of original)assert.equal(ref(e.file).sha256,e.sha256);
const extra=[...walk(D+'/a'),...walk(D+'/b')].filter(f=>/\.(json|md|txt)$/u.test(f));
const collection='cpa_uploader/raw/collections/2026-09-14-case-followup';
const pages='cpa_uploader/raw/collections/2026-09-14-case-followup-pages';
const files=[...new Set([...original.map(e=>e.file),...extra,
 ...read(R+'/source-inventory.json').entries.map(e=>e.original_path),
 ...['manifest.json','verification.json','index.md'].map(n=>collection+'/'+n),
 ...['manifest.json','verification.json','index.md'].map(n=>pages+'/'+n),
 D+'/source-peer-pages-inventory.json',...read(D+'/source-peer-pages-inventory.json').entries.map(e=>e.original_path),
 R+'/source-fragments-check.json',D+'/source-peer-review.json',D+'/a-peer-review.json',D+'/b-peer-review.json',
])];
assert(!fs.existsSync(R+'/draft-evidence-before-completion.json'));
fs.copyFileSync(R+'/draft-evidence.json',R+'/draft-evidence-before-completion.json',fs.constants.COPYFILE_EXCL);
fs.writeFileSync(R+'/draft-evidence.json',JSON.stringify(files.map(ref),null,2)+'\n');
console.log({evidence_files:files.length});
