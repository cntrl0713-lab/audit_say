import fs from 'node:fs';
import path from 'node:path';
import {
    compilePublicQuestionSet,
    validateQuestionSetV3,
} from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import {
    decryptAuthoringQuestionBankV3,
    encryptAuthoringQuestionBankV3,
} from '../lib/questionV3Encryption.ts';

const root = process.cwd();
const authoringPath = process.env.CPA_QUESTION_V3_AUTHORING_PATH
    ? path.resolve(process.env.CPA_QUESTION_V3_AUTHORING_PATH)
    : path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const encryptedPath = process.env.CPA_QUESTION_V3_ENCRYPTED_PATH
    ? path.resolve(process.env.CPA_QUESTION_V3_ENCRYPTED_PATH)
    : path.join(root, 'data/cpa_question_sets_v3.authoring.enc.json');
const publicPath = process.env.CPA_QUESTION_V3_PUBLIC_PATH
    ? path.resolve(process.env.CPA_QUESTION_V3_PUBLIC_PATH)
    : path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.public.json');
const secret = process.env.CPA_QUESTION_V3_ENCRYPTION_KEY || '';

if (!fs.existsSync(authoringPath)) throw new Error(`authoring 문제은행을 찾을 수 없습니다: ${authoringPath}`);
if (!secret) throw new Error('CPA_QUESTION_V3_ENCRYPTION_KEY가 필요합니다.');

const plaintext = fs.readFileSync(authoringPath, 'utf8');
const parsed = JSON.parse(plaintext) as unknown;
if (!Array.isArray(parsed)) throw new Error('authoring 문제은행의 루트는 배열이어야 합니다.');
const sets = parsed as QuestionSetV3[];
const errors = sets.flatMap((set, index) => [
    ...(set.status === 'published' ? [] : [`[${index}:${set.id}] status가 published가 아닙니다.`]),
    ...(set.verification.review_status === 'verified'
        ? []
        : [`[${index}:${set.id}] review_status가 verified가 아닙니다.`]),
    ...validateQuestionSetV3(set, { verifySourceQuotes: true })
        .errors.map((error) => `[${index}:${set.id}] ${error}`),
]);
if (errors.length > 0) throw new Error(`authoring 문제은행 검증 실패:\n${errors.join('\n')}`);

const encrypted = encryptAuthoringQuestionBankV3(plaintext, secret);
if (decryptAuthoringQuestionBankV3(encrypted, secret) !== plaintext) {
    throw new Error('암호화 문제은행 round-trip 검증에 실패했습니다.');
}
fs.mkdirSync(path.dirname(encryptedPath), { recursive: true });
fs.mkdirSync(path.dirname(publicPath), { recursive: true });
const encryptedTempPath = `${encryptedPath}.${process.pid}.tmp`;
const publicTempPath = `${publicPath}.${process.pid}.tmp`;
fs.writeFileSync(encryptedTempPath, encrypted, 'utf8');
fs.writeFileSync(publicTempPath, `${JSON.stringify(sets.map(compilePublicQuestionSet), null, 2)}\n`, 'utf8');
fs.renameSync(encryptedTempPath, encryptedPath);
fs.renameSync(publicTempPath, publicPath);
console.log(`v3 배포 문제은행 생성 완료: ${sets.length}세트`);
