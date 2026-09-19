// 커밋 전에 불필요한 사본을 저장소 밖 보관 폴더로 옮긴다(삭제하지 않음). publication/archive.mjs(2026-09-15)의 기준을 따른다.
// 남기는 것: 승급 장부의 모든 효율 검수 receipt 검증(수락 batch → 채점 manifest → 은행 사본·분류·입력·관측·실행 코드·검토 증거)이 직접 읽는 파일,
//   현재 정본 분류 카탈로그의 분류 입력, 운영 DB 반영 기록(stage/db-readiness.json 등), coverage·정본·wiki 같은 현재 자료가 가리키는 파일, README·도구·로그·장부·완료 기록.
// 옮기는 것(아직 커밋되지 않은 사본만):
//   - 대체된 판본 실행의 전체 은행 사본: r10 v1의 후보 은행·분류·카탈로그(현재 판본 v3는 부분 은행으로 실측)
//   - 운영 반영이 끝난 r05·r06 게시의 stage·baseline·후보·정본 카탈로그 사본, coverage 반영 전 사본, DB 전송 payload·SQL 사본
//   - 운영 반영이 끝난 pilot-01-005 게시(2026-09-18)의 stage·backup·정본 카탈로그 사본
// r07~r11 게시의 사본은 처음부터 커밋하지 않는 tmp/에 두었으므로 대상이 아니다.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r07-r11/archive.mjs --plan|--apply
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';

const B = 'cpa_uploader/analysis/reviews/case-review-2026-09-15', P = B + '/publication-r07-r11', Q = 'cpa_uploader/analysis/reviews/pilot-01-005-comprehensive-2026-09-18';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8')), hash = (b) => createHash('sha256').update(b).digest('hex');
const rel = (f) => path.relative(process.cwd(), path.resolve(f)).split(path.sep).join('/');
const mode = process.argv[2]; assert(['--plan', '--apply'].includes(mode)); assert.equal(process.argv.length, 3);
const ARCHIVE_ROOT = path.resolve('..', 'audit_say-archive', 'copies-2026-09-19'), OUT = 'cpa_uploader/analysis/reviews/copy-archive-2026-09-19.json';
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated', 'Archive only after the canonical install');
assert.equal(read(B + '/publication-r05-r06/db-import/publication-v2/completion.json').status, 'production_published_and_independently_verified', 'r05·r06 DB copies only after that production publication');
assert.equal(read(Q + '/publication-v1/install-completion.json').status, 'canonical_installed_and_validated', 'pilot-01-005 copies only after that canonical install');

// 1. 보호 목록: 승급 장부의 모든 효율 검수 batch에서 시작해 receipt 검증이 읽는 파일을 모은다.
const protectedFiles = new Set(), add = (f) => { if (typeof f === 'string' && f) protectedFiles.add(rel(f)); };
const ledger = read('cpa_uploader/data/cpa_question_sets_v3.promotions.json');
const batchFiles = [...new Set(ledger.entries.filter((e) => e.efficient_review?.batch?.file).map((e) => e.efficient_review.batch.file))];
for (const batchFile of batchFiles) {
    const batch = read(batchFile); add(batchFile); add(batch.authorization?.evidence?.file);
    const manifestFile = batch.grading_manifest?.file; add(manifestFile);
    const manifest = manifestFile ? read(manifestFile) : {};
    for (const r of [manifest.bank, manifest.classifications, manifest.policy, ...(manifest.inputs ?? []), ...(manifest.code_files ?? [])]) add(r?.file);
    for (const e of manifest.entries ?? []) { add(e.projected_file); for (const s of e.selection_evidence ?? []) add(s.file); }
    for (const o of batch.observations ?? []) { add(o.file); if (fs.existsSync(o.file)) for (const f of Object.values(read(o.file).files ?? {})) add(f?.file); }
    for (const s of batch.runtime_snapshots ?? []) add(s.file);
    for (const review of batch.agent_reviews ?? []) for (const e of review.evidence ?? []) add(e.file);
    if (manifest.policy?.file && fs.existsSync(manifest.policy.file)) add(read(manifest.policy.file).scope?.file);
}
for (const f of [...protectedFiles]) if (f.endsWith('.json') && fs.existsSync(f) && fs.statSync(f).size < 5_000_000) { const v = read(f); if (typeof v?.review_file === 'string') add(v.review_file); }
add(read('cpa_uploader/data/learning-question-classifications.json').review_file);

// 2. 후보: 아직 커밋되지 않은 사본 성격의 파일만 고른다.
const untracked = new Set(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z', '--', B, Q], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8').split('\0').filter(Boolean));
const patterns = [
    { re: /^cpa_uploader\/analysis\/reviews\/case-review-2026-09-15\/r10\/(candidate|catalog|classification)-v1\.json$/, category: 'superseded_run_bank_or_classification_copy' },
    { re: /^cpa_uploader\/analysis\/reviews\/case-review-2026-09-15\/publication-r05-r06\/(candidate\.json|canonical-catalog\.json|canonical-classification-review\.json|coverage-links-before\.json|baseline\/[^/]+\.json|stage\/(authoring|promotions|public|encrypted|learning-catalog|learning-classification-review)\.json)$/, category: 'publication_stage_baseline_or_candidate_copy' },
    { re: /^cpa_uploader\/analysis\/reviews\/case-review-2026-09-15\/publication-r05-r06\/db-import\/preparation-v[12]\/(replace-pack\.json|guarded-import\.sql|probe\.sql)$/, category: 'db_payload_or_sql_copy' },
    { re: /^cpa_uploader\/analysis\/reviews\/pilot-01-005-comprehensive-2026-09-18\/publication-v1\/(canonical-catalog\.json|canonical-classification-review\.json|backup\/[^/]+\.json|stage\/(authoring|promotions|public|encrypted|catalog|classification-review)\.json)$/, category: 'publication_stage_backup_or_catalog_copy' },
];
// 참조 검사: 사본 경로를 적은 파일을 찾는다. 현재 자료(정본·coverage·분석 입력·wiki·릴리스·correction)가 가리키면 옮기지 않는다.
const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [rel(path.join(dir, e.name))]) : [];
const LIVE = /^(cpa_uploader\/data\/|data\/|cpa_uploader\/analysis\/coverage\/|cpa_uploader\/analysis\/question-elements\/|cpa_uploader\/wiki\/|cpa_uploader\/releases\/|cpa_uploader\/corrections\/)/;
const scanRoots = [B, Q, 'cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19', 'cpa_uploader/releases', 'cpa_uploader/corrections', 'cpa_uploader/analysis/coverage', 'cpa_uploader/data', 'data', 'cpa_uploader/wiki'];
const scanned = scanRoots.flatMap(walk).filter((f) => /\.(json|md|mjs|mts|ts)$/.test(f) && fs.statSync(f).size <= 8_000_000).map((f) => [f, fs.readFileSync(f, 'utf8')]);
const referencedBy = (file) => scanned.filter(([f, text]) => f !== file && text.includes(file)).map(([f]) => f);
const candidates = [...untracked].sort().flatMap((file) => { const m = patterns.find((p) => p.re.test(file)); return m ? [{ file, category: m.category }] : []; });
const skipped = [], rows = [];
for (const c of candidates) {
    const refs = referencedBy(c.file);
    if (protectedFiles.has(c.file)) { skipped.push({ file: c.file, reason: 'receipt_or_catalog_input' }); continue; }
    const live = refs.filter((f) => LIVE.test(f)); if (live.length) { skipped.push({ file: c.file, reason: 'referenced_by_current_data', referenced_by: live }); continue; }
    const bytes = fs.readFileSync(c.file); rows.push({ file: c.file, size: bytes.length, sha256: hash(bytes), category: c.category, referenced_by: refs });
}
const summary = { moved_files: rows.length, bytes: rows.reduce((n, r) => n + r.size, 0), protected_files_checked: protectedFiles.size, ledger_batches: batchFiles.length, skipped };
if (mode === '--plan') { console.log(JSON.stringify({ ...summary, rows: rows.map((r) => [r.file, r.size, r.category, r.referenced_by.length]) }, null, 2)); process.exit(0); }

assert(!fs.existsSync(OUT), 'Archive already recorded');
for (const r of rows) {
    const target = path.join(ARCHIVE_ROOT, r.file); assert(!fs.existsSync(target), 'Archive target exists: ' + target);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(r.file, target, fs.constants.COPYFILE_EXCL);
    assert.equal(hash(fs.readFileSync(target)), r.sha256, 'Archive copy differs: ' + r.file); fs.unlinkSync(r.file);
}
const removedDirs = [];
for (const d of [B + '/publication-r05-r06/baseline', Q + '/publication-v1/backup']) if (fs.existsSync(d) && fs.readdirSync(d).length === 0) { fs.rmdirSync(d); removedDirs.push(d); }
// 옮긴 뒤에도 정본 검증에는 영향이 없어야 한다.
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'); assert.deepEqual(validateAuthoringBank(bank).errors, []);
fs.writeFileSync(OUT, JSON.stringify({ version: 1, created_at: new Date().toISOString(), action: 'moved_out_of_repository_not_deleted',
    archive_location: 'C:/Users/cntrl/Workspace/study/audit_say-archive/copies-2026-09-19 (같은 상대 경로. 로컬 전용, 저장소에 없음)',
    authorization: `2026-09-19 사용자 지시: 두 초안을 그대로 두고 전체 운영DB 대체 및 커밋 푸시 진행. ${P}/authorization.md. 사본은 커밋하지 않고 보관 폴더로 옮긴다는 기준은 2026-09-14·09-15 사용자 확인(“불필요한 파일 정리 후 커밋·푸시”)을 따른다.`,
    criteria: { kept: '승급 장부의 모든 효율 검수 receipt 검증이 직접 읽는 파일(수락 batch, 채점 manifest, 은행 사본·분류·입력·관측·실행 코드·검토 증거), 현재 정본 분류 카탈로그의 분류 입력, 현재 자료(정본·coverage·wiki·릴리스·correction)가 가리키는 파일, DB 준비 보고서, README·도구·로그·장부·완료/receipt/검증 기록, wiki 퇴역 페이지 보존본은 남겼다.',
        moved: '대체된 r10 v1 실행의 전체 은행·분류·카탈로그 사본, 운영 반영이 끝난 r05·r06 게시의 stage·baseline·후보·정본 카탈로그 사본과 coverage 반영 전 사본·DB 전송 payload와 SQL, 운영 반영이 끝난 pilot-01-005 게시의 stage·backup·정본 카탈로그 사본.' },
    recovery: 'r05·r06 stage의 은행 원문은 운영 release 31504e78의 source_document와 같고, pilot-01-005 stage는 그 뒤 기준서형 검토 반영(release c43c59e4) 이전의 로컬 정본이었다. baseline·backup은 각 설치 직전 정본의 사본이다. 옮긴 파일의 정확한 바이트가 필요하면 보관 폴더에서 같은 경로로 되돌리고 아래 SHA-256으로 확인한다.',
    effect: '옮긴 파일을 가리키는 과거 실행·게시·DB 준비 기록(r10 v1 manifest, r05·r06 stage-completion.json·baseline.json·db-import 준비 기록, pilot-01-005 install-completion.json 등)은 보관 폴더 없이는 파일 해시를 다시 확인할 수 없다. 현재 정본 검증·앱·운영 DB와 r07~r11 운영 반영 도구(db-import)는 이 사본을 읽지 않는다.',
    ...summary, removed_empty_dirs: removedDirs, rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ moved_files: summary.moved_files, bytes: summary.bytes, skipped: skipped.length }));
