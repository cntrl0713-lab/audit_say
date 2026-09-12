import fs from 'node:fs';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
const directory='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const catalog=buildSourceCatalog();
const normalized=value=>value.replace(/\s+/gu,'');
const units=catalog.units.map(unit=>({...unit,normalized_quote:normalized(unit.quote)}));
const sets=['a','b','c'].flatMap(owner=>JSON.parse(fs.readFileSync(`${directory}/${owner}/sets.json`,'utf8')));
const missing=[];
for(const set of sets){
  const matches=new Set();
  for(const source of set.source_refs){
    const quote=normalized(source.source_quote);
    const found=units.filter(unit=>(unit.file===source.file || quote.length>60) &&
      (unit.normalized_quote.includes(quote) || quote.includes(unit.normalized_quote)));
    for(const unit of found)matches.add(unit.id);
    if(!found.length)missing.push({set_id:set.id,source_id:source.id,file:source.file,chars:quote.length});
  }
}
console.log(JSON.stringify({catalog_units:units.length,unmatched_sources:missing},null,2));
