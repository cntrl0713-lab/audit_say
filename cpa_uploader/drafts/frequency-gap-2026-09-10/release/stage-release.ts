// Assigns bank set IDs to the reviewed drafts without changing any other content.
// Run from the repository root: npx tsx cpa_uploader/drafts/frequency-gap-2026-09-10/release/stage-release.ts
import fs from 'node:fs';
import path from 'node:path';
import { allocateQuestionSetId, readQuestionBank } from '../../../questionDraftInventory.ts';

const base = 'cpa_uploader/drafts/frequency-gap-2026-09-10';
const drafts = fs.readdirSync(base).filter((name) => /^draft-.*\d\.json$/u.test(name)).sort();
const taken = readQuestionBank().map((set) => set.id);
const sets: unknown[] = [];
const plans: unknown[] = [];
// IDs are allocated once; re-staging after bank inclusion must keep them stable.
const idMapFile = path.join(base, 'release/id-map.json');
const fixedIds: Record<string, string> = fs.existsSync(idMapFile) ? JSON.parse(fs.readFileSync(idMapFile, 'utf8')) : {};
const idMap: Record<string, string> = {};
for (const name of drafts) {
    const set = JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
    const plan = JSON.parse(fs.readFileSync(path.join(base, name.replace(/\.json$/u, '.authoring-plan.json')), 'utf8'));
    if (plan.set_id !== set.id) throw new Error(`${name}: plan set_id mismatch`);
    const id = fixedIds[set.id] ?? allocateQuestionSetId(set.classification.topic_id, taken);
    taken.push(id);
    idMap[set.id] = id;
    // Published sets number criteria crit1..critN across the whole set. When ids repeat across
    // subquestions the grading model answers 'sub1.crit1', which the grader rejects as unknown.
    let sequence = 0;
    for (const sub of set.subquestions) for (const criterion of sub.criteria) criterion.id = `crit${++sequence}`;
    sets.push({ ...set, id });
    plans.push({ ...plan, set_id: id });
}
const leaked = JSON.stringify(sets).match(/draft-\d{2}-\d{3}-\d{3}/gu);
if (leaked) throw new Error(`draft ID remains in set content: ${[...new Set(leaked)].join(', ')}`);
fs.writeFileSync(path.join(base, 'release/release-sets.json'), `${JSON.stringify(sets, null, 2)}\n`);
fs.writeFileSync(path.join(base, 'release/release-plans.json'), `${JSON.stringify({ version: 1, artifact_type: 'question_authoring_plan', plans }, null, 2)}\n`);
fs.writeFileSync(path.join(base, 'release/id-map.json'), `${JSON.stringify(idMap, null, 2)}\n`);
console.log(idMap);
