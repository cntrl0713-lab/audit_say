import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
let source=fs.readFileSync(path.join(dir,'run-generated-bank-v3-after-refill-v2.mjs'),'utf8');
const replacements=[
 ['runtime-v5-bank-v3-after-refill-01/runtime-lock.json','runtime-v5-bank-v3-after-refill-02/runtime-lock.json'],
 ['generated-bank-v3-after-refill-02','generated-bank-v3-refill02-01'],
 ["['semantic-v5-bank-v3-after-refill-root-01-1','semantic-v5-bank-v3-root-01-1']","['semantic-v5-bank-v3-complete-units-root-01-1','semantic-v5-bank-v3-after-refill-root-01-1','semantic-v5-bank-v3-root-01-1']"]
];
for(const [before,after]of replacements){if(source.split(before).length!==2)throw Error('Unexpected runner source');source=source.replace(before,after);}
fs.writeFileSync(path.join(dir,'run-generated-bank-v3-refill02.mjs'),source,{flag:'wx'});
console.log('Prepared a new local runner; no API call.');
