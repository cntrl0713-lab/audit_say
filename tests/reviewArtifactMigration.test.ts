import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkReviewMigration, migrateReviewArtifacts } from '../cpa_uploader/analysis/reviews/migrate-review-artifacts.mjs';

const oldRun = 'docs/reports/question-review-2027';
const newRun = 'cpa_uploader/analysis/reviews/question-review-2027';

function fixture(context: TestContext): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-review-migration-'));
    context.after(() => {
        assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('audit-review-migration-'));
        fs.rmSync(root, { recursive: true, force: true });
    });
    const files = {
        [`${oldRun}/01.json`]: '{"historical_path":"docs/reports/question-review-2027/grading-cases/01-cases.json"}\r\n',
        [`${oldRun}/01.md`]: '# Human report\r\n',
        [`${oldRun}/grading-cases/01-cases.json`]: '{"verdict":"uncertain"}\r\n',
        [`${oldRun}/sources/local.txt`]: 'Original evidence\r\n',
        'docs/plans/2027-question-review/manifest.json': '{"historical":true}\r\n',
    };
    for (const [relative, contents] of Object.entries(files)) {
        const file = path.join(root, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, contents);
    }
    return root;
}

test('historical migration preserves evidence bytes and embedded paths while retaining human reports', context => {
    const root = fixture(context);
    const original = fs.readFileSync(path.join(root, oldRun, '01.json'));
    const result = migrateReviewArtifacts({ repoDir: root });
    assert.equal(result.files, 4);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(fs.readFileSync(path.join(root, newRun, '01.json')), original);
    assert.ok(fs.existsSync(path.join(root, oldRun, '01.md')));
    assert.ok(!fs.existsSync(path.join(root, oldRun, '01.json')));
    const manifest = fs.readFileSync(path.join(root, newRun, 'migration-manifest.json'));
    assert.deepEqual(migrateReviewArtifacts({ repoDir: root }), result);
    assert.deepEqual(fs.readFileSync(path.join(root, newRun, 'migration-manifest.json')), manifest);
});

test('historical verification rejects changed bytes, old duplicate copies and missing required records', context => {
    const root = fixture(context);
    migrateReviewArtifacts({ repoDir: root });
    fs.appendFileSync(path.join(root, newRun, '01.json'), ' ');
    fs.writeFileSync(path.join(root, oldRun, '01.json'), '{}');
    fs.unlinkSync(path.join(root, newRun, 'grading-cases/01-cases.json'));
    const result = checkReviewMigration({ repoDir: root });
    assert.ok(result.errors.some(error => error.includes('Historical bytes changed')));
    assert.ok(result.errors.some(error => error.includes('Old copy still exists')));
    assert.ok(result.errors.some(error => error.includes('Missing migrated artifact')));
});

test('missing local-only evidence is reported separately and strict local verification rejects it', context => {
    const root = fixture(context);
    migrateReviewArtifacts({ repoDir: root });
    fs.unlinkSync(path.join(root, newRun, 'sources/local.txt'));
    const portable = checkReviewMigration({ repoDir: root });
    assert.deepEqual(portable.errors, []);
    assert.deepEqual(portable.unavailableLocal, [`${newRun}/sources/local.txt`]);
    assert.equal(portable.verified, 3);
    assert.ok(checkReviewMigration({ repoDir: root, requireLocal: true }).errors.some(error => error.includes('sources/local.txt')));
});

test('migration preflight refuses an existing destination before moving any source', context => {
    const root = fixture(context);
    fs.mkdirSync(path.join(root, newRun), { recursive: true });
    fs.writeFileSync(path.join(root, newRun, 'plan-manifest.json'), 'existing destination');
    assert.throws(() => migrateReviewArtifacts({ repoDir: root }), /Destination already exists/u);
    assert.ok(fs.existsSync(path.join(root, oldRun, '01.json')));
    assert.ok(fs.existsSync(path.join(root, oldRun, 'grading-cases/01-cases.json')));
    assert.equal(fs.readFileSync(path.join(root, newRun, 'plan-manifest.json'), 'utf8'), 'existing destination');
});

test('verification rejects manifest destinations outside the fixed review namespace', context => {
    const root = fixture(context);
    migrateReviewArtifacts({ repoDir: root });
    const file = path.join(root, newRun, 'migration-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.entries[0].new_path = '../outside.json';
    fs.writeFileSync(file, JSON.stringify(manifest));
    assert.throws(() => checkReviewMigration({ repoDir: root }), /Unexpected migration mapping/u);
});
