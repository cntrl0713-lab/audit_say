import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/a/';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const norm = text => text.replace(/\s+/gu, '');
const sets = read(base + 'sets.json');
const audit = read(base + 'audit.json');
const ids = new Set(audit.entries.filter(entry => entry.changed).map(entry => entry.set_id));
const catalog = buildSourceCatalog();
const allFiles = execFileSync('rg', ['--files', 'cpa_uploader'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim().split(/\r?\n/u).map(file => file.replaceAll('\\', '/'));
const planFiles = allFiles.filter(file => /(?:authoring[-.]?plan|(?:^|\/)plan(?:[.-][^/]*)?)\.json$/u.test(file));
const plans = planFiles.flatMap(file => {
  try { const value = read(file); return value.version === 1 && value.set_id && value.scope ? [{ file, sha256: hash(file), set_id: value.set_id, source_unit_ids: value.source_unit_ids, objective: value.objective, edition_assumption: value.edition_assumption }] : []; }
  catch { return []; }
});
const releaseMapFile = 'cpa_uploader/drafts/frequency-gap-2026-09-10/release/id-map.json';
const releaseMap = read(releaseMapFile);
const descriptor = unit => ({ source_unit_id: unit.id, file: unit.file, standard: unit.standard, paragraph: unit.paragraph, authority: unit.authority, locator: unit.locator, content_hash: unit.contentHash });
const entries = sets.filter(set => ids.has(set.id)).map(set => ({
  set_id: set.id,
  changed_subquestion_ids: audit.entries.filter(entry => entry.set_id === set.id && entry.changed).map(entry => entry.subquestion_id),
  existing_plans: plans.filter(plan => plan.set_id === set.id || releaseMap[plan.set_id] === set.id).map(plan => ({ ...plan, lineage: plan.set_id === set.id ? 'same_set_id' : 'release/id-map.json explicit mapping' })),
  source_refs: set.source_refs.map(ref => {
    const matches = catalog.units.filter(unit => norm(unit.quote).includes(norm(ref.source_quote)) || norm(ref.source_quote).includes(norm(unit.quote)));
    return { source_ref_id: ref.id, file: ref.file, title: ref.title, source_quote_sha256: createHash('sha256').update(ref.source_quote).digest('hex'), matches: matches.map(unit => ({ ...descriptor(unit), relation: norm(unit.quote).includes(norm(ref.source_quote)) ? 'source_quote_in_unit_after_whitespace_removal' : 'unit_is_only_part_of_source_quote' })) };
  }),
}));
const special = [
  { key: '220.14', ref_id: 'src-point-a-220-14', catalog_id: 'src-22d4cf170405148f88', interpretation: '공식 발췌와 학습자료 단위의 공백 제거 본문은 일치한다. authority는 학습자료로 보존하고 공식 발췌의 provenance를 함께 전달한다.' },
  { key: '200.A47', ref_id: 'src-point-a-200-a47', catalog_id: 'src-b852a4c5008940f9d2', interpretation: '카탈로그 학습자료는 축약형이다. 공식 본문의 주어진 수준의 감사위험이라는 조건과 예시가 없다. 같은 공식 인용 전체로 위장하지 않는다.' },
  { key: '200.A49', ref_id: 'src-point-a-200-a49', catalog_id: 'src-f4819c0ece002c0eb4', interpretation: '카탈로그 학습자료는 제거 불가·고유한계 핵심문장만 수록한다. 공식 추가 인용에는 앞선 300/330 설명 및 각주·PDF23쪽 머리말을 보존하여 strict 포함관계가 아니다.' },
  { key: '210.19', ref_id: 'src-point-a-210-19', catalog_id: 'src-2fceb4eefb2f173f13', interpretation: '공식 본문에는 각주 참조 7064 및 각주3/4·PDF37쪽 머리말이 삽입되어 strict 포함관계가 아니다. 학습자료 본문과 동일 조건을 담으나 그 문단은 문항03-004의 추가 득점 요구가 아닌 210.8(a)의 제외 문맥이다.' },
  { key: '240.39', ref_id: 'src240-39', catalog_id: 'src-4cd052b5b68ae2e2b6', interpretation: '동일 2025 공식 PDF 90–91쪽이다. 원문 중 PDF page 91/PDF PAGE 91 표지 대소문자와 공백만 다르고 등록 단위 끝에는 다음 절 표제 서면진술이 추가되어 있다. 원문·catalog 바이트는 유지하고 이 위치 차이를 근거로 수동 연결한다.' },
].map(item => {
  const refs = entries.flatMap(entry => entry.source_refs.filter(ref => ref.source_ref_id === item.ref_id).map(ref => ({ set_id: entry.set_id, ...ref })));
  const unit = catalog.units.find(candidate => candidate.id === item.catalog_id);
  const original = sets.flatMap(set => set.source_refs).find(ref => ref.id === item.ref_id);
  if (!unit || !original) throw new Error('Missing original/catalog ' + item.key);
  return { ...item, actual_catalog: descriptor(unit), referring_sets: refs.map(ref => ref.set_id), reference_file: original.file, reference_quote_sha256: createHash('sha256').update(original.source_quote).digest('hex'), whitespace_normalized_equal: norm(unit.quote) === norm(original.source_quote), display_marker_normalized_containment: norm(unit.quote.toLowerCase()).includes(norm(original.source_quote.toLowerCase())), official_quote: original.source_quote, catalog_quote: unit.quote };
});
const result = { version: 1, reviewer: 'plan_foundations', status: 'source_mapping_investigation_only', api_calls: 0, candidate_files_unchanged: true, sets_file: base + 'sets.json', sets_sha256: hash(base + 'sets.json'), catalog_fingerprint: catalog.fingerprint, searched_plan_files: planFiles.length, release_map: { file: releaseMapFile, sha256: hash(releaseMapFile) }, source_evidence: { file: base + 'source-evidence.txt', sha256: hash(base + 'source-evidence.txt') }, counts: { changed_sets: entries.length, sets_with_historical_plan: entries.filter(entry => entry.existing_plans.length > 0).length, sets_without_historical_plan_found: entries.filter(entry => entry.existing_plans.length === 0).length }, entries, special_comparisons: special, recommendation: '실제 source_unit_id만 계획에 사용한다. 공식 200.A47/A49·210.19 추가 발췌는 총괄의 별도 공식 등록 또는 실제 파일·인용·해시를 담은 명시적 수동 문맥 연결을 먼저 확정한다. 여기서 새 ID나 후속 계획을 만들지 않았다.' };
fs.writeFileSync(base + 'plan-source-investigation.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ counts: result.counts, special: special.map(item => ({ key: item.key, id: item.catalog_id, equal: item.whitespace_normalized_equal, markerNormalizedContained: item.display_marker_normalized_containment })), unmatched: entries.flatMap(entry => entry.source_refs.filter(ref => ref.matches.length === 0).map(ref => ({ set_id: entry.set_id, source_ref_id: ref.source_ref_id }))) }, null, 2));
