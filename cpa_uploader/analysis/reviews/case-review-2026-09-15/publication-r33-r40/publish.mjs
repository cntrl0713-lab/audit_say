// 사례형 지정 검토 r33~r40(D등급 단독 갱신)의 정본·공개본 반영. publication-r28-r32/publish.mjs를 이 묶음(새 10세트·퇴역 8세트)에 맞춰 옮겼다. 검증 방식은 같다.
// 새 10세트에는 분리 보존한 기준서형 두 세트가 포함된다(퇴역 없이 추가만 한다). pilot-18-005-standards-20260921은 물음이 둘이라 학습 단위도 둘이고 pilot-19-005-standards-20260921은 하나다.
// 운영 DB 반영은 이 스크립트가 하지 않는다. 사용자가 승인한 운영 반영은 설치 뒤 별도 단계로 기록한다(authorization.md).
//   - 기준·후보·stage 사본은 커밋하지 않는 tmp/case-review-publication-r33-r40/에 두고, 이 폴더의 기록에는 해시만 남긴다(docs/문항-수정-패치-운영.md).
//   - 학습 분류 입력은 정본 카탈로그가 가리키는 cpa_uploader/data/learning-question-classification-review.json을 제자리에서 갱신한다
//     (2026-09-19 correct_cpa_v3.ts가 정한 위치. 퇴역 세트 행을 빼고 새 세트 행을 붙인다).
//   --baseline : 현재 정본 6종(은행·장부·공개본·암호화본·분류 카탈로그·분류 입력)의 해시를 기록하고 은행·장부를 tmp에 복사한다.
//   --stage    : tmp의 격리 stage에서 원 8세트를 빼고 새 10세트를 붙인 뒤 검수 승급(verified)·게시(published), 공개본·암호화본·분류 카탈로그, 전체 검증, DB 준비 검사를 수행한다.
//   --install  : stage 결과를 정본에 원자적으로 기록하고 정본 검사를 수행한다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40/publish.mjs --baseline|--stage|--install
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { publicationPaths, reviewedContentHash, withPublicationLock, writePublicationFiles } from '../../../../questionBankPublication.ts';
import { compileLearningCatalog } from '../../../../../scripts/build-learning-unit-catalog.ts';
import { compilePublicQuestionSet } from '../../../../../lib/questionV3.ts';
import { contentHash } from '../../../../../lib/learningSubmission.ts';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40', T = 'tmp/case-review-publication-r33-r40', S = T + '/stage', L = P + '/stage-logs';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8')), hash = (b) => createHash('sha256').update(b).digest('hex'), ref = (file) => ({ file, sha256: hash(fs.readFileSync(file)) });
const json = (v) => JSON.stringify(v, null, 2) + '\n';
const write = (file, v) => { fs.writeFileSync(file, json(v), { flag: 'wx' }); return ref(file); };
const rel = (f) => path.relative(process.cwd(), f).split(path.sep).join('/');
const mode = process.argv[2]; assert(['--baseline', '--stage', '--install'].includes(mode));
const REVIEW = 'cpa_uploader/data/learning-question-classification-review.json';
const canonical = { ...publicationPaths(), catalog: path.resolve('cpa_uploader/data/learning-question-classifications.json'), review: path.resolve(REVIEW) };
const plan = read(P + '/plan.json');
const newIds = plan.rounds.map((r) => r.set_id), retiredIds = plan.rounds.flatMap((r) => r.retires);
assert.equal(newIds.length, 10); assert.equal(retiredIds.length, 8); assert.equal(new Set([...newIds, ...retiredIds]).size, 18);
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
// 분류 입력(review)과 카탈로그를 만든다. reviewFile은 카탈로그가 가리킬 경로이고, 파일은 writeTo에 쓴다(정본용은 설치 전까지 tmp에 둔다).
function catalogFiles(sets, sourceFile, entries, topics, reviewFile, writeTo) {
    const bankHash = hash(json(sets));
    const reviewText = json({ source_file: sourceFile, source_file_sha256: bankHash, entries });
    const compiled = compileLearningCatalog(sets, entries, topics);
    const catalogText = json({ schema_version: 1, source_file: sourceFile, source_file_sha256: bankHash, public_content_hash: contentHash(sets.map(compilePublicQuestionSet)),
        review_file: reviewFile, review_file_sha256: hash(reviewText), topics, classifications: compiled.classifications });
    fs.writeFileSync(writeTo.review, reviewText, { flag: 'wx' }); fs.writeFileSync(writeTo.catalog, catalogText, { flag: 'wx' });
    return { review: ref(writeTo.review), catalog: ref(writeTo.catalog) };
}

if (mode === '--baseline') {
    assert(!fs.existsSync(P + '/baseline.json'), 'Baseline already recorded'); assert(!fs.existsSync(T), 'Scratch copies already exist');
    const files = Object.entries(canonical).map(([name, file]) => ({ name, ...ref(rel(file)) }));
    const cat = read(canonical.catalog); assert.equal(cat.review_file, REVIEW, 'Canonical catalog must point at the data classification review');
    assert.equal(cat.review_file_sha256, files.find((f) => f.name === 'review').sha256);
    fs.mkdirSync(T + '/baseline', { recursive: true });
    fs.copyFileSync(canonical.authoring, T + '/baseline/authoring.json', fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(canonical.ledger, T + '/baseline/ledger.json', fs.constants.COPYFILE_EXCL);
    const sets = read(canonical.authoring);
    for (const id of retiredIds) assert(sets.some((s) => s.id === id), 'Retired set missing: ' + id);
    for (const id of newIds) assert(!sets.some((s) => s.id === id), 'New set already in bank: ' + id);
    // 현재 정본은 직전 운영 반영(r28~r32 묶음, release 04052784)의 원문과 같은 바이트여야 한다. 그 뒤 다른 작업의 변경이 없음을 확인한다.
    const release = read('cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r28-r32/db-import/publication-v1/completion.json');
    assert.equal(release.status, 'production_published_and_independently_verified');
    const releaseBank = release.files.find((f) => f.file.endsWith('/stage/authoring.json'));
    assert.equal(releaseBank.sha256, files.find((f) => f.name === 'authoring').sha256, 'Canonical bank differs from the active production release');
    write(P + '/baseline.json', { recorded_at: new Date().toISOString(), files, copies: [ref(T + '/baseline/authoring.json'), ref(T + '/baseline/ledger.json')], copies_committed: false,
        production_release: { record: ref('cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r28-r32/db-import/publication-v1/completion.json'), release_id: release.release_id,
            source_file_hash: releaseBank.sha256, note: '설치 전 정본은 이 active release의 저장 원문과 같은 바이트다. 설치 뒤 증분 릴리스의 기준 원문이 된다.' },
        counts: { sets: sets.length, questions: sets.flatMap((s) => s.subquestions).length, points: sets.flatMap((s) => s.subquestions).flatMap((q) => q.criteria).reduce((n, c) => n + c.max_points, 0) } });
    console.log('baseline recorded', files.map((f) => f.name + ':' + f.sha256.slice(0, 12)).join(' '));
} else if (mode === '--stage') {
    guard(); assert(env.CPA_QUESTION_V3_ENCRYPTION_KEY, '암호화 키 필요'); assert(!fs.existsSync(S), 'Stage already exists');
    const accepted = read(P + '/acceptance-completion.json'); assert.equal(accepted.status, 'accepted_for_publication');
    for (const c of baseline().copies) assert.equal(ref(c.file).sha256, c.sha256, 'Baseline copy changed: ' + c.file);
    const original = read(T + '/baseline/authoring.json'), priorLedger = read(T + '/baseline/ledger.json');
    const drafts = plan.rounds.map((r) => { const [set] = read(r.draft); assert.equal(set.id, r.set_id); assert.equal(set.status, 'needs_review');
        const round = accepted.rounds.find((x) => x.round === r.round); assert.equal(round.receipt.content_hash, reviewedContentHash(set)); return set; });
    const candidate = [...original.filter((s) => !retiredIds.includes(s.id)), ...drafts];
    assert.equal(candidate.length, original.length - retiredIds.length + newIds.length);
    fs.mkdirSync(S, { recursive: true });
    fs.writeFileSync(S + '/authoring.json', json(candidate), { flag: 'wx' });
    fs.writeFileSync(T + '/candidate.json', json(candidate), { flag: 'wx' });
    fs.copyFileSync(T + '/baseline/ledger.json', S + '/promotions.json', fs.constants.COPYFILE_EXCL);
    const note = (r) => `${plan.authorization}; ${P}/batches/${r.round}.json`;
    for (const r of plan.rounds) { run(`01-verify-${r.round}`, ['cpa_uploader/promote_cpa_v3.ts', '--to', 'verified', '--sets', r.set_id, '--efficient-review', `${P}/batches/${r.round}.json`, '--evidence', note(r)], stagedEnv); guard(); }
    run('02-publish', ['cpa_uploader/promote_cpa_v3.ts', '--to', 'published', '--sets', newIds.join(','), '--evidence', `${plan.authorization}; ${P}/acceptance-completion.json`], stagedEnv); guard();
    run('03-compile', ['scripts/compile-question-bank-v3.ts'], stagedEnv); guard();
    // 학습 분류: 현재 정본 분류 입력에서 퇴역 세트 행을 빼고, 회차별 검토 분류에서 새 세트 행을 가져온다.
    const priorCatalog = read(canonical.catalog), priorReview = read(priorCatalog.review_file), topics = priorCatalog.topics;
    const kept = priorReview.entries.filter((e) => !retiredIds.includes(e.set_id));
    assert.equal(kept.length, priorReview.entries.length - original.filter((s) => retiredIds.includes(s.id)).reduce((n, s) => n + s.subquestions.length, 0));
    const added = plan.rounds.flatMap((r) => { const rows = read(r.classification).entries.filter((e) => e.set_id === r.set_id);
        assert.equal(rows.length, drafts.find((d) => d.id === r.set_id).subquestions.length); return rows; });
    const entries = [...kept, ...added];
    const final = read(S + '/authoring.json');
    const staged = catalogFiles(final, rel(path.resolve(S + '/authoring.json')), entries, topics, S + '/learning-classification-review.json',
        { review: S + '/learning-classification-review.json', catalog: S + '/learning-catalog.json' });
    run('04-validate', ['cpa_uploader/validate_cpa_v3.ts'], stagedEnv); guard();
    run('05-db-readiness', ['scripts/import-question-bank-v3.ts', '--learning-catalog', S + '/learning-catalog.json', '--report', S + '/db-readiness.json'], stagedEnv); guard();
    const nextLedger = read(S + '/promotions.json');
    assert.deepEqual(final.map((s) => s.id), candidate.map((s) => s.id), 'Set IDs or order changed during promotion');
    assert.equal(fs.readFileSync(S + '/authoring.json', 'utf8'), json(final), 'Stage bank is not canonically serialized');
    for (const [i, s] of final.entries()) {
        if (newIds.includes(s.id)) { assert.equal(s.status, 'published'); assert.equal(s.verification.review_status, 'verified'); assert.equal(reviewedContentHash(s), reviewedContentHash(candidate[i])); }
        else assert.deepEqual(s, candidate[i], 'Retained set changed: ' + s.id);
    }
    assert.deepEqual(nextLedger.entries.slice(0, priorLedger.entries.length), priorLedger.entries);
    const appended = nextLedger.entries.slice(priorLedger.entries.length); assert.equal(appended.length, newIds.length * 2);
    for (const id of newIds) { const rows = appended.filter((e) => e.set_id === id);
        assert.deepEqual(rows.map((e) => [e.from_status, e.to_status]), [['needs_review', 'verified'], ['verified', 'published']]); assert(rows[0].efficient_review);
        assert.equal(rows[1].content_hash, reviewedContentHash(final.find((s) => s.id === id))); }
    // 정본용 분류 입력·카탈로그: 카탈로그는 정본 경로(data/)의 분류 입력을 가리킨다. 설치 전까지는 tmp에 둔다.
    const canonicalFiles = catalogFiles(final, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json', entries, topics, REVIEW,
        { review: T + '/canonical-classification-review.json', catalog: T + '/canonical-catalog.json' });
    const priorRows = priorCatalog.classifications.filter((c) => !retiredIds.includes(c.source_set_id)), nextCatalog = read(T + '/canonical-catalog.json');
    assert.deepEqual(nextCatalog.classifications.filter((c) => !newIds.includes(c.source_set_id)), priorRows, 'Retained classification rows changed');
    assert.deepEqual(nextCatalog.topics, priorCatalog.topics);
    const readiness = read(S + '/db-readiness.json'); assert.equal(readiness.ready, true); assert.deepEqual(readiness.errors, []);
    const qs = final.flatMap((s) => s.subquestions);
    write(P + '/stage-completion.json', { status: 'staged_and_validated', files: ['authoring.json', 'promotions.json', 'public.json', 'encrypted.json', 'db-readiness.json'].map((f) => ref(S + '/' + f)),
        catalog: canonicalFiles.catalog, classification_review: canonicalFiles.review, staged_catalog: staged.catalog, staged_classification_review: staged.review, candidate: ref(T + '/candidate.json'), copies_committed: false,
        db_ready: readiness.ready, new_sets: newIds, retired_sets: retiredIds, retained_sets: final.length - newIds.length, new_ledger_entries: appended.length,
        classification_rows: { prior: priorReview.entries.length, kept: kept.length, added: added.length, total: entries.length },
        counts: { sets: final.length, questions: qs.length, points: qs.flatMap((q) => q.criteria).reduce((n, c) => n + c.max_points, 0) }, model_api_calls: 0 });
    console.log('staged', final.length, 'sets');
} else {
    const done = read(P + '/stage-completion.json'); assert.equal(done.status, 'staged_and_validated'); assert(done.db_ready); assert(!fs.existsSync(P + '/install-completion.json')); guard();
    for (const r of [...done.files, done.catalog, done.classification_review]) assert.equal(ref(r.file).sha256, r.sha256);
    const writes = Object.entries({ authoring: 'authoring.json', ledger: 'promotions.json', public: 'public.json', encrypted: 'encrypted.json' }).map(([name, file]) => ({ file: canonical[name], content: fs.readFileSync(S + '/' + file, 'utf8') }));
    writes.push({ file: canonical.catalog, content: fs.readFileSync(done.catalog.file, 'utf8') }, { file: canonical.review, content: fs.readFileSync(done.classification_review.file, 'utf8') });
    withPublicationLock(canonical.authoring, () => { guard(); writePublicationFiles(writes, baseline().files.map((r) => ({ file: r.file, hash: r.sha256 }))); });
    run('06-canonical-catalog-check', ['scripts/build-learning-unit-catalog.ts', '--check'], env);
    run('07-canonical-validate', ['cpa_uploader/validate_cpa_v3.ts'], env);
    write(P + '/install-completion.json', { status: 'canonical_installed_and_validated', completed_at: new Date().toISOString(), files: Object.values(canonical).map((f) => ref(rel(f))),
        new_sets: done.new_sets, retired_sets: done.retired_sets, counts: done.counts, new_ledger_entries: done.new_ledger_entries, model_api_calls: 0, db_applied: false,
        production_release_before_apply: baseline().production_release.release_id,
        db_note: '이 단계는 정본·공개본 설치까지다. 사용자가 승인한 운영 반영(r12 변경 포함)은 설치 뒤 별도 실행과 기록으로 진행한다.' });
    console.log('installed');
}
