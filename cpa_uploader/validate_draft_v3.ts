import fs from 'node:fs';
import path from 'node:path';
import {
    computeQuestionSetMaxPoints,
    validateQuestionSetV3,
} from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { draftConflicts, readQuestionBank } from './questionDraftInventory.ts';

// v3 신규 draft 단독 검증기. authoring 은행에 넣기 전에 실행한다.
//
//   npx tsx cpa_uploader/validate_draft_v3.ts --file <draft.json>
//   npx tsx cpa_uploader/validate_draft_v3.ts --file <draft.json> --against-bank
//
// --against-bank: 현재 은행과 ID·발문 중복을 교차 검사한다. draft 내부 중복은 항상 검사한다.

const root = process.cwd();

function parseArgs(argv: string[]): Record<string, string> {
    const args: Record<string, string> = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--file' || arg === '--against-bank') {
            if (arg === '--file') {
                const value = argv[index + 1];
                if (!value) throw new Error('--file 값이 필요합니다.');
                args[arg] = value;
                index += 1;
            } else {
                args[arg] = '1';
            }
        }
    }
    return args;
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const draftPath = args['--file'];
    if (!draftPath) throw new Error('사용법: validate_draft_v3.ts --file <draft.json> [--against-bank]');
    const absolutePath = path.isAbsolute(draftPath) ? draftPath : path.resolve(root, draftPath);

    const raw: unknown = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    const drafts: QuestionSetV3[] = Array.isArray(raw) ? raw as QuestionSetV3[] : [raw as QuestionSetV3];

    const bank = args['--against-bank'] ? readQuestionBank(root) : [];
    const errors: string[] = draftConflicts(drafts, bank);
    const warnings: string[] = [];
    for (const draft of drafts) {
        const result = validateQuestionSetV3(draft, { verifySourceQuotes: true, cwd: root });
        errors.push(...result.errors.map((error) => `[${draft.id}] ${error}`));
        warnings.push(...result.warnings.map((warning) => `[${draft.id}] ${warning}`));

        console.log(`- ${draft.id}: 물음 ${draft.subquestions.length}개 · criterion ${draft.subquestions.reduce((sum, q) => sum + q.criteria.length, 0)}개 · ${computeQuestionSetMaxPoints(draft)}점 · status=${draft.status}`);
    }

    if (warnings.length > 0) {
        console.warn(`\ndraft 검토 필요: ${warnings.length}개 경고`);
        for (const warning of warnings) console.warn(`- ${warning}`);
    }

    if (errors.length > 0) {
        console.error(`\ndraft 검증 실패: ${errors.length}개 오류`);
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
        return;
    }
    console.log(`\ndraft 검증 통과: ${drafts.length}개 세트 (source quote 원문 실존${args['--against-bank'] ? ' + 기존 은행 발문 중복 없음' : ''})`);
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
