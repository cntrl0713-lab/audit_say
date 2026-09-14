import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const R='cpa_uploader/analysis/reviews/case-additional-2026-09-14',D='cpa_uploader/drafts/case-additional-2026-09-14';
assert(!fs.existsSync(R+'/execution-v1'),'Evidence must be complete before first runtime freeze');
const file=R+'/draft-evidence.json',rows=JSON.parse(fs.readFileSync(file));
const extras=[D+'/a/validation.json',D+'/a/integration-review.json',D+'/b-peer-review.json',
 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',
 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf',
 'cpa_uploader/raw/collections/2026-09-14-case-additional/manifest.json',
 'cpa_uploader/raw/originals/case-additional-2026-09-14/kicpa-audit-standards-index.html'];
for(const f of extras){assert(!rows.some(r=>r.file===f));rows.push({file:f,sha256:createHash('sha256').update(fs.readFileSync(f)).digest('hex')});}
fs.writeFileSync(file,JSON.stringify(rows,null,2)+'\n');
console.log({frozen_draft_evidence_files:rows.length});
