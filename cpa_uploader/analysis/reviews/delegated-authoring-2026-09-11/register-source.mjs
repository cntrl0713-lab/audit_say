import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';

const [input, output, label, provenanceNote] = process.argv.slice(2);
const sourceRoot = path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11') + path.sep;
const officialRoot = path.resolve('cpa_uploader/data/official') + path.sep;
if (!input || !output || !label || !/^[a-z0-9-]+$/.test(label)
    || !path.resolve(input).startsWith(sourceRoot) || !path.resolve(output).startsWith(officialRoot)
    || !path.basename(output).startsWith('delegated-')) throw Error('배정 폴더의 발췌와 delegated 공식 파일·기록 이름 필요');
const sha = value => createHash('sha256').update(value).digest('hex');
const bytes = fs.readFileSync(input);
const body = bytes.toString('utf8');
const prefix = `출처 등록일: 2026-09-11. 원본 전사: ${input}\n원본 파일 SHA-256: ${sha(bytes)}\n${provenanceNote ? provenanceNote + '\n' : ''}본문 바이트의 UTF-8 전사는 아래에 그대로 보존했다. 판본·범위·공식 URL은 발췌의 출처 기록을 따른다.\n\n`;
const registered = prefix + body;
fs.writeFileSync(output, registered, { flag: 'wx' });
const catalog = buildSourceCatalog();
const units = catalog.units.filter(unit => unit.file === output.replaceAll('\\','/'))
    .map(({id,file,standard,paragraph,topicIds,locator,contentHash}) => ({id,file,standard,paragraph,topicIds,locator,contentHash}));
const record = { created_at: new Date().toISOString(), input, input_sha256: sha(bytes), output,
    output_sha256: sha(Buffer.from(registered)), body_preserved: true, catalog_fingerprint: catalog.fingerprint, units };
const manifest = `cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/source-registration-${label}.json`;
fs.writeFileSync(manifest, JSON.stringify(record,null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify({manifest, output, units: units.length}));
