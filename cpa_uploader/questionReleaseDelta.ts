import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { contentHash } from '../lib/learningSubmission.ts';
import type { LearningClassification, LearningTopic } from '../lib/learningUnits.ts';
import { learningCatalogForBank } from '../scripts/import-question-bank-v3.ts';
import { bankSpans, sha256 } from './questionCorrection.ts';

/**
 * 운영 반영용 증분 릴리스.
 *
 * 운영 active release에 저장된 정본 원문(source_document)을 기준으로, 바뀐 세트의 텍스트만 제자리에 바꾸거나
 * 끝에 붙여 최종 원문을 PostgreSQL 안에서 복원한 뒤 기존 importer(cpa_import_learning_question_bank)를 한
 * transaction으로 호출한다. 전송량은 바뀐 세트와 분류 메타데이터뿐이다. importer는 내용 해시가 같은 세트의
 * 봉인 버전을 재사용하므로 바뀐 세트만 새 버전이 된다. 퇴역(삭제)·재정렬은 이 경로가 받지 않는다.
 *
 * 회차마다 복사하던 db-incremental 드라이버(replace-contract.mjs, contract.mjs)를 일반화한 것이다.
 *
 * Management API는 요청 본문이 크면 HTTP 413으로 거절한다(2026-09-14 약 1.8MB 통과, 2026-09-19 약 3.3MB 거절).
 * 많은 세트를 바꾼 릴리스는 pack을 압축 전송(`compressed`)으로 보낸다: pgcrypto OpenPGP 대칭 메시지(zlib)로 만들고
 * DB에서 `extensions.pgp_sym_decrypt_bytea`로 푼다. 암호는 공개 상수이며 기밀성을 주장하지 않는다(2026-09-14 전례와 같다).
 * 푼 pack은 평문 전송과 같은 payload 해시 guard를 통과해야만 importer에 들어간다.
 */

export const RELEASE_RPC = 'cpa_import_learning_question_bank';
/** importer가 호출하거나 트리거로 실행되는 함수. 검토 후 정의가 바뀌면 적용을 멈춘다. */
export const RELEASE_FUNCTIONS = [
    'cpa_import_learning_question_bank', 'cpa_import_question_bank', 'cpa_import_learning_classifications',
    'cpa_get_learning_classifications', 'cpa_json_text_array', 'cpa_normalize_fact', 'cpa_validate_question_seal',
    'cpa_guard_sealed_content', 'cpa_guard_published_release', 'cpa_guard_learning_metadata', 'cpa_guard_review_event',
    'cpa_guard_logical_identity',
] as const;
const ADVISORY_LOCK = '7261202609080502';

export interface ReleaseDeltaPatch { kind: 'replace' | 'append'; index: number; set_id: string; start: number; end: number; text: string }
export interface ReleaseFunction { signature: string; definition_sha256: string }
export interface ReleaseExpectation { release_id: string; source_file_hash: string; set_count: number }
export interface ReleaseCatalog { topics: LearningTopic[]; classifications: LearningClassification[] }

export interface ReleaseDelta {
    baselineSets: QuestionSetV3[];
    sets: QuestionSetV3[];
    replacedIds: string[];
    appendedIds: string[];
    patches: ReleaseDeltaPatch[];
    metadata: Record<string, unknown> & { source_file_hash: string; bank_content_hash: string; public_content_hash: string };
    payload: Record<string, unknown>;
}

export function applyTextPatches(baseline: string, patches: ReleaseDeltaPatch[]): string {
    let out = '', at = 0;
    for (const patch of patches) {
        if (patch.start < at || patch.end < patch.start) throw new Error('패치 위치가 겹치거나 역순입니다.');
        out += baseline.slice(at, patch.start) + patch.text;
        at = patch.end;
    }
    return out + baseline.slice(at);
}

/** 기준 원문(운영 active)과 현재 정본의 차이를 제자리 교체·끝 추가 패치로 만든다. */
export function buildReleaseDelta(input: { baselineDocument: string; document: string; catalog: ReleaseCatalog; evidence: string }): ReleaseDelta {
    const { baselineDocument, document } = input;
    if (!input.evidence.trim()) throw new Error('DB 검수 이벤트에 남길 근거(evidence)가 필요합니다.');
    // PostgreSQL substr는 문자 단위, JS는 UTF-16 단위다. 서로게이트 쌍이 없어야 두 오프셋이 같다.
    if (/[\uD800-\uDFFF]/u.test(baselineDocument) || /[\uD800-\uDFFF]/u.test(document)) throw new Error('BMP 밖 문자가 있으면 문자 위치로 복원할 수 없습니다.');
    const baselineSets = JSON.parse(baselineDocument) as QuestionSetV3[];
    const sets = JSON.parse(document) as QuestionSetV3[];
    const before = bankSpans(baselineDocument, baselineSets), after = bankSpans(document, sets);
    if (sets.length < baselineSets.length) throw new Error('운영 릴리스보다 세트가 적습니다. 퇴역은 퇴역 manifest 경로로 게시하십시오.');
    baselineSets.forEach((set, index) => {
        if (sets[index].id !== set.id) throw new Error(`세트 순서가 운영 릴리스와 다릅니다(${index + 1}번째: ${set.id} → ${sets[index].id}). 삭제·재정렬은 이 경로가 받지 않습니다.`);
    });
    const appended = sets.slice(baselineSets.length);
    const known = new Set(baselineSets.map((set) => set.id));
    if (appended.some((set) => known.has(set.id))) throw new Error('추가 세트의 ID가 기존 세트와 겹칩니다.');
    const unpublished = sets.filter((set) => set.status !== 'published' || set.verification?.review_status !== 'verified');
    if (unpublished.length) throw new Error(`게시·검수를 마치지 않은 세트가 있습니다: ${unpublished.map((set) => set.id).join(', ')}`);
    const patches: ReleaseDeltaPatch[] = [];
    baselineSets.forEach((set, index) => {
        const text = document.slice(after[index].start, after[index].end);
        if (text !== baselineDocument.slice(before[index].start, before[index].end)) {
            patches.push({ kind: 'replace', index, set_id: set.id, start: before[index].start, end: before[index].end, text });
        }
    });
    if (appended.length) {
        const end = before[baselineSets.length - 1].end;
        patches.push({ kind: 'append', index: baselineSets.length, set_id: appended.map((set) => set.id).join(','), start: end, end,
            text: document.slice(after[baselineSets.length - 1].end, after[sets.length - 1].end) });
    }
    if (!patches.length) throw new Error('운영 릴리스와 정본이 같습니다. 반영할 변경이 없습니다.');
    if (applyTextPatches(baselineDocument, patches) !== document) throw new Error('패치로 복원한 원문이 정본과 바이트 단위로 다릅니다.');
    const applicability = {};
    const metadata = {
        applicability, ...learningCatalogForBank(sets, input.catalog),
        source_file_hash: sha256(document), bank_content_hash: contentHash({ sets, applicability }),
        public_content_hash: contentHash(sets.map(compilePublicQuestionSet)),
        evidence: input.evidence.trim(), source_validation: 'external-importer', actor_user_id: null,
    };
    return {
        baselineSets, sets, patches, metadata,
        replacedIds: patches.filter((patch) => patch.kind === 'replace').map((patch) => patch.set_id),
        appendedIds: appended.map((set) => set.id),
        payload: { sets, ...metadata, source_document: document },
    };
}

export function releasePack(delta: ReleaseDelta) {
    return { metadata: delta.metadata, patches: delta.patches.map(({ kind, index, set_id, start, end, text }) => ({ kind, index, set_id, start, end, text })) };
}

/** pack을 SQL에 싣는 방식. `compressed`의 base64는 {@link compressReleasePack}이 만든다. */
export type ReleaseTransport = { kind: 'literal' } | { kind: 'compressed'; base64: string };
export const COMPRESSED_PACK_PASSPHRASE = 'audit-say-public-compressed-transport-v1';
const COMPRESSED_PACK_OPTIONS = 'compress-algo=2, compress-level=9, cipher-algo=aes256';

/** 로컬 PGlite의 pgcrypto로 pack을 압축 메시지로 만들고, 되풀어 원 pack과 바이트가 같은지 확인한다. */
export async function compressReleasePack(delta: ReleaseDelta): Promise<{ base64: string; pack_bytes: number; base64_bytes: number }> {
    const text = JSON.stringify(releasePack(delta));
    const pg = await PGlite.create({ extensions: { pgcrypto } });
    try {
        await pg.exec('create extension if not exists pgcrypto');
        const packed = (await pg.query<{ c: Uint8Array }>("select pgp_sym_encrypt_bytea(convert_to($1,'UTF8'),$2,$3) as c", [text, COMPRESSED_PACK_PASSPHRASE, COMPRESSED_PACK_OPTIONS])).rows[0].c;
        const base64 = Buffer.from(packed).toString('base64');
        const back = (await pg.query<{ t: string }>("select convert_from(pgp_sym_decrypt_bytea(decode($1,'base64'),$2),'UTF8') as t", [base64, COMPRESSED_PACK_PASSPHRASE])).rows[0].t;
        if (back !== text) throw new Error('압축 pack을 풀어 낸 결과가 원 pack과 다릅니다.');
        return { base64, pack_bytes: Buffer.byteLength(text), base64_bytes: Buffer.byteLength(base64) };
    } finally { await pg.close(); }
}

function packSql(pack: ReturnType<typeof releasePack>, transport: ReleaseTransport): string {
    if (transport.kind === 'literal') return `${dollar(JSON.stringify(pack), 'delta')}::jsonb`;
    if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(transport.base64)) throw new Error('압축 pack은 줄바꿈 없는 base64여야 합니다.');
    return `convert_from(extensions.pgp_sym_decrypt_bytea(decode('${transport.base64}','base64'),'${COMPRESSED_PACK_PASSPHRASE}'),'UTF8')::jsonb`;
}

function dollar(value: string, prefix: string): string {
    const tag = `$${prefix}_${sha256(value).slice(0, 20)}$`;
    if (value.includes(tag)) throw new Error('dollar 인용 태그가 본문과 겹칩니다.');
    return `${tag}${value}${tag}`;
}
// 세트 ID(DB 검사: ^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$)만 SQL 리터럴로 넣는다.
const text = (value: string) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(value)) throw new Error(`SQL 리터럴로 쓸 수 없는 세트 ID입니다: ${value}`);
    return `'${value}'`;
};
const hex64 = (value: string) => { if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error('64자리 해시가 필요합니다.'); return `'${value}'`; };
const uuid = (value: string) => { if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value)) throw new Error('UUID가 필요합니다.'); return `'${value}'::uuid`; };
const idList = (ids: string[]) => `array[${ids.map(text).join(',')}]::text[]`;
const intList = (values: number[]) => `array[${values.map((value) => { if (!Number.isSafeInteger(value) || value < 0) throw new Error('정수 위치가 필요합니다.'); return String(value); }).join(',')}]::int[]`;

/** 저장 원문 + 패치 → 최종 원문과 importer payload. `baselineSql`은 source_document 한 열을 돌려준다. */
export function restoreCte(pack: ReturnType<typeof releasePack>, baselineSql: string, transport: ReleaseTransport = { kind: 'literal' }): string {
    return `with packed as materialized(select ${packSql(pack, transport)} as d),`
        + `baseline as materialized(${baselineSql}),`
        + `patches as materialized(select (x.p->>'start')::int as s,(x.p->>'end')::int as e,x.p->>'text' as t,x.ord from packed cross join jsonb_array_elements(packed.d->'patches') with ordinality as x(p,ord)),`
        + `pieces as materialized(select ord,substr(b.source_document,coalesce(lag(e) over (order by ord),0)+1,s-coalesce(lag(e) over (order by ord),0))||t as piece from patches cross join baseline b),`
        + `restored as materialized(select packed.d,(select string_agg(piece,'' order by ord) from pieces)||substr(b.source_document,(select max(e) from patches)+1) as document,b.source_document as prior_document from packed cross join baseline b),`
        + `payload as materialized(select d,document,prior_document,(d->'metadata')||jsonb_build_object('source_document',document,'sets',document::jsonb) as p from restored) `;
}

/** 바꾸지 않은 세트는 객체가 같고, 교체한 세트는 같은 ID로 내용만 다르며, 추가 세트는 정한 순서로 끝에 붙는다. */
export function unchangedCondition(delta: Pick<ReleaseDelta, 'baselineSets' | 'patches' | 'appendedIds'>): string {
    const replaced = delta.patches.filter((patch) => patch.kind === 'replace').map((patch) => patch.index);
    const count = delta.baselineSets.length;
    const appended = delta.appendedIds.map((id, k) => ` and (p->'sets')->${count + k}->>'id'=${text(id)}`).join('');
    return `(jsonb_array_length(prior_document::jsonb)=${count} and jsonb_array_length(p->'sets')=${count + delta.appendedIds.length}`
        + ` and not exists(select 1 from jsonb_array_elements(prior_document::jsonb) with ordinality o(v,i) where`
        + ` ((i-1)::int<>all(${intList(replaced)}) and (p->'sets')->((i-1)::int) is distinct from v)`
        + ` or ((i-1)::int=any(${intList(replaced)}) and ((p->'sets')->((i-1)::int)->>'id' is distinct from v->>'id' or (p->'sets')->((i-1)::int)=v)))${appended})`;
}

function functionGuards(functions: ReleaseFunction[]): string {
    if (!functions.length) throw new Error('검토한 함수 정의 목록이 필요합니다.');
    return functions.map((fn) => {
        if (!/^[a-z_][a-z0-9_]*\([a-z0-9_[\], ]*\)$/u.test(fn.signature)) throw new Error(`함수 서명 형식이 올바르지 않습니다: ${fn.signature}`);
        return `if encode(sha256(convert_to(pg_get_functiondef('public.${fn.signature}'::regprocedure),'UTF8')),'hex') is distinct from ${hex64(fn.definition_sha256)} then raise exception 'Reviewed function changed: ${fn.signature}'; end if;`;
    }).join('\n');
}

/**
 * 적용 SQL(한 transaction)과 읽기 전용 probe SQL.
 * apply: 역할·잠금·함수 정의·active 기준 원문 확인 → 복원 payload 해시·불변 조건이 맞을 때만 importer 호출 → 사후 검증.
 */
export function buildReleaseDeltaSql(delta: ReleaseDelta, expected: ReleaseExpectation, functions: ReleaseFunction[], payloadHash: string, mode: 'apply' | 'probe' = 'apply',
    transport: ReleaseTransport = { kind: 'literal' }): string {
    const pack = releasePack(delta);
    if (!Number.isSafeInteger(expected.set_count) || expected.set_count !== delta.baselineSets.length) throw new Error('운영 릴리스 세트 수가 기준 원문과 다릅니다.');
    hex64(payloadHash); hex64(expected.source_file_hash); uuid(expected.release_id);
    for (const key of ['source_file_hash', 'bank_content_hash', 'public_content_hash'] as const) hex64(delta.metadata[key]);
    const cte = restoreCte(pack, "select source_document from public.cpa_question_bank_releases where status='active'", transport);
    const unchanged = unchangedCondition(delta);
    const active = `select id,source_file_hash,source_document into strict active_id,active_hash,source from public.cpa_question_bank_releases where status='active';\n`
        + `if active_id is distinct from ${uuid(expected.release_id)} or active_hash is distinct from ${hex64(expected.source_file_hash)} or source is null or encode(sha256(convert_to(source,'UTF8')),'hex') is distinct from ${hex64(expected.source_file_hash)} then raise exception 'Active baseline changed'; end if;\n`
        + `if right(source,3) <> E'\\n]\\n' or jsonb_typeof(source::jsonb) <> 'array' or jsonb_array_length(source::jsonb) <> ${expected.set_count} then raise exception 'Unexpected baseline source shape'; end if;`;
    if (mode === 'probe') {
        // 읽기 전용 연결에서 실행한다. 역할 전환·잠금·importer 호출 없이 복원 해시만 계산한다.
        return `begin read only;\nset local statement_timeout='120s';\n`
            + `do $delta_probe$ declare active_id uuid; active_hash text; source text; begin\n${functionGuards(functions)}\n${active}\nend $delta_probe$;\n`
            + `${cte}select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,current_setting('transaction_read_only') as transaction_read_only,`
            + `encode(sha256(convert_to(p::text,'UTF8')),'hex') as payload_jsonb_sha256,encode(sha256(convert_to(document,'UTF8')),'hex') as source_file_hash,${unchanged} as unchanged_sets_identical from payload;\ncommit;\n`;
    }
    const replaced = delta.replacedIds, appended = delta.appendedIds, touched = [...replaced, ...appended];
    const guard = `case when encode(sha256(convert_to(p::text,'UTF8')),'hex')=${hex64(payloadHash)} and encode(sha256(convert_to(document,'UTF8')),'hex')=p->>'source_file_hash' and ${unchanged} then p else null::jsonb end`;
    const after = `do $delta_after$ declare new_id uuid; current_source text; actual jsonb; prior jsonb; begin\n`
        + `select id,source_document into strict new_id,current_source from public.cpa_question_bank_releases where status='active' and source_file_hash=${hex64(delta.metadata.source_file_hash)} and bank_content_hash=${hex64(delta.metadata.bank_content_hash)} and public_content_hash=${hex64(delta.metadata.public_content_hash)};\n`
        + `if encode(sha256(convert_to(current_source,'UTF8')),'hex') is distinct from ${hex64(delta.metadata.source_file_hash)} then raise exception 'Final source identity mismatch'; end if;\n`
        + `if exists(select 1 from public.cpa_question_bank_release_items old where old.release_id=${uuid(expected.release_id)} and old.set_id<>all(${idList(replaced)}) and not exists(select 1 from public.cpa_question_bank_release_items next where next.release_id=new_id and next.set_id=old.set_id and next.set_version_id=old.set_version_id and next.position=old.position)) then raise exception 'Unchanged set versions changed'; end if;\n`
        + (replaced.length ? `if (select count(*) from public.cpa_question_bank_release_items old join public.cpa_question_bank_release_items next on next.release_id=new_id and next.set_id=old.set_id and next.position=old.position and next.set_version_id<>old.set_version_id where old.release_id=${uuid(expected.release_id)} and old.set_id=any(${idList(replaced)})) <> ${replaced.length} then raise exception 'Corrected sets were not versioned in place'; end if;\n` : '')
        + (appended.length ? `if (select count(*) from public.cpa_question_bank_release_items next where next.release_id=new_id and next.set_id=any(${idList(appended)}) and next.position>${expected.set_count} and not exists(select 1 from public.cpa_question_bank_release_items old where old.set_version_id=next.set_version_id and old.release_id<>new_id)) <> ${appended.length} then raise exception 'Appended sets were not added as new versions'; end if;\n` : '')
        + `if (select count(*) from public.cpa_question_bank_release_items where release_id=new_id) <> jsonb_array_length(current_source::jsonb) or exists(select 1 from jsonb_array_elements(current_source::jsonb) with ordinality item(s,ord) where not exists(select 1 from public.cpa_question_bank_release_items ri where ri.release_id=new_id and ri.set_id=item.s->>'id' and ri.position=item.ord)) then raise exception 'Final release IDs or order differ from reviewed source'; end if;\n`
        + `select jsonb_agg(c order by c->>'source_set_id',c->>'subquestion_id') into actual from jsonb_array_elements(public.cpa_get_learning_classifications(new_id)) c where c->>'source_set_id'<>all(${idList(touched)});\n`
        + `select jsonb_agg(c order by c->>'source_set_id',c->>'subquestion_id') into prior from jsonb_array_elements(current_setting('cpa.delta_prior_classifications')::jsonb) c where c->>'source_set_id'<>all(${idList(touched)});\n`
        + `if actual is distinct from prior then raise exception 'Unchanged classification versions changed'; end if;\n`
        + `select jsonb_agg(to_jsonb(t) order by t.position) into actual from (select id,title,part,position from public.cpa_learning_topics) t;\n`
        + `if actual is distinct from current_setting('cpa.delta_prior_topics')::jsonb then raise exception 'Existing learning topics changed'; end if;\n`
        + `end $delta_after$;\n`;
    return `begin;\nset local role service_role;\nset local statement_timeout='120s';\n`
        + `do $delta_guard$ declare active_id uuid; active_hash text; source text; topics jsonb; begin\n`
        + `if current_user <> 'service_role' then raise exception 'Unexpected role'; end if;\n`
        + `perform pg_advisory_xact_lock(${ADVISORY_LOCK});\n${functionGuards(functions)}\n${active}\n`
        + `perform set_config('cpa.delta_prior_classifications',public.cpa_get_learning_classifications(active_id)::text,true);\n`
        + `select jsonb_agg(to_jsonb(t) order by t.position) into topics from (select id,title,part,position from public.cpa_learning_topics) t;\n`
        + `perform set_config('cpa.delta_prior_topics',topics::text,true);\nend $delta_guard$;\n`
        + `${cte}select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,public.${RELEASE_RPC}(${guard}) as receipt from payload;\n`
        + `${after}commit;\n`;
}

/** 읽기 전용 점검: active 릴리스, 검토 대상 함수 정의, 저장 원문 누적량. */
export function releaseInspectionSql(): string {
    const names = `array[${RELEASE_FUNCTIONS.map((name) => `'${name}'`).join(',')}]::text[]`;
    return `select jsonb_build_object(`
        + `'active',(select jsonb_build_object('release_id',r.id,'release_no',r.release_no,'source_file_hash',r.source_file_hash,`
        + `'source_document_sha256',case when r.source_document is null then null else encode(sha256(convert_to(r.source_document,'UTF8')),'hex') end,`
        + `'set_count',(select count(*) from public.cpa_question_bank_release_items i where i.release_id=r.id)) from public.cpa_question_bank_releases r where r.status='active'),`
        + `'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'signature',regexp_replace(p.oid::regprocedure::text,'^public\\.',''),`
        + `'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'acl',p.proacl::text,'security_definer',p.prosecdef) order by p.oid::regprocedure::text),'[]'::jsonb)`
        + ` from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=any(${names})),`
        + `'releases',(select jsonb_build_object('count',count(*),'stored_source_bytes',coalesce(sum(octet_length(source_document)),0)) from public.cpa_question_bank_releases)`
        + `) as inspection`;
}

export interface ReleaseInspection {
    active: { release_id: string; release_no: number; source_file_hash: string; source_document_sha256: string | null; set_count: number } | null;
    functions: (ReleaseFunction & { name: string; acl: string | null; security_definer: boolean })[];
    releases: { count: number; stored_source_bytes: number };
}

/**
 * 점검 결과가 이 경로의 전제(active 릴리스·저장 원문·검토 함수 전부)를 만족하는지 본다.
 * 함수 정의(SECURITY DEFINER 여부 포함)·ACL은 점검 시점 값으로 고정하고, 적용 직전·직후 점검과 비교한다.
 */
export function assertReleaseInspection(value: unknown): ReleaseInspection {
    const inspection = value as ReleaseInspection;
    if (!inspection?.active?.release_id) throw new Error('active 문제은행 릴리스가 없습니다.');
    if (inspection.active.source_document_sha256 !== inspection.active.source_file_hash) throw new Error('active 릴리스에 원문이 저장되어 있지 않거나 원문 해시가 다릅니다. 증분 반영의 기준으로 쓸 수 없습니다.');
    const names = new Set(inspection.functions.map((fn) => fn.name));
    const missing = RELEASE_FUNCTIONS.filter((name) => !names.has(name));
    if (missing.length) throw new Error(`검토 대상 함수가 없습니다: ${missing.join(', ')}`);
    return inspection;
}

/**
 * 운영 없이 로컬 PostgreSQL(PGlite)로 복원 원문·전체 payload가 정본과 같고 변조를 잡는지 증명한다.
 * 압축 전송이면 Supabase처럼 `extensions` 스키마에 pgcrypto를 두고 운영 SQL과 같은 풀기 식으로 복원한다.
 */
export async function proveReleaseDeltaLocally(delta: ReleaseDelta, baselineDocument: string, transport: ReleaseTransport = { kind: 'literal' }) {
    const pack = releasePack(delta);
    const pg = await PGlite.create(transport.kind === 'compressed' ? { extensions: { pgcrypto } } : undefined);
    try {
        if (transport.kind === 'compressed') await pg.exec('create schema extensions; create extension pgcrypto with schema extensions;');
        const expected = (await pg.query<{ h: string }>("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') as h", [JSON.stringify(delta.payload)])).rows[0].h;
        const sql = restoreCte(pack, 'select $1::text as source_document', transport)
            + `select document,p,encode(sha256(convert_to(p::text,'UTF8')),'hex') as payload_jsonb_sha256,encode(sha256(convert_to(document,'UTF8')),'hex') as source_file_hash,${unchangedCondition(delta)} as unchanged from payload`;
        const row = (await pg.query<{ document: string; p: unknown; payload_jsonb_sha256: string; source_file_hash: string; unchanged: boolean }>(sql, [baselineDocument])).rows[0];
        const document = applyTextPatches(baselineDocument, delta.patches);
        if (row.document !== document || row.source_file_hash !== sha256(document) || row.payload_jsonb_sha256 !== expected || row.unchanged !== true) {
            throw new Error('로컬 PostgreSQL 복원 결과가 정본·payload와 다릅니다.');
        }
        // 기준 원문이 한 글자라도 다르면 복원 해시가 달라져야 한다. 운영 SQL은 두 해시를 모두 요구한다.
        // 변조는 패치가 덮지 않고 기준 원문에서 그대로 가져오는 곳에 넣는다: 문서 끝, 그리고 바뀌지 않은 세트가 있으면 그 안.
        const tampers = [`${baselineDocument.slice(0, -1)} \n`];
        const spans = bankSpans(baselineDocument, delta.baselineSets);
        const kept = delta.baselineSets.findIndex((_, index) => !delta.patches.some((patch) => patch.kind === 'replace' && patch.index === index));
        if (kept >= 0) {
            const { start, end } = spans[kept];
            const span = baselineDocument.slice(start, end);
            if (!span.includes('"schema_version": "3.0"')) throw new Error('변조 검사용 세트 형상이 예상과 다릅니다.');
            tampers.push(baselineDocument.slice(0, start) + span.replace('"schema_version": "3.0"', '"schema_version": "3.1"') + baselineDocument.slice(end));
        }
        for (const tamperedBaseline of tampers) {
            const tampered = (await pg.query<{ source_file_hash: string; payload_jsonb_sha256: string }>(sql, [tamperedBaseline])).rows[0];
            if (tampered.source_file_hash === row.source_file_hash || tampered.payload_jsonb_sha256 === expected) throw new Error('변조한 기준 원문을 구별하지 못했습니다.');
        }
        return {
            payloadHash: expected,
            proof: {
                method: 'Local PGlite PostgreSQL reconstruction; no production database or API', transport: transport.kind, source_bytes_identical: true,
                complete_payload_equal: true, unchanged_sets_identical: true, tampered_baseline_detected: true,
                replaced_set_ids: delta.replacedIds, appended_set_ids: delta.appendedIds,
                baseline_bytes: Buffer.byteLength(baselineDocument), patch_text_bytes: delta.patches.reduce((n, patch) => n + Buffer.byteLength(patch.text), 0),
                metadata_bytes: Buffer.byteLength(JSON.stringify(delta.metadata)), final_document_bytes: Buffer.byteLength(document),
                payload_jsonb_sha256: expected, final_source_sha256: sha256(document),
            },
        };
    } finally { await pg.close(); }
}
