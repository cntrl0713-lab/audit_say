import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { rollbackOwnedFiles, canonicalEnvironment, canonicalFiles, parseInstallArgs, assertFreshInstallOutput } from '../install-canonical-v1.ts';
import { hash, realIdentity, E } from '../stage-publication-v1.ts';
import { withPublicationLock, writePublicationFiles } from '../../../../../../questionBankPublication.ts';
const directory = fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'synthetic-fixture-'));
const rows = [];
function test(name, body) { try { body(); rows.push({ name, pass: true }); } catch (e) { rows.push({ name, pass: false, message: e.message }); } }
const identities = file => { const p = realIdentity(file); return process.platform === 'win32' ? p.toLowerCase() : p; };
function syntheticFiles(name) {
    const dir = path.join(directory, name); fs.mkdirSync(dir);
    return ['authoring', 'ledger', 'public', 'encrypted', 'catalog'].map(label => {
        const file = path.join(dir, `${label}.json`), original = Buffer.from(JSON.stringify({ synthetic: label, version: 'before' }) + '\r\n');
        fs.writeFileSync(file, original, { flag: 'wx' });
        return { file, original, allowed_hashes: [hash(original)], real_path: identities(file) };
    });
}
test('Five synthetic files restored byte-exact through production writer under publication lock', () => {
    const files = syntheticFiles('five');
    withPublicationLock(files[0].file, () => {
        const writes = files.map(f => { const content = JSON.stringify({ synthetic: path.basename(f.file), version: 'after' }); f.allowed_hashes.push(hash(content)); return { file: f.file, content }; });
        writePublicationFiles(writes, files.map(f => ({ file: f.file, hash: hash(f.original) })));
        const result = rollbackOwnedFiles(files); assert.equal(result.restored, true);
        files.forEach(f => assert(fs.readFileSync(f.file).equals(f.original)));
    });
    assert(!fs.existsSync(files[0].file + '.publication.lock'));
});
test('Four installed / catalog untouched can roll back all five safely', () => {
    const files = syntheticFiles('four');
    withPublicationLock(files[0].file, () => {
        const writes = files.slice(0, 4).map(f => { const content = '{"synthetic":"installed"}'; f.allowed_hashes.push(hash(content)); return { file: f.file, content }; });
        writePublicationFiles(writes, files.map(f => ({ file: f.file, hash: hash(f.original) })));
        assert.equal(rollbackOwnedFiles(files).restored, true);
    });
});
test('One foreign edit refuses every rollback write and preserves all current bytes', () => {
    const files = syntheticFiles('foreign');
    withPublicationLock(files[0].file, () => {
        for (const f of files) { const bytes = Buffer.from('{"synthetic":"ours"}'); f.allowed_hashes.push(hash(bytes)); fs.writeFileSync(f.file, bytes); }
        fs.writeFileSync(files[4].file, '{"synthetic":"other-worker"}');
        const before = files.map(f => fs.readFileSync(f.file));
        assert.equal(rollbackOwnedFiles(files).status, 'refused_foreign_or_unknown_change');
        files.forEach((f, i) => assert(fs.readFileSync(f.file).equals(before[i])));
    });
});
test('Missing or unknown partial file refuses rollback', () => {
    const files = syntheticFiles('partial'); fs.writeFileSync(files[1].file, '{"synthetic":');
    assert.equal(rollbackOwnedFiles(files).restored, false);
    fs.unlinkSync(files[1].file); assert.equal(rollbackOwnedFiles(files).restored, false);
});
test('Changed real-path declaration refuses restoration', () => {
    const files = syntheticFiles('identity'); files[0].real_path += '.not-this-file'; assert.equal(rollbackOwnedFiles(files).restored, false);
});
test('Production writer stale guard leaves synthetic originals unchanged', () => {
    const files = syntheticFiles('stale');
    assert.throws(() => writePublicationFiles([{ file: files[0].file, content: '{"synthetic":"after"}' }], [{ file: files[0].file, hash: 'a'.repeat(64) }]));
    files.forEach(f => assert(fs.readFileSync(f.file).equals(f.original)));
});
test('Publication lock refuses second installer and preserves lock owner', () => {
    const files = syntheticFiles('locked');
    withPublicationLock(files[0].file, () => {
        assert.throws(() => withPublicationLock(files[0].file, () => { throw Error('must not run'); }), /EEXIST/);
        assert(fs.existsSync(files[0].file + '.publication.lock'));
    });
    assert(!fs.existsSync(files[0].file + '.publication.lock'));
});
test('Synthetic synchronous error triggers byte rollback before lock release', () => {
    const files = syntheticFiles('failure');
    withPublicationLock(files[0].file, () => {
        try {
            const content = '{"synthetic":"ours"}'; files[0].allowed_hashes.push(hash(content));
            writePublicationFiles([{ file: files[0].file, content }], files.map(f => ({ file: f.file, hash: hash(f.original) })));
            throw Error('synthetic downstream CLI failure');
        } catch {
            assert(fs.existsSync(files[0].file + '.publication.lock')); assert.equal(rollbackOwnedFiles(files).restored, true);
        }
    });
});
test('Non-lossless UTF-8 original is not transcoded during rollback', () => {
    const files = syntheticFiles('utf8'); files[0].original = Buffer.from([0xff]);
    assert.throws(() => rollbackOwnedFiles(files), /UTF-8/);
});
test('Child canonical path scope overrides prior staging and never mutates parent env', () => {
    const env = { CPA_QUESTION_V3_AUTHORING_PATH: 'stage/authoring.json', OPENAI_API_KEY: 'synthetic', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', NODE_OPTIONS: '--synthetic', CPA_QUESTION_V3_ENCRYPTION_KEY: 'synthetic' };
    const previous = structuredClone(env), child = canonicalEnvironment(env);
    assert.deepEqual(env, previous); assert.equal(child.CPA_QUESTION_V3_AUTHORING_PATH, path.resolve(canonicalFiles.authoring));
    assert.equal(child.CPA_QUESTION_V3_ENCRYPTED_PATH, path.resolve(canonicalFiles.encrypted));
    assert.equal(child.OPENAI_API_KEY, undefined); assert.equal(child.SUPABASE_SERVICE_ROLE_KEY, undefined); assert.equal(child.NODE_OPTIONS, undefined);
});
test('Installer defaults dry-run and rejects apply/options without exact completion SHA', () => {
    const args = ['--stage-completion', 'synthetic-completion.json', '--completion-sha256', 'a'.repeat(64), '--preparation-lock', 'synthetic-preparation.json', '--preparation-sha256', 'b'.repeat(64), '--output', 'synthetic-new'];
    assert.equal(parseInstallArgs(args).execute, false);
    assert.throws(() => parseInstallArgs([...args, '--apply'])); assert.throws(() => parseInstallArgs([...args, '--output', 'second']));
    assert.throws(() => parseInstallArgs([...args, '--dry-run', '--execute']));
    assert.throws(() => parseInstallArgs(['--stage-completion', 'no-sha', '--output', 'new']));
});
test('Only a fresh child of root-owned canonical-install-v1 can be selected', () => {
    assertFreshInstallOutput(path.resolve(E, 'canonical-install-v1/synthetic-unused'));
    assert.throws(() => assertFreshInstallOutput(path.resolve(E, 'canonical-install-v1/../candidate-v1')));
    assert.throws(() => assertFreshInstallOutput(path.resolve(E, 'canonical-install-v1')));
    assert.throws(() => assertFreshInstallOutput(directory));
});
fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify({ scope: 'Synthetic files only; no actual bank validation, publication, model API or DB invocation',
    results: rows, passed: rows.filter(r => r.pass).length, failed: rows.filter(r => !r.pass).length, actual_bank_writes: 0, api_calls: 0, db_calls: 0 }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: directory, passed: rows.filter(r => r.pass).length, failed: rows.filter(r => !r.pass) }));
if (rows.some(r => !r.pass)) process.exitCode = 1;
