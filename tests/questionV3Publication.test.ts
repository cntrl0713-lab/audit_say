import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { decryptAuthoringQuestionBankV3 } from '../lib/questionV3Encryption.ts';
import { reviewedContentHash, snapshotFile, validateAuthoringBank, writePublicationFiles } from '../cpa_uploader/questionBankPublication.ts';
import type { PromotionLedger } from '../cpa_uploader/questionBankPublication.ts';
import { offlineReviewReceipt } from './helpers/questionSemanticReviewFixture.ts';
import { completeSemanticReview, prepareSemanticReview } from '../cpa_uploader/questionSemanticReview.ts';
import type { SemanticReviewReceipt } from '../cpa_uploader/questionSemanticReview.ts';
import { jsonHash } from '../cpa_uploader/questionReviewIdentity.ts';

const root = process.cwd();
const authoringFile = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const ledgerFile = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.promotions.json');
const secret = 'isolated-publication-regression-test-secret';

test('a split fourth subquestion is accepted while five subquestions exceed the linked-set limit', () => {
    const bank = JSON.parse(fs.readFileSync(authoringFile, 'utf8')) as QuestionSetV3[];
    const set = bank[0];
    const template = structuredClone(set.subquestions[0]);
    while (set.subquestions.length < 4) {
        const sub = structuredClone(template);
        sub.id = `split-${set.subquestions.length + 1}`;
        sub.prompt = `${sub.id} 격리 분할 검사: ${template.prompt}`;
        set.subquestions.push(sub);
    }
    set.learning_order = set.subquestions.map(sub => sub.id);
    assert.deepEqual(validateAuthoringBank(bank).errors, []);
    const fifth = structuredClone(template);
    fifth.id = 'split-5';
    fifth.prompt = `다섯째 격리 분할 검사: ${template.prompt}`;
    set.subquestions.push(fifth);
    set.learning_order.push(fifth.id);
    assert.ok(validateAuthoringBank(bank).errors.some(error => error.includes('세부 물음 2~4개')));
});
const scripts = {
    validate: 'cpa_uploader/validate_cpa_v3.ts',
    promote: 'cpa_uploader/promote_cpa_v3.ts',
    compile: 'scripts/compile-question-bank-v3.ts',
};

function fixture() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-publication-'));
    const files = { authoring: path.join(directory, 'authoring.json'), ledger: path.join(directory, 'ledger.json'),
        public: path.join(directory, 'public.json'), encrypted: path.join(directory, 'authoring.enc.json') };
    // Real CLIs enforce the original 65-set topic minima. Pin those pilot IDs so
    // every supplied peer is reviewed without inheriting later corpus growth.
    const fixtureTopicCounts = [3, 4, 3, 3, 4, 4, 3, 4, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 4];
    const fixturePeerIds = fixtureTopicCounts.flatMap((count, topic) => Array.from({ length: count }, (_, index) =>
        `pilot-${String(topic + 1).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`));
    const sets = (JSON.parse(fs.readFileSync(authoringFile, 'utf8')) as QuestionSetV3[])
        .filter(set => fixturePeerIds.includes(set.id));
    assert.equal(sets.length, fixturePeerIds.length, 'publication fixture peers must exist');
    assert.ok(sets.every(set => set.status === 'published'), 'publication fixture peers must be published');
    const draft = structuredClone(sets[0]);
    draft.id = 'draft-publication-regression';
    draft.status = 'needs_review';
    draft.verification.review_status = 'needs_human_review';
    draft.verification.notes = ['격리 CLI 순서 검증용 합성 문항: 실제 검수·게시 대상 아님'];
    for (const sub of draft.subquestions) sub.prompt = `격리 신규 문항: ${sub.prompt}`;
    sets.push(draft);
    fs.writeFileSync(files.authoring, `${JSON.stringify(sets, null, 2)}\n`);
    const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) as PromotionLedger;
    ledger.entries = ledger.entries.filter(entry => fixturePeerIds.includes(entry.set_id));
    fs.writeFileSync(files.ledger, `${JSON.stringify(ledger, null, 2)}\n`);
    const env = { ...process.env, CPA_QUESTION_V3_AUTHORING_PATH: files.authoring,
        CPA_QUESTION_V3_PUBLIC_PATH: files.public, CPA_QUESTION_V3_ENCRYPTED_PATH: files.encrypted,
        CPA_QUESTION_V3_PROMOTIONS_PATH: files.ledger, CPA_QUESTION_V3_ENCRYPTION_KEY: secret };
    return { directory, files, sets, draft, env };
}

function cli(f: ReturnType<typeof fixture>, command: keyof typeof scripts, args: string[] = [], success = true) {
    const result = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', scripts[command], ...args], {
        cwd: root, env: f.env, encoding: 'utf8', timeout: 120_000,
    });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.error, undefined, output);
    if (success) assert.equal(result.status, 0, output);
    else assert.notEqual(result.status, 0, output);
    return output;
}
function bytes(f: ReturnType<typeof fixture>) {
    return Object.fromEntries(Object.entries(f.files).map(([name, file]) => [name, fs.existsSync(file) ? fs.readFileSync(file) : null]));
}
async function verify(f: ReturnType<typeof fixture>) {
    const review = await writeReview(f);
    cli(f, 'promote', ['--to', 'verified', '--sets', f.draft.id, '--evidence', '격리 테스트 검수 승인 근거', '--review', review]);
}
async function writeReview(f: ReturnType<typeof fixture>) {
    const sets = JSON.parse(fs.readFileSync(f.files.authoring, 'utf8')) as QuestionSetV3[];
    const receipt = await offlineReviewReceipt(sets.find((set) => set.id === f.draft.id)!, sets);
    const file = path.join(f.directory, 'review.json');
    fs.writeFileSync(file, JSON.stringify({ schema_version: '1.0', reviews: [receipt] }));
    return file;
}
function save(f: ReturnType<typeof fixture>) { fs.writeFileSync(f.files.authoring, `${JSON.stringify(f.sets, null, 2)}\n`); }

test('actual CLI publishes an added draft without a preexisting public snapshot and preserves reviewed content', async () => {
    const originals = [snapshotFile(authoringFile), snapshotFile(ledgerFile)];
    const f = fixture();
    try {
        cli(f, 'validate', ['--authoring-only']);
        const before = bytes(f);
        assert.match(cli(f, 'validate', [], false), /published/);
        assert.match(cli(f, 'compile', [], false), /published/);
        assert.match(cli(f, 'promote', ['--to', 'published', '--sets', f.draft.id, '--evidence', '미검수 게시 시도'], false), /verified/);
        assert.match(cli(f, 'promote', ['--to', 'verified', '--sets', f.draft.id], false), /evidence/);
        assert.match(cli(f, 'promote', ['--to', 'verified', '--sets', f.draft.id, '--evidence', 'receipt 없는 검수'], false), /--review/);
        assert.deepEqual(bytes(f), before, 'failed gates must not write bank, ledger or artifacts');
        const injected = await offlineReviewReceipt(f.draft, f.sets);
        injected.grading.transport = 'injected_response';
        const unhashed = { ...injected } as Partial<SemanticReviewReceipt>; delete unhashed.receipt_hash;
        injected.receipt_hash = jsonHash(unhashed);
        const injectedFile = path.join(f.directory, 'injected-review.json');
        fs.writeFileSync(injectedFile, JSON.stringify({ schema_version: '1.0', reviews: [injected] }));
        assert.match(cli(f, 'promote', ['--to', 'verified', '--sets', f.draft.id, '--evidence', '주입 응답 승급 차단 확인', '--review', injectedFile], false), /주입 응답.*승급 근거/);
        assert.deepEqual(bytes(f), before, 'injected model responses cannot approve a new draft');
        await verify(f);
        let sets = JSON.parse(fs.readFileSync(f.files.authoring, 'utf8')) as QuestionSetV3[];
        const reviewed = sets.at(-1)!;
        assert.equal(reviewed.status, 'verified');
        assert.equal(reviewed.verification.review_status, 'verified');
        assert.equal(reviewedContentHash(reviewed), reviewedContentHash(f.draft));
        cli(f, 'validate', ['--authoring-only']);
        cli(f, 'promote', ['--to', 'published', '--sets', f.draft.id, '--evidence', '격리 게시 승인 근거']);
        assert.equal(fs.existsSync(f.files.public), false, 'publication does not require or manufacture public data');
        assert.match(cli(f, 'validate', [], false), /public/);
        cli(f, 'compile');
        cli(f, 'validate');
        const plaintext = fs.readFileSync(f.files.authoring, 'utf8');
        sets = JSON.parse(plaintext) as QuestionSetV3[];
        assert.equal(decryptAuthoringQuestionBankV3(fs.readFileSync(f.files.encrypted, 'utf8'), secret), plaintext);
        assert.deepEqual(JSON.parse(fs.readFileSync(f.files.public, 'utf8')), sets.map(compilePublicQuestionSet));
        const ledger = JSON.parse(fs.readFileSync(f.files.ledger, 'utf8')) as PromotionLedger;
        const entries = ledger.entries.filter((entry) => entry.set_id === f.draft.id);
        assert.deepEqual(entries.map((entry) => entry.to_status), ['verified', 'published']);
        assert.ok(entries.every((entry) => entry.evidence.trim() && entry.content_hash === reviewedContentHash(sets.at(-1)!)));
        assert.equal(entries[0].review_summary?.verdict, 'pass');
        assert.equal(entries[1].review_receipt_hash, entries[0].semantic_review?.receipt_hash);
        const completed = bytes(f);
        cli(f, 'promote', ['--to', 'published', '--sets', f.draft.id, '--evidence', '격리 멱등 재시도']);
        assert.deepEqual(bytes(f), completed, 'idempotent publication preserves bytes');
    } finally {
        fs.rmSync(f.directory, { recursive: true, force: true });
        assert.deepEqual([snapshotFile(authoringFile), snapshotFile(ledgerFile)], originals, 'real authoring and ledger remain untouched');
    }
});

test('whole-bank duplicate, source and policy failures are rejected before promotion writes', async () => {
    const f = fixture();
    try {
        const mutations = [
            () => { f.draft.subquestions[0].prompt = f.sets[0].subquestions[0].prompt; },
            () => { f.sets[1].source_refs[0].source_quote = '존재하지 않는 격리 원문'; },
            () => { f.draft.subquestions[0].constraints.max_entries = 2; },
            () => { f.draft.id = f.sets[0].id; },
        ];
        const original = structuredClone(f.sets);
        for (const mutate of mutations) {
            f.sets = structuredClone(original); f.draft = f.sets.at(-1)!;
            mutate(); save(f);
            const before = bytes(f);
            cli(f, 'promote', ['--to', 'verified', '--sets', f.draft.id, '--evidence', '격리 실패 검증'], false);
            assert.deepEqual(bytes(f), before);
        }
    } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test('changed reviewed content, forged review state and missing evidence cannot publish or compile', async () => {
    const f = fixture();
    try {
        await verify(f);
        f.sets = JSON.parse(fs.readFileSync(f.files.authoring, 'utf8')) as QuestionSetV3[];
        f.draft = f.sets.at(-1)!;
        const reviewed = structuredClone(f.sets);
        f.draft.subquestions[0].criteria[0].claim += ' 검수 후 수정'; save(f);
        const changed = bytes(f);
        assert.match(cli(f, 'promote', ['--to', 'published', '--sets', f.draft.id, '--evidence', '게시 시도'], false), /검수 후|해시/);
        assert.deepEqual(bytes(f), changed);
        f.sets = structuredClone(reviewed); f.draft = f.sets.at(-1)!;
        f.draft.status = 'published'; save(f);
        assert.match(cli(f, 'compile', [], false), /published 승급 장부/);
        const ledger = JSON.parse(fs.readFileSync(f.files.ledger, 'utf8')) as PromotionLedger;
        ledger.entries = ledger.entries.filter((entry) => entry.set_id !== f.draft.id);
        fs.writeFileSync(f.files.ledger, JSON.stringify(ledger));
        const forged = bytes(f);
        assert.match(cli(f, 'compile', [], false), /verified 승급 장부/);
        assert.deepEqual(bytes(f), forged);
    } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test('explicit re-verification reviews only changed targets and requires re-publication before compilation', async () => {
    const f = fixture();
    try {
        await verify(f);
        cli(f, 'promote', ['--to', 'published', '--sets', f.draft.id, '--evidence', '격리 최초 게시']);
        const publishedLedger = JSON.parse(fs.readFileSync(f.files.ledger, 'utf8')) as PromotionLedger;
        f.sets = JSON.parse(fs.readFileSync(f.files.authoring, 'utf8')) as QuestionSetV3[];
        f.draft = f.sets.at(-1)!;
        f.draft.subquestions[0].criteria[0].claim += ' 재검수할 수정';
        save(f);
        const changed = bytes(f);
        assert.match(cli(f, 'promote', ['--to', 'verified', '--sets', f.draft.id, '--evidence', '명시적 재검수 없는 시도'], false), /검수 후|해시/);
        assert.match(cli(f, 'compile', [], false), /검수 후|해시/);
        assert.deepEqual(bytes(f), changed);

        // Another set's changed content must not be authorized by the target's review.
        const other = f.sets[0];
        const otherOriginal = structuredClone(other);
        const ledger = structuredClone(publishedLedger);
        const otherReview = await offlineReviewReceipt(other, f.sets);
        ledger.entries.push({ set_id: other.id, from_status: 'published', to_status: 'verified',
            evidence: '격리 타 세트 이전 검수', date: '2026-09-09', content_hash: reviewedContentHash(other), semantic_review: otherReview,
            review_receipt_hash: otherReview.receipt_hash, review_summary: { units: otherReview.units.length, cases: otherReview.cases.length, method: otherReview.execution.method, verdict: 'pass' } });
        ledger.entries.push({ set_id: other.id, from_status: 'verified', to_status: 'published',
            evidence: '격리 타 세트 이전 게시', date: '2026-09-09', content_hash: reviewedContentHash(other), review_receipt_hash: otherReview.receipt_hash });
        fs.writeFileSync(f.files.ledger, JSON.stringify(ledger));
        other.subquestions[0].criteria[0].claim += ' 타 세트 미검수 변경'; save(f);
        const unrelated = bytes(f);
        const reverify = ['--reverify', '--to', 'verified', '--sets', f.draft.id, '--evidence', '격리 수정내용 재검수 승인'];
        assert.match(cli(f, 'promote', reverify, false), new RegExp(other.id));
        assert.deepEqual(bytes(f), unrelated);
        f.sets[0] = otherOriginal; save(f);
        fs.writeFileSync(f.files.ledger, JSON.stringify(publishedLedger));

        assert.match(cli(f, 'promote', reverify, false), /--review/);
        cli(f, 'promote', [...reverify, '--review', await writeReview(f)]);
        const reviewed = JSON.parse(fs.readFileSync(f.files.authoring, 'utf8')) as QuestionSetV3[];
        assert.equal(reviewed.at(-1)!.status, 'verified');
        assert.equal(reviewed.at(-1)!.verification.review_status, 'verified');
        assert.equal(reviewedContentHash(reviewed.at(-1)!), reviewedContentHash(f.draft));
        const rereviewLedger = JSON.parse(fs.readFileSync(f.files.ledger, 'utf8')) as PromotionLedger;
        assert.deepEqual(rereviewLedger.entries.slice(0, -1), publishedLedger.entries, 'previous review evidence is append-only');
        assert.equal(rereviewLedger.entries.at(-1)!.from_status, 'published');
        assert.equal(rereviewLedger.entries.at(-1)!.content_hash, reviewedContentHash(f.draft));
        assert.match(cli(f, 'compile', [], false), /published/);
        cli(f, 'promote', ['--to', 'published', '--sets', f.draft.id, '--evidence', '격리 재검수 후 재게시']);
        cli(f, 'compile'); cli(f, 'validate');
    } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test('re-verification cannot authorize an unreviewed draft or forged lifecycle labels', async () => {
    const f = fixture();
    try {
        const args = ['--reverify', '--to', 'verified', '--sets', f.draft.id, '--evidence', '격리 재검수'];
        const draft = bytes(f);
        assert.match(cli(f, 'promote', args, false), /needs_review/);
        assert.deepEqual(bytes(f), draft);
        await verify(f);
        f.sets = JSON.parse(fs.readFileSync(f.files.authoring, 'utf8')) as QuestionSetV3[];
        f.draft = f.sets.at(-1)!;
        f.draft.status = 'published'; save(f);
        const forged = bytes(f);
        assert.match(cli(f, 'promote', args, false), /published 승급 장부/);
        assert.deepEqual(bytes(f), forged);
        f.draft.status = 'verified'; f.draft.verification.review_status = 'needs_human_review'; save(f);
        const unreviewed = bytes(f);
        assert.match(cli(f, 'promote', args, false), /review_status=verified/);
        assert.deepEqual(bytes(f), unreviewed);
    } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test('publication writer detects changed inputs and rolls back when a later replacement fails', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-publication-write-'));
    const first = path.join(directory, 'first.json');
    const second = path.join(directory, 'second.json');
    try {
        fs.writeFileSync(first, 'old-first'); fs.writeFileSync(second, 'old-second');
        const guard = snapshotFile(first);
        fs.writeFileSync(first, 'changed-input');
        assert.throws(() => writePublicationFiles([{ file: second, content: 'new-second' }], [guard]), /검증 중 파일이 변경/);
        assert.equal(fs.readFileSync(second, 'utf8'), 'old-second');
        const rename = fs.renameSync;
        t.mock.method(fs, 'renameSync', (from: fs.PathLike, to: fs.PathLike) => {
            if (to === second) throw new Error('injected second replacement failure');
            rename(from, to);
        });
        assert.throws(() => writePublicationFiles([{ file: first, content: 'new-first' }, { file: second, content: 'new-second' }]), /second replacement/);
        assert.equal(fs.readFileSync(first, 'utf8'), 'changed-input');
        assert.equal(fs.readFileSync(second, 'utf8'), 'old-second');
        assert.deepEqual(fs.readdirSync(directory).sort(), ['first.json', 'second.json']);
    } finally { t.mock.restoreAll(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('nonpassing or forged semantic receipts and historical backfill cannot approve a new draft', async () => {
    const f = fixture();
    try {
        const reviewFile = await writeReview(f);
        const good = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
        for (const status of ['fail', 'uncertain'] as const) {
            const receipt = good.reviews[0];
            const prepared = prepareSemanticReview(f.draft, { bank: f.sets });
            const raw = structuredClone({ units: receipt.units, cases: receipt.cases, notes: receipt.notes });
            raw.units[0].checks[status === 'fail' ? 'source_support' : 'conditions_exceptions'] = status;
            const bad = completeSemanticReview(prepared, raw, receipt.execution);
            fs.writeFileSync(reviewFile, JSON.stringify({ schema_version: '1.0', reviews: [bad] }));
            const before = bytes(f);
            assert.match(cli(f, 'promote', ['--to', 'verified', '--sets', f.draft.id, '--evidence', '실패 검수', '--review', reviewFile], false), /pass가 아닙니다/);
            assert.deepEqual(bytes(f), before);
        }
        const forged = structuredClone(good); forged.reviews[0].units[0].source_quotes[0].quote = '없는 원문';
        fs.writeFileSync(reviewFile, JSON.stringify(forged));
        assert.match(cli(f, 'promote', ['--to', 'verified', '--sets', f.draft.id, '--evidence', '위조 검수', '--review', reviewFile], false), /실제 원문|해시/);
        f.draft.status = 'published'; f.draft.verification.review_status = 'verified'; save(f);
        const before = bytes(f);
        assert.match(cli(f, 'promote', ['--backfill-verified', '--evidence', '새 가짜 소급 승인'], false), /새 소급 검수 기록/);
        assert.deepEqual(bytes(f), before);
    } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test('changed source bytes require a fresh receipt and explicit re-review even when item content is unchanged', async () => {
    const f = fixture();
    try {
        const copied = new Map<string, string>();
        for (const source of f.draft.source_refs) {
            let file = copied.get(source.file);
            if (!file) { file = path.join(f.directory, `source-${copied.size}.md`); fs.copyFileSync(path.resolve(root, source.file), file); copied.set(source.file, file); }
            source.file = file;
        }
        save(f); await verify(f);
        cli(f, 'promote', ['--to', 'published', '--sets', f.draft.id, '--evidence', '격리 원문 최초 승인']);
        f.sets = JSON.parse(fs.readFileSync(f.files.authoring, 'utf8')) as QuestionSetV3[]; f.draft = f.sets.at(-1)!;
        const oldContentHash = reviewedContentHash(f.draft);
        fs.appendFileSync(f.draft.source_refs[0].file, '\n격리 source 주변 문맥 변경\n');
        const before = bytes(f);
        assert.match(cli(f, 'compile', [], false), /source 파일이 변경/);
        const args = ['--reverify', '--to', 'verified', '--sets', f.draft.id, '--evidence', '원문 변경 재대조', '--review', path.join(f.directory, 'review.json')];
        assert.match(cli(f, 'promote', args, false), /source 파일이 변경/);
        assert.deepEqual(bytes(f), before);
        await writeReview(f); cli(f, 'promote', args);
        cli(f, 'promote', ['--to', 'published', '--sets', f.draft.id, '--evidence', '격리 원문 재검수 후 게시']);
        cli(f, 'compile'); cli(f, 'validate');
        assert.equal(reviewedContentHash(f.draft), oldContentHash);
    } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});
