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
        // Retirement/splitting may replace set IDs without changing the cross-set source contract.
        const sources = new Map<string, { set: QuestionSetV3; sourceIndex: number }>();
        let pair: { first: QuestionSetV3; second: QuestionSetV3; firstIndex: number; secondIndex: number } | undefined;
        for (const set of bank) {
            for (const [sourceIndex, source] of set.source_refs.entries()) {
                const prior = sources.get(source.source_quote);
                if (prior && prior.set.id !== set.id) { pair = { first: prior.set, second: set, firstIndex: prior.sourceIndex, secondIndex: sourceIndex }; break; }
                sources.set(source.source_quote, { set, sourceIndex });
            }
            if (pair) break;
        }
        assert.ok(pair, 'The bank must contain an actual source quote reused by different sets');
        const { first, second, firstIndex, secondIndex } = pair;
        const sharedSource = second.source_refs[secondIndex];
        assert.equal(first.source_refs[firstIndex].source_quote, sharedSource.source_quote);
        const dataDir = path.join(temp, 'cpa_uploader/data');
        fs.mkdirSync(dataDir, { recursive: true });
        const authoringPath = path.join(dataDir, 'cpa_question_sets_v3.authoring.json');
        const publicPath = path.join(dataDir, 'cpa_question_sets_v3.public.json');
        const promotionsPath = path.join(dataDir, 'cpa_question_sets_v3.promotions.json');
        fs.copyFileSync(path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.promotions.json'), promotionsPath);
        const env = { ...process.env,
            CPA_QUESTION_V3_AUTHORING_PATH: authoringPath,
            CPA_QUESTION_V3_PUBLIC_PATH: publicPath,
            CPA_QUESTION_V3_PROMOTIONS_PATH: promotionsPath,
            CPA_QUESTION_V3_ENCRYPTED_PATH: path.join(temp, 'authoring.enc.json'),
        };
        const run = () => {
            fs.writeFileSync(authoringPath, JSON.stringify(bank));
            fs.writeFileSync(publicPath, JSON.stringify(bank.map(compilePublicQuestionSet)));
            return spawnSync(process.execPath, ['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'cpa_uploader/validate_cpa_v3.ts')], { cwd: root, env, encoding: 'utf8' });
        };
        const valid = run();
        assert.equal(valid.status, 0, valid.stderr);
        second.source_refs.push({ ...sharedSource, id: 'redundant-source' });
        const duplicate = run();
        assert.equal(duplicate.status, 1);
        assert.ok(duplicate.stderr.includes(`${second.id}/redundant-source: source_quote가 ${second.id}/${sharedSource.id}와 중복됩니다`), duplicate.stderr);
        second.source_refs.pop();
        sharedSource.source_quote = '실제 출처에 없는 조작된 회계감사 기준 문장';
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
