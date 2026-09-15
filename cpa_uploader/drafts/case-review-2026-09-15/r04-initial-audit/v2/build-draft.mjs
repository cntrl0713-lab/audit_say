// r04 v2: KGA 300 발췌본 v2(판본 기록 줄 추가)에 맞춰 kga300-13 출처 제목의 줄 표시만 고친다. 나머지는 v1과 바이트까지 같아야 한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit/v2/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit';
const OUT = `${D}/v2`;
const FILE = 'cpa_uploader/data/official/case-review-2026-09-15-kga300.md';
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const [v1] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const set = structuredClone(v1);
const text = fs.readFileSync(FILE, 'utf8');
const ref = set.source_refs.find((r) => r.id === 'kga300-13');
assert.equal(ref.file, FILE);
const i = text.indexOf(ref.source_quote);
assert(i >= 0 && text.indexOf(ref.source_quote, i + 1) === -1, 'quote must occur exactly once in the v2 excerpt');
assert.equal(sha(ref.source_quote), ref.content_hash);
const first = text.slice(0, i).split('\n').length;
const span = `L${first}-L${first + ref.source_quote.split('\n').length - 1}`;
assert.equal(ref.title, 'KGA 300 문단 13, 2025 개정 전문 원문 PDF 182쪽; L11-L18');
ref.title = `KGA 300 문단 13, 2025 개정 전문 원문 PDF 182쪽; ${span}`;
set.verification.notes = [...v1.verification.notes,
    'v2: KGA 300 발췌본에 출처·확인일 두 줄을 더하고 문단 3의 소제목 “시행일”을 뺀 v2 등록본에 맞춰 kga300-13 출처 제목의 줄 표시만 고쳤다. 인용 원문·content_hash·사실관계·발문·모범답안·criterion은 v1과 같다.'];
const strip = (s) => { const c = structuredClone(s); c.source_refs.find((r) => r.id === 'kga300-13').title = ''; c.verification.notes = c.verification.notes.slice(0, 4); return JSON.stringify(c); };
assert.equal(strip(set), strip(v1), 'v2 may change only the kga300-13 title and add one note');
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/sets.json`, JSON.stringify([set], null, 2) + '\n');
console.log({ set: set.id, span, sha256: createHash('sha256').update(fs.readFileSync(`${OUT}/sets.json`)).digest('hex') });
