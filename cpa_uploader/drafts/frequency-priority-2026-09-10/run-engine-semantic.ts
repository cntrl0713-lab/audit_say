import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewQuestionDraft } from '../../questionSemanticReview.ts';
import type { QuestionSetV3 } from '../../../lib/questionV3.ts';
import { createHash } from 'node:crypto';
const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../..');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sets: QuestionSetV3[] = fs.readdirSync(base).filter(f => /^draft-\d{2}-\d{3}-freq01\.json$/u.test(f)).map(f => read(path.join(base, f)));
const bank: QuestionSetV3[] = [...read(path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json')), ...sets];
const run = process.argv[2] || 'engine-r1';
if (!/^[a-z0-9-]+$/u.test(run)) throw new Error('Invalid run name');
const out = path.join(base, 'semantic-review', run);
fs.mkdirSync(out, { recursive: true });
const codes = ['cpa_uploader/questionSemanticReview.ts', 'cpa_uploader/questionReviewIdentity.ts'];
const snapshot = JSON.stringify({ questions: sets, bank, model: 'gpt-5.6-luna', code_hashes: Object.fromEntries(codes.map(f => [f, createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')])) }, null, 2);
if (fs.existsSync(path.join(out, 'input-snapshot.json'))) throw new Error('Use a fresh run name');
fs.writeFileSync(path.join(out, 'input-snapshot.json'), snapshot);
void (async () => {
    let next = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
        while (next < sets.length) {
            const set = sets[next++];
            const traces: unknown[] = [];
            try {
                const receipt = await reviewQuestionDraft(set, { bank, model: 'gpt-5.6-luna',
                    authoringPlan: read(path.join(base, `${set.id}.json.authoring-plan.json`)).plans[0],
                    onChunk(event) {
                        traces.push(event);
                        fs.writeFileSync(path.join(out, `${set.id}.chunks.json`), JSON.stringify({ events: traces }, null, 2));
                        console.log(JSON.stringify({ set_id: set.id, unit_id: event.unit_id, attempt: event.attempt, error: event.error ?? null }));
                    } });
                fs.writeFileSync(path.join(out, `${set.id}.review.json`), JSON.stringify({ schema_version: '1.0', reviews: [receipt] }, null, 2));
                console.log(JSON.stringify({ set_id: set.id, verdict: receipt.verdict, units: receipt.units.length, cases: receipt.cases.length }));
            } catch (error) {
                fs.writeFileSync(path.join(out, `${set.id}.error.json`), JSON.stringify({ error: String(error), completed_units: traces.length }, null, 2));
                console.log(JSON.stringify({ set_id: set.id, error: String(error) }));
                process.exitCode = 1;
            }
        }
    }));
})();
