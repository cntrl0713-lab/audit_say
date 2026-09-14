import fs from 'node:fs';
import assert from 'node:assert/strict';
import {R,D,read,ref,authorSources,sourceEvidencePlan} from './source-evidence.mjs';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const original=read(R+'/draft-evidence.json');for(const e of original)assert.equal(ref(e.file).sha256,e.sha256);
const extra=[...walk(D+'/a'),...walk(D+'/b'),...walk(D+'/c')].filter(f=>/\.(json|md|txt)$/u.test(f));
const sources=['a','b','c'].flatMap(authorSources),sourcePlan=sourceEvidencePlan();
const files=[...new Set([...original.map(e=>e.file),...extra,...sources.map(e=>e.file),...sourcePlan.files.map(e=>e.file),
 D+'/source-catalog-final.json',D+'/a-peer-review.json',D+'/b-peer-review.json',D+'/c-peer-review.json',
 R+'/helpers/source-evidence.mjs',R+'/helpers/complete-draft-evidence.mjs',R+'/helpers/provenance.json'])];
const completed=files.map(ref);
for(const source of [...sources,...sourcePlan.files])assert.equal(ref(source.file).sha256,source.sha256,'Source changed while completing evidence');
assert(!fs.existsSync(R+'/draft-evidence-before-completion.json'));
fs.copyFileSync(R+'/draft-evidence.json',R+'/draft-evidence-before-completion.json',fs.constants.COPYFILE_EXCL);
fs.writeFileSync(R+'/draft-evidence.json',JSON.stringify(completed,null,2)+'\n');
console.log({evidence_files:files.length});
