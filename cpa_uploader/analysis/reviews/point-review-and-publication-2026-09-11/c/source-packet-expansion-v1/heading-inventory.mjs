import fs from 'node:fs';
import {buildSourceCatalog} from '../../../../../questionSourceCatalog.mjs';
const c=buildSourceCatalog(),all=[];
for(const s of c.sources.filter(s=>s.kind==='standard'))for(const line of fs.readFileSync(s.file,'utf8').split(/\r?\n/u)){
 const m=line.match(/^#{1,6}\s+((?:KGA|감사기준서)\s*\d{3,4}.*)$/u);
 if(m&&!/^(?:KGA|감사기준서)\s*\d{3,4}(?=\s*(?::|[‘“"']|$))/u.test(m[1]))all.push({file:s.file,heading:m[1]});
}
console.log(JSON.stringify(all,null,2));
