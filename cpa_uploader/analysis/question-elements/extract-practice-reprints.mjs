import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, '../../..');
const relativeDirectory = 'cpa_uploader/analysis/question-elements';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const key = origin => `${origin.kind}:${origin.year}:${origin.problem}:${origin.subquestion}`;

// Replays a fixed, reviewed correspondence ledger. It never discovers or accepts
// a match merely because two generic question stems have similar wording.
export function extractPracticeReprints({ repoDir = repository } = {}) {
  const dir = path.join(repoDir, relativeDirectory);
  const read = name => JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
  const raw = read('practice.json');
  const reviewed = read('practice-reprint-links.json');
  const missing = read('practice-reprint-missing.json');
  const sourceCuration = read('curation-practice-advanced-late.json');
  for (const input of [reviewed,missing,sourceCuration]) for (const [file,digest] of Object.entries(input.source_hashes)) {
    assert.equal(sha(fs.readFileSync(path.join(repoDir,file))),digest,`Stale review source: ${file}`);
  }
  const byId = new Map(raw.records.map(record=>[record.id,structuredClone(record)]));
  for (const override of sourceCuration.records) {
    const record=byId.get(override.id);
    assert.ok(record,`Missing source curation target ${override.id}`);
    record.elements=override.elements;
    record.status=override.status;
    if(override.origin) record.origin=override.origin;
  }
  const file = Object.keys(reviewed.source_hashes)[0];
  const records=[];
  for (const link of reviewed.links) {
    const target=byId.get(link.target_id),source=byId.get(link.source_id);
    assert.ok(target&&source,`Missing reviewed reprint ${link.target_id}`);
    assert.equal(target.source.file,file);
    assert.equal(source.source.file,file);
    assert.equal(target.source.end_line,link.target_end_line);
    assert.equal(source.source.end_line,link.source_end_line);
    assert.ok(source.source.page<284&&target.source.page>=284&&target.source.page<384);
    assert.equal(key(source.origin),key(link.origin),`Original source identity differs: ${source.id}`);
    assert.ok(source.elements.length,`Reviewed source has no elements: ${source.id}`);
    records.push({id:target.id,elements:structuredClone(source.elements),status:source.status,origin:link.origin,
      notes:[...link.notes,`동일 원시험·사례·발문 재수록: ${source.id} (L${source.source.start_line}–${source.source.end_line}) → L${target.source.start_line}–${target.source.end_line}; 원문 occurrence는 보존하고 같은 원물음 빈도는 중복 합산하지 않음`]});
  }
  for (const entry of missing.missing_sources.filter(entry=>entry.source_start_line===null)) {
    const record=byId.get(entry.target_id);
    assert.equal(record?.source.end_line,entry.target_end_line);
    records.push({id:entry.target_id,elements:entry.elements,status:'extracted',origin:entry.origin,notes:entry.notes.filter(note=>!note.startsWith('Part2 실제 발문과 Part1'))});
  }
  for (const entry of missing.excluded_targets) {
    assert.ok(byId.has(entry.id));
    records.push({id:entry.id,excluded:true,notes:entry.notes});
  }
  const targets=raw.records.filter(record=>record.source.file===file&&record.source.page>=284&&record.source.page<384);
  assert.equal(new Set(records.map(record=>record.id)).size,records.length,'Duplicate reviewed target');
  assert.deepEqual(records.map(record=>record.id).sort(),targets.map(record=>record.id).sort(),'Every Part2 candidate must have one reviewed decision');
  records.sort((a,b)=>byId.get(a.id).source.start_line-byId.get(b.id).source.start_line);
  return {version:1,source_hashes:reviewed.source_hashes,records};
}

export function assertPracticeReprintRegressions(raw, overlay) {
  const records=new Map(raw.records.map(record=>[record.id,structuredClone(record)]));
  for(const entry of overlay.records) Object.assign(records.get(entry.id),entry);
  const advanced=[...records.values()].filter(record=>record.source.file.includes('고급'));
  const at=end=>advanced.find(record=>record.source.end_line===end);
  assert.equal(key(at(13505).origin),'mock:2024:GS2-8:6');
  assert.equal(key(at(13554).origin),'mock:2024:GS2-8:7');
  assert.equal(key(at(3302).origin),'mock:2024:GS2-8:7');
  assert.notDeepEqual(at(13505).elements,at(13554).elements,'Control-test purposes and scope guidelines are different demands');
  for(const [source,target,number] of [[9186,11934,'4'],[9191,11941,'5']]) {
    assert.equal(key(at(source).origin),`mock:2024:GS1-2:${number}`);
    assert.equal(key(at(target).origin),key(at(source).origin));
  }
  for(const record of advanced.filter(record=>record.origin.kind==='mock')) {
    assert.ok(!/GS[12]-(?:11|21|31|51|61)$/u.test(record.origin.problem??''),`OCR bracket treated as a number: ${record.id}`);
  }
  // These pages ask the same generic evidence-appropriateness question in two
  // different GS rounds; their surrounding cases and exam identities differ.
  const round1=advanced.filter(record=>record.source.page===44&&/적절|잘못/u.test(record.text));
  const round2=advanced.filter(record=>record.source.page===48&&/적절|잘못/u.test(record.text));
  assert.ok(round1.length&&round2.length);
  assert.ok(round1.some(record=>record.origin.year===2023&&record.origin.problem?.startsWith('GS1-')));
  assert.ok(round2.some(record=>record.origin.year===2023&&record.origin.problem?.startsWith('GS2-')));
  for(const a of round1) for(const b of round2) assert.notEqual(key(a.origin),key(b.origin));
}

if (process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every(argument=>argument==='--check'),'Usage: node extract-practice-reprints.mjs [--check]');
  const result=extractPracticeReprints();
  assertPracticeReprintRegressions(JSON.parse(fs.readFileSync(path.join(directory,'practice.json'),'utf8')),result);
  const output=JSON.stringify(result,null,2)+'\n';
  const target=path.join(directory,'curation-practice-reprints.json');
  if(process.argv.includes('--check')) assert.equal(fs.readFileSync(target,'utf8'),output,'Reprint curation is not synchronized');
  else fs.writeFileSync(target,output,'utf8');
  console.log(JSON.stringify({records:result.records.length,extracted:result.records.filter(record=>record.status==='extracted').length,needs_review:result.records.filter(record=>record.status==='needs_review').length,excluded:result.records.filter(record=>record.excluded).length},null,2));
}
