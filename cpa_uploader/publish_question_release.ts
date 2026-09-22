/**
 * 정본의 바뀐 세트만 운영 문제은행에 증분 게시한다. 회차마다 복사하던 db-incremental 드라이버를 대신한다.
 *
 *   inspect  운영 읽기 전용 점검(active 릴리스·검토 함수 정의)       → cpa_uploader/releases/<run>/inspection.json
 *   prepare  로컬 준비(운영 접속 없음): 기준 원문 찾기·증분 계산·DB 이관 준비 검사·PGlite 증명·SQL 생성
 *   probe    운영 읽기 전용 transaction에서 복원 payload 해시 대조
 *   apply    검토한 SQL을 한 번 실행한다. 실패해도 자동 재시도하지 않는다
 *   verify   운영 읽기 전용 왕복 검증(공개본·물음 분류·세트 버전·저장 원문·판본 조회 메모 적용률)
 *
 *   node --env-file=.env.local cpa_uploader/publish_question_release.ts <inspect|probe|verify> --run <YYYYMMDD-slug> --project <ref>
 *   node --env-file=.env.local cpa_uploader/publish_question_release.ts prepare --run <run> [--baseline-commit <sha> | --baseline-file <path>] [--transport literal|compressed]
 *   node --env-file=.env.local cpa_uploader/publish_question_release.ts apply --run <run> --project <ref> --expected-preparation-sha256 <sha>
 *
 * 운영 명령(inspect·probe·apply·verify)은 사용자가 직접 실행한다. SQL 본문은 커밋하지 않는 tmp/에 두고 기록에는 해시만 남긴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { canonicalJson } from '../lib/learningSubmission.ts';
import { publicLearningSet } from '../lib/learningPublic.ts';
import { validateLearningClassification } from '../lib/learningUnits.ts';
import { learningCatalogForBank } from '../scripts/import-question-bank-v3.ts';
import { publicationPaths, reviewedContentHash } from './questionBankPublication.ts';
import { CORRECTIONS_DIRECTORY, serializeBank, sha256 } from './questionCorrection.ts';
import {
    assertReleaseInspection, buildReleaseDelta, buildReleaseDeltaSql, compressReleasePack, COMPRESSED_PACK_PASSPHRASE, proveReleaseDeltaLocally,
    releaseInspectionSql, RELEASE_RPC,
} from './questionReleaseDelta.ts';
import type { ReleaseInspection, ReleaseTransport } from './questionReleaseDelta.ts';
import { DEFAULT_CATALOG } from './correct_cpa_v3.ts';

const RUN_PATTERN = /^\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PROJECT_PATTERN = /^[a-z0-9]{20}$/u;
/** Management API 요청 본문 중 통과가 확인된 최대 크기(2026-09-14, 1,820,645바이트). 이보다 크면 압축 전송을 권한다. */
const KNOWN_ACCEPTED_REQUEST_BYTES = 1_820_645;
const TRANSPORTS = ['literal', 'compressed'] as const;
type TransportKind = typeof TRANSPORTS[number];

/** 운영 SQL 전송. 여러 문장이면 마지막으로 행을 돌려준 문장의 행을 돌려준다(Management API와 같다). */
export type SqlTransport = <T>(sql: string, readOnly: boolean, parameters?: unknown[], timeout?: number) => Promise<T[]>;

export function releasePaths(root: string, run: string) {
    if (!RUN_PATTERN.test(run)) throw new Error('--run은 YYYYMMDD-<소문자-slug> 형식이어야 합니다.');
    const resolve = (key: string, fallback: string) => path.resolve(root, process.env[key] || fallback);
    const publication = publicationPaths(root);
    return {
        records: path.join(resolve('CPA_QUESTION_RELEASES_DIR', 'cpa_uploader/releases'), run),
        scratch: path.join(resolve('CPA_QUESTION_RELEASES_TMP_DIR', 'tmp/question-releases'), run),
        authoring: publication.authoring, public: publication.public,
        catalog: resolve('CPA_QUESTION_V3_LEARNING_CATALOG_PATH', DEFAULT_CATALOG),
        applied: resolve('CPA_QUESTION_CORRECTIONS_APPLIED_DIR', `${CORRECTIONS_DIRECTORY}/applied`),
    };
}
type Paths = ReturnType<typeof releasePaths>;

const rel = (root: string, file: string) => path.relative(root, file).split(path.sep).join('/');
const ref = (root: string, file: string) => ({ file: rel(root, file), sha256: sha256(fs.readFileSync(file)) });
const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
function writeRecord(file: string, value: unknown) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}
function guard(root: string, inputs: { file: string; sha256: string }[]) {
    for (const input of inputs) if (sha256(fs.readFileSync(path.resolve(root, input.file))) !== input.sha256) throw new Error(`준비 이후 입력이 바뀌었습니다: ${input.file}`);
}

// ---------------------------------------------------------------- 운영 SQL 전송

/** Supabase Management API. 응답·오류 본문에 문항 원문이 섞일 수 있으므로 SQLSTATE와 짧은 예외 문구만 남긴다. */
export function managementTransport(project: string): SqlTransport {
    if (!PROJECT_PATTERN.test(project)) throw new Error('--project에 Supabase 프로젝트 ref를 지정하십시오.');
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://invalid.local/');
    if (url.protocol !== 'https:' || url.hostname !== `${project}.supabase.co` || url.port || url.username || url.password) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL이 --project와 다른 프로젝트를 가리킵니다.');
    }
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!token) throw new Error('SUPABASE_ACCESS_TOKEN이 필요합니다(값은 기록하지 않습니다).');
    return async <T>(sql: string, readOnly: boolean, parameters: unknown[] = [], timeout = 60_000): Promise<T[]> => {
        const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeout),
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sql, read_only: readOnly, ...(parameters.length ? { parameters } : {}) }),
        });
        let body: unknown;
        try { body = await response.json(); } catch { throw Object.assign(new Error('Management SQL 응답을 읽을 수 없습니다(본문 생략).'), { http_status: response.status }); }
        if (!response.ok) {
            const message = typeof (body as { message?: unknown })?.message === 'string' ? (body as { message: string }).message : '';
            throw Object.assign(new Error(`Management SQL 실패 HTTP ${response.status}: ${message.match(/ERROR:\s+[0-9A-Z]{5}:\s*([^\n]{0,160})/u)?.[1] ?? '본문 생략'}`),
                { http_status: response.status, sqlstate: message.match(/ERROR:\s+([0-9A-Z]{5}):/u)?.[1] ?? null });
        }
        if (!Array.isArray(body)) throw new Error('Management SQL 응답 형상이 예상과 다릅니다.');
        return body as T[];
    };
}

async function inspect(transport: SqlTransport): Promise<ReleaseInspection> {
    const rows = await transport<{ inspection: unknown }>(releaseInspectionSql(), true);
    return assertReleaseInspection(rows[0]?.inspection);
}
const pinned = (inspection: ReleaseInspection) => ({ active: inspection.active, functions: inspection.functions });

// ---------------------------------------------------------------- 로컬 준비

interface Preparation {
    version: 1; status: 'locally_prepared_not_applied'; prepared_at: string; run: string; project: string; rpc: string;
    expected: { release_id: string; source_file_hash: string; set_count: number };
    functions: { signature: string; definition_sha256: string }[];
    baseline: { commit: string | null; file: string | null; sha256: string };
    inputs: { file: string; sha256: string }[];
    replaced_set_ids: string[]; appended_set_ids: string[];
    corrections: { correction_id: string; set_id: string; spec_sha256: string }[];
    unrecorded_changed_set_ids: string[];
    evidence: string;
    metadata: { source_file_hash: string; bank_content_hash: string; public_content_hash: string };
    payload_jsonb_sha256: string;
    transport: { kind: TransportKind; pack_bytes?: number; base64_bytes?: number; public_passphrase?: string; confidentiality_claim?: false };
    request_bytes: { apply: number; probe: number };
    sql: { file: string; sha256: string; bytes: number };
    probe_sql: { file: string; sha256: string; bytes: number };
    readiness: { file: string; sha256: string };
    local_proof: Record<string, unknown>;
}

/** 운영 active 원문과 SHA-256이 같은 정본 판본을 Git 이력(또는 지정 파일)에서 찾는다. 사본을 저장소에 두지 않는다. */
function findBaseline(root: string, paths: Paths, sha: string, options: { commit?: string; file?: string }): { commit: string | null; file: string | null; document: string } {
    if (options.commit && options.file) throw new Error('--baseline-commit과 --baseline-file 중 하나만 지정하십시오.');
    if (options.file) {
        const document = fs.readFileSync(path.resolve(root, options.file), 'utf8');
        if (sha256(document) !== sha) throw new Error('--baseline-file이 운영 active 원문과 다릅니다.');
        return { commit: null, file: rel(root, path.resolve(root, options.file)), document };
    }
    const file = rel(root, paths.authoring);
    const show = (revision: string) => execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, maxBuffer: 64 * 1024 * 1024, windowsHide: true }).toString('utf8');
    if (options.commit) {
        const document = show(options.commit);
        if (sha256(document) !== sha) throw new Error(`--baseline-commit ${options.commit}의 정본이 운영 active 원문과 다릅니다.`);
        return { commit: options.commit, file: null, document };
    }
    const revisions = execFileSync('git', ['log', '--format=%H', '-n', '200', '--', file], { cwd: root, windowsHide: true }).toString('utf8').split('\n').filter(Boolean);
    for (const revision of revisions) {
        const document = show(revision);
        if (sha256(document) === sha) return { commit: revision, file: null, document };
    }
    throw new Error('운영 active 원문과 같은 정본 판본을 최근 Git 이력에서 찾지 못했습니다. --baseline-commit 또는 --baseline-file로 지정하십시오.');
}

/** 교체된 세트마다 정본 설치 기록(corrections/applied)을 찾아 근거에 남긴다. */
function correctionRecords(paths: Paths, sets: QuestionSetV3[], ids: string[]) {
    const records = fs.existsSync(paths.applied) ? fs.readdirSync(paths.applied).filter((name) => name.endsWith('.json'))
        .map((name) => readJson<{ correction_id: string; set_id: string; spec: { sha256: string }; content_hash: { after: string } }>(path.join(paths.applied, name))) : [];
    const found: Preparation['corrections'] = [];
    const unrecorded: string[] = [];
    for (const id of ids) {
        const set = sets.find((item) => item.id === id)!;
        const match = records.filter((record) => record.set_id === id && record.content_hash.after === reviewedContentHash(set));
        if (!match.length) unrecorded.push(id);
        for (const record of match) found.push({ correction_id: record.correction_id, set_id: id, spec_sha256: record.spec.sha256 });
    }
    return { found, unrecorded };
}

async function prepareRelease(root: string, paths: Paths, run: string, baseline: { commit?: string; file?: string }, transportKind: TransportKind = 'literal') {
    if (!TRANSPORTS.includes(transportKind)) throw new Error(`--transport는 ${TRANSPORTS.join(' 또는 ')}입니다.`);
    const inspectionFile = path.join(paths.records, 'inspection.json');
    if (!fs.existsSync(inspectionFile)) throw new Error('먼저 inspect로 운영 상태를 점검하십시오.');
    if (fs.existsSync(path.join(paths.records, 'preparation.json'))) throw new Error('이미 준비한 실행입니다. 새 --run을 쓰십시오.');
    const recorded = readJson<{ project: string; inspection: ReleaseInspection }>(inspectionFile);
    const inspection = assertReleaseInspection(recorded.inspection);
    const document = fs.readFileSync(paths.authoring, 'utf8');
    const sets = JSON.parse(document) as QuestionSetV3[];
    if (serializeBank(sets) !== document) throw new Error('편집 정본이 직렬화 규칙과 다릅니다.');
    const catalog = readJson<Parameters<typeof learningCatalogForBank>[1]>(paths.catalog);
    if (canonicalJson(readJson(paths.public)) !== canonicalJson(sets.map(compilePublicQuestionSet))) throw new Error('공개본이 정본의 컴파일 결과와 다릅니다. 정본 설치를 먼저 마치십시오.');
    if (sha256(document) === inspection.active!.source_file_hash) throw new Error('운영 active 릴리스가 이미 현재 정본입니다. 반영할 변경이 없습니다.');
    const base = findBaseline(root, paths, inspection.active!.source_file_hash, baseline);
    const inputs = [ref(root, paths.authoring), ref(root, paths.catalog), ref(root, paths.public)];

    // 근거 문자열은 교체 세트별 정본 설치 기록을 가리킨다. 운영 검수 이벤트의 evidence로 남는다.
    const draft = buildReleaseDelta({ baselineDocument: base.document, document, catalog, evidence: 'pending' });
    const { found, unrecorded } = correctionRecords(paths, sets, draft.replacedIds);
    const evidence = [`question-release ${run}`, `changed ${[...draft.replacedIds, ...draft.appendedIds].join(',')}`,
        found.length ? `corrections ${found.map((item) => `${item.correction_id}@${item.spec_sha256.slice(0, 12)}`).join(',')}` : '',
        `baseline ${base.commit ?? base.file}`].filter(Boolean).join('; ');
    const delta = buildReleaseDelta({ baselineDocument: base.document, document, catalog, evidence });

    fs.mkdirSync(paths.scratch, { recursive: true });
    const readinessFile = path.join(paths.scratch, 'readiness.json');
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(env)) if (/OPENAI|ANTHROPIC|SUPABASE/iu.test(key)) delete env[key];
    delete env.NODE_OPTIONS;
    console.log('DB 이관 준비 검사(전체 은행 검증 포함, 수 분 걸릴 수 있음)…');
    const readinessRun = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/import-question-bank-v3.ts',
        '--report', readinessFile, '--learning-catalog', paths.catalog], { cwd: root, env, encoding: 'utf8', timeout: 600_000, windowsHide: true, shell: false, maxBuffer: 64 * 1024 * 1024 });
    const readiness = fs.existsSync(readinessFile) ? readJson<{ ready: boolean; errors: string[]; source_file_hash: string; bank_content_hash: string; public_content_hash: string }>(readinessFile) : null;
    if (readinessRun.status !== 0 || !readiness?.ready) throw new Error(`DB 이관 준비 검사 실패: ${readiness?.errors?.slice(0, 5).join(' / ') ?? readinessRun.stderr}`);
    for (const key of ['source_file_hash', 'bank_content_hash', 'public_content_hash'] as const) {
        if (readiness[key] !== delta.metadata[key]) throw new Error(`준비 검사와 증분 payload의 ${key}가 다릅니다.`);
    }
    guard(root, inputs);

    let transport: ReleaseTransport = { kind: 'literal' };
    let transportRecord: Preparation['transport'] = { kind: 'literal' };
    if (transportKind === 'compressed') {
        const compressed = await compressReleasePack(delta);
        transport = { kind: 'compressed', base64: compressed.base64 };
        transportRecord = { kind: 'compressed', pack_bytes: compressed.pack_bytes, base64_bytes: compressed.base64_bytes,
            public_passphrase: COMPRESSED_PACK_PASSPHRASE, confidentiality_claim: false };
    }
    const proof = await proveReleaseDeltaLocally(delta, base.document, transport);
    const expected = { release_id: inspection.active!.release_id, source_file_hash: inspection.active!.source_file_hash, set_count: inspection.active!.set_count };
    const functions = inspection.functions.map(({ signature, definition_sha256 }) => ({ signature, definition_sha256 }));
    const sql = buildReleaseDeltaSql(delta, expected, functions, proof.payloadHash, 'apply', transport);
    const probeSql = buildReleaseDeltaSql(delta, expected, functions, proof.payloadHash, 'probe', transport);
    // managementTransport가 보내는 본문과 같은 모양으로 크기를 잰다.
    const requestBytes = { apply: Buffer.byteLength(JSON.stringify({ query: sql, read_only: false })), probe: Buffer.byteLength(JSON.stringify({ query: probeSql, read_only: true })) };
    const sqlFile = path.join(paths.scratch, 'apply.sql'), probeFile = path.join(paths.scratch, 'probe.sql');
    fs.writeFileSync(sqlFile, sql, { flag: 'wx' });
    fs.writeFileSync(probeFile, probeSql, { flag: 'wx' });
    const preparation: Preparation = {
        version: 1, status: 'locally_prepared_not_applied', prepared_at: new Date().toISOString(), run, project: recorded.project, rpc: RELEASE_RPC,
        expected, functions, baseline: { commit: base.commit, file: base.file, sha256: sha256(base.document) }, inputs,
        replaced_set_ids: delta.replacedIds, appended_set_ids: delta.appendedIds, corrections: found, unrecorded_changed_set_ids: unrecorded,
        evidence, metadata: { source_file_hash: delta.metadata.source_file_hash, bank_content_hash: delta.metadata.bank_content_hash, public_content_hash: delta.metadata.public_content_hash },
        payload_jsonb_sha256: proof.payloadHash, transport: transportRecord, request_bytes: requestBytes,
        sql: { file: rel(root, sqlFile), sha256: sha256(sql), bytes: Buffer.byteLength(sql) },
        probe_sql: { file: rel(root, probeFile), sha256: sha256(probeSql), bytes: Buffer.byteLength(probeSql) },
        readiness: ref(root, readinessFile), local_proof: proof.proof,
    };
    const preparationFile = path.join(paths.records, 'preparation.json');
    writeRecord(preparationFile, preparation);
    console.log(JSON.stringify({ status: preparation.status, replaced: delta.replacedIds, appended: delta.appendedIds, corrections: found.map((item) => item.correction_id),
        unrecorded_changed_set_ids: unrecorded, transport: transportRecord.kind, sql_bytes: preparation.sql.bytes, request_bytes: requestBytes,
        preparation_sha256: ref(root, preparationFile).sha256 }, null, 2));
    if (unrecorded.length) console.log(`주의: 정본 설치 기록이 없는 교체 세트 ${unrecorded.join(', ')} — 다른 게시 도구로 바뀐 세트인지 확인하십시오.`);
    if (Math.max(requestBytes.apply, requestBytes.probe) > KNOWN_ACCEPTED_REQUEST_BYTES) {
        console.log(`주의: 요청 본문이 통과가 확인된 크기(${KNOWN_ACCEPTED_REQUEST_BYTES}바이트)보다 큽니다. Management API가 HTTP 413으로 거절할 수 있습니다${transportRecord.kind === 'literal' ? '. 새 --run으로 --transport compressed를 쓰십시오' : ''}.`);
    }
    console.log(`다음(운영 읽기 전용): node --env-file=.env.local cpa_uploader/publish_question_release.ts probe --run ${run} --project ${recorded.project}`);
    return preparation;
}

function loadPrepared(root: string, paths: Paths) {
    const file = path.join(paths.records, 'preparation.json');
    if (!fs.existsSync(file)) throw new Error('preparation.json이 없습니다. prepare를 먼저 실행하십시오.');
    const preparation = readJson<Preparation>(file);
    guard(root, preparation.inputs);
    for (const item of [preparation.sql, preparation.probe_sql]) {
        const full = path.resolve(root, item.file);
        if (!fs.existsSync(full) || sha256(fs.readFileSync(full)) !== item.sha256) throw new Error(`준비한 SQL이 없거나 바뀌었습니다: ${item.file}. 새 --run으로 다시 준비하십시오.`);
    }
    return { preparation, file };
}
function recordedInspection(paths: Paths) {
    return readJson<{ project: string; inspection: ReleaseInspection }>(path.join(paths.records, 'inspection.json'));
}

// ---------------------------------------------------------------- 운영 명령

async function probeRelease(root: string, paths: Paths, project: string, transport: SqlTransport) {
    const { preparation, file } = loadPrepared(root, paths);
    if (preparation.project !== project) throw new Error('준비한 프로젝트와 다릅니다.');
    const resultFile = path.join(paths.records, 'probe-result.json');
    if (fs.existsSync(resultFile)) throw new Error('이미 probe를 기록했습니다.');
    const before = await inspect(transport);
    if (canonicalJson(pinned(before)) !== canonicalJson(pinned(recordedInspection(paths).inspection))) throw new Error('점검 이후 운영 active 릴리스나 함수 정의가 바뀌었습니다. 새 --run으로 다시 점검하십시오.');
    const started = Date.now();
    const rows = await transport<Record<string, unknown>>(fs.readFileSync(path.resolve(root, preparation.probe_sql.file), 'utf8'), true, [], 150_000);
    const row = rows.at(-1) ?? {};
    const after = await inspect(transport);
    if (canonicalJson(pinned(after)) !== canonicalJson(pinned(before))) throw new Error('읽기 전용 probe 중 운영 상태가 바뀌었습니다.');
    const passed = row.payload_jsonb_sha256 === preparation.payload_jsonb_sha256 && row.source_file_hash === preparation.metadata.source_file_hash
        && row.unchanged_sets_identical === true && row.transaction_read_only === 'on';
    writeRecord(resultFile, { checked_at: new Date().toISOString(), elapsed_ms: Date.now() - started, read_only_transaction: true, passed, result: row, db_writes: 0 });
    if (!passed) throw new Error('운영 원문으로 복원한 payload가 로컬 준비와 다릅니다. 적용하지 마십시오.');
    console.log(JSON.stringify({ status: 'probe_passed', ...row }, null, 2));
    console.log(`다음(운영 쓰기, 1회): node --env-file=.env.local cpa_uploader/publish_question_release.ts apply --run ${preparation.run} --project ${project} --expected-preparation-sha256 ${ref(root, file).sha256}`);
}

/**
 * 검증용 조회 함수(cpa_get_active_question_bank, cpa_get_learning_classifications)는 service_role만 실행할 수 있다.
 * Management API의 읽기 전용 요청은 그 권한이 없는 supabase_read_only_user로 실행되므로(2026-09-19 verify에서 permission denied),
 * 쓰기 가능 연결로 보내되 read only transaction 안에서 역할만 바꿔 부른다. 쓰기는 DB가 막는다.
 */
function serviceRoleRead(select: string): string {
    return `begin read only;
set local role service_role;
set local statement_timeout='120s';
${select};
commit;
`;
}

const itemsSql = "select coalesce(jsonb_agg(jsonb_build_object('set_id',set_id,'set_version_id',set_version_id,'position',position) order by position),'[]'::jsonb) as items from public.cpa_question_bank_release_items where release_id=$1::uuid";

async function applyRelease(root: string, paths: Paths, project: string, transport: SqlTransport, expectedPreparation: string) {
    const { preparation, file } = loadPrepared(root, paths);
    if (sha256(fs.readFileSync(file)) !== expectedPreparation) throw new Error('--expected-preparation-sha256이 검토한 preparation.json과 다릅니다.');
    if (preparation.project !== project) throw new Error('준비한 프로젝트와 다릅니다.');
    const probe = path.join(paths.records, 'probe-result.json');
    if (!fs.existsSync(probe) || !readJson<{ passed: boolean }>(probe).passed) throw new Error('운영 읽기 전용 probe를 먼저 통과해야 합니다.');
    const started = path.join(paths.records, 'apply-started.json');
    if (fs.existsSync(started)) throw new Error('이전 적용 시도가 있습니다. 자동 재시도하지 않습니다. verify로 운영 상태를 확인하십시오.');
    const before = await inspect(transport);
    if (canonicalJson(pinned(before)) !== canonicalJson(pinned(recordedInspection(paths).inspection))) throw new Error('점검 이후 운영 active 릴리스나 함수 정의가 바뀌었습니다. 적용하지 않았습니다.');
    const items = (await transport<{ items: unknown }>(itemsSql, true, [preparation.expected.release_id]))[0]?.items;
    writeRecord(path.join(paths.records, 'before.json'), { checked_at: new Date().toISOString(), inspection: before, items });
    const sql = fs.readFileSync(path.resolve(root, preparation.sql.file), 'utf8');
    if (sha256(sql) !== preparation.sql.sha256) throw new Error('SQL이 준비 후 바뀌었습니다.');
    writeRecord(started, { started_at: new Date().toISOString(), preparation: ref(root, file), sql: preparation.sql, automatic_retry: false });
    const begun = Date.now();
    try {
        const rows = await transport<Record<string, unknown>>(sql, false, [], 150_000);
        writeRecord(path.join(paths.records, 'apply-response.json'), { received_at: new Date().toISOString(), elapsed_ms: Date.now() - begun, response: rows });
    } catch (error) {
        const detail = error as Error & { http_status?: number; sqlstate?: string | null };
        writeRecord(path.join(paths.records, 'apply-failure.json'), { failed_at: new Date().toISOString(), elapsed_ms: Date.now() - begun, message: detail.message,
            http_status: detail.http_status ?? null, sqlstate: detail.sqlstate ?? null, outcome: 'uncertain_until_verify', automatic_retry: false });
        throw error;
    }
    console.log(`적용 응답을 기록했습니다. 다음(운영 읽기 전용): node --env-file=.env.local cpa_uploader/publish_question_release.ts verify --run ${preparation.run} --project ${project}`);
}

async function verifyRelease(root: string, paths: Paths, project: string, transport: SqlTransport) {
    const { preparation } = loadPrepared(root, paths);
    const responseFile = path.join(paths.records, 'apply-response.json');
    if (!fs.existsSync(responseFile)) throw new Error('apply-response.json이 없습니다. 실패 기록이 있으면 운영 상태를 직접 점검하십시오.');
    if (fs.existsSync(path.join(paths.records, 'completion.json'))) throw new Error('이미 검증을 마친 실행입니다.');
    const rows = readJson<{ response: { effective_role?: string; receipt?: { release_id?: string } }[] }>(responseFile).response;
    const row = rows.find((item) => item.receipt);
    if (!row?.receipt?.release_id || row.effective_role !== 'service_role') throw new Error('적용 응답에 service_role 영수증이 없습니다.');
    const releaseId = row.receipt.release_id;
    const before = readJson<{ inspection: ReleaseInspection; items: { set_id: string; set_version_id: string; position: number }[] }>(path.join(paths.records, 'before.json'));
    const after = await inspect(transport);
    const problems: string[] = [];
    if (after.active!.release_id !== releaseId) problems.push('active 릴리스가 적용 영수증의 릴리스가 아닙니다.');
    if (after.active!.source_file_hash !== preparation.metadata.source_file_hash || after.active!.source_document_sha256 !== preparation.metadata.source_file_hash) problems.push('active 저장 원문이 정본과 다릅니다.');
    if (canonicalJson(after.functions) !== canonicalJson(before.inspection.functions)) problems.push('함수 정의나 권한이 적용 전후로 달라졌습니다.');
    // 적용 SQL이 같은 transaction에서 채운 판본 조회 메모가 새 릴리스의 모든 항목을 덮는지 확인한다.
    const memo = after.memo;
    if (!memo || memo.memo_items !== memo.items || memo.memo_versions !== memo.items) problems.push('새 릴리스의 판본 조회 메모(cpa_question_bank_release_item_source)가 항목 수와 다릅니다.');
    const sets = JSON.parse(fs.readFileSync(paths.authoring, 'utf8')) as QuestionSetV3[];
    const bank = (await transport<{ bank: unknown[] }>(serviceRoleRead('select public.cpa_get_active_question_bank() as bank'), false, [], 150_000))[0]?.bank ?? [];
    const projected = (bank as Parameters<typeof publicLearningSet>[0][]).map(publicLearningSet).map((set) => {
        const copy = set as unknown as Record<string, unknown> & { subquestions: Record<string, unknown>[] };
        delete copy.release_id; delete copy.set_version_id;
        for (const sub of copy.subquestions) delete sub.logical_subquestion_id;
        return copy;
    });
    const publicRoundTrip = canonicalJson(projected) === canonicalJson(sets.map(compilePublicQuestionSet));
    if (!publicRoundTrip) problems.push('운영 공개 문제은행이 정본의 공개본과 다릅니다.');
    const expectedRows = learningCatalogForBank(sets, readJson(paths.catalog)).learning_classifications;
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(releaseId)) throw new Error('적용 영수증의 release_id 형식이 올바르지 않습니다.');
    const classes = ((await transport<{ rows: unknown[] }>(serviceRoleRead(`select public.cpa_get_learning_classifications('${releaseId}'::uuid) as rows`), false))[0]?.rows ?? []).map(validateLearningClassification);
    if (classes.length !== expectedRows.length || classes.some((item) => {
        const expected = expectedRows.find((entry) => entry.set_id === item.source_set_id && entry.subquestion_id === item.subquestion_id);
        return !expected || expected.question_style !== item.question_style || expected.standalone_prompt !== item.standalone_prompt
            || canonicalJson([...expected.topic_ids].sort()) !== canonicalJson([...item.topic_ids].sort())
            || canonicalJson([...expected.case_fact_ids].sort()) !== canonicalJson([...(item.case_fact_ids ?? [])].sort());
    })) problems.push('운영 물음 분류가 정본 카탈로그와 다릅니다.');
    const items = ((await transport<{ items: { set_id: string; set_version_id: string; position: number }[] }>(itemsSql, true, [releaseId]))[0]?.items) ?? [];
    const changed = new Set([...preparation.replaced_set_ids, ...preparation.appended_set_ids]);
    for (const old of before.items) {
        const next = items.find((item) => item.set_id === old.set_id);
        if (!next || next.position !== old.position) problems.push(`${old.set_id}: 새 릴리스에서 위치가 바뀌었거나 빠졌습니다.`);
        else if (changed.has(old.set_id) === (next.set_version_id === old.set_version_id)) problems.push(`${old.set_id}: ${changed.has(old.set_id) ? '교체 세트가 새 버전이 아닙니다' : '바뀌지 않은 세트의 버전이 달라졌습니다'}.`);
    }
    if (items.length !== sets.length) problems.push('새 릴리스의 세트 수가 정본과 다릅니다.');
    const verification = { checked_at: new Date().toISOString(), read_only: true, read_function_role: 'service_role in a read-only transaction', release_id: releaseId, passed: problems.length === 0, problems,
        public_round_trip: publicRoundTrip, classification_count: classes.length, set_count: items.length, memo,
        replaced_set_ids: preparation.replaced_set_ids, appended_set_ids: preparation.appended_set_ids, releases: after.releases };
    writeRecord(path.join(paths.records, 'verification.json'), verification);
    if (problems.length) throw new Error(`운영 검증 실패:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
    writeRecord(path.join(paths.records, 'completion.json'), { status: 'production_published_and_verified', completed_at: new Date().toISOString(), project,
        release_id: releaseId, previous_release_id: preparation.expected.release_id, source_file_hash: preparation.metadata.source_file_hash,
        replaced_set_ids: preparation.replaced_set_ids, appended_set_ids: preparation.appended_set_ids, corrections: preparation.corrections,
        preparation: ref(root, path.join(paths.records, 'preparation.json')), verification: ref(root, path.join(paths.records, 'verification.json')) });
    console.log(JSON.stringify({ status: 'production_published_and_verified', release_id: releaseId, replaced: preparation.replaced_set_ids, appended: preparation.appended_set_ids }, null, 2));
}

export interface ReleaseOptions { run: string; project?: string; baselineCommit?: string; baselineFile?: string; expectedPreparation?: string; transport?: TransportKind }

/** CLI와 테스트가 함께 쓴다. 테스트는 운영 대신 로컬 PostgreSQL 전송을 넘긴다. */
export async function runRelease(mode: string, options: ReleaseOptions, root = process.cwd(), transport?: SqlTransport) {
    const paths = releasePaths(root, options.run);
    if (mode === 'prepare') return prepareRelease(root, paths, options.run, { commit: options.baselineCommit, file: options.baselineFile }, options.transport);
    const project = options.project ?? '';
    if (!PROJECT_PATTERN.test(project)) throw new Error('--project에 Supabase 프로젝트 ref를 지정하십시오.');
    const sql = transport ?? managementTransport(project);
    if (mode === 'inspect') {
        const file = path.join(paths.records, 'inspection.json');
        if (fs.existsSync(file)) throw new Error('이미 점검한 실행입니다. 새 --run을 쓰십시오.');
        const inspection = await inspect(sql);
        writeRecord(file, { version: 1, checked_at: new Date().toISOString(), project, read_only: true, inspection });
        console.log(JSON.stringify({ active: inspection.active, memo: inspection.memo, releases: inspection.releases, functions: inspection.functions.length }, null, 2));
        console.log(`다음(로컬): node --env-file=.env.local cpa_uploader/publish_question_release.ts prepare --run ${options.run}`);
        return inspection;
    }
    if (mode === 'probe') return probeRelease(root, paths, project, sql);
    if (mode === 'apply') {
        if (!options.expectedPreparation || !/^[a-f0-9]{64}$/u.test(options.expectedPreparation)) throw new Error('--expected-preparation-sha256에 검토한 preparation.json의 SHA-256을 지정하십시오.');
        return applyRelease(root, paths, project, sql, options.expectedPreparation);
    }
    if (mode === 'verify') return verifyRelease(root, paths, project, sql);
    throw new Error('사용법: publish_question_release.ts <inspect|prepare|probe|apply|verify> --run <YYYYMMDD-slug> …');
}

export async function main(args = process.argv.slice(2), root = process.cwd()) {
    const [mode, ...rest] = args;
    const allowed: Record<string, string[]> = { inspect: ['--run', '--project'], prepare: ['--run', '--baseline-commit', '--baseline-file', '--transport'],
        probe: ['--run', '--project'], apply: ['--run', '--project', '--expected-preparation-sha256'], verify: ['--run', '--project'] };
    if (!allowed[mode]) throw new Error('사용법: publish_question_release.ts <inspect|prepare|probe|apply|verify> --run <YYYYMMDD-slug> …');
    const values = new Map<string, string>();
    for (let index = 0; index < rest.length; index += 2) {
        const [name, value] = [rest[index], rest[index + 1]];
        if (!allowed[mode].includes(name)) throw new Error(`${mode}에서 쓸 수 없는 인자: ${name}`);
        if (!value || value.startsWith('--') || values.has(name)) throw new Error(`${name} 값을 한 번 지정하십시오.`);
        values.set(name, value);
    }
    const run = values.get('--run');
    if (!run) throw new Error('--run이 필요합니다.');
    const transport = values.get('--transport');
    if (transport !== undefined && !TRANSPORTS.includes(transport as TransportKind)) throw new Error(`--transport는 ${TRANSPORTS.join(' 또는 ')}입니다.`);
    return runRelease(mode, { run, project: values.get('--project'), baselineCommit: values.get('--baseline-commit'),
        baselineFile: values.get('--baseline-file'), expectedPreparation: values.get('--expected-preparation-sha256'), transport: transport as TransportKind | undefined }, root);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
