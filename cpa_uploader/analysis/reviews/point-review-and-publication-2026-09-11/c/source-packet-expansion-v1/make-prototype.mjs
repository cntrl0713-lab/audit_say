import fs from 'node:fs';
import {createHash} from 'node:crypto';
const out='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/source-packet-expansion-v1';
const originalFile='cpa_uploader/questionSourceCatalog.mjs',original=fs.readFileSync(originalFile,'utf8');
const sha=x=>createHash('sha256').update(x).digest('hex');
const sourceFile='cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt';
const fileHash=sha(fs.readFileSync(sourceFile));
const assignments=[
 {file:sourceFile,source_hash:fileHash,standard:'KGA 402',from_paragraph:'12',owner_paragraph:'9',footnote_number:'3',footnote_text:'3 감사기준서 315 문단 9',owner_callout:'감사기준서 315 3'},
 {file:sourceFile,source_hash:fileHash,standard:'KGA 402',from_paragraph:'12',owner_paragraph:'10',footnote_number:'4',footnote_text:'4 감사기준서 315 문단 26(a)',owner_callout:'4 (서비스조직이 처리한 거래에 적용되는 이용자기업의 관련 통제 포함)'},
 {file:sourceFile,source_hash:fileHash,standard:'KGA 402',from_paragraph:'12',owner_paragraph:'10',footnote_number:'5',footnote_text:'5 감사기준서 315 문단 26(d)',owner_callout:'판단하여야 한다.5'},
];
fs.writeFileSync(`${out}/reference-footnotes-proposal.json`,JSON.stringify(assignments,null,2)+'\n');
const helper=String.raw`
// Confirmed PDF footnote ownership affects reference inference only. Source
// quotations, offsets, identifiers and hashes retain their original bytes.
function referenceTextsWithFootnotes(units, sources, assignments = []) {
  const result = new Map(units.map((unit) => [unit.id, unit.quote]));
  for (const assignment of assignments) {
    const source = sources.find((entry) => entry.file === assignment.file);
    if (!source) continue; // Registry entries outside a bounded fixture catalog.
    if (source.contentHash !== assignment.source_hash) throw new Error('각주 귀속의 출처 해시가 변경되었습니다: ' + assignment.file);
    const matching = (paragraph) => units.filter((unit) => unit.file === assignment.file
      && unit.standard === assignment.standard && unit.paragraph === paragraph && !inAppendix(unit));
    const from = matching(assignment.from_paragraph), owners = matching(assignment.owner_paragraph);
    if (from.length !== 1 || owners.length !== 1 || from[0].id === owners[0].id)
      throw new Error('각주 귀속 문단을 고유하게 확인할 수 없습니다: ' + assignment.file);
    const body = assignment.footnote_text;
    const input = result.get(from[0].id);
    if (!body || input.indexOf(body) < 0 || input.indexOf(body) !== input.lastIndexOf(body)
      || !assignment.owner_callout || !owners[0].quote.includes(assignment.owner_callout))
      throw new Error('각주 본문·호출 원문의 확인이 필요합니다: ' + assignment.file);
    result.set(from[0].id, input.replace(body, ''));
    result.set(owners[0].id, result.get(owners[0].id) + '\n' + body);
  }
  return result;
}
`;
let patched=original;
const oldHeading="const match = heading.match(/^(?:KGA|감사기준서)\\s*(\\d{3,4})\\b/u);";
const newHeading="const match = heading.match(/^(?:KGA|감사기준서)\\s*(\\d{3,4})(?=\\s|:|$)/u);";
if(!patched.includes(oldHeading))throw Error('Heading anchor changed');patched=patched.replace(oldHeading,newHeading);
patched=patched.replace('export function buildSourceCatalog({ repoDir = DEFAULT_ROOT } = {}) {',helper+'\nexport function buildSourceCatalog({ repoDir = DEFAULT_ROOT } = {}) {');
const oldReferences="  for (const unit of units.filter((entry) => entry.kind === 'standard')) {\r\n    const references = paragraphReferences(unit.quote, unit.standard);";
const oldRefLF=oldReferences.replaceAll('\r\n','\n');
const referenceNew="  const referenceTexts = referenceTextsWithFootnotes(units, sources, registry.referenceFootnotes || []);\n  for (const unit of units.filter((entry) => entry.kind === 'standard')) {\n    const references = paragraphReferences(referenceTexts.get(unit.id), unit.standard);";
if(patched.includes(oldReferences))patched=patched.replace(oldReferences,referenceNew);else if(patched.includes(oldRefLF))patched=patched.replace(oldRefLF,referenceNew);else throw Error('Reference anchor changed');
// This core patch source retains production paths. It is not imported/executed.
fs.writeFileSync(`${out}/questionSourceCatalog.proposed-core.mjs.txt`,patched);
// The executable prototype changes only its fixture root and injects the proposed
// registry field from this owned folder. Those are harness changes, not core advice.
const prototype=patched.replace("const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');","const DEFAULT_ROOT = process.cwd();")
 .replace('const registry = JSON.parse(registryText);',`const registry = {...JSON.parse(registryText), referenceFootnotes: JSON.parse(fs.readFileSync('${out}/reference-footnotes-proposal.json', 'utf8'))};`);
fs.writeFileSync(`${out}/questionSourceCatalog.prototype.mjs`,prototype);
fs.writeFileSync(`${out}/prototype-inputs.json`,JSON.stringify({original_core:originalFile,original_core_sha256:sha(original),proposed_core_sha256:sha(patched),prototype_sha256:sha(prototype),registry_assignments:assignments,api_calls:0,core_mutations:0},null,2)+'\n');
console.log(JSON.stringify({original_sha256:sha(original),prototype_file:`${out}/questionSourceCatalog.prototype.mjs`,assignments:assignments.length},null,2));
