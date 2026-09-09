import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import { publicLearningSet } from '../lib/learningPublic.ts';
import type { PublicQuestionSetV3, QuestionSetV3 } from '../lib/questionV3.ts';
import { createLearningDatabase, importQuestionBank, memberId, otherMemberId, questionBankPayload, sampleQuestionSet } from './helpers/cpaLearningDatabase.ts';

test('public learning parser preserves stored legacy constraints and rejects malformed constraints or selection', () => {
    const questionSet = compilePublicQuestionSet(sampleQuestionSet());
    const envelope = { release_id: 'release', set_version_id: 'version', question_set: questionSet };
    assert.deepEqual(publicLearningSet(envelope), { ...questionSet, release_id: 'release', set_version_id: 'version' });
    for (const constraints of [
        { ordered: true, max_entries: null, overflow_policy: 'none' as const },
        { ordered: false, max_entries: 2, overflow_policy: 'none' as const },
        { ordered: true, max_entries: 4, overflow_policy: 'ignore_after_limit' as const },
    ]) {
        const stored = structuredClone(envelope);
        stored.question_set.subquestions[0].constraints = constraints;
        const before = structuredClone(stored);
        assert.deepEqual(publicLearningSet(stored).subquestions[0].constraints, constraints);
        assert.deepEqual(stored, before, 'reading an immutable snapshot must preserve its stored constraints');
    }
    const policies = [
        { constraints: { ordered: 'false' } },
        { constraints: { ordered: undefined } },
        { constraints: { max_entries: 0 } },
        { constraints: { max_entries: -1 } },
        { constraints: { max_entries: 1.5 } },
        { constraints: { max_entries: 'invalid' } },
        { constraints: { max_entries: undefined } },
        { constraints: { overflow_policy: 'invalid' } },
        { constraints: { overflow_policy: undefined } },
        { selection: { type: 'best_n', n: 1 } },
        { selection: { type: 'at_least_n', n: 1 } },
        { selection: { type: undefined } },
        { selection: { n: 1 } },
        { selection: { n: undefined } },
    ];
    for (const policy of policies) {
        const invalid = structuredClone(envelope);
        Object.assign(invalid.question_set.subquestions[0].constraints, policy.constraints);
        Object.assign(invalid.question_set.subquestions[0].selection, policy.selection);
        const before = structuredClone(invalid);
        assert.throws(() => publicLearningSet(invalid), /저장/, JSON.stringify(policy));
        assert.deepEqual(invalid, before, 'rejection must not alter the stored payload');
    }
});

test('SQL question bank preserves v3 public/private contracts, scoped codes, revision identity and idempotency', async () => {
    const db = await createLearningDatabase();
    try {
        await db.exec('set role service_role');
        assert.equal((await db.query<{ allowed: boolean }>("select has_table_privilege(current_user,'auth.users','SELECT') as allowed")).rows[0].allowed, false);
        await assert.rejects(db.query('select id from auth.users'), /permission denied/);
        const original = sampleQuestionSet();
        const first = await importQuestionBank(db, [original]);
        const invalidActor = { ...questionBankPayload([original]), bank_content_hash: 'a'.repeat(64), actor_user_id: '00000000-0000-4000-8000-000000009999' };
        await assert.rejects(db.query('select cpa_import_question_bank($1::jsonb)', [JSON.stringify(invalidActor)]), /foreign key/);
        const same = await importQuestionBank(db, [original]);
        assert.equal(same.release_id, first.release_id);
        assert.equal(same.reused, true);
        const privateSet = (await db.query<{ question: QuestionSetV3 }>('select cpa_get_question_version($1) as question', [first.question_versions[0].set_version_id])).rows[0].question;
        assert.deepEqual(compilePublicQuestionSet(privateSet), compilePublicQuestionSet(original));
        assert.equal(privateSet.subquestions[0].decision, undefined, 'judgment need not have choice metadata');
        assert.deepEqual(privateSet.subquestions[1].decision, original.subquestions[1].decision, 'descriptive may have decision metadata');
        type LearningPublicSet = Omit<PublicQuestionSetV3, 'subquestions'> & { subquestions: Array<PublicQuestionSetV3['subquestions'][number] & { logical_subquestion_id: string }> };
        const bank = (await db.query<{ bank: Array<{ release_id: string; set_version_id: string; question_set: LearningPublicSet }> }>('select cpa_get_active_question_bank() as bank')).rows[0].bank;
        const publicSet = structuredClone(bank[0].question_set);
        const logicalIds = publicSet.subquestions.map((sub) => sub.logical_subquestion_id);
        for (const sub of publicSet.subquestions) delete (sub as Partial<typeof sub>).logical_subquestion_id;
        assert.deepEqual(publicSet, compilePublicQuestionSet(original));
        const changed = structuredClone(original);
        changed.subquestions[0].prompt += ' 개정된 발문';
        const next = await importQuestionBank(db, [changed]);
        assert.notEqual(next.release_id, first.release_id);
        assert.notEqual(next.question_versions[0].set_version_id, first.question_versions[0].set_version_id);
        assert.deepEqual((await db.query<{ id: string }>('select subquestion_id as id from cpa_subquestion_versions where set_version_id=$1 order by position', [next.question_versions[0].set_version_id])).rows.map((r) => r.id), logicalIds);
        const historical = (await db.query<{ question: QuestionSetV3 }>('select cpa_get_question_version($1) as question', [first.question_versions[0].set_version_id])).rows[0].question;
        assert.equal(historical.subquestions[0].prompt, original.subquestions[0].prompt);
        assert.equal((await db.query<{ count: number }>("select count(*)::int as count from cpa_question_bank_releases where status='active'")).rows[0].count, 1);
        await db.query('select cpa_reactivate_question_bank($1)', [first.release_id]);
        assert.equal((await db.query<{ id: string }>("select id from cpa_question_bank_releases where status='active'")).rows[0].id, first.release_id);
        assert.equal((await db.query<{ count: number }>('select count(*)::int as count from cpa_question_set_versions')).rows[0].count, 2);
        const collision = questionBankPayload([changed]);
        collision.bank_content_hash = questionBankPayload([original]).bank_content_hash;
        await assert.rejects(db.query('select cpa_import_question_bank($1::jsonb)', [JSON.stringify(collision)]), /different content/);
        const applicabilityChange = { ...questionBankPayload([original]), applicability: { exam_year: 2027, status: 'confirmed' } };
        await assert.rejects(db.query('select cpa_import_question_bank($1::jsonb)', [JSON.stringify(applicabilityChange)]), /different content/);
        applicabilityChange.bank_content_hash = 'e'.repeat(64);
        const applicabilityBank = (await db.query<{ result: { question_versions: Array<{ set_version_id: string }> } }>('select cpa_import_question_bank($1::jsonb) as result', [JSON.stringify(applicabilityChange)])).rows[0].result;
        assert.notEqual(applicabilityBank.question_versions[0].set_version_id, first.question_versions[0].set_version_id);
        assert.deepEqual((await db.query<{ applicability: unknown }>('select applicability from cpa_question_set_versions where id=$1', [applicabilityBank.question_versions[0].set_version_id])).rows[0].applicability, applicabilityChange.applicability);
    } finally { await db.close(); }
});

test('SQL importer rejects broken policy, scores, source links, private display fields and rolls back publication', async () => {
    const db = await createLearningDatabase();
    try {
        const first = await importQuestionBank(db);
        const corruptions: Array<(set: QuestionSetV3) => void> = [
            (set) => { Object.assign(set.subquestions[0].selection, { type: 'best_n', n: 1 }); },
            (set) => { Object.assign(set.subquestions[0].constraints, { max_entries: 0 }); },
            (set) => { set.subquestions[0].criteria[0].scores.met = 2; },
            (set) => { set.subquestions[0].criteria[0].source_ref_ids = ['unknown']; },
            (set) => { set.subquestions[0].requirements[0].source_ref_id = 'unknown'; },
            (set) => { set.learning_order = ['sub1', 'sub1']; },
            (set) => { Object.assign(set.shared_context.facts[0], { source_quote: 'PRIVATE' }); },
            (set) => { set.subquestions[0].answer_slots = [{ id: 'a', label: 'a', input: 'textarea', ...{ model_answer: 'PRIVATE' } }]; },
            (set) => { set.classification.tags = [...set.subquestions[0].model_answer]; },
            (set) => { set.subquestions[1].decision!.correct = 'unknown'; },
        ];
        for (const corrupt of corruptions) {
            const set = sampleQuestionSet(); corrupt(set);
            await assert.rejects(importQuestionBank(db, [set]));
            assert.equal((await db.query<{ id: string }>("select id from cpa_question_bank_releases where status='active'")).rows[0].id, first.release_id);
            assert.equal((await db.query<{ count: number }>('select count(*)::int as count from cpa_question_bank_releases')).rows[0].count, 1);
        }
    } finally { await db.close(); }
});

test('final-snapshot import preserves declared hashes, excerpt fidelity and stored answer constraints exactly', async () => {
    const db = await createLearningDatabase();
    try {
        const original = sampleQuestionSet();
        Object.assign(original.verification, { source_fidelity: 'excerpt' });
        original.subquestions[0].constraints = { ordered: true, max_entries: 2, overflow_policy: 'none' };
        original.subquestions[1].constraints = { ordered: false, max_entries: 4, overflow_policy: 'ignore_after_limit' };
        original.source_refs[0].content_hash = 'declared-source-label';
        const before = JSON.stringify(original);
        const sourceDocument = `${JSON.stringify([original], null, 2).replace(/\n/g, '\r\n')}\r\n`;
        const payload = { ...questionBankPayload([original]), source_document: sourceDocument,
            source_file_hash: createHash('sha256').update(sourceDocument).digest('hex'),
            source_validation: 'source-identity-only; content-review-skipped-by-user' };
        await assert.rejects(db.query('select cpa_import_question_bank($1::jsonb)', [JSON.stringify({ ...payload, source_file_hash: '0'.repeat(64) })]), /file hash mismatch/);
        await assert.rejects(db.query('select cpa_import_question_bank($1::jsonb)', [JSON.stringify({ ...payload, sets: [sampleQuestionSet()] })]), /does not match imported sets/);
        const imported = (await db.query<{ result: { release_id: string; question_versions: Array<{ set_version_id: string }> } }>('select cpa_import_question_bank($1::jsonb) as result', [JSON.stringify(payload)])).rows[0].result;
        const savedSource = (await db.query<{ source_document: string; validation_report: { source_validation: string } }>('select source_document,validation_report from cpa_question_bank_releases where id=$1', [imported.release_id])).rows[0];
        assert.equal(savedSource.source_document, sourceDocument, 'exact CRLF, whitespace and final newline are retained');
        assert.equal(savedSource.validation_report.source_validation, payload.source_validation);
        const reused = (await db.query<{ result: { reused: boolean } }>('select cpa_import_question_bank($1::jsonb) as result', [JSON.stringify(payload)])).rows[0].result;
        assert.equal(reused.reused, true);
        const reformatted = JSON.stringify([original]);
        await assert.rejects(db.query('select cpa_import_question_bank($1::jsonb)', [JSON.stringify({ ...payload, source_document: reformatted,
            source_file_hash: createHash('sha256').update(reformatted).digest('hex') })]), /different source document/);
        const privateSet = (await db.query<{ question: QuestionSetV3 }>('select cpa_get_question_version($1) as question', [imported.question_versions[0].set_version_id])).rows[0].question;
        assert.deepEqual(privateSet.verification, original.verification);
        assert.deepEqual(privateSet.source_refs, original.source_refs);
        assert.deepEqual(privateSet.subquestions.map((q) => q.constraints), original.subquestions.map((q) => q.constraints));
        assert.deepEqual(compilePublicQuestionSet(privateSet), compilePublicQuestionSet(original));
        const storedHashes = (await db.query<{ declared_quote_hash: string; quote_hash: string }>('select declared_quote_hash,quote_hash from cpa_question_sources')).rows[0];
        assert.equal(storedHashes.declared_quote_hash, original.source_refs[0].content_hash);
        assert.equal(storedHashes.quote_hash, createHash('sha256').update(original.source_refs[0].source_quote).digest('hex'));
        const envelope = (await db.query<{ bank: unknown[] }>('select cpa_get_active_question_bank() as bank')).rows[0].bank[0];
        const { release_id: releaseId, set_version_id: setVersionId, ...projected } = publicLearningSet(envelope);
        assert.equal(releaseId, imported.release_id);
        assert.equal(setVersionId, imported.question_versions[0].set_version_id);
        for (const sub of projected.subquestions) delete (sub as typeof sub & { logical_subquestion_id?: string }).logical_subquestion_id;
        assert.deepEqual(projected, compilePublicQuestionSet(original));
        assert.equal(JSON.stringify(original), before, 'import never rewrites the selected source snapshot');
    } finally { await db.close(); }
});

test('sealed content rejects inserts, updates, deletes and reparenting; published releases cannot be reopened for editing', async () => {
    const db = await createLearningDatabase();
    try {
        const bank = await importQuestionBank(db);
        const versionId = bank.question_versions[0].set_version_id;
        const source = (await db.query<{ id: string }>('select id from cpa_question_sources')).rows[0].id;
        const sub = (await db.query<{ id: string }>('select id from cpa_subquestion_versions order by position')).rows[0].id;
        await assert.rejects(db.query('update cpa_question_set_versions set title=$1 where id=$2', ['changed', versionId]), /immutable/);
        await assert.rejects(db.query('update cpa_question_set_versions set sealed_at=null where id=$1', [versionId]), /immutable/);
        await assert.rejects(db.query('update cpa_question_sources set source_quote=$1 where id=$2', ['changed', source]), /immutable/);
        await assert.rejects(db.query('delete from cpa_subquestion_answers where subquestion_version_id=$1', [sub]), /immutable/);
        await assert.rejects(db.query("insert into cpa_question_sources(set_version_id,code,position,file_path,role,source_quote) values($1,'new',2,'x','standard','private')", [versionId]), /immutable/);
        await assert.rejects(db.query("update cpa_question_bank_releases set status='draft',published_at=null where id=$1", [bank.release_id]), /immutable/);
        await assert.rejects(db.query('delete from cpa_question_bank_release_items where release_id=$1', [bank.release_id]), /immutable/);
        await assert.rejects(db.query("insert into cpa_question_bank_release_items(release_id,set_id,set_version_id,position) values($1,'pilot-01-001',$2,2)", [bank.release_id, versionId]), /immutable/);
        await assert.rejects(db.exec("update cpa_subquestions set code='different' where code='sub1'"), /immutable/);
        await assert.rejects(db.exec("update cpa_question_review_events set evidence='changed'"), /append-only/);
        // A source cannot be moved out of a sealed parent into an editable draft.
        const draft = (await db.query<{ id: string }>(`insert into cpa_question_set_versions(set_id,revision,schema_version,status,title,topic_id,part,chapter,domain,standards,tags,shared_facts,source_fidelity,review_status,calculation_required,verification_notes,content_hash,max_points)
            select set_id,revision+1,schema_version,'needs_review',title,topic_id,part,chapter,domain,standards,tags,shared_facts,source_fidelity,'needs_human_review',false,verification_notes,repeat('f',64),max_points from cpa_question_set_versions where id=$1 returning id`, [versionId])).rows[0].id;
        await assert.rejects(db.query('update cpa_question_sources set set_version_id=$1 where id=$2', [draft, source]), /immutable/);
        const draftSub = (await db.query<{ id: string }>(`insert into cpa_subquestion_versions(set_version_id,set_id,subquestion_id,position,learning_position,type,prompt,ordered,max_entries,overflow_policy,selection_type,selection_n,decision_options,answer_slots,max_points)
            select $1,set_id,subquestion_id,position,learning_position,type,prompt,ordered,max_entries,overflow_policy,selection_type,selection_n,decision_options,answer_slots,max_points from cpa_subquestion_versions where id=$2 returning id`, [draft, sub])).rows[0].id;
        await assert.rejects(db.query("update cpa_question_set_versions set status='published',review_status='verified',sealed_at=now() where id=$1", [draft]), /verified evidence/);
        await assert.rejects(db.query("insert into cpa_question_review_events(set_version_id,set_id,event_type,to_status,evidence,occurred_at) values($1,'pilot-01-001','review','verified','missing hash',now())", [draft]), /check constraint/);
        await assert.rejects(db.query("insert into cpa_requirements(subquestion_version_id,set_version_id,code,position,source_id,source_quote) values($1,$2,'r',1,$3,'quote')", [draftSub, draft, source]), /foreign key/);
        const attempt = (await db.query<{ id: string }>("insert into cpa_attempts(owner_user_id,actor_kind,release_id,set_id,set_version_id,submission_key,answers_hash) values($1,'member',$2,'pilot-01-001',$3,gen_random_uuid(),repeat('a',64)) returning id", [memberId, bank.release_id, versionId])).rows[0].id;
        await assert.rejects(db.query("insert into cpa_attempt_answers(attempt_id,set_version_id,subquestion_version_id,answer_text) values($1,$2,$3,'answer')", [attempt, versionId, draftSub]), /foreign key/);
        await assert.rejects(db.query("insert into cpa_attempts(owner_user_id,actor_kind,release_id,set_id,set_version_id,submission_key,answers_hash) values($1,'member',$2,'pilot-01-001',$3,gen_random_uuid(),repeat('b',64))", [memberId, bank.release_id, draft]), /foreign key/);
    } finally { await db.close(); }
});

test('new learning tables and RPCs deny browser roles; profile defaults and compatibility view remain protected', async () => {
    const db = await createLearningDatabase();
    try {
        await importQuestionBank(db);
        const viewPrivileges = (await db.query<{ privilege_type: string }>(`select distinct x.privilege_type from pg_class c
            cross join lateral aclexplode(c.relacl) x where c.oid='public.user_cpa'::regclass order by x.privilege_type`)).rows.map((r) => r.privilege_type);
        assert.deepEqual(viewPrivileges, ['DELETE', 'INSERT', 'SELECT', 'UPDATE'], 'compatibility view restores exact original DML grants, including owner ACL');
        const tables = (await db.query<{ name: string }>(`select c.relname as name from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname<>'cpa_users' order by c.relname`)).rows;
        assert.equal(tables.length, 20);
        for (const role of ['anon', 'authenticated']) {
            await db.exec(`set role ${role}`);
            for (const { name } of tables) await assert.rejects(db.query(`select * from public.${name}`), /permission denied/);
            await assert.rejects(db.query('select cpa_get_active_question_bank()'), /permission denied/);
            await assert.rejects(db.query('select cpa_reactivate_question_bank($1)', ['00000000-0000-4000-8000-000000000000']), /permission denied/);
            await assert.rejects(db.query('select cpa_import_question_bank($1::jsonb)', [JSON.stringify(questionBankPayload())]), /permission denied/);
            await db.exec('reset role');
        }
        const newId = '00000000-0000-4000-8000-000000000004';
        await db.query('insert into auth.users(id) values($1)', [newId]);
        await db.exec(`set role authenticated; set request.jwt.claim.sub='${newId}';`);
        await assert.rejects(db.query("insert into user_cpa(id,username,role,exp) values($1,'attack','ADMIN',900)", [newId]), /must start/);
        await db.query("insert into user_cpa(id,username) values($1,'new')", [newId]);
        assert.equal((await db.query<{ role: string }>('select role from cpa_users')).rows[0].role, 'MEMBER');
        await db.exec('reset role; set role service_role');
        await db.query("update cpa_users set role='ADMIN' where id=$1", [newId]);
        assert.equal((await db.query<{ role: string }>('select role from cpa_users where id=$1', [newId])).rows[0].role, 'ADMIN');
        const balances = (await db.query<{ id: string; exp: number | string }>('select id,exp from cpa_users where id in ($1,$2) order by id', [memberId, otherMemberId])).rows;
        assert.deepEqual(balances.map((b) => Number(b.exp)), [17, 0]);
    } finally { await db.close(); }
});
