import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const dataset=JSON.parse(fs.readFileSync(path.join(here,'past-exam.json'),'utf8'));
const a=dataset.records.filter(r=>r.source.file.endsWith('_A.md'));
const primary=a.filter(r=>r.source_role==='question');
const key=o=>`${o.year}:${o.problem}:${o.subquestion}:${o.item||''}`;
const byKey=new Map(primary.map(r=>[key(r.origin),r]));

test('every occurrence preserves its exact source bytes, line range and page',()=>{
  const seen=new Set();
  for(const declared of dataset.sources){
    const bytes=fs.readFileSync(path.join(root,declared.file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),declared.sha256);
    const text=bytes.toString('utf8'),newline=text.includes('\r\n')?'\r\n':'\n',lines=text.split(/\r?\n/);
    assert.equal(lines.filter(line=>/^## 원문 페이지 \d+/.test(line)).length,declared.pages);
    for(const record of dataset.records.filter(r=>r.source.file===declared.file)){
      assert.ok(!seen.has(record.id),`duplicate occurrence ${record.id}`);seen.add(record.id);
      assert.equal(record.text,lines.slice(record.source.start_line-1,record.source.end_line).join(newline),record.id);
      assert.equal(Number(lines.slice(0,record.source.start_line).findLast(line=>/^## 원문 페이지 \d+/.test(line)).match(/\d+/)[0]),record.source.page);
    }
  }
});

test('author indexes and actual papers retain different roles and five omitted actual questions',()=>{
  assert.equal(a.filter(r=>r.source_role==='author_index').length,398);
  assert.equal(primary.length,403);
  assert.equal(new Set(primary.map(r=>`${r.origin.year}:${r.origin.problem}:${r.origin.subquestion}`)).size,402);
  for(const suffix of ['2014:5:3:','2016:7:2:','2016:7:3:','2016:7:4:','2016:7:5:'])assert.ok(byKey.has(suffix),suffix);
  const item1=byKey.get('2015:7:3:1'),item2=byKey.get('2015:7:3:2');
  assert.notEqual(item1.id,item2.id);
  assert.equal(item1.text,item2.text);
  assert.equal(item1.elements[0].kind,'calculation');
  assert.equal(item2.elements[0].kind,'judgment');
});

test('OCR repairs separate neighboring demands and exclude answer prose',()=>{
  assert.match(byKey.get('2023:2:1:').text,/충분성/);
  assert.doesNotMatch(byKey.get('2023:2:1:').text,/목표감사위험/);
  assert.match(byKey.get('2023:2:2:').text,/목표감사위험/);
  assert.doesNotMatch(byKey.get('2023:2:2:').text,/충분성/);
  assert.doesNotMatch(byKey.get('2023:3:3:').text,/권고 개선안|구매팀 담당자는 승인된/);
  assert.doesNotMatch(byKey.get('2025:2:6:').text,/커진다|작아진다/);
  assert.match(byKey.get('2020:9:3:').text,/새로운 감사보고서를 발행/);
  assert.doesNotMatch(byKey.get('2020:9:4:').text,/새로운 감사보고서를 발행/);
  assert.doesNotMatch(byKey.get('2016:7:5:').text,/한정의견|부적정의견/);
});

test('all actual prompts have reviewed concrete requirements, with unclassified IT preserved',async()=>{
  const curated=new Map();
  for(const name of fs.readdirSync(here).filter(name=>/^past-exam-curated-\d{4}-\d{4}\.mjs$/.test(name))){
    const curationModule=await import(new URL(name,import.meta.url));
    for(const [id,elements]of Object.entries(curationModule.curated)){assert.ok(!curated.has(id));curated.set(id,elements);}
  }
  assert.equal(curated.size,primary.length);
  for(const record of primary)assert.deepEqual(record.elements,curated.get(key(record.origin)).map(([label,topic_id,kind])=>({label,topic_id,kind})),key(record.origin));
  assert.equal(byKey.get('2025:1:1:').elements.length,5);
  assert.match(byKey.get('2025:1:1:').elements[1].label,/보험계리.*유의적 부문|유의적 부문.*보험계리/);
  assert.equal(byKey.get('2025:6:1:').status,'extracted');
  assert.equal(byKey.get('2025:6:1:').elements[0].topic_id,null);
});

test('partial topical reprints map only the requirement present and preserve following conditions',()=>{
  const topical=dataset.records.filter(r=>r.source.file.endsWith('기출문제_주제별_해설.md'));
  const service=topical.find(r=>r.source.start_line===6935);
  assert.equal(key(service.origin),'2025:3:3:4');
  assert.equal(service.elements.length,1);
  assert.match(service.text,/보고서를 입수하여/);
  assert.doesNotMatch(service.text,/적절하지 않다/);
  const inventory=topical.find(r=>r.source.start_line===7503);
  assert.equal(inventory.elements.length,1);
  assert.equal(inventory.source.end_line,7518);
  assert.doesNotMatch(inventory.elements[0].label,/외부창고/);
  assert.ok(topical.filter(r=>r.source.page<354&&![3101,4886,6935,7503,12401].includes(r.source.start_line)).every(r=>r.status==='needs_review'));
});

test('later shared cases bind to their own facts rather than an earlier question context',()=>{
  const pps=byKey.get('2015:7:3:1').context_source;
  assert.equal(pps.start_line,21382);
  assert.equal(pps.end_line,21414);
  const inventory=byKey.get('2023:6:2:').context_source;
  assert.equal(inventory.start_line,5687);
  assert.equal(inventory.end_line,5692);
});

test('short topical reprint retains its reviewed original and the exact relevant shared case',()=>{
  const reprint=dataset.records.find(r=>r.id==='past-09dd26f4cc4668d53227');
  assert.equal(key(reprint.origin),'2024:8:1:');
  assert.equal(reprint.status,'extracted');
  assert.equal(reprint.elements.length,1);
  assert.deepEqual(reprint.elements,byKey.get('2024:8:1:').elements);
  assert.equal(reprint.source.end_line,14782);
  assert.equal(reprint.context_source.start_line,14754);
  assert.equal(reprint.context_source.end_line,14776);
});
