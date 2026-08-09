import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('the canonical quiz route serves the v3 question bank to authenticated users', () => {
    const quizPage = read('app/quiz/page.tsx');
    const actions = read('app/actions.ts');
    const gradeAction = actions.slice(
        actions.indexOf('export async function gradeQuestionSetV3Action'),
        actions.indexOf('\nexport async function', actions.indexOf('export async function gradeQuestionSetV3Action') + 1),
    );

    assert.match(quizPage, /loadPublicQuestionSetsV3/);
    assert.match(quizPage, /QuizClient/);
    assert.doesNotMatch(gradeAction, /assertAdmin/);
    assert.match(gradeAction, /incrementProgress/);
});

test('the v3 cutover removes duplicate and v2-only runtime files', () => {
    const removedPaths = [
        'app/quiz-v3/page.tsx',
        'app/quiz-v3/QuizV3Client.tsx',
        'app/api/debug/route.ts',
        'structure.md',
        'cpa_uploader/data/cpa_problems_v2.json',
        'cpa_uploader/upload_cpa_v2.ts',
        'cpa_uploader/schema_v2.sql',
        'lib/serverUtils.ts',
        'lib/gradePipeline.ts',
        'lib/quizGrading.ts',
        'lib/rubricJudge.ts',
        'lib/rubric.ts',
        'tests/quizGrading.test.ts',
        'tests/gradePipeline.test.ts',
        'tests/gradeRequestGuards.test.ts',
        'tests/rubricJudge.test.ts',
        'tests/rubricJudgeScenarios.test.ts',
        'tests/rubric.test.ts',
        'tests/rubricCoverage.test.ts',
        'tests/gradeParsing.test.ts',
        'tests/keywordFilter.test.ts',
        'tests/quiz-sampling.test.ts',
        'tests/similarity.test.ts',
        'tests/structure.test.ts',
        'tests/utils.test.ts',
    ];

    for (const relativePath of removedPaths) {
        assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} should be removed`);
    }

    const runtimePaths = [
        'app/actions.ts',
        'app/admin/page.tsx',
        'app/curriculum/page.tsx',
        'app/profile/page.tsx',
        'lib/db.ts',
        'lib/dbAdmin.ts',
    ];
    for (const relativePath of runtimePaths) {
        assert.doesNotMatch(read(relativePath), /cpa_questions_v2|AuditQuestion|ReviewNote/);
    }
});
