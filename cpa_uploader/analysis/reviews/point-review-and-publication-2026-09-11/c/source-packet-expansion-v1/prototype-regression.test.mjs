import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {buildSourceCatalog,createSourcePacket} from '../../../../../questionSourceCatalog.mjs';
const owned=path.resolve('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/source-packet-expansion-v1');
const c=buildSourceCatalog(),file='cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt';
const unit=p=>c.units.find(u=>u.file===file&&u.standard==='KGA 402'&&u.paragraph===p);

test('verified footnotes move reference ownership without losing official body or paragraph identifiers',()=>{
 const prior=JSON.parse(fs.readFileSync(path.join(owned,'impact-evidence.json'),'utf8'));
 for(const p of ['9','10','12']){assert.equal(prior.official402.find(u=>u.paragraph===p).quote_unchanged,true);assert.ok(unit(p));}
 assert.ok(unit('12').quote.includes('3 감사기준서 315 문단 9'));
 assert.ok(unit('12').quote.includes('4 감사기준서 315 문단 26(a)'));
 assert.ok(unit('12').quote.includes('5 감사기준서 315 문단 26(d)'));
 assert.equal(unit('12').dependencies.some(d=>d.standard==='KGA 315'),false);
 assert.ok(unit('9').dependencies.some(d=>d.standard==='KGA 315'&&d.paragraph==='9'));
 assert.ok(unit('10').dependencies.some(d=>d.standard==='KGA 315'&&d.paragraph==='26'));
});
test('relationship/application headings preserve enclosing 610/701 standard identity',()=>{
 const internal=c.units.find(u=>u.file.endsWith('/06_타인의_업무활용.md')&&u.paragraph==='9'&&u.quote.includes('기업에는 내부감사기능'));
 assert.equal(internal.standard,'KGA 610');
 const falseReferences=c.units.filter(u=>u.file.endsWith('/07_감사의견과_감사보고.md')&&u.context.section.includes('감사기준서 315에 따라'));
 assert.ok(falseReferences.length>0);assert.ok(falseReferences.every(u=>u.standard==='KGA 701'));
 const real315=c.units.find(u=>u.id===unit('9').dependencies.find(d=>d.standard==='KGA 315'&&d.paragraph==='9').targetId);
 assert.ok(real315.quote.includes('규모나 복잡성에 관계없이 모든 기업'));
});
test('official primary selection and truthful full-scope budget rejection are separate contracts',()=>{
 assert.throws(()=>createSourcePacket({topicId:'13',catalog:c}),/원문을 자르지 않았습니다/);
 const packet=createSourcePacket({topicId:'13',catalog:c,maxChars:3_000_000});
 assert.equal(packet.primary[0].standard,'KGA 402');assert.equal(packet.primary[0].authority,'official_transcription');
 assert.ok(packet.units.some(u=>u.standard==='KGA 315'&&u.paragraph==='26'));
 assert.ok(packet.unresolved.length>0);assert.equal(packet.completeness,'unresolved');
});
test('footnote assignments fail closed on stale file, missing body or absent owner callout',t=>{
 const dir=fs.mkdtempSync(path.join(owned,'isolated-fixture-'));
 t.after(()=>{const resolved=path.resolve(dir);assert.ok(resolved.startsWith(owned+path.sep+'isolated-fixture-'));fs.rmSync(resolved,{recursive:true,force:true});});
 const registry=JSON.parse(fs.readFileSync('cpa_uploader/config/question-source-registry.json','utf8'));
 fs.mkdirSync(path.join(dir,'cpa_uploader/config'),{recursive:true});fs.mkdirSync(path.join(dir,'cpa_uploader/data/official'),{recursive:true});
 fs.mkdirSync(path.join(dir,'cpa_uploader/data/회계감사_통합학습자료'),{recursive:true});
 fs.writeFileSync(path.join(dir,'cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md'),'### 13. 타인의 업무 활용\n');
 fs.copyFileSync(file,path.join(dir,file));
 for(const patch of [{source_hash:'0'.repeat(64)},{footnote_text:'3 missing body'},{owner_callout:'missing callout'}]){
  const changed=structuredClone(registry);Object.assign(changed.referenceFootnotes[0],patch);
  fs.writeFileSync(path.join(dir,'cpa_uploader/config/question-source-registry.json'),JSON.stringify(changed));
  assert.throws(()=>buildSourceCatalog({repoDir:dir}),/각주/);
 }
 fs.writeFileSync(path.join(dir,'cpa_uploader/config/question-source-registry.json'),JSON.stringify(registry));
 assert.ok(buildSourceCatalog({repoDir:dir}).units.some(u=>u.standard==='KGA 402'&&u.paragraph==='12'));
});
