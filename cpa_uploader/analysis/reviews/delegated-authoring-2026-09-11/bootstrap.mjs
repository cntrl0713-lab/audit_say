import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const out = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const assignments = 'docs/plans/question-authoring-by-topic-2026-09-11/assignments';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const readSet = file => { const value = read(file); return Array.isArray(value) ? value[0] : value; };
const write = (file, value) => fs.writeFileSync(path.join(out, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const inventory = [];
function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name).replaceAll('\\', '/');
        if (entry.isDirectory()) visit(file);
        else if (file.endsWith('.json')) {
            let value; try { value = read(file); } catch { continue; }
            const sets = Array.isArray(value) ? value : Array.isArray(value?.sets) ? value.sets : [value];
            if (sets.length && sets.every(set => set && typeof set.id === 'string' && Array.isArray(set.subquestions))) {
                inventory.push({ file, sha256: hash(file), ids: sets.map(set => set.id) });
            }
        }
    }
}
visit('cpa_uploader/data'); visit('cpa_uploader/drafts');
const bankFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank = read(bankFile);
const existing = {
    'T04-A': 'cpa_uploader/drafts/frequency-priority-2026-09-10/draft-04-320-freq01.json',
    'T09-A': 'cpa_uploader/drafts/frequency-priority-2026-09-10/draft-09-501-freq01.json',
    'T09-B': 'cpa_uploader/drafts/frequency-priority-2026-09-10/draft-09-505-freq01.json',
    'T10-A': 'cpa_uploader/drafts/frequency-priority-2026-09-10/draft-10-530-freq01.json',
    'T12-A': 'cpa_uploader/drafts/frequency-priority-2026-09-10/draft-12-560-freq01.json',
    'T12-B': 'cpa_uploader/drafts/frequency-priority-2026-09-10/draft-12-570-freq01.json',
    'T05-A': 'cpa_uploader/drafts/frequency-gap-2026-09-10/release/per-set/pilot-05-008.json',
};
const active = Object.entries(existing).map(([plan_id, file]) => ({ plan_id, file, id: readSet(file).id, sha256: hash(file) }));
const seen = new Set(inventory.flatMap(row => row.ids));
const ledger = [];
for (const file of ['r01','r02','n01','n02','n03','n04','n05','n06','s01','s02','s03','s04','s05','s06']) {
    const text = fs.readFileSync(`${assignments}/${file}.md`, 'utf8');
    for (const match of text.matchAll(/^\| `(T(\d\d)-[A-Z])` \|.*$/gm)) {
        const plan_id = match[1], topic = match[2], predecessor = existing[plan_id] || null;
        let id = predecessor ? readSet(predecessor).id : null;
        if (!id) {
            let seq = 1;
            for (const current of seen) {
                const m = current.match(new RegExp(`^pilot-${topic}-(\\d+)$`));
                if (m) seq = Math.max(seq, +m[1] + 1);
            }
            id = `pilot-${topic}-${String(seq).padStart(3,'0')}`; seen.add(id);
        }
        const questions = [...match[0].matchAll(/`(T\d\d-[A-Z]-Q\d+)` (\d+)점/g)].map((m,i) => ({plan_question_id:m[1], provisional_points:+m[2], suggested_id:predecessor ? readSet(predecessor).subquestions[i].id : `sub${i+1}`}));
        ledger.push({ plan_id, package:file.toUpperCase(), topic_id:topic, set_id:id, kind:predecessor?'continuation':'new', predecessor, predecessor_sha256:predecessor?hash(predecessor):null, output_directory:`cpa_uploader/drafts/delegated-authoring-2026-09-11/${file}/`, questions, stage:'assigned', actual_file:null });
    }
}
if (ledger.length !== 49 || new Set(ledger.map(x=>x.plan_id)).size !== 49 || new Set(ledger.map(x=>x.set_id)).size !== 49 || ledger.flatMap(x=>x.questions).length !== 131) throw Error('배정 장부 합계 또는 ID 충돌');
const files = [bankFile, 'cpa_uploader/data/cpa_question_sets_v3.public.json', 'cpa_uploader/analysis/question-elements/question-elements.json', 'cpa_uploader/analysis/coverage/links.json', 'lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/ai/openaiStructured.ts', 'cpa_uploader/questionSemanticReview.ts', 'cpa_uploader/questionReviewGrading.ts', 'cpa_uploader/review_question_draft_v3.ts', 'cpa_uploader/generate_cpa_v3.ts', 'cpa_uploader/questionAuthoringPlan.ts'];
write('input-baseline.json',{created_at:new Date().toISOString(),root,exam_year:2027,exam_year_authority:'사용자가 현재 실행에서 2027년 CPA 시험 적용 기준으로 명시',edition_status:'공식 출제범위와 각 기준서 시행·예외 대조 진행 중',bank_counts:{sets:bank.length,questions:bank.reduce((a,s)=>a+s.subquestions.length,0)},files:files.map(file=>({file,sha256:hash(file)})),settings:{review_model:process.env.CPA_REVIEW_MODEL||null,generation_model:process.env.CPA_GENERATION_MODEL||null,grading_model:process.env.OPENAI_GRADING_MODEL||process.env.CPA_GRADING_MODEL||null,openai_api_key_present:Boolean(process.env.OPENAI_API_KEY)},publication_authorized:false});
write('input-inventory.json',{created_at:new Date().toISOString(),inventory,active_drafts:active,selection:'은행104 + priority 개별6 + 최신 per-set pilot-05-008 한 개. 나머지 gap 원초안·release사본·합본은 역사본 또는 은행사본으로 제외.'});
write('id-ledger.json',{version:1,exam_year:2027,allocation:'전역 문항 파일 ID 전수 조사 후 총괄 수동 작성용 ID 배정. 생성 CLI의 자동 배정에 위임하지 않음.',entries:ledger});
write('comparison-initial.json',[...bank,...active.map(x=>readSet(x.file))]);
console.log(JSON.stringify({ledger:ledger.length,questions:ledger.flatMap(x=>x.questions).length,active_drafts:active.length,comparison:bank.length+active.length,n01:ledger.filter(x=>x.package==='N01').map(x=>({plan:x.plan_id,id:x.set_id}))}));
