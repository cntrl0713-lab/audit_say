import fs from 'node:fs';
import path from 'node:path';
import {
    validateQuestionSetV3,
} from './questionV3.ts';
import type {
    PublicQuestionSetV3,
    QuestionSetV3,
} from './questionV3.ts';

interface CachedQuestionSets {
    mtimeMs: number;
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

function publicPath(): string {
    return process.env.CPA_QUESTION_V3_PUBLIC_PATH
        ? path.resolve(process.env.CPA_QUESTION_V3_PUBLIC_PATH)
        : path.join(process.cwd(), 'cpa_uploader/data/cpa_question_sets_v3.public.json');
}

export function loadAuthoringQuestionSetsV3(): QuestionSetV3[] {
    const file = authoringPath();
    if (!fs.existsSync(file)) {
        throw new Error('v3 문제 파일이 없습니다. npm run questions:v3:generate를 먼저 실행하세요.');
    }

    const stat = fs.statSync(file);
    if (authoringCache?.mtimeMs === stat.mtimeMs) return authoringCache.sets;

    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
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

    authoringCache = { mtimeMs: stat.mtimeMs, sets };
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
