import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
const sources = [`${base}/c/raw-source-inventory-v1/candidates.json`, `${base}/a/raw-crosscheck-v1/candidates.json`];
const entries = new Map();
for (const file of sources) for (const entry of read(file).entries) {
  if (/raw-collector-validation|fixture-run-|learning-unit-runner-fixtures/u.test(entry.original_path)) throw new Error('Synthetic fixture in source selection');
  if (entries.has(entry.original_path)) throw new Error(`Overlapping inventory entry: ${entry.original_path}`);
  entries.set(entry.original_path, entry);
}
const recoveryFile = `${base}/raw-collection-v1/recovery.json`;
for (const item of read(recoveryFile).entries) {
  if (item.status !== 'historical_bytes_recovered') throw new Error('Unresolved historical original');
  entries.set(item.saved_path, { original_path: item.saved_path, category: 'verification',
    role: '기록된 원 URL에서 재확보한 공식 원본; 과거 SHA-256과 바이트 일치',
    sha256: item.sha256, bytes: item.bytes, content_form: 'recovered_original_document',
    historical_path: item.historical_path, documented_urls: [item.url], retrieved_at: item.retrieved_at,
    historical_identity: 'exact_sha256_match', provenance_records: [{ file: recoveryFile, sha256: hash(fs.readFileSync(recoveryFile)) },
      { file: item.historical_record, sha256: hash(fs.readFileSync(item.historical_record)) }] });
}
const urlRecoveryFile = `${base}/raw-collection-v1/url-only-recovery.json`;
const urlRecovery = read(urlRecoveryFile);
entries.set(urlRecovery.original_path, { ...urlRecovery, content_form: 'newly_retrieved_url_only_source',
  provenance_records: [{ file: urlRecoveryFile, sha256: hash(fs.readFileSync(urlRecoveryFile)) }] });
for (const file of [recoveryFile, urlRecoveryFile]) entries.set(file, { original_path: file, category: 'verification', role: '추가 확보 원본의 취득·기존 해시 대조 기록', sha256: hash(fs.readFileSync(file)), content_form: 'source_provenance_record' });
const sorted = [...entries.values()].sort((a, b) => a.original_path.localeCompare(b.original_path));
for (const entry of sorted) if (hash(fs.readFileSync(entry.original_path)) !== entry.sha256) throw new Error(`Source changed: ${entry.original_path}`);
const catalog = buildSourceCatalog();
const missing = catalog.sources.filter(source => !entries.has(source.file));
if (missing.length) throw new Error(`Catalog files missing: ${missing.map(source => source.file)}`);
const exclusions = read(`${base}/c/raw-source-inventory-v1/exclusions.json`).groups.filter(entry => !entry.path.includes('cpa_question_sets_v3.*.json'));
exclusions.push({ path: '원본 교재 PDF 8권', reason: '사용자 확정: 통합학습자료 자체가 기반이고 PDF는 필요 없음. 미보관 결함이 아닌 범위 제외.' },
  { path: '공개 문제은행·승급 ledger 및 코드·생성 wiki 페이지', reason: '생성 산출물·실행 구현은 기존 소유 위치 유지. 편집 정본·실제 wiki 입력은 시점 사본으로 별도 수집.' },
  { path: `${base}/b/raw-collector-validation-v1/fixture-run-*`, reason: '합성 프로그램 테스트 fixture; 회계감사 원자료 아님.' });
const inventory = { version: 1, prepared_at: new Date().toISOString(),
  scope: '통합학습자료 자체를 기반으로 한 wiki 입력과 제작·검증에 사용한 원자료, 공식 원문, 추출본·페이지 이미지·출처 계보. 과거 인용 경로와 바이트 유지.',
  input_inventories: sources.map(file => ({ file, sha256: hash(fs.readFileSync(file)) })),
  catalog_coverage: { files: catalog.sources.length, units: catalog.units.length, missing_files: [] },
  missing: [], excluded: exclusions,
  provenance_notes: [
    '기존 보존 경로의 취득일·내용 검토일은 수집 시각으로 바꾸지 않았다.',
    '과거 누락 공식 원본 4개는 원 URL에서 재확보하여 기록된 SHA-256과 일치함을 확인했다.',
    'URL만 기록된 ISA800 국제기준 PDF는 현재 확보본이며 과거 원본과의 바이트 동일성은 확인할 수 없다. 국내 기준서 판본 승인에 사용하지 않는다.',
    '다운로드 실패 응답·빈 추출 결과를 보존했어도 원문 확보로 간주하지 않는다. 개별 content_form·역할·원기록을 확인한다.',
    'JSON·mjs에 들어 있는 수동 원발문 입력과 실제 wiki가 읽은 은행·초안·과거 검토 JSON은 wiki-input 시점 사본이다. 현행 정본이나 공식 기준서로 대체하지 않는다.',
  ], entries: sorted };
const target = `${base}/raw-collection-v1/selection.json`;
fs.writeFileSync(target, JSON.stringify(inventory, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ entries: sorted.length, bytes: sorted.reduce((n, entry) => n + fs.statSync(entry.original_path).size, 0), catalog_files: catalog.sources.length, selection: target }));
