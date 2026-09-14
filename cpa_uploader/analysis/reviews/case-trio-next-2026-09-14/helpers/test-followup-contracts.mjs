import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {assertPublicationEnvironment} from './publication-environment.mjs';
import {partitionSourceInventory} from './source-inventory.mjs';
import {checkArtifactLinks} from './artifact-links.mjs';
import {resolveCoverageSourceUnits} from './coverage-source-map.mjs';

test('both publication modes reject missing env-file or empty key without exposing its value',()=>{
 const env={CPA_QUESTION_V3_ENCRYPTION_KEY:'synthetic-sensitive-test-marker'};
 assert.throws(()=>assertPublicationEnvironment([],env),error=>error.message.includes('both stage and install')&&!error.message.includes(env.CPA_QUESTION_V3_ENCRYPTION_KEY));
 assert.throws(()=>assertPublicationEnvironment(['--env-file=.env.local'],{}),/Encryption key/u);
 assert.throws(()=>assertPublicationEnvironment(['--env-file=.env.local'],{CPA_QUESTION_V3_ENCRYPTION_KEY:' '}),/Encryption key/u);
 assert.doesNotThrow(()=>assertPublicationEnvironment(['--env-file=.env.local','--import','tsx'],env));
});

test('source collection excludes raw materials by resolved path and does not exclude prefix siblings',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'trio-next-source-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const materials=path.join(root,'materials'),sibling=path.join(root,'materials-other');fs.mkdirSync(materials);fs.mkdirSync(sibling);
 const archived=path.join(materials,'page.png'),outside=path.join(sibling,'original.txt');fs.writeFileSync(archived,'image fixture');fs.writeFileSync(outside,'source fixture');
 const result=partitionSourceInventory([archived,path.join(materials,'..','materials','page.png'),outside],materials);
 assert.equal(result.excluded.length,1);assert.equal(result.excluded[0].file,archived);assert.equal(result.entries.length,1);assert.equal(result.entries[0].original_path,outside);
 assert.match(result.entries[0].sha256,/^[a-f0-9]{64}$/u);
});

test('artifact links support angle-bracket absolute paths, spaces, encodings, anchors and line references',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'trio-next-links-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const target=path.join(root,'source file.md'),document=path.join(root,'README.md');fs.writeFileSync(target,'fixture');
 fs.writeFileSync(document,[`[absolute](<${target}>)`,'[relative](<source file.md>)','[encoded](source%20file.md#anchor)',`[line](<${target}:12>)`,'[web](https://example.test/a)','[anchor](#heading)','[mail](mailto:a@example.test)','![image](missing.png)'].join('\n'));
 assert.deepEqual(checkArtifactLinks(document),{links:4,broken:[]});
 fs.appendFileSync(document,'\n[missing](missing.md)\n[encoding](broken%ZZ.md)');
 const result=checkArtifactLinks(document);assert.equal(result.links,6);assert.deepEqual(result.broken.map(row=>row.target),['missing.md','broken%ZZ.md']);
});

test('coverage aliases require an actual catalogue unit containing the selected quote from the same file',()=>{
 const set={source_refs:[{id:'local-alias',file:'official.txt',source_quote:'요건 A\n요건 B'}]},question={criteria:[{id:'c1',source_ref_ids:['local-alias']}]};
 const proposal={criterion_ids:['c1'],source_unit_ids:['catalogue-unit']},units=[{id:'catalogue-unit',file:'official.txt',quote:'문단 전체: 요건 A 요건 B 및 C'}];
 assert.deepEqual(resolveCoverageSourceUnits(set,question,proposal,units),{sourceIds:['catalogue-unit'],sources:units});
 assert.throws(()=>resolveCoverageSourceUnits(set,question,{criterion_ids:['c1']},units),/contain every selected criterion quote/u);
 assert.throws(()=>resolveCoverageSourceUnits(set,question,proposal,[{...units[0],file:'different.txt'}]),/contain every selected criterion quote/u);
 assert.throws(()=>resolveCoverageSourceUnits(set,question,proposal,[{...units[0],quote:'요건 A'}]),/contain every selected criterion quote/u);
 assert.throws(()=>resolveCoverageSourceUnits(set,question,{...proposal,source_unit_ids:['catalogue-unit','catalogue-unit']},units),/nonempty and unique/u);
});
