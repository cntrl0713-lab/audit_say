import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
    validateQuestionSetV3,
} from './questionV3.ts';
import type {
    PublicQuestionSetV3,
    QuestionSetV3,
} from './questionV3.ts';
import { decryptAuthoringQuestionBankV3 } from './questionV3Encryption.ts';

interface CachedQuestionSets {
    file: string;
    mtimeMs: number;
    size: number;
    keyFingerprint: string;
    sets: QuestionSetV3[];
}

interface CachedPublicQuestionSets {
    mtimeMs: number;
    sets: PublicQuestionSetV3[];
}

let authoringCache: CachedQuestionSets | null = null;
let publicCache: CachedPublicQuestionSets | null = null;

function authoringPath(): string {
    return process.env.CPA_QUESTION_V3_AUTHORING_PATH
        ? path.resolve(process.env.CPA_QUESTION_V3_AUTHORING_PATH)
        : path.join(process.cwd(), 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
}

function encryptedAuthoringPath(): string {
    return process.env.CPA_QUESTION_V3_ENCRYPTED_PATH
        ? path.resolve(process.env.CPA_QUESTION_V3_ENCRYPTED_PATH)
        : path.join(process.cwd(), 'data/cpa_question_sets_v3.authoring.enc.json');
}

function publicPath(): string {
    return process.env.CPA_QUESTION_V3_PUBLIC_PATH
        ? path.resolve(process.env.CPA_QUESTION_V3_PUBLIC_PATH)
        : path.join(process.cwd(), 'cpa_uploader/data/cpa_question_sets_v3.public.json');
}

function authoringEncryptionKey(): string {
    const secret = process.env.CPA_QUESTION_V3_ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('CPA_QUESTION_V3_ENCRYPTION_KEY가 설정되지 않았습니다.');
    }
    return secret;
}

export function resolveAuthoringQuestionBankPath(
    plaintextFile: string,
    encryptedFile: string,
    nodeEnv = process.env.NODE_ENV,
): string {
    if (nodeEnv === 'production') return encryptedFile;
    return fs.existsSync(plaintextFile) ? plaintextFile : encryptedFile;
}

export function loadAuthoringQuestionSetsV3(): QuestionSetV3[] {
    const plaintextFile = authoringPath();
    const encryptedFile = encryptedAuthoringPath();
    const file = resolveAuthoringQuestionBankPath(plaintextFile, encryptedFile);
    if (!fs.existsSync(file)) {
        throw new Error('v3 authoring 문제 파일이 없습니다. 평문 또는 암호화된 배포 문제은행을 확인하세요.');
    }

    const stat = fs.statSync(file);
    const secret = file === plaintextFile ? '' : authoringEncryptionKey();
    const keyFingerprint = secret
        ? crypto.createHash('sha256').update(secret, 'utf8').digest('hex')
        : '';
    if (
        authoringCache?.file === file
        && authoringCache.mtimeMs === stat.mtimeMs
        && authoringCache.size === stat.size
        && authoringCache.keyFingerprint === keyFingerprint
    ) {
        return authoringCache.sets;
    }

    const fileContents = fs.readFileSync(file, 'utf8');
    const plaintext = file === plaintextFile
        ? fileContents
        : decryptAuthoringQuestionBankV3(
            fileContents,
            secret,
        );
    const parsed = JSON.parse(plaintext) as unknown;
    if (!Array.isArray(parsed)) throw new Error('v3 문제 파일의 루트는 배열이어야 합니다.');

    const sets: QuestionSetV3[] = [];
    const errors: string[] = [];
    for (const [index, candidate] of parsed.entries()) {
        const result = validateQuestionSetV3(candidate, {
            verifySourceQuotes: process.env.NODE_ENV !== 'production',
        });
        if (result.errors.length > 0) {
            errors.push(...result.errors.map((error) => `[${index}] ${error}`));
        } else {
            sets.push(candidate as QuestionSetV3);
        }
    }
    if (errors.length > 0) {
        throw new Error(`v3 문제 데이터 검증 실패:\n${errors.join('\n')}`);
    }

    authoringCache = {
        file,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        keyFingerprint,
        sets,
    };
    return sets;
}

export function loadPublicQuestionSetsV3(): PublicQuestionSetV3[] {
    const file = publicPath();
    if (!fs.existsSync(file)) throw new Error('v3 공개 문제 파일이 없습니다.');

    const stat = fs.statSync(file);
    if (publicCache?.mtimeMs === stat.mtimeMs) return publicCache.sets;

    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) throw new Error('v3 공개 문제 파일의 루트는 배열이어야 합니다.');
    for (const [index, candidate] of parsed.entries()) {
        if (
            typeof candidate !== 'object'
            || candidate === null
            || typeof (candidate as Record<string, unknown>).id !== 'string'
            || !Array.isArray((candidate as Record<string, unknown>).subquestions)
        ) {
            throw new Error(`[${index}] v3 공개 문제 형식이 올바르지 않습니다.`);
        }
    }

    const sets = parsed as PublicQuestionSetV3[];
    publicCache = { mtimeMs: stat.mtimeMs, sets };
    return sets;
}

export function findAuthoringQuestionSetV3(id: string): QuestionSetV3 {
    const set = loadAuthoringQuestionSetsV3().find((candidate) => candidate.id === id);
    if (!set) throw new Error(`v3 문제 세트를 찾을 수 없습니다: ${id}`);
    return set;
}
