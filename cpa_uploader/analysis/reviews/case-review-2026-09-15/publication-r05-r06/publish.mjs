// 사례형 지정 검토 r05~r06의 정본·공개본 반영.
//   --baseline : 현재 정본 5종의 해시와 은행·장부 사본을 기록한다(쓰기 대상은 이 폴더뿐).
//   --stage    : 격리 stage에서 원 4세트를 빼고 새 2세트를 붙인 뒤 검수 승급(verified)·게시(published), 공개본·암호화본·분류 카탈로그, 전체 검증, DB 준비 검사를 수행한다.
//   --install  : stage 결과를 정본에 원자적으로 기록하고 정본 검사를 수행한다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r05-r06/publish.mjs --baseline|--stage|--install
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { publicationPaths, reviewedContentHash, withPublicationLock, writePublicationFiles } from '../../../../questionBankPublication.ts';
import { compileLearningCatalog } from '../../../../../scripts/build-learning-unit-catalog.ts';
import { compilePublicQuestionSet } from '../../../../../lib/questionV3.ts';
import { contentHash } from '../../../../../lib/learningSubmission.ts';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r05-r06', S = P + '/stage', L = P + '/stage-logs';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8')), hash = (b) => createHash('sha256').update(b).digest('hex'), ref = (file) => ({ file, sha256: hash(fs.readFileSync(file)) });
const write = (file, v) => { fs.writeFileSync(file, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(file); };
const rel = (f) => path.relative(process.cwd(), f).split(path.sep).join('/');
const mode = process.argv[2]; assert(['--baseline', '--stage', '--install'].includes(mode));
const canonical = { ...publicationPaths(), catalog: path.resolve('cpa_uploader/data/learning-question-classifications.json') };
const plan = read(P + '/plan.json');
const newIds = plan.rounds.map((r) => r.set_id), retiredIds = plan.rounds.flatMap((r) => r.retires);
assert.equal(newIds.length, 2); assert.equal(retiredIds.length, 4); assert.equal(new Set([...newIds, ...retiredIds]).size, 6);
const env = { ...process.env }; for (const k of Object.keys(env)) if (/OPENAI|ANTHROPIC|SUPABASE/i.test(k)) delete env[k]; delete env.NODE_OPTIONS;
const stagedEnv = { ...env, CPA_QUESTION_V3_AUTHORING_PATH: path.resolve(S + '/authoring.json'), CPA_QUESTION_V3_PROMOTIONS_PATH: path.resolve(S + '/promotions.json'),
    CPA_QUESTION_V3_PUBLIC_PATH: path.resolve(S + '/public.json'), CPA_QUESTION_V3_ENCRYPTED_PATH: path.resolve(S + '/encrypted.json') };
const baseline = () => read(P + '/baseline.json');
const guard = () => { for (const r of baseline().files) assert.equal(ref(r.file).sha256, r.sha256, '다른 작업의 정본 변경: ' + r.file); };
function run(id, args, environment) {
    fs.mkdirSync(L, { recursive: true });
    const log = L + '/' + id + '.log', fd = fs.openSync(log, 'wx'), start = Date.now(); let result;
    try { result = spawnSync(process.execPath, ['--import', 'tsx', ...args], { cwd: process.cwd(), env: environment, shell: false, windowsHide: true, stdio: ['ignore', fd, fd] }); } finally { fs.closeSync(fd); }
    write(L + '/' + id + '.result.json', { exit_code: result.status, signal: result.signal, elapsed_ms: Date.now() - start, log: ref(log) });
    assert.equal(result.status, 0, id + ' 실패: ' + log); console.log(id + ' passed');
}
function catalog(bankFile, sourceFile, prefix, entries, topics) {
    const sets = read(bankFile), reviewFile = prefix + '-classification-review.json';
    const review = { source_file: sourceFile, source_file_sha256: ref(bankFile).sha256, entries };
    write(reviewFile, review);
    const compiled = compileLearningCatalog(sets, review.entries, topics), file = prefix + '-catalog.json';
    write(file, { schema_version: 1, source_file: sourceFile, source_file_sha256: ref(bankFile).sha256, public_content_hash: contentHash(sets.map(compilePublicQuestionSet)),
        review_file: reviewFile, review_file_sha256: ref(reviewFile).sha256, topics, classifications: compiled.classifications });
    return file;
}

if (mode === '--baseline') {
    assert(!fs.existsSync(P + '/baseline.json'), 'Baseline already recorded');
    const files = Object.entries(canonical).map(([name, file]) => ({ name, ...ref(rel(file)) }));
    fs.mkdirSync(P + '/baseline');
    fs.copyFileSync(canonical.authoring, P + '/baseline/authoring.json', fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(canonical.ledger, P + '/baseline/ledger.json', fs.constants.COPYFILE_EXCL);
    const sets = read(canonical.authoring), cat = read(canonical.catalog);
    for (const id of retiredIds) assert(sets.some((s) => s.id === id), 'Retired set missing: ' + id);
    for (const id of newIds) assert(!sets.some((s) => s.id === id), 'New set already in bank: ' + id);
    write(P + '/baseline.json', { recorded_at: new Date().toISOString(), files, copies: [ref(P + '/baseline/authoring.json'), ref(P + '/baseline/ledger.json')],
        catalog_review_file: ref(cat.review_file), counts: { sets: sets.length, questions: sets.flatMap((s) => s.subquestions).length } });
    console.log('baseline recorded', files.map((f) => f.name + ':' + f.sha256.slice(0, 12)).join(' '));
} else if (mode === '--stage') {
    guard(); assert(env.CPA_QUESTION_V3_ENCRYPTION_KEY, '암호화 키 필요'); assert(!fs.existsSync(S), 'Stage already exists');
    const accepted = read(P + '/acceptance-completion.json'); assert.equal(accepted.status, 'accepted_for_publication'); assert.equal(ref(P + '/acceptance-completion.json').sha256, hash(fs.readFileSync(P + '/acceptance-completion.json')));
    const original = read(P + '/baseline/authoring.json'), priorLedger = read(P + '/baseline/ledger.json');
    const drafts = plan.rounds.map((r) => { const [set] = read(r.draft); assert.equal(set.id, r.set_id); assert.equal(set.status, 'needs_review');
        const round = accepted.rounds.find((x) => x.round === r.round); assert.equal(round.receipt.content_hash, reviewedContentHash(set)); return set; });
    const candidate = [...original.filter((s) => !retiredIds.includes(s.id)), ...drafts];
    assert.equal(candidate.length, original.length - retiredIds.length + newIds.length);
    fs.mkdirSync(S);
    fs.writeFileSync(S + '/authoring.json', JSON.stringify(candidate, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(P + '/candidate.json', JSON.stringify(candidate, null, 2) + '\n', { flag: 'wx' });
    fs.copyFileSync(P + '/baseline/ledger.json', S + '/promotions.json', fs.constants.COPYFILE_EXCL);
    const note = (r) => `${plan.authorization}; ${P}/batches/${r.round}.json`;
    for (const r of plan.rounds) { run(`01-verify-${r.round}`, ['cpa_uploader/promote_cpa_v3.ts', '--to', 'verified', '--sets', r.set_id, '--efficient-review', `${P}/batches/${r.round}.json`, '--evidence', note(r)], stagedEnv); guard(); }
    run('02-publish', ['cpa_uploader/promote_cpa_v3.ts', '--to', 'published', '--sets', newIds.join(','), '--evidence', `${plan.authorization}; ${P}/acceptance-completion.json`], stagedEnv); guard();
    run('03-compile', ['scripts/compile-question-bank-v3.ts'], stagedEnv); guard();
    // 학습 분류: 현재 정본 분류 검토에서 퇴역 세트 행을 빼고, 회차별 검토 분류에서 새 세트 행을 가져온다.
    const priorReview = read(read(canonical.catalog).review_file), topics = read(canonical.catalog).topics;
    const kept = priorReview.entries.filter((e) => !retiredIds.includes(e.set_id));
    assert.equal(kept.length, priorReview.entries.length - original.filter((s) => retiredIds.includes(s.id)).reduce((n, s) => n + s.subquestions.length, 0));
    const added = plan.rounds.flatMap((r) => { const rows = read(r.classification).entries.filter((e) => e.set_id === r.set_id);
        assert.equal(rows.length, drafts.find((d) => d.id === r.set_id).subquestions.length); return rows; });
    const entries = [...kept, ...added];
    const stagedCatalog = catalog(S + '/authoring.json', S + '/authoring.json', S + '/learning', entries, topics);
    run('04-validate', ['cpa_uploader/validate_cpa_v3.ts'], stagedEnv); guard();
    run('05-db-readiness', ['scripts/import-question-bank-v3.ts', '--learning-catalog', stagedCatalog, '--report', S + '/db-readiness.json'], stagedEnv); guard();
    const final = read(S + '/authoring.json'), nextLedger = read(S + '/promotions.json');
    assert.deepEqual(final.map((s) => s.id), candidate.map((s) => s.id), 'Set IDs or order changed during promotion');
    for (const [i, s] of final.entries()) {
        if (newIds.includes(s.id)) { assert.equal(s.status, 'published'); assert.equal(s.verification.review_status, 'verified'); assert.equal(reviewedContentHash(s), reviewedContentHash(candidate[i])); }
        else assert.deepEqual(s, candidate[i], 'Retained set changed: ' + s.id);
    }
    assert.deepEqual(nextLedger.entries.slice(0, priorLedger.entries.length), priorLedger.entries);
    const appended = nextLedger.entries.slice(priorLedger.entries.length); assert.equal(appended.length, newIds.length * 2);
    for (const id of newIds) { const rows = appended.filter((e) => e.set_id === id);
        assert.deepEqual(rows.map((e) => [e.from_status, e.to_status]), [['needs_review', 'verified'], ['verified', 'published']]); assert(rows[0].efficient_review);
        assert.equal(rows[1].content_hash, reviewedContentHash(final.find((s) => s.id === id))); }
    const canonicalCatalog = catalog(S + '/authoring.json', 'cpa_uploader/data/cpa_question_sets_v3.authoring.json', P + '/canonical', entries, topics);
    const readiness = read(S + '/db-readiness.json'); assert.equal(readiness.ready, true); assert.deepEqual(readiness.errors, []);
    const qs = final.flatMap((s) => s.subquestions);
    write(P + '/stage-completion.json', { status: 'staged_and_validated', files: ['authoring.json', 'promotions.json', 'public.json', 'encrypted.json', 'db-readiness.json'].map((f) => ref(S + '/' + f)),
        catalog: ref(canonicalCatalog), staged_catalog: ref(stagedCatalog), candidate: ref(P + '/candidate.json'), db_ready: readiness.ready, new_sets: newIds, retired_sets: retiredIds,
        retained_sets: final.length - newIds.length, new_ledger_entries: appended.length,
        counts: { sets: final.length, questions: qs.length, points: qs.flatMap((q) => q.criteria).reduce((n, c) => n + c.max_points, 0) }, model_api_calls: 0 });
    console.log('staged', final.length, 'sets');
} else {
    const done = read(P + '/stage-completion.json'); assert.equal(done.status, 'staged_and_validated'); assert(done.db_ready); assert(!fs.existsSync(P + '/install-completion.json')); guard();
    for (const r of [...done.files, done.catalog]) assert.equal(ref(r.file).sha256, r.sha256);
    const writes = Object.entries({ authoring: 'authoring.json', ledger: 'promotions.json', public: 'public.json', encrypted: 'encrypted.json' }).map(([name, file]) => ({ file: canonical[name], content: fs.readFileSync(S + '/' + file, 'utf8') }));
    writes.push({ file: canonical.catalog, content: fs.readFileSync(done.catalog.file, 'utf8') });
    withPublicationLock(canonical.authoring, () => { guard(); writePublicationFiles(writes, baseline().files.map((r) => ({ file: r.file, hash: r.sha256 }))); });
    run('06-canonical-catalog-check', ['scripts/build-learning-unit-catalog.ts', '--check'], env);
    run('07-canonical-validate', ['cpa_uploader/validate_cpa_v3.ts'], env);
    write(P + '/install-completion.json', { status: 'canonical_installed_and_validated', completed_at: new Date().toISOString(), files: Object.values(canonical).map((f) => ref(rel(f))),
        new_sets: done.new_sets, retired_sets: done.retired_sets, counts: done.counts, new_ledger_entries: done.new_ledger_entries, model_api_calls: 0, db_applied: false });
    console.log('installed');
}
