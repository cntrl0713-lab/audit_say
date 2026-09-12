import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { questionHash } from '../../coverage/build-coverage.mjs';
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const file = 'cpa_uploader/analysis/coverage/links.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const previous = read(`${control}/final-153-v2/manifest.json`).entries.find(row => row.plan_id === 'T08-B');
const current = read(`${control}/final-153-v3/manifest.json`).entries.find(row => row.plan_id === 'T08-B');
const loadSet = entry => {
    if (hash(fs.readFileSync(entry.file)) !== entry.sha256) throw Error('고정 문항 변경');
    const raw = read(entry.file); return Array.isArray(raw) ? raw[0] : raw;
};
const oldSet = loadSet(previous), newSet = loadSet(current), expected = structuredClone(oldSet);
expected.subquestions[2].model_answer[2] = newSet.subquestions[2].model_answer[2];
expected.subquestions[2].criteria[2] = newSet.subquestions[2].criteria[2];
if (JSON.stringify(expected) !== JSON.stringify(newSet)) throw Error('검토한 sub3 c8 및 모범답안 이외 변경');
if (JSON.stringify(previous.source_files) !== JSON.stringify(current.source_files)) throw Error('직접 출처 변경');
const before = fs.readFileSync(file), overlay = read(file);
if (hash(before) !== read(`${control}/coverage-t08-b-v2-followup.json`).after_sha256) throw Error('이전 관계 적용 뒤 외부 변경');
const changes = [];
overlay.links = overlay.links.map(link => {
    if (link.target?.set_id !== newSet.id) return link;
    if (link.target.file !== previous.file) throw Error('이전 활성 대상과 불일치');
    const oldSub = oldSet.subquestions.find(sub => sub.id === link.target.subquestion_id), newSub = newSet.subquestions.find(sub => sub.id === link.target.subquestion_id);
    if (!oldSub || !newSub || questionHash(oldSet, oldSub) !== link.snapshot.question_sha256) throw Error('관계의 이전 의미 대조 입력 불일치');
    const reason = link.target.subquestion_id === 'sub3'
        ? '2024년 원출제의 국내 거래용 전후 7일 검사 범위를 수출거래에 그대로 적용한 절차의 보완이라는 요구와 대조했다. 후속 c8은 실제 운송·인수기간에 맞는 기간 조정 및 인식시점 증빙과 기록기간 연결이라는 같은 목적을 유지하면서 원계획의 대체 증빙 허용을 명시한다. 특정 증빙의 공동 목록이나 계산 일수의 재진술을 새 요구로 세지 않으며 기존 직접 대응과 T07-C의 의도된 적용복습 구분을 유지한다.'
        : '후속의 이 물음·공통지문·모범답안·criterion·출처는 이전 고정본과 같다. 기존 직접 또는 부분 대응 범위를 유지하고 활성 파일 경로만 연결한다.';
    const next = { ...link, target: { ...link.target, file: current.file }, reason: `${link.reason} ${reason}`,
        review_status: 'needs_review', snapshot: { ...link.snapshot, question_sha256: questionHash(newSet, newSub) },
        provenance: { cohort_manifest: `${control}/final-153-v3/manifest.json`, candidate_sha256: current.sha256,
            previous_link: link, followup_evidence: `${control}/active-selection-v3.json`,
            application_note: '원출제 요구·원계획의 대체 증빙 허용·현재 목적 명제를 대조한 활성 대상 후속. 관계 검토 대기는 유지하며 의미검수·실제 채점·사람 확인·정본 편입과 별개다.' } };
    changes.push({ id: link.id, subquestion_id: link.target.subquestion_id, relationship: link.relationship,
        previous_question_hash: link.snapshot.question_sha256, current_question_hash: next.snapshot.question_sha256, rationale: reason });
    return next;
});
if (changes.length !== 3) throw Error('T08-B 세 관계 이외 변경');
fs.writeFileSync(`${control}/coverage-before-t08-b-v3.json`, before, { flag: 'wx' });
fs.writeFileSync(file, JSON.stringify(overlay, null, 2) + '\n');
fs.writeFileSync(`${control}/coverage-t08-b-v3-followup.json`, JSON.stringify({ at: new Date().toISOString(), file,
    before_sha256: hash(before), after_sha256: hash(fs.readFileSync(file)), previous_file: previous.file, current_file: current.file,
    changes, total_links: overlay.links.length, added_links: 0,
    changed_scope: 'T08-B 활성 경로 세 개와 sub3의 기존 목적 기반 증빙 허용 명료화. 출처·원기출 빈도·다른 관계·검토 상태 승급 없음.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ links: changes.length, changed_question_hashes: changes.filter(row => row.previous_question_hash !== row.current_question_hash).length }));
