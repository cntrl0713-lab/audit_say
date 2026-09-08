import fs from 'node:fs';
import path from 'node:path';
import {
    computeQuestionSetMaxPoints,
    validateQuestionSetV3,
} from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

// v3 신규 draft 단독 검증기. authoring 은행에 넣기 전에 실행한다.
//
//   npx tsx cpa_uploader/validate_draft_v3.ts --file <draft.json>
//   npx tsx cpa_uploader/validate_draft_v3.ts --file <draft.json> --against-bank
//
// --against-bank: 기존 은행 65세트와의 발문 중복까지 교차 검사한다.

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

function normalize(value: string): string {
    return value.replace(/\s+/g, '').toLowerCase();
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const draftPath = args['--file'];
    if (!draftPath) throw new Error('사용법: validate_draft_v3.ts --file <draft.json> [--against-bank]');
    const absolutePath = path.isAbsolute(draftPath) ? draftPath : path.resolve(root, draftPath);

    const raw: unknown = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    const drafts: QuestionSetV3[] = Array.isArray(raw) ? raw as QuestionSetV3[] : [raw as QuestionSetV3];

    // 기존 은행과의 교차 중복 검사용 인덱스
    let bankPrompts = new Map<string, string>();
    let bankIds = new Set<string>();
    if (args['--against-bank']) {
        const bankPath = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
        if (fs.existsSync(bankPath)) {
            const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8')) as QuestionSetV3[];
            bankPrompts = new Map(
                bank.flatMap((set) => set.subquestions.map((subquestion) => [normalize(subquestion.prompt), `${set.id}/${subquestion.id}`])),
            );
            bankIds = new Set(bank.map((set) => set.id));
        }
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    for (const draft of drafts) {
        const result = validateQuestionSetV3(draft, { verifySourceQuotes: true, cwd: root });
        errors.push(...result.errors.map((error) => `[${draft.id}] ${error}`));
        warnings.push(...result.warnings.map((warning) => `[${draft.id}] ${warning}`));

        if (bankIds.has(draft.id)) errors.push(`[${draft.id}] 은행에 이미 존재하는 세트 id입니다.`);
        if (args['--against-bank']) {
            for (const subquestion of draft.subquestions) {
                const owner = bankPrompts.get(normalize(subquestion.prompt));
                if (owner) errors.push(`[${draft.id}/${subquestion.id}] 발문이 기존 ${owner}와 중복됩니다.`);
            }
        }

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

main();
