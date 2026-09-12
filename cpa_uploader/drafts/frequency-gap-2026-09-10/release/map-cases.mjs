// Maps the author QA cases onto the review template's per-criterion case slots.
// Writes release/case-map.json for the reviewer to verify and override; not a review receipt.
import fs from 'node:fs';
import path from 'node:path';

const base = 'cpa_uploader/drafts/frequency-gap-2026-09-10';
const template = JSON.parse(fs.readFileSync(path.join(base, 'release/review-template.json'), 'utf8'));
const sets = JSON.parse(fs.readFileSync(path.join(base, 'release/release-sets.json'), 'utf8'));
const idMap = JSON.parse(fs.readFileSync(path.join(base, 'release/id-map.json'), 'utf8'));
const draftId = Object.fromEntries(Object.entries(idMap).map(([from, to]) => [to, from]));
const kindOf = {
    model_answer: 'model_answer', paraphrase: 'paraphrase', accepted_paraphrase: 'paraphrase', equivalent_expression: 'paraphrase',
    omission: 'omission', proposition_omission: 'omission', opposite: 'opposite', opposite_meaning: 'opposite', contradiction: 'opposite',
    condition_boundary: 'condition_boundary',
};

const out = {};
for (const review of template.reviews) {
    const released = sets.find((item) => item.id === review.set_id);
    // QA cases name the authored criterion ids; release ids differ only by the critN renumbering.
    const set = JSON.parse(fs.readFileSync(path.join(base, `${draftId[released.id]}.json`), 'utf8'));
    set.id = released.id;
    const qa = JSON.parse(fs.readFileSync(path.join(base, `qa-${draftId[set.id].replace('draft-', '')}.json`), 'utf8'));
    const slots = {};
    const releasedId = (subId, criterionId) => {
        const sub = set.subquestions.find((item) => item.id === subId);
        return released.subquestions.find((item) => item.id === subId).criteria[sub.criteria.findIndex((item) => item.id === criterionId)].id;
    };
    for (const sub of set.subquestions) {
        const core = qa.cases.filter((item) => item.subquestion_id === sub.id && kindOf[item.kind]);
        core.forEach((item, index) => {
            let target = item.target_criterion_id;
            const match = /^sub\d+[-.]((?:sub\d+\.)?(?:c|crit)\d+)[-.]/u.exec(item.id);
            if (!target && match) target = sub.criteria.find((criterion) => criterion.id === match[1] || criterion.id === `${sub.id}.${match[1]}`)?.id;
            if (!target) target = sub.criteria[Math.floor(index / 5)]?.id;
            if (!sub.criteria.some((criterion) => criterion.id === target)) throw new Error(`${set.id}/${item.id}: target not found`);
            const unit = `criterion:${sub.id}:${releasedId(sub.id, target)}`;
            const kind = kindOf[item.kind];
            const expected = item.expected_verdicts.find((verdict) => verdict.criterion_id === target).verdict;
            (slots[unit] ||= {})[kind] = { answer: item.answer, expected, qa_id: item.id, rationale: item.rationale };
        });
    }
    out[set.id] = slots;
}
fs.writeFileSync(path.join(base, 'release/case-map.json'), `${JSON.stringify(out, null, 2)}\n`);

// Compact dump for reading.
for (const set of sets) {
    console.log(`\n##### ${set.id} (${draftId[set.id]}) ${set.title}`);
    for (const sub of set.subquestions) {
        console.log(`\n[${sub.id}] ${sub.prompt}`);
        for (const criterion of sub.criteria) {
            const unit = `criterion:${sub.id}:${criterion.id}`;
            const slot = out[set.id][unit] || {};
            console.log(`  <${criterion.id}> ${criterion.claim}`);
            for (const kind of ['paraphrase', 'omission', 'opposite', 'condition_boundary']) {
                const item = slot[kind];
                if (!item) { console.log(`     ${kind.slice(0, 4)}=MISSING`); continue; }
                // Show only lines that differ from the model answer.
                const lines = item.answer.split('\n');
                const own = lines.filter((line) => !sub.model_answer.includes(line));
                const dropped = sub.model_answer.filter((line) => !lines.includes(line)).map((line) => sub.model_answer.indexOf(line) + 1);
                const shown = own.length ? own.join(' ⏎ ') : '(모범답안 문장만)';
                console.log(`     ${kind.slice(0, 4)}=${item.expected}: ${shown}${dropped.length && own.length !== lines.length ? `  [+모범 ${lines.length - own.length}문장, 삭제 ${dropped.join(',')}]` : ''}`);
            }
        }
    }
}
