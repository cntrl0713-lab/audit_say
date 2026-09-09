import fs from 'node:fs';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { decryptAuthoringQuestionBankV3, encryptAuthoringQuestionBankV3 } from '../lib/questionV3Encryption.ts';
import {
    loadPromotionLedger, publicationPaths, snapshotFile, snapshotSources,
    validateAuthoringBank, validatePromotionLedger, withPublicationLock, writePublicationFiles,
} from '../cpa_uploader/questionBankPublication.ts';

try {
    const paths = publicationPaths();
    const secret = process.env.CPA_QUESTION_V3_ENCRYPTION_KEY || '';
    if (!secret) throw new Error('CPA_QUESTION_V3_ENCRYPTION_KEY가 필요합니다.');
    if (new Set(Object.values(paths)).size !== 4) throw new Error('정본·장부·공개본·암호화본 경로는 서로 달라야 합니다.');
    withPublicationLock(paths.authoring, () => {
        const guards = [snapshotFile(paths.authoring), snapshotFile(paths.ledger), snapshotFile(paths.public), snapshotFile(paths.encrypted)];
        const plaintext = fs.readFileSync(paths.authoring, 'utf8');
        const raw: unknown = JSON.parse(plaintext);
        if (Array.isArray(raw)) guards.push(...snapshotSources(raw as QuestionSetV3[]));
        const result = validateAuthoringBank(raw);
        if (result.errors.length) throw new Error(`authoring 문제은행 검증 실패:\n${result.errors.join('\n')}`);
        const errors = validatePromotionLedger(result.sets, loadPromotionLedger(paths.ledger), true);
        if (errors.length) throw new Error(`게시·검수 검증 실패:\n${errors.join('\n')}`);
        const encrypted = encryptAuthoringQuestionBankV3(plaintext, secret);
        if (decryptAuthoringQuestionBankV3(encrypted, secret) !== plaintext) throw new Error('암호화 문제은행 round-trip 검증에 실패했습니다.');
        writePublicationFiles([
            { file: paths.encrypted, content: encrypted },
            { file: paths.public, content: `${JSON.stringify(result.sets.map(compilePublicQuestionSet), null, 2)}\n` },
        ], guards);
        console.log(`v3 배포 문제은행 생성 완료: ${result.sets.length}세트`);
    });
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
