import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildSourceCatalog, createSourcePacket, parseSourceToc, sourceUnitToRef } from '../cpa_uploader/questionSourceCatalog.mjs';
import type { SourceUnit } from '../cpa_uploader/questionSourceCatalog.mjs';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const learning = 'cpa_uploader/data/회계감사_통합학습자료';
const catalog = buildSourceCatalog({ repoDir });
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const actual = (standard: string, paragraph: string, authority?: string): SourceUnit => {
  const unit = catalog.units.find((candidate) => candidate.standard === standard && candidate.paragraph === paragraph
    && (!authority || candidate.authority === authority));
  assert.ok(unit, `${standard}.${paragraph} ${authority || ''}`);
  return unit;
};

test('all 151 indented TOC source links map their actual pages into the 19 topics', () => {
  const tocText = fs.readFileSync(path.join(repoDir, learning, '00_통합_목차.md'), 'utf8');
  const rawLinks = tocText.split(/\r?\n/).filter((line) => /^\s+- `(?:02_|03_|04_)/.test(line));
  assert.equal(rawLinks.length, 151);
  assert.equal(catalog.tocLinks.length, 151);
  assert.deepEqual(['02_', '03_', '04_'].map((prefix) => catalog.tocLinks.filter((link) => link.file.includes(`/${prefix}`)).length), [37, 57, 57]);
  for (const link of catalog.tocLinks) {
    const mapped = catalog.units.filter((unit) => unit.file === link.file && unit.topicIds.includes(link.topicId));
    for (const page of link.pages) assert.ok(mapped.some((unit) => unit.page === page), `${link.topicId}/${link.file}/${page}`);
  }
  assert.equal(catalog.warnings.length, 0);
  const withOutsideLink = parseSourceToc(`${tocText}\n- \`99_완전성_검증.md\`: 123\n`);
  assert.equal(withOutsideLink.links.length, 151);
});

test('catalog quotations and hashes preserve source bytes and full child lists', () => {
  const files = new Map(catalog.sources.map((source) => [source.file, fs.readFileSync(path.join(repoDir, source.file), 'utf8')]));
  for (const unit of catalog.units) {
    assert.ok(files.get(unit.file)!.includes(unit.quote), unit.id);
    assert.equal(unit.contentHash, hash(unit.quote), unit.id);
    assert.ok(unit.startLine > 0 && unit.endLine >= unit.startLine);
  }
  const contract = actual('KGA 210', '10', 'learning_material');
  for (const letter of ['a', 'b', 'c', 'd', 'e', 'f']) assert.ok(contract.quote.includes(`(${letter})`));
  assert.ok(contract.quote.includes('해당 보고서가 예상되는 형태와 내용과 다를 수 있는 상황'));
  const objectives = actual('KGA 200', '7', 'learning_material');
  assert.equal(objectives.quote.split('\n').filter((line) => line.trim().startsWith('- ')).length, 3);
  const firstAudit = actual('KGA 300', 'A22', 'learning_material');
  assert.equal(firstAudit.quote.split('\n').filter((line) => line.trim().startsWith('- ')).length, 4);
  assert.ok(firstAudit.quote.includes('법규에서 금지되지 않는 한'));
  const thirdParty = actual('KGA 260', 'A43', 'learning_material');
  for (const letter of ['a', 'b', 'c']) assert.ok(thirdParty.quote.includes(`(${letter})`));
  const ref = sourceUnitToRef(contract);
  assert.equal(ref.page, 'KGA 210');
  assert.match(ref.source_span, /L343-L349/);
});

test('new topic 13 packet selects KGA 402 without requiring any bank citation', () => {
  const packet = createSourcePacket({ repoDir, topicId: '13', catalog });
  assert.equal(packet.primary[0].standard, 'KGA 402');
  assert.equal(packet.primary[0].authority, 'learning_material');
  assert.ok(packet.primary[0].quote.includes('충분한 이해'));
  assert.ok(packet.dependencies.length > 14);
  assert.ok(packet.supporting.some((unit) => unit.kind === 'practice'));
  assert.ok(packet.supporting.some((unit) => unit.kind === 'past_exam'));
  assert.ok(packet.warnings.some((warning) => warning.includes('공식 원문')));
  assert.ok(!fs.readFileSync(path.join(repoDir, 'cpa_uploader/questionSourceCatalog.mjs'), 'utf8').includes('readQuestionBank'));
});

test('completion and reporting packets retain required conditions and subsequent actions', () => {
  const quality = createSourcePacket({ topicId: '01', sourceIds: [actual('KGA 220', 'A26').id], catalog, maxChars: 200_000 });
  for (const paragraph of ['20', '21', '22']) assert.ok(quality.units.some((unit) => unit.standard === 'KGA 220' && unit.paragraph === paragraph));
  const disclaimer = createSourcePacket({ topicId: '15', sourceIds: [actual('KGA 705', '28').id], catalog });
  assert.ok(disclaimer.units.some((unit) => unit.standard === 'KGA 705' && unit.paragraph === '29' && unit.quote.includes('포함하여서는 안 된다')));
  const otherInformation = createSourcePacket({ topicId: '16', sourceIds: [actual('KGA 720', '17', 'official_transcription').id], catalog });
  for (const paragraph of ['17', '18', '19']) assert.ok(otherInformation.units.some((unit) => unit.standard === 'KGA 720' && unit.paragraph === paragraph));
  const kam = createSourcePacket({ topicId: '16', sourceIds: [actual('KGA 701', '9', 'official_transcription').id], catalog, maxChars: 200_000 });
  assert.ok(kam.units.some((unit) => unit.standard === 'KGA 701' && unit.paragraph === '10'));
  assert.ok(actual('KGA 1200', '10', 'official_transcription').quote.includes('전반적인 목적'));
  assert.ok(actual('KGA 1200', '32', 'official_transcription').quote.includes('커뮤니케이션의 상대'));
});

test('unavailable references remain explicit, and no arbitrary unit/character truncation occurs', () => {
  const packet = createSourcePacket({ topicId: '15', catalog });
  assert.equal(packet.completeness, 'unresolved');
  assert.ok(packet.unresolved.some((reference) => reference.standard === 'KGA 705' && reference.paragraph === 'A26' && reference.targetId === null));
  assert.throws(() => createSourcePacket({ topicId: '13', catalog, maxChars: 200 }), /원문을 자르지 않았습니다.*더 좁은/);
  assert.throws(() => createSourcePacket({ topicId: '13', catalog, sourceIds: ['missing'] }), /원자료 ID/);
  assert.throws(() => createSourcePacket({ topicId: '13', catalog, sourceIds: [actual('KGA 210', '10').id] }), /연결되어 있지 않습니다/);
  assert.ok(catalog.units.some((unit) => unit.dependencies.some((reference) => reference.standard === 'IFRS 7' && reference.paragraph === '42H' && reference.targetId === null)));
});

test('appendix cases do not replace numbered requirements and absent appendices stay unresolved', () => {
  const caseReport = catalog.units.find((unit) => unit.standard === 'KGA 1200' && unit.quote.startsWith('1. 적정의견 감사보고서'))!;
  assert.ok(caseReport.context.section.includes('보론 2'));
  assert.ok(caseReport.locator.includes('보론 2'));
  assert.notEqual(caseReport.id, actual('KGA 1200', '1', 'official_transcription').id);
  const objective = actual('KGA 1200', '10', 'official_transcription');
  assert.ok(objective.dependencies.every((dependency) => dependency.targetId !== caseReport.id));
  assert.ok(catalog.units.some((unit) => unit.dependencies.some((dependency) => dependency.appendix !== undefined)));
  assert.ok(catalog.units.some((unit) => unit.dependencies.some((dependency) => dependency.appendix !== undefined && dependency.targetId === null)));
});

test('an explicit self-contained paragraph does not drag in unrelated section references', () => {
  const source = actual('KGA 200', '7', 'learning_material');
  const packet = createSourcePacket({ topicId: '02', catalog, sourceIds: [source.id] });
  assert.equal(packet.completeness, 'complete');
  assert.equal(packet.completenessScope, 'parsed_references');
  assert.equal(packet.dependencies.length, 0);
  assert.equal(packet.primary[0].quote, source.quote);
  assert.ok(packet.charCount > packet.quoteChars, 'budget includes source locators and provenance, not just quote text');
});

test('explicit practice/past exam selections preserve full OCR pages and private provenance', () => {
  for (const kind of ['practice', 'past_exam']) {
    const unit = catalog.units.find((candidate) => candidate.kind === kind && candidate.topicIds.includes('13') && candidate.quote.length > 150)!;
    const packet = createSourcePacket({ topicId: '13', sourceIds: [unit.id], catalog });
    assert.equal(packet.primary[0].id, unit.id);
    assert.equal(packet.primary[0].quote, unit.quote);
    assert.equal(packet.sourceRefs[0].role, 'practice');
    assert.equal(packet.primary[0].authority, 'learning_material');
    assert.ok(packet.warnings.some((warning) => warning.includes('전후 페이지')));
  }
});

test('topic 19 mappings retain official URLs and unresolved domestic edition boundaries', () => {
  const isa = actual('ISA 800 (국내 판본 미확인)', '8');
  assert.ok(isa.topicIds.includes('19'));
  assert.ok(isa.provenance.includes('irba.co.za'));
  assert.ok(isa.edition.includes('국내'));
  const interim = actual('분·반기재무제표 검토준칙', '1');
  assert.ok(interim.edition.includes('2014-12-30'));
  assert.ok(interim.warnings.some((warning) => warning.includes('2015')));
  assert.equal(catalog.registry.topics.at(-1)!.standards.length, 5);
  const agreedProcedures = actual('합의된 절차 수행업무기준', '7');
  assert.ok(agreedProcedures.quote.includes('(5) 전문가적 품위'));
  assert.ok(agreedProcedures.quote.includes('독립성'));
  assert.equal(catalog.units.some((unit) => unit.standard === '합의된 절차 수행업무기준' && unit.paragraph === '3'), false);
});

test('source identities survive line movement, while source/registry changes invalidate fingerprints without a bank', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-source-catalog-test-'));
  t.after(() => {
    assert.ok(path.resolve(temp).startsWith(`${path.resolve(os.tmpdir())}${path.sep}audit-source-catalog-test-`));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const registryDir = path.join(temp, 'cpa_uploader/config');
  const standardDir = path.join(temp, learning, '01_감사기준');
  fs.mkdirSync(registryDir, { recursive: true });
  fs.mkdirSync(standardDir, { recursive: true });
  const registryFile = path.join(registryDir, 'question-source-registry.json');
  fs.writeFileSync(registryFile, JSON.stringify(catalog.registry));
  fs.writeFileSync(path.join(temp, learning, '00_통합_목차.md'), '## 공통 분류체계\r\n### 13. 서비스조직\r\n');
  const standardFile = path.join(standardDir, 'source.md');
  const body = '# KGA 402: 서비스조직\r\n### 요구사항\r\n' + Array.from({ length: 16 }, (_, index) => `${index + 1}. 감사인은 조건 ${index + 1}을 확인하여야 한다.\r\n    (a) 해당 절차와 예외를 보존한다.\r\n`).join('');
  fs.writeFileSync(standardFile, body);
  const first = buildSourceCatalog({ repoDir: temp });
  const packet = createSourcePacket({ topicId: '13', catalog: first });
  assert.equal(packet.units.length, 16);
  assert.equal(packet.completeness, 'complete');
  assert.ok(packet.primary[0].quote.includes('\r\n'));
  fs.writeFileSync(standardFile, `\r\n${body}`);
  const moved = buildSourceCatalog({ repoDir: temp });
  assert.deepEqual(moved.units.map((unit) => unit.id), first.units.map((unit) => unit.id));
  assert.deepEqual(moved.units.map((unit) => unit.contentHash), first.units.map((unit) => unit.contentHash));
  assert.notEqual(moved.fingerprint, first.fingerprint);
  fs.writeFileSync(registryFile, JSON.stringify({ ...catalog.registry, editionPolicy: '추가 판본 확인 필요' }));
  assert.notEqual(buildSourceCatalog({ repoDir: temp }).fingerprint, moved.fingerprint);
  for (const directory of ['03_문제연습', '04_기출문제']) {
    fs.mkdirSync(path.join(temp, learning, directory), { recursive: true });
    fs.writeFileSync(path.join(temp, learning, directory, 'long.md'), `## 원문 페이지 1\n${'완전한 사례와 해설. '.repeat(2000)}`);
  }
  fs.writeFileSync(path.join(temp, learning, '00_통합_목차.md'), '## 공통 분류체계\n### 13. 서비스조직\n  - `03_문제연습/long.md`: 1\n  - `04_기출문제/long.md`: 1\n');
  const limited = createSourcePacket({ repoDir: temp, topicId: '13', maxChars: packet.charCount + 1000 });
  assert.equal(limited.supporting.length, 0);
  assert.equal(limited.units.length, 16);
  assert.equal(limited.warnings.filter((warning) => warning.includes('문자 예산')).length, 2);
  assert.equal(fs.existsSync(path.join(temp, 'cpa_uploader/data/questions_v3.json')), false);
});
