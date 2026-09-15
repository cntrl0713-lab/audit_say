// 불필요한 사본을 저장소 밖 보관 폴더로 옮긴다(삭제하지 않음). 2026-09-14 copy-archive 기준을 따른다.
// 남기는 것: 승급 장부의 새 receipt 검증(수락 batch → 채점 manifest → 은행 사본·분류·입력·관측·실행 코드·검토 증거)이 직접 읽는 파일,
//   현재 회차의 분류 검토 입력, 현재 정본 분류 카탈로그의 검토 파일, 운영 DB 반영이 읽는 기록(stage/db-readiness.json 등), README·도구·로그·장부·완료 기록.
// --plan|--apply       : 대체된 판본 실행의 후보 은행·분류·카탈로그 사본, 게시 stage·baseline·후보 사본(정본 설치 뒤, DB 반영 전에도 가능).
//                        DB 반영 도구는 이 사본 대신 설치 기록으로 같은 바이트임을 확인한 정본과 반영 전 커밋의 정본을 읽는다.
// --plan-db|--apply-db : 운영 DB 반영이 끝난 뒤 DB 전송 payload·SQL 사본.
//   node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication/archive.mjs --plan|--apply|--plan-db|--apply-db
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';

const B = 'cpa_uploader/analysis/reviews/case-review-2026-09-15', P = B + '/publication';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8')), hash = (b) => createHash('sha256').update(b).digest('hex');
const rel = (f) => path.relative(process.cwd(), path.resolve(f)).split(path.sep).join('/');
const mode = process.argv[2]; assert(['--plan', '--apply', '--plan-db', '--apply-db'].includes(mode)); assert.equal(process.argv.length, 3);
const db = mode.endsWith('-db'), apply = mode.startsWith('--apply');
const ARCHIVE_ROOT = path.resolve('..', 'audit_say-archive', 'case-review-2026-09-15'), OUT = `cpa_uploader/analysis/reviews/copy-archive-2026-09-15${db ? '-db' : ''}.json`;
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated', 'Archive only after the canonical install');
if (db) assert.equal(read(P + '/db-import/publication-v1/completion.json').status, 'production_published_and_independently_verified', 'Archive DB copies only after the production publication completes');

// 1. 보호 목록: 수락 batch에서 시작해 receipt 검증이 읽는 파일을 모두 모은다.
const protectedFiles = new Set();
const add = (f) => { if (f) protectedFiles.add(rel(f)); };
for (const round of read(P + '/plan.json').rounds) {
    const batchFile = `${P}/batches/${round.round}.json`, batch = read(batchFile); add(batchFile); add(batch.authorization.evidence.file); add(round.draft); add(round.classification);
    const manifest = read(batch.grading_manifest.file); add(batch.grading_manifest.file);
    for (const r of [manifest.bank, manifest.classifications, manifest.policy, ...manifest.inputs, ...manifest.code_files]) add(r.file);
    for (const e of manifest.entries) { add(e.projected_file); for (const s of e.selection_evidence) add(s.file); }
    for (const o of batch.observations) { add(o.file); const obs = read(o.file); for (const f of Object.values(obs.files ?? {})) if (f?.file) add(f.file); }
    for (const s of batch.runtime_snapshots) add(s.file);
    for (const review of batch.agent_reviews) for (const e of review.evidence) add(e.file);
    const policy = read(manifest.policy.file); if (policy.scope?.file) add(policy.scope.file);
}
// 보호 카탈로그가 가리키는 분류 검토 파일, 현재 정본 분류 카탈로그의 검토 파일, DB 반영 도구가 읽는 준비 보고서도 남긴다.
for (const f of [...protectedFiles]) if (f.endsWith('.json') && fs.existsSync(f) && fs.statSync(f).size < 5_000_000) { const v = read(f); if (typeof v?.review_file === 'string') add(v.review_file); }
add(read('cpa_uploader/data/learning-question-classifications.json').review_file);
add(P + '/stage/db-readiness.json');

// 2. 후보: 사본 성격의 파일만 고른다.
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [rel(path.join(dir, e.name))]);
const copyPattern = db ? [
    { re: /^cpa_uploader\/analysis\/reviews\/case-review-2026-09-15\/publication\/db-import\/preparation-v1\/(replace-pack\.json|guarded-import\.sql|probe\.sql)$/, category: 'db_payload_or_sql_copy' },
    { re: /^cpa_uploader\/analysis\/reviews\/case-review-2026-09-15\/publication\/db-migration\/(migration|guarded-migration)\.sql$/, category: 'db_payload_or_sql_copy' },
] : [
    { re: /^cpa_uploader\/analysis\/reviews\/case-review-2026-09-15\/r0\d\/(candidate|catalog|classification)-v\d+\.json$/, category: 'superseded_run_bank_or_classification_copy' },
    { re: /^cpa_uploader\/analysis\/reviews\/case-review-2026-09-15\/publication\/(candidate\.json|canonical-catalog\.json|coverage-links-before\.json|baseline\/[^/]+\.json|stage\/[^/]+\.json)$/, category: 'publication_stage_baseline_or_candidate_copy' },
];
const scanned = walk(B).filter((f) => /\.(json|md)$/.test(f) && fs.statSync(f).size <= 2_000_000).map((f) => [f, fs.readFileSync(f, 'utf8')]);
const referencedBy = (file) => scanned.filter(([f, text]) => f !== file && text.includes(file)).map(([f]) => f);
const rows = walk(B).flatMap((file) => { const m = copyPattern.find((p) => p.re.test(file)); if (!m || protectedFiles.has(file)) return [];
    const bytes = fs.readFileSync(file); return [{ file, size: bytes.length, sha256: hash(bytes), category: m.category, referenced_by: referencedBy(file) }]; });
const summary = { moved_files: rows.length, bytes: rows.reduce((n, r) => n + r.size, 0), protected_files_checked: protectedFiles.size };
if (!apply) { console.log(JSON.stringify({ ...summary, rows: rows.map((r) => [r.file, r.size, r.category, r.referenced_by.length]) }, null, 2)); process.exit(0); }

assert(!fs.existsSync(OUT), 'Archive already recorded');
for (const r of rows) {
    const target = path.join(ARCHIVE_ROOT, r.file); assert(!fs.existsSync(target), 'Archive target exists: ' + target);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(r.file, target, fs.constants.COPYFILE_EXCL);
    assert.equal(hash(fs.readFileSync(target)), r.sha256, 'Archive copy differs: ' + r.file); fs.unlinkSync(r.file);
}
const removedDirs = []; for (const d of [P + '/baseline']) if (fs.existsSync(d) && fs.readdirSync(d).length === 0) { fs.rmdirSync(d); removedDirs.push(d); }
// 옮긴 뒤에도 정본 검증에는 영향이 없어야 한다.
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'); assert.deepEqual(validateAuthoringBank(bank).errors, []);
fs.writeFileSync(OUT, JSON.stringify({ version: 1, created_at: new Date().toISOString(), action: 'moved_out_of_repository_not_deleted',
    archive_location: 'C:/Users/cntrl/Workspace/study/audit_say-archive/case-review-2026-09-15 (같은 상대 경로. 로컬 전용, 저장소에 없음)',
    authorization: db ? `2026-09-15 사용자 지시: 불필요한 파일은 아카이브에 넣고 운영DB 적용. ${P}/authorization.md`
        : `2026-09-15 사용자 지시: 불필요한 파일은 아카이브에 넣고 지적했던 문제들 대체해서 운영DB 적용 → 불필요한 파일 정리 후 커밋·푸시. ${P}/authorization.md`,
    criteria: db ? { kept: '운영 DB 반영 완료·왕복·독립 검증 기록, 퇴역 manifest, 로컬 복원 증명, 준비 기록, 마이그레이션 before/after·완료 기록은 남겼다.', moved: 'DB 전송 payload(replace-pack)·guarded/probe SQL, 마이그레이션 SQL 사본.' }
        : { kept: '새 receipt 검증(수락 batch → 채점 manifest → 은행 사본·분류·입력·관측·실행 코드·검토 증거)이 직접 읽는 파일, 현재 회차 초안·분류 검토 입력, 현재 정본 분류 카탈로그의 검토 파일, DB 준비 보고서(stage/db-readiness.json), README·도구·로그·장부·완료/receipt/검증 기록, wiki 퇴역 페이지 보존본은 남겼다.',
            moved: '대체된 판본 실행(r01 v1~v3, r02 v1, r03 v1, r04 v1)의 후보 은행·분류·카탈로그 사본, 게시 stage·baseline·후보 사본, coverage 반영 전 사본.' },
    recovery: db ? '적용한 SQL과 payload는 준비 기록의 SHA-256으로 확인한다. 최종 원문은 운영 DB의 active release source_document와 정본 은행에 있다. 옮긴 파일이 필요하면 보관 폴더에서 같은 경로로 되돌리고 아래 SHA-256으로 확인한다.'
        : 'stage의 은행·장부·공개본·암호화본·카탈로그는 설치된 정본과 같은 바이트다(install-completion.json). baseline 은행·장부와 coverage 반영 전 사본은 반영 전 커밋 76e8da75의 같은 경로 파일이다. 게시된 은행 원문은 운영 DB의 release source_document에도 남는다. 옮긴 파일의 정확한 바이트가 필요하면 보관 폴더에서 같은 경로로 되돌리고 아래 SHA-256으로 확인한다.',
    effect: db ? '옮긴 파일을 가리키는 DB 준비·반영 기록은 보관 폴더 없이는 파일 해시를 다시 확인할 수 없다. 운영 DB·정본 검증·앱에는 영향이 없다.'
        : '옮긴 파일을 가리키는 과거 실행·게시 기록(대체된 판본의 manifest, stage-completion.json, baseline.json 등)은 보관 폴더 없이는 파일 해시를 다시 확인할 수 없다. 현재 정본 검증·앱과 남은 운영 DB 반영 도구(db-import)는 이 사본을 읽지 않는다.',
    ...summary, removed_empty_dirs: removedDirs, rows }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary));
