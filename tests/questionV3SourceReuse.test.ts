import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

test('bank validation permits cross-set source reuse but rejects redundant entries and fabricated quotes', () => {
    const root = process.cwd();
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-source-reuse-'));
    try {
        const bank = JSON.parse(fs.readFileSync(path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'), 'utf8')) as QuestionSetV3[];
        for (const set of bank) for (const source of set.source_refs) source.file = path.resolve(root, source.file);
        const first = bank.find(s => s.id === 'pilot-07-002')!;
        const second = bank.find(s => s.id === 'pilot-07-004')!;
        assert.equal(first.source_refs[0].source_quote, second.source_refs[0].source_quote);
        const dataDir = path.join(temp, 'cpa_uploader/data');
        fs.mkdirSync(dataDir, { recursive: true });
        const run = () => {
            fs.writeFileSync(path.join(dataDir, 'cpa_question_sets_v3.authoring.json'), JSON.stringify(bank));
            fs.writeFileSync(path.join(dataDir, 'cpa_question_sets_v3.public.json'), JSON.stringify(bank.map(compilePublicQuestionSet)));
            return spawnSync(process.execPath, ['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'cpa_uploader/validate_cpa_v3.ts')], { cwd: temp, encoding: 'utf8' });
        };
        const valid = run();
        assert.equal(valid.status, 0, valid.stderr);
        second.source_refs.push({ ...second.source_refs[0], id: 'redundant-source' });
        const duplicate = run();
        assert.equal(duplicate.status, 1);
        assert.match(duplicate.stderr, /pilot-07-004\/redundant-source: source_quote가 pilot-07-004\/src1와 중복됩니다/);
        second.source_refs.pop();
        second.source_refs[0].source_quote = '실제 출처에 없는 조작된 회계감사 기준 문장';
        const fabricated = run();
        assert.equal(fabricated.status, 1);
        assert.match(fabricated.stderr, /source_quote가 source file에 존재하지 않습니다/);
    } finally {
        // mkdtemp owns this exact directory; no computed workspace deletion.
        assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(temp).startsWith('audit-source-reuse-'));
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
