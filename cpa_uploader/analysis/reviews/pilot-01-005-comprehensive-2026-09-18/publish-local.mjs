import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { publicationPaths, reviewedContentHash, validateAuthoringBank, withPublicationLock, writePublicationFiles } from '../../../questionBankPublication.ts';

const R = 'cpa_uploader/analysis/reviews/pilot-01-005-comprehensive-2026-09-18';
const REBIND = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c/rebind-final-catalog.ts';
const TARGET = 'pilot-01-005';
const out = `${R}/publication-v1`, stage = `${out}/stage`, backup = `${out}/backup`;
const canonical = { ...publicationPaths(), catalog: path.resolve('cpa_uploader/data/learning-question-classifications.json') };
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = (file) => ({ file, sha256: hash(fs.readFileSync(file)) });
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const mode = process.argv[2];
assert(['--stage', '--install'].includes(mode), 'Usage: publish-local.mjs --stage|--install');

const env = { ...process.env };
for (const key of Object.keys(env)) if (/OPENAI|ANTHROPIC|SUPABASE/i.test(key)) delete env[key];
delete env.NODE_OPTIONS;
const stagedEnv = {
  ...env,
  CPA_QUESTION_V3_AUTHORING_PATH: path.resolve(`${stage}/authoring.json`),
  CPA_QUESTION_V3_PROMOTIONS_PATH: path.resolve(`${stage}/promotions.json`),
  CPA_QUESTION_V3_PUBLIC_PATH: path.resolve(`${stage}/public.json`),
  CPA_QUESTION_V3_ENCRYPTED_PATH: path.resolve(`${stage}/encrypted.json`),
};
function run(id, args, environment, guard = () => {}) {
  guard();
  const log = `${out}/${id}.log`, fd = fs.openSync(log, 'wx');
  let result;
  const started = Date.now();
  try {
    result = spawnSync(process.execPath, ['--import', 'tsx', ...args], { cwd: process.cwd(), env: environment, shell: false, windowsHide: true, stdio: ['ignore', fd, fd] });
  } finally { fs.closeSync(fd); }
  write(`${out}/${id}.result.json`, { id, exit_code: result.status, signal: result.signal, elapsed_ms: Date.now() - started, log: ref(log) });
  assert.equal(result.status, 0, `${id} failed; inspect ${log}`);
  guard();
  console.log(`${id} passed`);
}

if (mode === '--stage') {
  assert(!fs.existsSync(out), 'Publication stage already exists');
  const baseline = read(`${R}/baseline-v1.json`);
  assert.equal(ref(canonical.authoring).sha256, baseline.bank.sha256, 'Canonical authoring changed during review');
  assert.equal(ref(canonical.catalog).sha256, baseline.catalog.sha256, 'Canonical catalog changed during review');
  fs.mkdirSync(stage, { recursive: true });
  fs.mkdirSync(backup, { recursive: true });
  const originals = Object.entries(canonical).map(([name, file]) => {
    const copy = `${backup}/${name}.json`;
    fs.copyFileSync(file, copy, fs.constants.COPYFILE_EXCL);
    return { name, ...ref(file), backup: copy };
  });
  const immutable = [`${R}/candidate-v1.json`, `${R}/classification-review-v1.json`, `${R}/batch-v1.json`, `${R}/receipt-v1.json`].map(ref);
  const guard = () => { for (const identity of [...originals, ...immutable]) assert.equal(ref(identity.file).sha256, identity.sha256, `Concurrent change: ${identity.file}`); };
  write(`${out}/preparation.json`, { prepared_at: new Date().toISOString(), originals, immutable, target: TARGET });
  const priorBank = read(canonical.authoring);
  const stagedBank = read(`${R}/candidate-v1.json`);
  const prior = priorBank.find((set) => set.id === TARGET);
  const target = stagedBank.find((set) => set.id === TARGET);
  assert(prior && target && prior.status === 'published' && prior.verification.review_status === 'verified');
  target.status = prior.status;
  target.verification.review_status = prior.verification.review_status;
  assert.deepEqual(validateAuthoringBank(stagedBank).errors, []);
  fs.writeFileSync(`${stage}/authoring.json`, `${JSON.stringify(stagedBank, null, 2)}\n`, { flag: 'wx' });
  fs.copyFileSync(canonical.ledger, `${stage}/promotions.json`, fs.constants.COPYFILE_EXCL);
  const evidence = `${R}/batch-v1.json`;
  run('01-reverify', ['cpa_uploader/promote_cpa_v3.ts', '--to', 'verified', '--sets', TARGET, '--efficient-review', evidence, '--evidence', evidence, '--reverify'], stagedEnv, guard);
  run('02-publish', ['cpa_uploader/promote_cpa_v3.ts', '--to', 'published', '--sets', TARGET, '--evidence', evidence], stagedEnv, guard);
  run('03-compile', ['scripts/compile-question-bank-v3.ts'], stagedEnv, guard);
  run('04-catalog', [REBIND, '--bank', `${stage}/authoring.json`, '--review', `${R}/classification-review-v1.json`, '--output', `${stage}/classification-review.json`, '--catalog-output', `${stage}/catalog.json`], stagedEnv, guard);
  run('05-validate', ['cpa_uploader/validate_cpa_v3.ts'], stagedEnv, guard);
  run('06-db-readiness', ['scripts/import-question-bank-v3.ts', '--learning-catalog', `${stage}/catalog.json`, '--report', `${stage}/readiness.json`], stagedEnv, guard);
  const final = read(`${stage}/authoring.json`), reviewed = read(`${R}/candidate-v1.json`);
  assert.deepEqual(final.map(reviewedContentHash), reviewed.map(reviewedContentHash));
  const finalTarget = final.find((set) => set.id === TARGET);
  assert.equal(finalTarget.status, 'published');
  assert.equal(finalTarget.verification.review_status, 'verified');
  const previousLedger = read(`${backup}/ledger.json`), nextLedger = read(`${stage}/promotions.json`);
  assert.deepEqual(nextLedger.entries.slice(0, previousLedger.entries.length), previousLedger.entries);
  assert.equal(nextLedger.entries.length - previousLedger.entries.length, 2);
  guard();
  write(`${out}/stage-completion.json`, {
    status: 'validated_isolated_published_stage', completed_at: new Date().toISOString(),
    files: ['authoring.json', 'promotions.json', 'public.json', 'encrypted.json', 'classification-review.json', 'catalog.json', 'readiness.json'].map((file) => ref(`${stage}/${file}`)),
    canonical_writes: 0, db_writes: 0, model_api_calls: 0,
  });
  process.exit(0);
}

const prep = read(`${out}/preparation.json`), completion = read(`${out}/stage-completion.json`);
assert.equal(completion.status, 'validated_isolated_published_stage');
assert(!fs.existsSync(`${out}/install-completion.json`));
const guardOriginal = () => {
  for (const identity of [...prep.originals, ...prep.immutable, ...completion.files]) assert.equal(ref(identity.file).sha256, identity.sha256, `Concurrent change: ${identity.file}`);
};
guardOriginal();
const expected = new Map(prep.originals.map((identity) => [identity.file, identity.sha256]));
const allowed = new Map(prep.originals.map((identity) => [identity.file, new Set([identity.sha256])]));
const guard = () => {
  for (const identity of [...prep.immutable, ...completion.files]) assert.equal(ref(identity.file).sha256, identity.sha256);
  for (const [file, sha256] of expected) assert.equal(ref(file).sha256, sha256, `Foreign edit: ${file}`);
};
const install = (writes) => {
  guard();
  for (const item of writes) allowed.get(item.file).add(hash(item.content));
  writePublicationFiles(writes, [...expected].map(([file, sha256]) => ({ file, hash: sha256 })));
  for (const item of writes) expected.set(item.file, hash(item.content));
  guard();
};
withPublicationLock(canonical.authoring, () => {
  guardOriginal();
  try {
    install(Object.entries({ authoring: 'authoring.json', ledger: 'promotions.json', public: 'public.json', encrypted: 'encrypted.json' })
      .map(([name, file]) => ({ file: canonical[name], content: fs.readFileSync(`${stage}/${file}`, 'utf8') })));
    run('07-canonical-catalog', [REBIND, '--bank', canonical.authoring, '--review', `${R}/classification-review-v1.json`, '--output', `${out}/canonical-classification-review.json`, '--catalog-output', `${out}/canonical-catalog.json`], env, guard);
    install([{ file: canonical.catalog, content: fs.readFileSync(`${out}/canonical-catalog.json`, 'utf8') }]);
    run('08-catalog-check', ['scripts/build-learning-unit-catalog.ts', '--check'], env, guard);
    run('09-canonical-validate', ['cpa_uploader/validate_cpa_v3.ts'], env, guard);
    write(`${out}/install-completion.json`, {
      status: 'canonical_installed_and_validated', completed_at: new Date().toISOString(),
      files: Object.values(canonical).map(ref), preserved_history: true, new_ledger_entries: 2,
      db_applied: false, model_api_calls: 0,
    });
  } catch (error) {
    let rollback = 'refused_foreign_change';
    if (prep.originals.every((identity) => allowed.get(identity.file).has(ref(identity.file).sha256))) {
      writePublicationFiles(prep.originals.map((identity) => ({ file: identity.file, content: fs.readFileSync(identity.backup, 'utf8') })), prep.originals.map((identity) => ({ file: identity.file, hash: ref(identity.file).sha256 })));
      rollback = 'restored_exact_original_bytes';
    }
    write(`${out}/install-failure.json`, { reason: error instanceof Error ? error.message : String(error), rollback });
    throw error;
  }
});
