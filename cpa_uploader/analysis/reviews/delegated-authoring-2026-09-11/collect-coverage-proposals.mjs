import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
import { questionHash, sourceUnitHash } from '../../coverage/build-coverage.mjs';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const drafts = 'cpa_uploader/drafts/delegated-authoring-2026-09-11';
const label = process.argv[2];
if (!label || !/^[a-z0-9-]+$/.test(label)) throw Error('새 실행 이름 필요');
const output = `${control}/${label}.json`;
if (fs.existsSync(output)) throw Error('기존 제안을 덮어쓰지 않습니다.');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const hashFile = file => sha(fs.readFileSync(file));
const normPath = file => path.posix.normalize(file.replaceAll('\\', '/'));
const catalog = buildSourceCatalog();
const units = new Map(catalog.units.map(unit => [unit.id, unit]));
const datasetFile = 'cpa_uploader/analysis/question-elements/question-elements.json';
const elements = new Map(read(datasetFile).elements.map(element => [element.id, element]));
const sources = [
    `${control}/coverage-proposal-n01.json`, `${control}/coverage-proposal-r01-n05.json`,
    ...fs.readdirSync(drafts, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => `${drafts}/${entry.name}/coverage-proposal.json`).filter(file => fs.existsSync(file)),
];
const links = [], errors = [], packageCounts = {}, tuples = new Set();
for (const sourceFile of sources) {
    const proposal = read(sourceFile);
    const entries = proposal.links || proposal.entries || proposal.relationships;
    if (!Array.isArray(entries)) throw Error(`${sourceFile}: 제안 배열 없음`);
    for (let index = 0; index < entries.length; index++) {
        const row = structuredClone(entries[index]);
        try {
            if (!elements.has(row.element_id)) throw Error(`없는 요소 ${row.element_id}`);
            if (!Array.isArray(row.source_unit_ids) || row.source_unit_ids.some(id => !units.has(id))) throw Error('미등록 출처');
            if (!row.reason?.trim() || !['direct', 'partial', 'broader', 'adjacent', 'excluded'].includes(row.relationship)) throw Error('관계/근거 오류');
            if (!row.target || row.target.scope !== 'draft') throw Error('초안 대상 누락');
            row.target.file = normPath(row.target.file);
            if (!row.target.file.startsWith(`${drafts}/`)) throw Error('배정 밖 대상');
            const input = read(row.target.file);
            const set = (Array.isArray(input) ? input : [input]).find(set => set.id === row.target.set_id);
            const question = set?.subquestions.find(question => question.id === row.target.subquestion_id);
            if (!question || !row.target.criterion_ids?.length || row.target.criterion_ids.some(id => !question.criteria.some(criterion => criterion.id === id))) throw Error('현재 물음/criterion과 불일치');
            const pkg = row.target.file.split('/')[3];
            const tuple = JSON.stringify([row.element_id, row.target, row.relationship]);
            if (tuples.has(tuple)) throw Error('동일 관계 중복 제안');
            tuples.add(tuple);
            packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
            links.push({ ...row, id: row.id || `delegated-2026-09-11-${pkg}-${String(packageCounts[pkg]).padStart(2, '0')}`,
                review_status: 'needs_review',
                provenance: { ...row.provenance, proposal_file: sourceFile, proposal_sha256: hashFile(sourceFile), proposal_row: index + 1, candidate_sha256: hashFile(row.target.file) },
                snapshot: { element_sha256: sha(JSON.stringify(elements.get(row.element_id))), question_sha256: questionHash(set, question),
                    source_hashes: Object.fromEntries(row.source_unit_ids.map(id => [id, units.get(id).contentHash])),
                    source_metadata_hashes: Object.fromEntries(row.source_unit_ids.map(id => [id, sourceUnitHash(units.get(id))])) },
            });
        } catch (error) { errors.push({ source_file: sourceFile, row: index + 1, target: row.target, error: String(error) }); }
    }
}
if (new Set(links.map(link => link.id)).size !== links.length) errors.push({ error: '연결 ID 중복' });
const result = { version: 1, artifact_type: 'consolidated_coverage_proposal', created_at: new Date().toISOString(),
    status: 'proposal_only_not_applied', catalog_fingerprint: catalog.fingerprint, dataset_sha256: hashFile(datasetFile),
    source_files: sources.map(file => ({ file, sha256: hashFile(file) })), package_counts: packageCounts, links, errors,
    policy: '원문·원발문·초안 대조를 남긴 담당자 제안을 현행 ID·해시로 수집한 후보 장부. 공통 links 미수정. current 해시는 의미검수·실제 채점·사람 승인·게시 완료를 뜻하지 않는다.' };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, links: links.length, package_counts: packageCounts, errors }));
if (errors.length) process.exitCode = 1;
