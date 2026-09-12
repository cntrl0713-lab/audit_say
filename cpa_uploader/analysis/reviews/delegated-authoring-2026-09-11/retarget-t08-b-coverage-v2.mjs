import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { questionHash } from '../../coverage/build-coverage.mjs';
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const file = 'cpa_uploader/analysis/coverage/links.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const previous = read(`${control}/final-153-v1/manifest.json`).entries.find(row => row.plan_id === 'T08-B');
const current = read(`${control}/final-153-v2/manifest.json`).entries.find(row => row.plan_id === 'T08-B');
const loadSet = entry => {
    if (hash(fs.readFileSync(entry.file)) !== entry.sha256) throw Error('고정 문항 변경');
    const raw = read(entry.file); return Array.isArray(raw) ? raw[0] : raw;
};
const oldSet = loadSet(previous), newSet = loadSet(current), expected = structuredClone(oldSet);
expected.subquestions[1].prompt = newSet.subquestions[1].prompt;
if (JSON.stringify(expected) !== JSON.stringify(newSet)) throw Error('검토한 발문 한 곳 이외 변경');
if (JSON.stringify(previous.source_files) !== JSON.stringify(current.source_files)) throw Error('직접 출처 변경');
const before = fs.readFileSync(file), overlay = read(file);
if (hash(before) !== read(`${control}/coverage-followup-applied.json`).current_sha256) throw Error('이전 관계 적용 뒤 외부 변경');
const changes = [];
overlay.links = overlay.links.map(link => {
    if (link.target?.set_id !== newSet.id) return link;
    if (link.target.file !== previous.file) throw Error('이전 활성 대상과 불일치');
    const oldSub = oldSet.subquestions.find(sub => sub.id === link.target.subquestion_id), newSub = newSet.subquestions.find(sub => sub.id === link.target.subquestion_id);
    if (!oldSub || !newSub || questionHash(oldSet, oldSub) !== link.snapshot.question_sha256) throw Error('관계의 이전 의미 대조 입력 불일치');
    const reason = link.target.subquestion_id === 'sub2'
        ? '후속 발문은 선정 자료를 감사증거로 이용할 전제를 명시한다. 기존 criterion의 관련성·신뢰성 조건을 발문에 드러냈으며, 2017년 원발문의 기록에서만 추출한 테스트 한계에 대한 요구보다 확장된 부분 대응 관계를 유지한다.'
        : '후속 문항의 해당 물음·공통지문·정답·criterion·출처는 원본과 같으므로 기존 직접 대응 범위를 유지한다.';
    const next = { ...link, target: { ...link.target, file: current.file }, reason: `${link.reason} ${reason}`,
        review_status: 'needs_review', snapshot: { ...link.snapshot, question_sha256: questionHash(newSet, newSub) },
        provenance: { cohort_manifest: `${control}/final-153-v2/manifest.json`, candidate_sha256: current.sha256,
            previous_link: link, followup_evidence: `${control}/active-selection-v2.json`,
            application_note: '원발문 요소와 이전/후속 발문·동일 명제/출처를 실제 대조하여 활성 경로를 변경했다. 후보 관계 needs_review를 유지하며 의미검수·실제 채점·사람 검수·게시와 별개다.' } };
    changes.push({ id: link.id, subquestion_id: link.target.subquestion_id, relationship: link.relationship,
        previous_question_hash: link.snapshot.question_sha256, current_question_hash: next.snapshot.question_sha256, rationale: reason });
    return next;
});
if (changes.length !== 3) throw Error('T08-B의 세 물음 관계 이외 변경');
fs.writeFileSync(`${control}/coverage-before-t08-b-v2.json`, before, { flag: 'wx' });
fs.writeFileSync(file, JSON.stringify(overlay, null, 2) + '\n');
fs.writeFileSync(`${control}/coverage-t08-b-v2-followup.json`, JSON.stringify({ at: new Date().toISOString(), file,
    before_sha256: hash(before), after_sha256: hash(fs.readFileSync(file)), previous_file: previous.file, current_file: current.file,
    changes, total_links: overlay.links.length, changed_scope: 'T08-B의 활성 대상 세 경로와 sub2 발문의 기존 조건 명시. 출처·요소·원기출 빈도·다른 관계를 변경하지 않음.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ links: changes.length, changed_question_hashes: changes.filter(row => row.previous_question_hash !== row.current_question_hash).length }));
