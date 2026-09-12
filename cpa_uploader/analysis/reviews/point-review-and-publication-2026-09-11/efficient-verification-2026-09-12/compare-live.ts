import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { compilePublicQuestionSet } from '../../../../../lib/questionV3.ts';
import { buildGradingPrompt, buildGradingResponseSchema } from '../../../../../lib/questionV3Grading.ts';
import { contentHash } from '../../../../../lib/learningSubmission.ts';
import { sha256 } from '../../../../questionReviewIdentity.ts';
const here = path.dirname(fileURLToPath(import.meta.url)), folder = path.join(here, 'live-before-publication-v1');
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const summary = read<{ canonical: { file: string; sha256: string }; unselected_live_changes: string[] }>(path.join(folder, 'summary.json'));
assert.equal(sha256(fs.readFileSync(summary.canonical.file)), summary.canonical.sha256);
const live = read<QuestionSetV3[]>(path.join(folder, 'live-source.json')), canonical = read<QuestionSetV3[]>(summary.canonical.file);
const entries = summary.unselected_live_changes.map(id => {
    const a = structuredClone(live.find(s => s.id === id)!), b = structuredClone(canonical.find(s => s.id === id)!);
    const before = a.verification.notes, after = b.verification.notes;
    a.verification.notes = []; b.verification.notes = [];
    assert.equal(contentHash(a), contentHash(b), `${id}: Non-note content differs`);
    a.verification.notes = before; b.verification.notes = after;
    const answers = Object.fromEntries(a.subquestions.map(q => [q.id, q.model_answer.join('\n')]));
    assert.equal(buildGradingPrompt(a, answers), buildGradingPrompt(b, answers));
    assert.equal(contentHash(buildGradingResponseSchema(a, answers)), contentHash(buildGradingResponseSchema(b, answers)));
    assert.equal(contentHash(compilePublicQuestionSet(a)), contentHash(compilePublicQuestionSet(b)));
    return { set_id: id, before_notes: before, canonical_notes: after, note_only: true, actual_grading_and_public_unchanged: true };
});
fs.writeFileSync(path.join(folder, 'unselected-diff-review-v2.json'), JSON.stringify({ reviewed_at: new Date().toISOString(),
    rationale: 'Live source retains earlier report paths; canonical already contains the repository report migration. All unselected differences are verification-note paths. Their questions, answers, sources, points and grading/public inputs are unchanged.', entries,
    unselected_non_note_changes: 0, db_writes: 0, api_calls: 0 }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ unselected_note_only_changes: entries.length, non_note_changes: 0 }));
