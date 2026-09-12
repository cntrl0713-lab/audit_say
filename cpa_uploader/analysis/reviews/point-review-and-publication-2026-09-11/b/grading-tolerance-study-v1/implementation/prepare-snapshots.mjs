import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const own = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(own, '../../../../../../..');
const files = ['questionReviewGrading.ts', 'questionSemanticReview.ts', 'questionBankPublication.ts', 'promote_cpa_v3.ts'];
const out = [];
for (const name of files) {
  const file = path.join(root, 'cpa_uploader', name); const bytes = fs.readFileSync(file);
  for (const folder of ['before', 'proposed']) {
    fs.mkdirSync(path.join(own, folder, 'cpa_uploader'), { recursive: true });
    fs.writeFileSync(path.join(own, folder, 'cpa_uploader', name + '.txt'), bytes, { flag: 'wx' });
  }
  out.push({ file: `cpa_uploader/${name}`, sha256: createHash('sha256').update(bytes).digest('hex') });
}
fs.writeFileSync(path.join(own, 'baseline.json'), JSON.stringify({ production_edits: 0, files: out }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ captured: out.length, production_edits: 0 }));
