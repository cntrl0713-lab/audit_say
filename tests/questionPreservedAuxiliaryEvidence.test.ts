import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertEfficientEvidenceUnchanged, createEfficientValidationContext, readPreservedAuxiliaryInput } from '../cpa_uploader/questionEfficientReview.ts';

test('historical generated evidence follows only the same manifest collection and preserved hash', context => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-auxiliary-'));
    context.after(() => { assert.equal(path.dirname(root), os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); });
    const hash = (text: string) => createHash('sha256').update(text).digest('hex');
    const original = { file: 'cpa_uploader/analysis/question-elements/question-elements.json', sha256: hash('historical') };
    const archiveFile = 'cpa_uploader/raw/materials/verification/' + original.sha256.slice(0, 16) + '/question-elements.json';
    const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); return { file, sha256: hash(text) }; };
    write(original.file, 'current generated view');
    const archived = write(archiveFile, 'historical');
    const collectionFile = 'cpa_uploader/raw/collections/frozen-test/manifest.json';
    const collectionBody = (archivedPath = archiveFile, originalPath = original.file) => JSON.stringify({ version: 1, mode: 'byte_preserving_copy', entries: [{ original_path: originalPath, sha256: original.sha256, archived_path: archivedPath }] });
    const collection = write(collectionFile, collectionBody());
    const inputs = [original, archived, collection];
    const c = createEfficientValidationContext();
    assert.equal(readPreservedAuxiliaryInput(original, inputs, c, root), 'historical');
    assert.equal(c.preservedAuxiliaryInputs?.size, 1);
    assertEfficientEvidenceUnchanged(c);
    assert.equal(fs.readFileSync(path.join(root, original.file), 'utf8'), 'current generated view');
    assert.throws(() => readPreservedAuxiliaryInput(original, [original, collection], createEfficientValidationContext(), root), /same manifest/);
    assert.throws(() => readPreservedAuxiliaryInput(original, [original, archived], createEfficientValidationContext(), root), /no manifest-bound/);
    const collectionAlias = { ...collection, file: 'cpa_uploader/raw/collections/..\\collections\\frozen-test/manifest.json' };
    assert.throws(() => readPreservedAuxiliaryInput(original, [original, archived, collectionAlias], createEfficientValidationContext(), root), /no manifest-bound/);
    assert.throws(() => readPreservedAuxiliaryInput(original, inputs, createEfficientValidationContext(), root, new Set([original.file])), /Changed evidence/);
    assert.throws(() => readPreservedAuxiliaryInput(original, inputs, createEfficientValidationContext(), root, new Set(['cpa_uploader/analysis/question-elements/./question-elements.json'])), /Changed evidence/);
    const unmapped = write(collectionFile, collectionBody(archiveFile, 'different-original.json'));
    assert.throws(() => readPreservedAuxiliaryInput(original, [original, archived, unmapped], createEfficientValidationContext(), root), /no manifest-bound/);
    const unsafe = write(collectionFile, collectionBody('cpa_uploader/raw/materials/verification/../../outside.json'));
    assert.throws(() => readPreservedAuxiliaryInput(original, [original, archived, unsafe], createEfficientValidationContext(), root), /Unsafe preserved/);
    write(collectionFile, collectionBody());
    write(archiveFile, 'tampered');
    assert.throws(() => assertEfficientEvidenceUnchanged(c), /Evidence changed during validation/);
    assert.throws(() => readPreservedAuxiliaryInput(original, inputs, createEfficientValidationContext(), root), /Changed evidence/);
});

test('primary and unregistered evidence cannot fall back to a preserved auxiliary file', context => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-auxiliary-primary-'));
    context.after(() => { assert.equal(path.dirname(root), os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); });
    for (const file of ['bank.json', 'policy.json', 'runtime.ts', 'observation.json', 'cpa_uploader/data/official/source.txt']) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), 'changed');
        const identity = { file, sha256: createHash('sha256').update('original').digest('hex') };
        assert.throws(() => readPreservedAuxiliaryInput(identity, [identity], createEfficientValidationContext(), root), /Changed evidence/);
    }
});
