import fs from 'node:fs';
import { createHash } from 'node:crypto';
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/qa-tolerance-assessment-v1';
const file = `${base}/assess.ts`;
const record = JSON.parse(fs.readFileSync(`${base}/canary-assessment.json`, 'utf8'));
const expected = record.unchanged_input_files.find(row => row.file.replaceAll('\\', '/').endsWith('/qa-tolerance-assessment-v1/assess.ts')).sha256;
const current = fs.readFileSync(file, 'utf8');
const first = current
  .replace(/const requiredProducerCode = \[[\s\S]*?const loadedGraderPins = requiredProducerCode\.slice\(0, 5\)\.map\(identity\);\n/, '')
  .replaceAll('    loadedGraderPins.forEach(checkIdentity);\n', '')
  .replace("        assert.equal(params.model, 'gpt-5.6-luna', 'Replay model configuration differs');\n", '')
  .replace(/        for \(const code of requiredProducerCode\) \{[\s\S]*?assert\.equal\(inputs\.hashes\[job\.qa_file\], job\.qa_sha256\);\n/, '');
const actual = createHash('sha256').update(first).digest('hex');
if (actual !== expected) throw Error('Original source reconstruction differs from recorded hash');
fs.writeFileSync(`${base}/assess.initial.ts.txt`, first, { flag: 'wx' });
fs.writeFileSync(`${base}/initial-source-preservation.json`, JSON.stringify({ original_file: file, original_sha256: expected,
  preserved_file: `${base}/assess.initial.ts.txt`, preserved_sha256: actual,
  reason: 'Preserve the exact first assessor used for canary-assessment.json before additional identity guards and TypeScript fix.',
  original_assessment_modified: false }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ preserved_original_sha256: actual }));
