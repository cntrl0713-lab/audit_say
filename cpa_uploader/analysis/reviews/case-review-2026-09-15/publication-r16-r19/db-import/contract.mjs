// 운영 active release에 저장된 원문을 그대로 두고, 퇴역 세트의 텍스트를 빼고 새 세트의 텍스트를 끝에 붙여 최종 원문을 복원한다.
// publication-r13-r15/db-import/contract.mjs의 퇴역·추가 계약(복원 CTE, 남는 세트·순서 조건, guarded SQL, PGlite 증명)을 그대로 이어받아 r16~r19 묶음에 적용한다.
// 바꾼 점은 입력의 위치뿐이다. 이번에는 정본이 직전 운영 반영(release 3518cda6)과 같은 바이트에서 시작하므로 기준 원문도 이 묶음의 설치 전 baseline 사본을 쓴다.
//   - 최종 원문: 이 묶음의 stage 산출물(tmp/case-review-publication-r16-r19/stage). 설치 기록으로 정본과 같은 바이트였음을 확인한다.
//   - 기준 원문: 운영 active release(사례형 r12~r15 반영, 3518cda6)의 저장 원문과 같은 바이트인 설치 전 정본 사본(tmp/case-review-publication-r16-r19/baseline/authoring.json).
//     커밋 여부와 무관하게 이 사본을 읽고 baseline.json과 운영 반영 기록의 SHA-256으로 대조한다. 운영 SQL도 이 해시를 다시 확인한다.
//   - 전송 pack·SQL 사본은 커밋하지 않는 tmp/에 두고 기록에는 해시만 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { learningCatalogForBank } from '../../../../../../scripts/import-question-bank-v3.ts';
import { compilePublicQuestionSet, computeQuestionSetMaxPoints } from '../../../../../../lib/questionV3.ts';
import { canonicalJson, contentHash } from '../../../../../../lib/learningSubmission.ts';

export const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r16-r19', N = P + '/db-import', T = 'tmp/case-review-publication-r16-r19';
export const PROJECT = 'xvifzicrjmbfqaepcfpp', RPC = 'cpa_import_learning_question_bank_with_retirements';
// 이 묶음의 기준이 되는 운영 반영(사례형 r12~r15, release 3518cda6). 읽기 전용으로 참조한다.
export const PRIOR_RELEASE = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r13-r15/db-import/publication-v1';
export const read = (file) => JSON.parse(fs.readFileSync(file));
export const sha = (value) => createHash('sha256').update(value).digest('hex');
export const ref = (file) => ({ file, sha256: sha(fs.readFileSync(file)) });
export const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const guard = (inputs) => { for (const row of inputs) assert.equal(ref(row.file).sha256, row.sha256, 'Prepared input changed: ' + row.file); };
// 이번 릴리스 범위는 이 배치의 정본 설치 계획과 같다(다른 세션이 정본에만 설치해 둔 변경이 없다).
export const plan = () => { const p = read(P + '/plan.json'); return { retiredIds: p.rounds.flatMap((r) => r.retires), newIds: p.rounds.map((r) => r.set_id) }; };
export const CANONICAL = { authoring: 'cpa_uploader/data/cpa_question_sets_v3.authoring.json', ledger: 'cpa_uploader/data/cpa_question_sets_v3.promotions.json',
    public: 'cpa_uploader/data/cpa_question_sets_v3.public.json', encrypted: 'data/cpa_question_sets_v3.authoring.enc.json', catalog: 'cpa_uploader/data/learning-question-classifications.json',
    review: 'cpa_uploader/data/learning-question-classification-review.json' };
export const STAGE = { authoring: T + '/stage/authoring.json', ledger: T + '/stage/promotions.json', public: T + '/stage/public.json',
    encrypted: T + '/stage/encrypted.json', catalog: T + '/stage/learning-catalog.json', readiness: T + '/stage/db-readiness.json' };

// stage에서 만든 파일과 install 당시 정본이 같은 바이트였다는 사실을 기록끼리 대조한다(설치 뒤의 정본은 보지 않는다).
export function installedFiles() {
    const staged = read(P + '/stage-completion.json'), installed = read(P + '/install-completion.json');
    assert.equal(staged.status, 'staged_and_validated'); assert.equal(installed.status, 'canonical_installed_and_validated');
    const target = { 'authoring.json': CANONICAL.authoring, 'promotions.json': CANONICAL.ledger, 'public.json': CANONICAL.public, 'encrypted.json': CANONICAL.encrypted };
    const readinessRow = staged.files.find((r) => path.basename(r.file) === 'db-readiness.json'); assert(readinessRow);
    for (const row of staged.files.filter((r) => r !== readinessRow)) {
        const file = target[path.basename(row.file)], installedRow = installed.files.find((f) => f.file === file);
        assert(installedRow, 'Missing installed file for ' + row.file); assert.equal(installedRow.sha256, row.sha256, 'Installed bytes differ from the validated stage: ' + file);
    }
    assert.equal(installed.files.find((f) => f.file === CANONICAL.catalog).sha256, staged.catalog.sha256, 'Installed catalog differs from the validated stage');
    assert.equal(installed.files.find((f) => f.file === CANONICAL.review).sha256, staged.classification_review.sha256, 'Installed classification review differs from the validated stage');
    // stage 산출물이 --stage 실행 당시 기록한 해시 그대로인지 확인한다.
    guard([...staged.files, staged.staged_catalog, staged.staged_classification_review]);
    return { staged, installed, readiness: readinessRow };
}
export function baselineSource() {
    // 기준 원문은 이 묶음의 설치 전 정본 사본이며, 직전 운영 반영(release 3518cda6)의 저장 원문과 같은 바이트다.
    const recorded = read(P + '/baseline.json'), expected = recorded.files.find((r) => r.name === 'authoring').sha256;
    const copy = recorded.copies.find((c) => c.file === T + '/baseline/authoring.json'); assert(copy); assert.equal(copy.sha256, expected);
    const prior = read(PRIOR_RELEASE + '/completion.json'); assert.equal(prior.status, 'production_published_and_independently_verified');
    const priorBank = prior.files.find((f) => f.file.endsWith('/stage/authoring.json')); assert(priorBank, 'Prior release record must name its source document');
    assert.equal(priorBank.sha256, expected, 'Baseline differs from the active production release source');
    assert.equal(recorded.production_release.release_id, prior.release_id);
    const bytes = fs.readFileSync(copy.file);
    assert.equal(sha(bytes), expected, 'Baseline source differs from the recorded canonical bank');
    return { file: copy.file, release_id: prior.release_id, release_record: ref(PRIOR_RELEASE + '/completion.json'), sha256: expected, document: bytes.toString('utf8') };
}

// JSON.stringify(sets,null,2)+'\n' 문서에서 각 최상위 세트 객체의 [start,end) 위치를 계산하고 문서 전체를 다시 만들어 확인한다.
export function elementSpans(document, sets) {
    const texts = sets.map((set) => JSON.stringify(set, null, 2).split('\n').map((line) => '  ' + line).join('\n'));
    assert.equal('[\n' + texts.join(',\n') + '\n]\n', document, 'Document is not the canonical pretty-printed array');
    let at = 2; return texts.map((text) => { const span = { start: at, end: at + text.length }; at = span.end + 2; return span; });
}
export function applyPatches(baseline, patches) { let out = '', at = 0; for (const p of patches) { assert(p.start >= at && p.end >= p.start); out += baseline.slice(at, p.start) + p.text; at = p.end; } return out + baseline.slice(at); }

export function buildLocal(retirementDocument) {
    const { staged: completion, installed, readiness: readinessRef } = installedFiles();
    const { retiredIds, newIds } = plan();
    const base = baselineSource(), baselineDocument = base.document, baseline = JSON.parse(baselineDocument);
    const document = fs.readFileSync(STAGE.authoring, 'utf8'), sets = JSON.parse(document);
    const retained = baseline.filter((s) => !retiredIds.includes(s.id));
    assert.deepEqual(sets.map((s) => s.id), [...retained.map((s) => s.id), ...newIds], 'Final order must be retained sets followed by the new sets');
    for (const [i, s] of retained.entries()) assert.deepEqual(sets[i], s, 'Retained set changed: ' + s.id);
    assert(sets.slice(retained.length).every((s) => s.status === 'published' && s.verification.review_status === 'verified'));
    // PostgreSQL substr는 문자 단위, JS는 UTF-16 단위다. 서로게이트 쌍이 없으면 둘이 같다.
    assert(!/[\uD800-\uDFFF]/.test(baselineDocument) && !/[\uD800-\uDFFF]/.test(document), 'Astral characters would break character offsets');
    const before = elementSpans(baselineDocument, baseline), after = elementSpans(document, sets);
    const retiredIndices = baseline.map((s, i) => (retiredIds.includes(s.id) ? i : -1)).filter((i) => i >= 0);
    assert.equal(retiredIndices.length, retiredIds.length); assert(!retiredIndices.includes(baseline.length - 1), 'The last baseline set must stay so the new sets can follow it');
    const removals = retiredIndices.map((i) => ({ kind: 'remove', index: i, set_id: baseline[i].id, start: before[i].start, end: before[i + 1].start, text: '' }));
    const last = before[baseline.length - 1], firstNew = retained.length;
    const append = { kind: 'append', index: baseline.length, set_id: newIds.join(','), start: last.end, end: last.end, text: document.slice(after[firstNew].start - 2, after[sets.length - 1].end) };
    assert(append.text.startsWith(',\n  {'));
    const patches = [...removals, append];
    assert.equal(applyPatches(baselineDocument, patches), document, 'Retire/append patches must reproduce exact authored bytes');
    const readiness = read(STAGE.readiness), compiled = sets.map(compilePublicQuestionSet), catalog = learningCatalogForBank(sets, read(STAGE.catalog));
    assert.equal(readiness.ready, true); assert.equal(readiness.content_review_performed, true); assert.deepEqual(readiness.errors, []);
    assert.equal(readiness.full_bank_validation.exit_code, 0); assert.equal(readiness.full_bank_validation.signal, null); assert.equal(readiness.full_bank_validation.error_code, null);
    assert.equal(sha(document), readiness.source_file_hash); assert.equal(contentHash({ sets, applicability: {} }), readiness.bank_content_hash); assert.equal(contentHash(compiled), readiness.public_content_hash);
    assert.equal(canonicalJson(read(STAGE.public)), canonicalJson(compiled));
    assert.equal(sets.length, readiness.set_count); assert.equal(sets.reduce((n, s) => n + s.subquestions.length, 0), readiness.subquestion_count);
    assert.equal(sets.reduce((n, s) => n + computeQuestionSetMaxPoints(s), 0), readiness.max_points); assert.equal(sets.reduce((n, s) => n + s.subquestions.reduce((m, q) => m + q.criteria.length, 0), 0), readiness.criterion_count);
    const retirement = { manifest_document: retirementDocument, manifest_sha256: sha(retirementDocument) };
    const metadata = { applicability: {}, ...catalog, source_file_hash: readiness.source_file_hash, bank_content_hash: readiness.bank_content_hash, public_content_hash: readiness.public_content_hash,
        evidence: P + '/acceptance-completion.json', source_validation: 'external-importer', actor_user_id: null, retirement };
    const payload = { sets, ...metadata, source_document: document };
    const baselineRef = { file: base.file, sha256: base.sha256, production_release_id: base.release_id, production_release_record: base.release_record };
    return { baselineRef, baselineDocument, baseline, document, sets, retiredIds, newIds, retiredIndices, patches, readiness, readinessRef, compiled, catalog, metadata, payload, completion, installed };
}

export function dollar(value) { const tag = '$retire_' + sha(value).slice(0, 20) + '$'; assert(!value.includes(tag)); return tag + value + tag; }
export function restoreCte(pack, baselineSql) {
    return `with packed as materialized(select ${dollar(JSON.stringify(pack))}::jsonb as d),baseline as materialized(${baselineSql}),patches as materialized(select (x.p->>'start')::int as s,(x.p->>'end')::int as e,x.p->>'text' as t,x.ord from packed cross join jsonb_array_elements(packed.d->'patches') with ordinality as x(p,ord)),pieces as materialized(select ord,substr(b.source_document,coalesce(lag(e) over (order by ord),0)+1,s-coalesce(lag(e) over (order by ord),0))||t as piece from patches cross join baseline b),restored as materialized(select packed.d,(select string_agg(piece,'' order by ord) from pieces)||substr(b.source_document,(select max(e) from patches)+1) as document,b.source_document as prior_document from packed cross join baseline b),payload as materialized(select d,document,prior_document,(d->'metadata')||jsonb_build_object('source_document',document,'sets',document::jsonb) as p from restored) `;
}
const idList = (ids) => 'array[' + ids.map((id) => { assert(/^[a-z0-9-]+$/.test(id)); return "'" + id + "'"; }).join(',') + ']::text[]';
// 남는 세트는 원래 객체와 상대 순서가 같고, 퇴역 세트는 모두 빠지고, 새 세트는 정해진 순서로만 붙는다.
export function retainedCondition(retiredIds, newIds) {
    return `(select jsonb_agg(v order by i) from jsonb_array_elements(prior_document::jsonb) with ordinality o(v,i) where v->>'id'<>all(${idList(retiredIds)}))=(select jsonb_agg(v order by i) from jsonb_array_elements(p->'sets') with ordinality o(v,i) where v->>'id'<>all(${idList(newIds)})) and (select count(*) from jsonb_array_elements(prior_document::jsonb) s where s->>'id'=any(${idList(retiredIds)}))=${retiredIds.length} and not exists(select 1 from jsonb_array_elements(p->'sets') s where s->>'id'=any(${idList(retiredIds)})) and (select array_agg(v->>'id' order by i) from jsonb_array_elements(p->'sets') with ordinality o(v,i) where v->>'id'=any(${idList(newIds)}))=${idList(newIds)}`;
}
export function buildSql(pack, expected, functions, payloadHash, mode = 'apply') {
    assert(['apply', 'probe'].includes(mode));
    assert(Number.isSafeInteger(expected.set_count) && expected.set_count > 0); assert(/^[a-f0-9]{64}$/.test(payloadHash)); assert(/^[a-f0-9]{64}$/.test(expected.source_file_hash)); assert(/^[a-f0-9-]{36}$/.test(expected.release_id));
    const { retiredIds, newIds } = plan();
    assert.deepEqual(pack.patches.filter((p) => p.kind === 'remove').map((p) => p.set_id).sort(), [...retiredIds].sort());
    const functionGuards = functions.map((f) => { assert(/^[a-z_]+\((jsonb|uuid)\)$/.test(f.signature)); assert(/^[a-f0-9]{64}$/.test(f.definition_sha256)); return `if encode(sha256(convert_to(pg_get_functiondef('public.${f.signature}'::regprocedure),'UTF8')),'hex') is distinct from '${f.definition_sha256}' then raise exception 'Reviewed function changed'; end if;`; }).join('\n');
    const cte = restoreCte(pack, "select source_document from public.cpa_question_bank_releases where status='active'");
    const unchanged = retainedCondition(retiredIds, newIds);
    const payloadGuard = `case when encode(sha256(convert_to(p::text,'UTF8')),'hex')='${payloadHash}' and encode(sha256(convert_to(document,'UTF8')),'hex')=p->>'source_file_hash' and ${unchanged} then p else null::jsonb end`;
    const result = mode === 'probe'
        ? `select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,current_setting('transaction_read_only') as transaction_read_only,encode(sha256(convert_to(p::text,'UTF8')),'hex') as payload_jsonb_sha256,encode(sha256(convert_to(document,'UTF8')),'hex') as source_file_hash,${unchanged} as retained_identical_retired_omitted_new_appended from payload`
        : `select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,public.${RPC}(${payloadGuard}) as receipt from payload`;
    const after = mode === 'probe' ? '' : `do $retire_after$ declare new_id uuid; current_source text; actual jsonb; prior jsonb; begin
select id,source_document into strict new_id,current_source from public.cpa_question_bank_releases where status='active' and source_file_hash='${pack.metadata.source_file_hash}' and bank_content_hash='${pack.metadata.bank_content_hash}' and public_content_hash='${pack.metadata.public_content_hash}';
if encode(sha256(convert_to(current_source,'UTF8')),'hex') is distinct from '${pack.metadata.source_file_hash}' then raise exception 'Final source identity mismatch'; end if;
if (select count(*) from public.cpa_question_bank_release_items where release_id='${expected.release_id}'::uuid) <> ${expected.set_count} or exists(select 1 from public.cpa_question_bank_release_items old where old.release_id='${expected.release_id}'::uuid and old.set_id<>all(${idList(retiredIds)}) and not exists(select 1 from public.cpa_question_bank_release_items next where next.release_id=new_id and next.set_id=old.set_id and next.set_version_id=old.set_version_id)) then raise exception 'Retained set versions changed'; end if;
if exists(select 1 from public.cpa_question_bank_release_items next where next.release_id=new_id and next.set_id=any(${idList(retiredIds)})) then raise exception 'Retired set still active'; end if;
if (select count(*) from public.cpa_question_bank_release_items next where next.release_id=new_id and next.set_id=any(${idList(newIds)}) and not exists(select 1 from public.cpa_question_bank_release_items old where old.set_version_id=next.set_version_id and old.release_id<>new_id)) <> ${newIds.length} then raise exception 'New sets were not added as new versions'; end if;
if (select count(*) from public.cpa_question_bank_release_items where release_id=new_id) <> jsonb_array_length(current_source::jsonb) or exists(select 1 from jsonb_array_elements(current_source::jsonb) with ordinality item(s,ord) where not exists(select 1 from public.cpa_question_bank_release_items ri where ri.release_id=new_id and ri.set_id=item.s->>'id' and ri.position=item.ord)) then raise exception 'Final release IDs or order differ from reviewed source'; end if;
select jsonb_agg(c order by c->>'source_set_id',c->>'subquestion_id') into actual from jsonb_array_elements(public.cpa_get_learning_classifications(new_id)) c where c->>'source_set_id'<>all(${idList(newIds)});
select jsonb_agg(c order by c->>'source_set_id',c->>'subquestion_id') into prior from jsonb_array_elements(current_setting('cpa.retire_prior_classifications')::jsonb) c where c->>'source_set_id'<>all(${idList(retiredIds)});
if actual is distinct from prior then raise exception 'Retained classification versions changed'; end if;
select jsonb_agg(to_jsonb(t) order by t.position) into actual from (select id,title,part,position from public.cpa_learning_topics) t;
if actual is distinct from current_setting('cpa.retire_prior_topics')::jsonb then raise exception 'Existing learning topics changed'; end if;
end $retire_after$;\n`;
    for (const key of ['source_file_hash', 'bank_content_hash', 'public_content_hash']) assert(/^[a-f0-9]{64}$/.test(pack.metadata[key]));
    const shape = `if right(source,3) <> E'\\n]\\n' or jsonb_typeof(source::jsonb) <> 'array' or jsonb_array_length(source::jsonb) <> ${expected.set_count} then raise exception 'Unexpected baseline source shape'; end if;`;
    const active = `select id,source_file_hash,source_document into strict active_id,active_hash,source from public.cpa_question_bank_releases where status='active';\nif active_id is distinct from '${expected.release_id}'::uuid or active_hash is distinct from '${expected.source_file_hash}' or source is null or encode(sha256(convert_to(source,'UTF8')),'hex') is distinct from '${expected.source_file_hash}' then raise exception 'Active baseline changed'; end if;`;
    // probe는 읽기 전용 API 연결에서 실행한다. 역할 전환·잠금·함수 실행 없이 active 원문과 함수 정의만 읽고 복원 해시를 계산한다.
    if (mode === 'probe') return `begin read only;\nset local statement_timeout='120s';\ndo $retire_probe$ declare active_id uuid; active_hash text; source text; begin\n${functionGuards}\n${active}\n${shape}\nend $retire_probe$;\n${cte}${result};\ncommit;\n`;
    return `begin;\nset local role service_role;\nset local statement_timeout='120s';\ndo $retire_guard$ declare active_id uuid; active_hash text; source text; topics jsonb; begin\nif current_user <> 'service_role' then raise exception 'Unexpected role'; end if;\nperform pg_advisory_xact_lock(7261202609080502);\n${functionGuards}\n${active}\n${shape}\nperform set_config('cpa.retire_prior_classifications',public.cpa_get_learning_classifications(active_id)::text,true);\nselect jsonb_agg(to_jsonb(t) order by t.position) into topics from (select id,title,part,position from public.cpa_learning_topics) t;\nperform set_config('cpa.retire_prior_topics',topics::text,true);\nend $retire_guard$;\n${cte}${result};\n${after}commit;\n`;
}

export async function localProof(built) {
    const pack = { metadata: built.metadata, patches: built.patches.map(({ kind, index, set_id, start, end, text }) => ({ kind, index, set_id, start, end, text })) };
    const pg = await PGlite.create();
    try {
        const expected = (await pg.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') as h", [JSON.stringify(built.payload)])).rows[0].h;
        const sql = restoreCte(pack, 'select $1::text as source_document') + `select document,p,encode(sha256(convert_to(p::text,'UTF8')),'hex') as payload_jsonb_sha256,encode(sha256(convert_to(document,'UTF8')),'hex') as source_file_hash,${retainedCondition(built.retiredIds, built.newIds)} as retained_identical_retired_omitted_new_appended from payload`;
        const row = (await pg.query(sql, [built.baselineDocument])).rows[0];
        assert.equal(row.document, built.document); assert.deepEqual(row.p, built.payload); assert.equal(row.payload_jsonb_sha256, expected); assert.equal(row.source_file_hash, sha(built.document));
        assert.equal(row.retained_identical_retired_omitted_new_appended, true);
        // 부정 사례: 기준 원문이 한 글자라도 다르면 복원 원문 해시가 달라져야 한다. 운영 SQL은 이 해시와 payload 해시를 모두 요구한다.
        const tampered = (await pg.query(sql, [built.baselineDocument.replace('"schema_version": "3.0"', '"schema_version": "3.1"')])).rows[0];
        assert.notEqual(tampered.source_file_hash, sha(built.document)); assert.notEqual(tampered.payload_jsonb_sha256, expected);
        // 부정 사례: 남는 세트가 기준과 달라지는 패치(첫 퇴역 세트 대신 앞 세트를 지움)는 상대 순서 조건을 거짓으로 만든다.
        const shifted = structuredClone(pack), first = shifted.patches[0], i = first.index;
        assert(i > 0); const prev = elementSpans(built.baselineDocument, built.baseline)[i - 1];
        Object.assign(first, { start: prev.start, end: first.start });
        const wrong = (await pg.query(restoreCte(shifted, 'select $1::text as source_document') + `select ${retainedCondition(built.retiredIds, built.newIds)} as ok from payload`, [built.baselineDocument])).rows[0];
        assert.equal(wrong.ok, false);
        return { pack, payloadHash: expected, proof: { method: 'Local PGlite PostgreSQL reconstruction; no production database or API', source_bytes_identical: true, complete_payload_equal: true,
            retained_objects_and_order_identical: true, retired_set_ids: built.retiredIds, retired_indices: built.retiredIndices, new_set_ids: built.newIds, tampered_baseline_detected: true,
            baseline_bytes: Buffer.byteLength(built.baselineDocument), patch_text_bytes: pack.patches.reduce((n, p) => n + Buffer.byteLength(p.text), 0), final_document_bytes: Buffer.byteLength(built.document),
            metadata_bytes: Buffer.byteLength(JSON.stringify(built.metadata)), payload_jsonb_sha256: expected, final_source_sha256: sha(built.document) } };
    } finally { await pg.close(); }
}
