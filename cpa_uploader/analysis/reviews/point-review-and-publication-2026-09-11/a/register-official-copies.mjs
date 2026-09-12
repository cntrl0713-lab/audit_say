import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/';
const prior = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/';
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = file => hashBytes(fs.readFileSync(file));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const lf = value => value.replaceAll('\r\n', '\n');
const noSpace = value => value.replace(/\s+/gu, '');
const originalEvidence = base + 'a/source-evidence.txt';
const eOfficial = prior + 'e-official.txt';
const raw2025File = prior + 'kga-2025-pymupdf-pages.txt';
const raw2025 = lf(fs.readFileSync(raw2025File, 'utf8'));
const official330File = 'cpa_uploader/data/official/kga315-330-2025-review06.txt';
const official330 = lf(fs.readFileSync(official330File, 'utf8'));
const pdf = prior + 'kga-2025.pdf';
const pdf2026 = prior + 'kga-2026-full.pdf';
const url = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';
const sets = read(base + 'a/sets.json');
const all = read(base + 'prepared-reviewed-v1/candidate-authoring.json');
const frozen = ['sets.json', 'audit.json', 'qa.json', 'validation.json', 'handoff.md', 'source-evidence.txt'].map(file => ({ file: base + 'a/' + file, sha256: hashFile(base + 'a/' + file) }));
const aRefs = [...new Map(sets.flatMap(set => set.source_refs).filter(ref => ref.file === originalEvidence).map(ref => [ref.id, ref])).values()];
const sourceValidation = aRefs.map(ref => {
  const direct = raw2025.includes(lf(ref.source_quote));
  const via330 = ref.id === 'src-point-a-330-8' && official330.includes(lf(ref.source_quote));
  if (!direct && !via330) throw new Error('Official excerpt missing: ' + ref.id);
  return { source_ref_id: ref.id, quote_sha256: hashBytes(ref.source_quote), source_file: direct ? raw2025File : official330File, source_file_sha256: hashFile(direct ? raw2025File : official330File), exact_after_line_ending_normalization: true, direct_2025_pdf_extraction_nonwhitespace_equal: noSpace(raw2025).includes(noSpace(ref.source_quote)), original_evidence_contains_after_line_ending_normalization: lf(fs.readFileSync(originalEvidence, 'utf8')).includes(lf(ref.source_quote)) };
});
const pages710 = [...lf(fs.readFileSync(eOfficial, 'utf8')).matchAll(/## PDF page (\d+)\n([\s\S]*?)(?=\n## PDF page|$)/gu)].map(match => {
  const body = match[2].trimEnd();
  if (!raw2025.includes(body)) throw new Error('710 original page mismatch: ' + match[1]);
  return { page: Number(match[1]), body_sha256_after_lf: hashBytes(body), exact_in_raw_2025_after_line_ending_normalization: true };
});
const copies = [
  { original: originalEvidence, target: 'cpa_uploader/data/official/point-review-a-supplement-2026-09-11.txt', scope: 'KGA 220.14, 200.13(e)/A47/A49, 210.6/8/19, 330.8의 기존 공식 전사 전체; 330.8은 기존 official/kga315-330-2025-review06.txt 직접 인용 대조', original_extra: '출처 대조: 8개 직접 인용의 실제 원전 포함을 등록 증거에 기록. 330.8은 원전 PDF와 비공백 문자가 같고 기존 공식 전사와 줄바꿈 정규화 후 정확히 같다.' },
  { original: eOfficial, target: 'cpa_uploader/data/official/point-review-710-appendix-2026-09-11.txt', scope: 'KGA 710 실제 원문 PDF 787/789/790/791/792 및 보론 사례 1/2/3 가정 PDF 794/797/800 전체; 대응수치·비교재무제표의 적용 범위를 구별', original_extra: '출처 대조: e-source-evidence.json의 2025/2026 페이지 대조 이력 보존; 이번 등록에서는 전체 8개 페이지 본문이 2025 공식 원전 추출에 실제 포함됨을 독립 확인.' },
];
for (const copy of copies) {
  if (fs.existsSync(copy.target)) throw new Error('Do not overwrite existing registered source: ' + copy.target);
  const bytes = fs.readFileSync(copy.original);
  const header = [
    '# 공식 전사 보존 사본 등록',
    '출처 등록일: 2026-09-11. 원본 발췌의 바이트는 아래에 그대로 보존했으며 새 제목·문장·쪽 문구를 원문 안에 합성하지 않았다.',
    '공식 출처: 회계감사기준 전문 2025년 11월 개정. URL ' + url,
    '출처 PDF SHA-256: ' + hashFile(pdf) + '; 실제 파일 ' + pdf,
    '출처 추출본 SHA-256: ' + hashFile(raw2025File) + '; 실제 파일 ' + raw2025File,
    '출처 원본 발췌: ' + copy.original + '; SHA-256 ' + hashBytes(bytes),
    '출처 적용 범위: ' + copy.scope,
    '확인된 기본 사례 가정: 2026-01-01 개시 보고기간, 2027 CPA 대비. 기존 edition-policy.md의 종전 품질관리 체계·판본 미지정 한계를 유지한다.',
    '출처 대조용 2026 전문 PDF SHA-256: ' + hashFile(pdf2026) + '; 기존 2026판 대조 기록을 보존하며 이번 사본 등록을 새 시험 판본 승인으로 표시하지 않는다.',
    copy.original_extra,
    '출처 보존: 페이지 표지와 각주로 카탈로그 단위가 나뉘면 실제 단위를 모두 연결한다. 사례의 일부 가정을 일반 의무로 확장하지 않는다.',
    '',
  ].join('\r\n') + '\r\n';
  fs.writeFileSync(copy.target, Buffer.concat([Buffer.from(header, 'utf8'), bytes]));
  copy.sha256 = hashFile(copy.target);
  copy.original_sha256 = hashBytes(bytes);
  copy.original_byte_offset = Buffer.byteLength(header, 'utf8');
  copy.original_bytes_preserved = fs.readFileSync(copy.target).subarray(copy.original_byte_offset).equals(bytes);
}
const catalog = buildSourceCatalog();
const outputUnits = catalog.units.filter(unit => copies.some(copy => copy.target === unit.file));
for (const unit of outputUnits) {
  if (unit.authority !== 'official_transcription' || hashBytes(unit.quote) !== unit.contentHash || !fs.readFileSync(unit.file, 'utf8').includes(unit.quote)) throw new Error('Catalog unit integrity: ' + unit.id);
}
const mappings = all.flatMap(set => set.source_refs.filter(ref => copies.some(copy => copy.original === ref.file)).map(ref => {
  const copy = copies.find(candidate => candidate.original === ref.file);
  const targetText = fs.readFileSync(copy.target, 'utf8');
  if (!lf(targetText).includes(lf(ref.source_quote))) throw new Error('Reference not contained in copy: ' + set.id + '/' + ref.id);
  const units = outputUnits.filter(unit => unit.file === copy.target && (noSpace(unit.quote).includes(noSpace(ref.source_quote)) || noSpace(ref.source_quote).includes(noSpace(unit.quote))));
  return { set_id: set.id, source_ref_id: ref.id, original_file: ref.file, registered_file: copy.target, original_quote_sha256: hashBytes(ref.source_quote), same_after_only_line_ending_normalization: true, actual_source_unit_ids: units.map(unit => unit.id), unit_coverage_note: units.length > 1 ? 'split_actual_units; inspect exact original quote spans; no synthetic concatenation' : units.length === 1 ? 'actual_unit_quote_contains_or_is_contained_in_original_quote' : 'manual_source_span_mapping_needed' };
}));
const changedFrozen = frozen.filter(item => hashFile(item.file) !== item.sha256);
if (changedFrozen.length) throw new Error('Frozen files changed');
const evidence = { version: 1, task: 'official_catalog_registration', api_calls: 0, copies, baseline_pdf: { file: pdf, sha256: hashFile(pdf), url }, source_validation: sourceValidation, pages_710: pages710, catalog_fingerprint: catalog.fingerprint, actual_catalog_units: outputUnits, source_ref_mappings: mappings, frozen_files: frozen, frozen_file_changes: changedFrozen, registry_or_common_code_changes: false, unfulfilled_mappings: mappings.filter(item => item.actual_source_unit_ids.length === 0) };
fs.writeFileSync(base + 'a/source-registration-evidence-2026-09-11.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ copies, units: outputUnits.map(unit => ({ id: unit.id, file: unit.file, paragraph: unit.paragraph, locator: unit.locator, chars: unit.quote.length })), mappings, unchanged: frozen.length }, null, 2));
