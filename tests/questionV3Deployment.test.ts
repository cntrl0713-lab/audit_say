import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAuthoringQuestionSetsV3 } from '../lib/questionV3Store.ts';
import {
    decryptAuthoringQuestionBankV3,
    encryptAuthoringQuestionBankV3,
} from '../lib/questionV3Encryption.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

function createEncryptedBundle(payload: unknown, secret: string): string {
    const key = crypto.createHash('sha256')
        .update('audit-say:v3-authoring:v1\0', 'utf8')
        .update(secret, 'utf8')
        .digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf8'),
        cipher.final(),
    ]);
    return JSON.stringify({
        format: 'audit-say-v3-authoring',
        version: 1,
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        auth_tag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
    });
}

function createQuestionSet(sourceFile = 'production-does-not-ship-source.md'): QuestionSetV3 {
    return {
        schema_version: '3.0',
        id: 'pilot-01-001',
        type: 'linked_question_set',
        status: 'needs_review',
        title: '배포용 암호화 문제은행 테스트',
        classification: {
            topic_id: '01',
            part: 'PART1',
            chapter: '감사의 기초',
            domain: 'audit',
            standards: ['KGA 200'],
            tags: ['배포'],
        },
        source_refs: [{
            id: 'src1',
            file: sourceFile,
            source_quote: '합리적인 확신은 높은 수준의 확신이다.',
            role: 'standard',
        }],
        shared_context: { facts: [] },
        learning_order: ['q1'],
        subquestions: [{
            id: 'q1',
            type: 'descriptive',
            prompt: '합리적 확신의 수준을 설명하시오.',
            constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
            selection: { type: 'all', n: null },
            model_answer: ['높은 수준의 확신이다.'],
            requirements: [{
                id: 'q1.r1',
                source_ref_id: 'src1',
                source_quote: '합리적인 확신은 높은 수준의 확신이다.',
            }],
            criteria: [{
                id: 'q1.c1',
                requirement_id: 'q1.r1',
                claim: '합리적 확신은 높은 수준의 확신이라고 설명함',
                critical_facts: [{ id: 'level', type: 'conclusion', expected: '높은 수준' }],
                max_points: 1,
                scores: { met: 1, not_met: 0, contradicted: 0 },
                source_ref_ids: ['src1'],
            }],
        }],
        verification: {
            source_fidelity: 'exact',
            review_status: 'needs_human_review',
            calculation_required: false,
            notes: [],
        },
    };
}

test('encrypted authoring bundles round-trip without exposing plaintext', () => {
    const plaintext = JSON.stringify([createQuestionSet()]);
    const secret = 'deployment-test-secret-with-sufficient-length';
    const encrypted = encryptAuthoringQuestionBankV3(plaintext, secret);

    assert.equal(encrypted.includes('배포용 암호화 문제은행 테스트'), false);
    assert.equal(decryptAuthoringQuestionBankV3(encrypted, secret), plaintext);
});

test('production loads the encrypted authoring bank when the ignored plaintext bank is absent', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'question-v3-deployment-'));
    const encryptedPath = path.join(directory, 'authoring.enc.json');
    const sourcePath = path.join(directory, 'source.md');
    const secret = 'deployment-test-secret-with-sufficient-length';
    fs.writeFileSync(sourcePath, '합리적인 확신은 높은 수준의 확신이다.', 'utf8');
    fs.writeFileSync(encryptedPath, createEncryptedBundle([createQuestionSet(sourcePath)], secret), 'utf8');

    const previous = {
        authoringPath: process.env.CPA_QUESTION_V3_AUTHORING_PATH,
        encryptedPath: process.env.CPA_QUESTION_V3_ENCRYPTED_PATH,
        encryptionKey: process.env.CPA_QUESTION_V3_ENCRYPTION_KEY,
    };
    process.env.CPA_QUESTION_V3_AUTHORING_PATH = path.join(directory, 'missing-authoring.json');
    process.env.CPA_QUESTION_V3_ENCRYPTED_PATH = encryptedPath;
    process.env.CPA_QUESTION_V3_ENCRYPTION_KEY = secret;

    try {
        const sets = loadAuthoringQuestionSetsV3();
        assert.equal(sets.length, 1);
        assert.equal(sets[0].id, 'pilot-01-001');
    } finally {
        if (previous.authoringPath === undefined) delete process.env.CPA_QUESTION_V3_AUTHORING_PATH;
        else process.env.CPA_QUESTION_V3_AUTHORING_PATH = previous.authoringPath;
        if (previous.encryptedPath === undefined) delete process.env.CPA_QUESTION_V3_ENCRYPTED_PATH;
        else process.env.CPA_QUESTION_V3_ENCRYPTED_PATH = previous.encryptedPath;
        if (previous.encryptionKey === undefined) delete process.env.CPA_QUESTION_V3_ENCRYPTION_KEY;
        else process.env.CPA_QUESTION_V3_ENCRYPTION_KEY = previous.encryptionKey;
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
