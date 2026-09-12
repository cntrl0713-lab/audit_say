import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSourceCatalog,createSourcePacket,sourceUnitToRef} from '../../../../../questionSourceCatalog.mjs';
const out='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/source-packet-expansion-v1';
fs.mkdirSync(out,{recursive:true});
const catalog=buildSourceCatalog(),sha=x=>createHash('sha256').update(x).digest('hex');
const added=['a','b','c'].map(x=>`cpa_uploader/data/official/point-review-${x}-source-followup-2026-09-11.txt`);
const appendix=u=>/(?:보론|부록|appendix)/iu.test(u.context.section);
const prefer=(units,from)=>[...units].sort((a,b)=>{const rank=u=>(u.authority==='official_transcription'?100:0)+(from&&u.file===from.file?10:0)+(u.quote.length>60?1:0);return rank(b)-rank(a)||b.quote.length-a.quote.length||a.id.localeCompare(b.id);})[0];
function beforeWithout(files){
 const units=structuredClone(catalog.units.filter(u=>!files.includes(u.file))),byPara=new Map();
 for(const u of units.filter(u=>u.paragraph&&!appendix(u))){const k=u.standard+':'+u.paragraph;byPara.set(k,[...(byPara.get(k)||[]),u]);}
 for(const u of units)for(const d of u.dependencies){const target=d.paragraph?prefer(byPara.get(d.standard+':'+d.paragraph)||[],u):null;const ap=d.appendix?units.filter(x=>x.standard===d.standard&&new RegExp(`(?:보론|부록|appendix)\\s*${d.appendix}(?:[^0-9]|$)`,'iu').test(x.context.section)):[];d.targetId=target?.id||ap[0]?.id||null;if(d.appendix!==undefined)d.targetIds=ap.map(x=>x.id);}
 return {...catalog,units,sources:catalog.sources.filter(s=>!files.includes(s.file)),fingerprint:'reconstructed-read-only-without:'+files.join(',')};
}
const inputChars=units=>JSON.stringify(units.map(sourceUnitToRef),null,2).length+JSON.stringify(units.map(u=>({id:u.id,file:u.file,locator:u.locator,authority:u.authority,edition:u.edition,provenance:u.provenance})),null,2).length;
function trace(c){
 const packet=createSourcePacket({topicId:'13',catalog:c,maxChars:3_000_000}),byId=new Map(c.units.map(u=>[u.id,u]));
 const primary=packet.primary,selected=new Map(primary.map(u=>[u.id,u])),parents=new Map(primary.map(u=>[u.id,null])),edges=[];
 for(const u of primary){const groups=new Map();for(const s of c.units.filter(x=>x.context.sectionId===u.context.sectionId&&x.paragraph)){const k=s.standard+':'+s.paragraph;groups.set(k,[...(groups.get(k)||[]),s]);}for(const g of groups.values()){const s=prefer(g,u);if(!selected.has(s.id)){selected.set(s.id,s);parents.set(s.id,{from:u.id,reason:'initial selected section context'});}}}
 const queue=[...selected.values()];for(let i=0;i<queue.length;i++){const u=queue[i];for(const d of u.dependencies)for(const targetId of d.targetIds?.length?d.targetIds:[d.targetId]){const t=byId.get(targetId);if(!t)continue;edges.push({from:u.id,to:t.id,reason:d.reason,standard:d.standard,paragraph:d.paragraph,appendix:d.appendix??null});if(!selected.has(t.id)){selected.set(t.id,t);parents.set(t.id,{from:u.id,reason:d.reason});queue.push(t);}}}
 const units=[...selected.values()];if(units.length!==1+packet.dependencies.length)throw Error('Trace does not match actual source packet');
 const path=id=>{const result=[];let current=id;while(current){const u=byId.get(current),via=parents.get(current);result.unshift({id:current,standard:u.standard,paragraph:u.paragraph,file:u.file,via:via?.reason??null});current=via?.from;}return result;};
 return {primary:primary.map(u=>u.id),required_units:units.length,required_input_chars:inputChars(units),required_quote_chars:units.reduce((n,u)=>n+u.quote.length,0),unresolved:packet.unresolved.length,edges,units:units.map(u=>({id:u.id,standard:u.standard,paragraph:u.paragraph,file:u.file,lines:[u.startLine,u.endLine],quote_chars:u.quote.length,source_input_chars:inputChars([u])})),new_file_paths:units.filter(u=>added.includes(u.file)).map(u=>({target:u.id,path:path(u.id)})),first_paths_by_standard:Object.fromEntries([...new Set(units.map(u=>u.standard))].map(s=>[s,path(units.find(u=>u.standard===s).id)]))};
}
const current=trace(catalog),reconstructedBefore=trace(beforeWithout(added));
const sensitivity=[];for(const f of added){const t=trace(beforeWithout([f]));sensitivity.push({excluded_file:f,required_units:t.required_units,required_input_chars:t.required_input_chars});}
const beforeById=new Map(beforeWithout(added).units.map(u=>[u.id,u])),changedResolved=[];
for(const u of catalog.units){const old=beforeById.get(u.id);if(!old)continue;for(const d of u.dependencies){const od=old.dependencies.find(o=>o.standard===d.standard&&o.paragraph===d.paragraph&&o.appendix===d.appendix);if(od&&JSON.stringify([od.targetId,od.targetIds])!==JSON.stringify([d.targetId,d.targetIds]))changedResolved.push({from:u.id,source_standard:u.standard,source_paragraph:u.paragraph,source_file:u.file,dependency_standard:d.standard,dependency_paragraph:d.paragraph,reason:d.reason,before:od.targetId,after:d.targetId,in_current_graph:current.units.some(x=>x.id===u.id),in_before_graph:reconstructedBefore.units.some(x=>x.id===u.id)});}}
const result={method:'Read-only actual current graph; before-state is explicitly a reconstruction excluding only the three new followup files and re-resolving original references with the current unchanged preferred/appendix selection algorithm, not a claimed historical saved packet. Diagnostic maxChars=3000000 is for graph inspection only and is not a production budget proposal.',catalog_fingerprint:catalog.fingerprint,core_sha256:sha(fs.readFileSync('cpa_uploader/questionSourceCatalog.mjs')),added_files:added.map(file=>({file,sha256:sha(fs.readFileSync(file))})),current,reconstructed_before_abc:reconstructedBefore,sensitivity,changed_resolved_edges:changedResolved,remote_api_calls:0,core_bank_source_writes:0};
fs.writeFileSync(`${out}/graph-evidence.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({current:{units:current.required_units,chars:current.required_input_chars},before:{units:reconstructedBefore.required_units,chars:reconstructedBefore.required_input_chars},sensitivity,new_paths:current.new_file_paths.filter(x=>x.path.filter(p=>added.includes(p.file)).length===1).slice(0,10),changed_entrance_edges:changedResolved.filter(e=>e.in_before_graph)},null,2));
