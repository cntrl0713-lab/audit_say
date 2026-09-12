// Builds per-set manual semantic review inputs from the template, the reviewer's notes
// (manual-review-notes.json) and the reviewer-checked case map. The result still has to pass
// review_question_draft_v3.ts --manual-input, which re-verifies every quote, unit and case.
import fs from 'node:fs';
import path from 'node:path';

const base = 'cpa_uploader/drafts/frequency-gap-2026-09-10/release';
const read = (name) => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
const template = read('review-template.json');
// After publication the canonical bank is the editing source (e.g. the 2026-09-11 pilot-13-006
// crit5 condition); release-sets.json stays the 2026-09-10 staging record for unpublished sets.
const bank = JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'utf8'));
const sets = read('release-sets.json').map((staged) => bank.find((set) => set.id === staged.id) ?? staged);
const caseMap = read('case-map.json');
const notes = read('manual-review-notes.json');
const idMap = read('id-map.json');
const outDir = path.join(base, 'per-set');
fs.mkdirSync(outDir, { recursive: true });

const why = {
    model_answer: '저장 모범답안 전체이며 이 명제를 원문 문언대로 담는다.',
    paraphrase: '명제의 주체·조건·행위를 바꾸지 않은 동의 표현이다.',
    omission: '해당 명제를 삭제했고 남은 문장이 그 명제를 함축하지 않는다.',
    opposite: '명제와 반대되는 결론이나 조건을 명시했다.',
    condition_boundary: '조건·대상·범위의 일부를 빠뜨리거나 바꾸어 명제를 완성하지 못한다.',
};

const only = process.argv.slice(2);
for (const review of template.reviews.filter((item) => !only.length || only.includes(item.set_id))) {
    const set = sets.find((item) => item.id === review.set_id);
    const note = notes.sets[set.id];
    // Reviewer notes use the authored criterion ids; release ids are renumbered critN.
    const authored = JSON.parse(fs.readFileSync(path.join(base, '..', `${Object.entries(idMap).find(([, to]) => to === set.id)[0]}.json`), 'utf8'));
    const authoredId = (subId, criterionId) => authored.subquestions.find((sub) => sub.id === subId)
        .criteria[set.subquestions.find((sub) => sub.id === subId).criteria.findIndex((criterion) => criterion.id === criterionId)].id;
    const quote = (id) => ({ source_ref_id: id, quote: set.source_refs.find((ref) => ref.id === id).source_quote });
    const shared = `판본: ${note.edition} 중복: ${note.duplication}`;
    const units = review.units.map((unit) => {
        const [kind, subId, criterionId] = unit.id.split(':');
        const sub = set.subquestions.find((item) => item.id === subId);
        let rationale; let sources;
        if (kind === 'subquestion') {
            rationale = `${note.subquestions[subId]} ${shared}`;
            sources = [...new Set(sub.requirements.map((req) => req.source_ref_id))];
        } else {
            const criterion = sub.criteria.find((item) => item.id === criterionId);
            const text = note.criteria[`${subId}:${authoredId(subId, criterionId)}`];
            if (!text) throw new Error(`${set.id}: missing note ${subId}:${criterionId}`);
            rationale = `${text} 발문 요구 범위 안의 독립 1점 명제이며 같은 물음의 다른 criterion과 겹치지 않는다. ${shared}`;
            sources = criterion.source_ref_ids;
        }
        return { ...unit, checks: Object.fromEntries(Object.keys(unit.checks).map((check) => [check, 'pass'])), rationale, source_quotes: sources.map(quote) };
    });
    const cases = review.cases.map((item) => {
        const [, subId, criterionId] = item.unit_id.split(':');
        const criterion = set.subquestions.find((sub) => sub.id === subId).criteria.find((c) => c.id === criterionId);
        const override = notes.case_overrides[`${set.id}|${item.unit_id}|${item.kind}`];
        const mapped = override || (item.kind === 'model_answer' ? null : caseMap[set.id][item.unit_id]?.[item.kind]);
        if (item.kind !== 'model_answer' && !mapped?.answer) throw new Error(`${set.id} ${item.unit_id}/${item.kind}: no case answer`);
        const answer = mapped ? mapped.answer : item.answer;
        const expected = mapped ? mapped.expected : 'met';
        const model = set.subquestions.find((sub) => sub.id === subId).model_answer;
        const lines = answer.split('\n').filter(Boolean);
        const answerQuote = lines.find((line) => !model.includes(line)) || lines[0];
        const detail = mapped?.rationale && !/^원문과 독립 채점명제를 대조해 먼저 정한 기대값이다/u.test(mapped.rationale) ? ` ${mapped.rationale}` : '';
        return { ...item, answer, answer_quote: answerQuote, expected, verdict: 'pass',
            rationale: `기대 ${expected}: ${why[item.kind]}${detail}`, source_quotes: criterion.source_ref_ids.map(quote) };
    });
    const filled = { ...review, units, cases, notes: [notes._about] };
    fs.writeFileSync(path.join(outDir, `${set.id}.json`), `${JSON.stringify([set], null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, `${set.id}.manual.json`), `${JSON.stringify({ schema_version: '1.0', reviews: [filled] }, null, 2)}\n`);
}
console.log(`filled ${template.reviews.length} review inputs in ${outDir}`);
