import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import ts from 'typescript';
import { prepareSemanticReview, reviewChunkSchema, groundReviewChunk, completeSemanticReview } from '../../../questionSemanticReview.ts';
import type { PreparedSemanticReview, SemanticReviewResult } from '../../../questionSemanticReview.ts';
import { jsonHash } from '../../../questionReviewIdentity.ts';
import { requestOpenAIStructured, OpenAIRequestError } from '../../../../lib/ai/openaiStructured.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';

// Prototype: default is local cache validation. Only --execute permits API calls.
// The parent owns adoption, common-code changes, and authorization to execute.
type Identity = { file: string; sha256: string };
type Entry = { plan_id: string; set_id: string; file: string; sha256: string; plan_files: Identity[]; qa_file: string; qa_sha256: string; source_files: Identity[] };
type Lock = { manifest_sha256: string; comparison_bank: Identity; code_files: Identity[]; source_files?: Identity[]; settings: { review_model: string; grading_model: string; review_input_max_chars: number } };
type Runtime = { args: string[]; code_hashes: Record<string, string>; review_model: string; grading_model: string; max_input_chars: number; mock: boolean };
type RawRow = { set_id: string; unit_id: string; attempt: number; model: string; transport?: 'model'|'injected_response'; performed_at: string; input_hash: string; schema_hash: string; content_hash: string; bank_hash: string; source_files: Identity[]; response: unknown; error?: string; error_code?: string; instructions_hash?: string; record_kind?: string };
type Cached = { row: RawRow; grounded: SemanticReviewResult; log: string; line: number; log_hash: string; runtime_file: string; runtime_hash: string; response_hash: string; instructions_hash: string };
const read = <T = unknown>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const fileHash = (file: string) => sha(fs.readFileSync(file));
const samePath = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const reviewCode = 'cpa_uploader/questionSemanticReview.ts';
const requiredRuntimeCode = ['lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3Answer.ts', 'lib/questionV3.ts', 'lib/ai/openaiStructured.ts',
    reviewCode, 'cpa_uploader/questionReviewGrading.ts', 'cpa_uploader/review_question_draft_v3.ts', 'cpa_uploader/questionBankPublication.ts',
    'cpa_uploader/questionAuthoringPlan.ts', 'cpa_uploader/questionSourceCatalog.mjs'];

export function extractProductionInstructions(text: string): string {
    const source = ts.createSourceFile(reviewCode, text, ts.ScriptTarget.Latest, true);
    const found: string[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'instructions'
            && ts.isBinaryExpression(node.initializer) && ts.isStringLiteral(node.initializer.left)
            && node.initializer.left.text.startsWith('당신은 별도 의미 검수자다.')) found.push(node.initializer.left.text);
        ts.forEachChild(node, visit);
    };
    visit(source);
    if (found.length !== 1) throw Error('현행 생산 지시문 AST를 유일하게 추출할 수 없음');
    return found[0];
}

const headerNames = ['x-request-id', 'x-ratelimit-limit-requests', 'x-ratelimit-remaining-requests', 'x-ratelimit-reset-requests', 'x-ratelimit-limit-tokens', 'x-ratelimit-remaining-tokens', 'x-ratelimit-reset-tokens', 'retry-after'];
export function safeHeaders(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object') return {};
    const headers = value as { get?: (key: string) => string | null } & Record<string, unknown>;
    return Object.fromEntries(headerNames.flatMap(key => {
        const v = typeof headers.get === 'function' ? headers.get(key) : headers[key];
        return typeof v === 'string' ? [[key, v]] : [];
    }));
}
export function safeError(error: unknown, depth = 0): Record<string, unknown> {
    const value = (error && typeof error === 'object' ? error : {}) as { name?: unknown; status?: unknown; code?: unknown; retryable?: unknown; request_id?: unknown; headers?: unknown; cause?: unknown };
    return {
        name: typeof value.name === 'string' ? value.name : 'UnknownError',
        status: typeof value.status === 'number' ? value.status : null,
        code: typeof value.code === 'string' ? value.code : null,
        retryable: typeof value.retryable === 'boolean' ? value.retryable : null,
        request_id: typeof value.request_id === 'string' ? value.request_id : null,
        headers: safeHeaders(value.headers),
        ...(depth < 2 && value.cause ? { cause: safeError(value.cause, depth + 1) } : {}),
    };
}

function parseArgs(values: string[]) {
    const args: Record<string, string> = {};
    const logs: string[] = [];
    const skipUnits: string[] = [];
    let execute = false, explicitCache = false;
    for (let i = 0; i < values.length; i++) {
        const key = values[i];
        if (key === '--execute') { if (execute) throw Error('중복 --execute'); execute = true; continue; }
        if (key === '--cache-only') { if (explicitCache) throw Error('중복 --cache-only'); explicitCache = true; continue; }
        if (!['--manifest', '--plan-id', '--runtime-lock', '--resume-log', '--skip-unit', '--output'].includes(key) || !values[i + 1] || values[i + 1].startsWith('--')) throw Error('지원인자 --manifest --plan-id --runtime-lock --resume-log(반복가능) --skip-unit(반복가능) --output --cache-only 또는 --execute');
        const value = values[++i];
        if (key === '--resume-log') logs.push(value);
        else if (key === '--skip-unit') { if (skipUnits.includes(value)) throw Error('중복 skip unit'); skipUnits.push(value); }
        else { if (args[key]) throw Error(`중복 ${key}`); args[key] = value; }
    }
    if (!args['--manifest'] || !args['--plan-id'] || !args['--output'] || execute && explicitCache) throw Error('manifest, plan-id, 새 output 디렉터리 및 배타적 실행모드 필요');
    return { values: args, logs, skipUnits, execute };
}

function unitRequest(prepared: PreparedSemanticReview, unit: PreparedSemanticReview['units'][number]) {
    const input = JSON.stringify({ ...(prepared.requestContext as Record<string, unknown>), target_unit: unit.id,
        reference_catalog: { fields: unit.fields, sources: prepared.sources.filter(source => unit.sources.includes(source.source_ref_id))
            .map(source => ({ id: source.source_ref_id, quote: source.declared_metadata.source_quote })) } });
    return { input, input_hash: sha(input), schema: reviewChunkSchema(unit), schema_hash: jsonHash(reviewChunkSchema(unit)) };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
    const parsed = parseArgs(argv);
    const args = parsed.values;
    const manifestFile = args['--manifest'], lockFile = args['--runtime-lock'] || path.join(path.dirname(manifestFile), 'runtime-lock.json');
    const manifest = read<{ entries: Entry[] }>(manifestFile), lock = read<Lock>(lockFile);
    const entries = manifest.entries.filter(e => e.plan_id === args['--plan-id']);
    if (entries.length !== 1) throw Error('manifest의 계획 ID가 유일하지 않음');
    const entry = entries[0];
    if (entry.plan_files.length !== 1) throw Error('정확한 단일 plan 파일이 필요');
    const planFile = entry.plan_files[0].file;
    const bankFile = lock.comparison_bank.file;
    const model = lock.settings.review_model, maxChars = lock.settings.review_input_max_chars;
    if (model !== 'gpt-5.6-luna' || lock.settings.grading_model !== model || maxChars !== 500000) throw Error('이번 고정 모델/500k 설정과 다름');
    if (process.env.CPA_REVIEW_MODEL && process.env.CPA_REVIEW_MODEL !== model
        || process.env.CPA_GRADING_MODEL && process.env.CPA_GRADING_MODEL !== lock.settings.grading_model
        || process.env.CPA_REVIEW_INPUT_MAX_CHARS && Number(process.env.CPA_REVIEW_INPUT_MAX_CHARS) !== maxChars) throw Error('프로세스 환경 설정이 고정 runtime과 다름');
    const output = path.resolve(args['--output']);
    const allowed = path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11') + path.sep;
    if (!output.toLowerCase().startsWith(allowed.toLowerCase()) || fs.existsSync(output)) throw Error('배정 출력범위의 새 디렉터리만 허용');
    const snapshots = new Map<string, string>();
    const verifyIdentity = ({ file, sha256 }: Identity) => {
        if (fileHash(file) !== sha256) throw Error(`고정 해시 불일치: ${file}`);
        snapshots.set(path.resolve(file), sha256);
    };
    for (const item of [{ file: manifestFile, sha256: lock.manifest_sha256 }, lock.comparison_bank, ...lock.code_files, ...(lock.source_files || []),
        { file: entry.file, sha256: entry.sha256 }, { file: entry.qa_file, sha256: entry.qa_sha256 }, ...entry.plan_files, ...entry.source_files]) verifyIdentity(item);
    snapshots.set(path.resolve(lockFile), fileHash(lockFile));
    const ownFile = path.resolve(process.argv[1]); snapshots.set(ownFile, fileHash(ownFile));
    if (!lock.code_files.some(f => samePath(f.file, reviewCode))) throw Error('검수 공통코드가 runtime-lock에 없음');
    const guard = () => {
        for (const [file, expected] of snapshots) if (!fs.existsSync(file) || fileHash(file) !== expected) throw Error(`실행 중 입력·코드 변경: ${file}`);
    };
    const raw = read<QuestionSetV3 | QuestionSetV3[]>(entry.file);
    if (Array.isArray(raw) && raw.length !== 1) throw Error('세트별 실행에는 한세트 입력만 허용');
    const set = Array.isArray(raw) ? raw[0] : raw;
    if (set.id !== entry.set_id) throw Error('manifest/set ID 불일치');
    const rawPlan = read<{ plans?: Array<{ set_id: string }> }>(planFile);
    const plan = rawPlan.plans ? rawPlan.plans.find(p => p.set_id === set.id) : rawPlan;
    const bank = read<QuestionSetV3[]>(bankFile);
    const prepared = prepareSemanticReview(set, { bank: [...bank.filter(peer => peer.id !== set.id), set], authoringPlan: plan, maxInputChars: maxChars });
    for (const source of prepared.sourceFiles) verifyIdentity(source);
    const instructions = extractProductionInstructions(fs.readFileSync(reviewCode, 'utf8'));
    const instructionsHash = sha(instructions);
    const requests = new Map(prepared.units.map(unit => [unit.id, unitRequest(prepared, unit)]));
    for (const request of requests.values()) if (request.input.length > maxChars) throw Error('원문을 보존한 단위 입력이 고정 예산을 초과');
    const cached = new Map<string, Cached>();
    const cacheErrors: Array<{ log: string; line: number; unit_id: string; error: string; actual_response_received: boolean }> = [];
    for (const log of parsed.logs) {
        if (!log.endsWith('.chunks.jsonl')) throw Error('생산 chunks JSONL만 재사용 가능');
        const runtimeFile = log.slice(0, -'.chunks.jsonl'.length) + '.runtime.json';
        const runtimeResultFile = log.slice(0, -'.chunks.jsonl'.length) + '.runtime-result.json';
        const runtime = read<Runtime>(runtimeFile);
        const runtimeResult = read<{ changed_code_files?: string[]; changed_input_files?: string[] }>(runtimeResultFile);
        if (runtime.mock !== false || runtime.review_model !== model || runtime.grading_model !== lock.settings.grading_model || runtime.max_input_chars !== maxChars
            || !Array.isArray(runtimeResult.changed_code_files) || runtimeResult.changed_code_files.length || runtimeResult.changed_input_files?.length) throw Error('원실행 모델/예산/코드/입력 안정성 증거 불일치');
        const runtimeArg = (name: string) => { const i = runtime.args.indexOf(name); if (i < 0 || !runtime.args[i + 1]) throw Error(`원 runtime 인자 없음 ${name}`); return runtime.args[i + 1]; };
        if (!samePath(runtimeArg('--file'), entry.file) || !samePath(runtimeArg('--plan'), planFile) || !samePath(runtimeArg('--bank'), bankFile)) throw Error('원실행 문항/plan/은행 경로가 다름');
        if (!Object.keys(runtime.code_hashes).some(f => samePath(f, reviewCode))) throw Error('원 runtime에검수지시·공통코드 해시가 없음');
        for (const required of requiredRuntimeCode) if (!Object.keys(runtime.code_hashes).some(f => samePath(f, required))) throw Error(`원 runtime 공통코드 해시 누락: ${required}`);
        for (const [file, expected] of Object.entries(runtime.code_hashes)) verifyIdentity({ file, sha256: expected });
        // This also refuses an old cache after a production instruction/code change.
        for (const file of [log, runtimeFile, runtimeResultFile]) snapshots.set(path.resolve(file), fileHash(file));
        const rows = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as RawRow);
        for (const [index, row] of rows.entries()) {
            if (row.record_kind && row.record_kind !== 'new_actual_model_request') throw Error('실제 신규 응답 로그만 재사용 가능. 재사용 장부 대신 원 chunks를 지정하세요.');
            if (row.transport !== 'model') throw Error('실제 모델 transport가 명시되지 않은 과거 단위는 새 의미검수로 재사용할 수 없음');
            const unit = prepared.units.find(unit => unit.id === row.unit_id), request = requests.get(row.unit_id);
            if (!unit || !request || row.set_id !== set.id || row.model !== model || row.content_hash !== prepared.contentHash || row.bank_hash !== prepared.bankHash
                || jsonHash(row.source_files) !== jsonHash(prepared.sourceFiles) || row.input_hash !== request.input_hash || row.schema_hash !== request.schema_hash) throw Error(`캐시 identity 불일치 ${log}:${index + 1}`);
            if (row.error || row.response == null) { cacheErrors.push({ log, line: index + 1, unit_id: row.unit_id, error: row.error || 'null response', actual_response_received: row.response != null }); continue; }
            if (![1, 2].includes(row.attempt)) throw Error('원생산 retry 범위 밖 attempt');
            let priorError = '';
            if (row.attempt === 2) {
                const previous = rows.slice(0, index).reverse().find(r => r.unit_id === row.unit_id && r.attempt === 1);
                if (!previous?.error) throw Error('재시도 응답의 원이전 오류가 없어 지시문 이력을 확인할 수 없음');
                priorError = previous.error;
            }
            const exactInstructions = instructions + (row.attempt > 1 ? ' 직전 응답 검증 오류를 고치되 판정을 임의로 pass로 바꾸지 말라: ' + priorError : '');
            if (row.instructions_hash && row.instructions_hash !== sha(exactInstructions)) throw Error('실제 응답에 기록한 지시문 해시가 원 retry 지시문과 다름');
            const grounded = groundReviewChunk(row.response, prepared, unit);
            const responseHash = jsonHash(row.response), previous = cached.get(row.unit_id);
            if (previous && previous.response_hash !== responseHash) throw Error(`같은 입력의 상이한 유효 응답이 둘 이상임. 유리한 판정을 임의선택하지 않음: ${row.unit_id}`);
            if (!previous) cached.set(row.unit_id, { row, grounded, log, line: index + 1, log_hash: fileHash(log), runtime_file: runtimeFile, runtime_hash: fileHash(runtimeFile), response_hash: responseHash, instructions_hash: sha(exactInstructions) });
        }
    }
    for (const unitId of parsed.skipUnits) {
        if (!prepared.units.some(unit => unit.id === unitId) || cached.has(unitId)
            || new Set(cacheErrors.filter(row => row.unit_id === unitId && row.actual_response_received).map(row => `${path.resolve(row.log)}:${row.line}`)).size < 2)
            throw Error(`skip은 현재 입력의 실제 응답 검증 실패가 두 번 이상 보존된 미완성 단위만 허용: ${unitId}`);
    }
    guard();
    fs.mkdirSync(output, { recursive: true });
    const writeNew = (name: string, value: unknown) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    const audit = { started_at: new Date().toISOString(), mode: parsed.execute ? 'execute' : 'cache_validation_only', manifest: manifestFile, plan_id: entry.plan_id, set_id: set.id,
        model, max_input_chars: maxChars, instructions_hash: instructionsHash, code_hashes: Object.fromEntries(lock.code_files.map(f => [f.file, f.sha256])),
        content_hash: prepared.contentHash, bank_hash: prepared.bankHash, source_files: prepared.sourceFiles, context_hash: jsonHash(prepared.context),
        checked_input_hashes: Object.fromEntries(snapshots), expected_units: prepared.units.length, cached_units: [...cached].map(([unit_id, c]) => ({ unit_id, log: c.log, line: c.line, log_hash: c.log_hash, runtime_file: c.runtime_file, runtime_hash: c.runtime_hash, response_hash: c.response_hash, input_hash: c.row.input_hash, schema_hash: c.row.schema_hash, instructions_hash: c.instructions_hash, checks: c.grounded.units[0].checks })),
        skipped_error_rows: cacheErrors, explicitly_unresolved_units: parsed.skipUnits, missing_units: prepared.units.filter(u => !cached.has(u.id)).map(u => u.id), actual_api_requests: 0,
        provenance: '실제 과거 모델 응답을 input/schema/content/bank/source/runtime/code로 확인해 직접 ground. API 응답 주입이나 mock으로 실행하지 않음.' };
    writeNew('cache-audit.json', audit);
    if (!parsed.execute) { console.log(JSON.stringify({ mode: audit.mode, reusable: cached.size, missing: audit.missing_units.length, actual_api_requests: 0, output })); return; }
    if (!process.env.OPENAI_API_KEY?.trim()) throw Error('실제 실행의 API key 없음');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
    const chunkFile = path.join(output, 'semantic.json.chunks.jsonl');
    fs.writeFileSync(chunkFile, '', { flag: 'wx' });
    const reuseFile = path.join(output, 'reused-actual-model-evidence.jsonl');
    fs.writeFileSync(reuseFile, '', { flag: 'wx' });
    const runtimeCode = { ...Object.fromEntries(lock.code_files.map(f => [f.file, f.sha256])), [ownFile]: snapshots.get(ownFile)! };
    writeNew('semantic.json.runtime.json', { started_at: audit.started_at, args: ['--file', entry.file, '--plan', planFile, '--bank', bankFile, '--output', path.join(output, 'semantic.json')],
        actual_invocation: argv, code_hashes: runtimeCode, review_model: model, grading_model: lock.settings.grading_model, max_input_chars: maxChars,
        credential_logged: false, transport: 'production_structured_api_with_direct_grounded_past_evidence', mock: false,
        runtime_lock: { file: lockFile, sha256: fileHash(lockFile) }, reused_evidence_file: reuseFile });
    const chunks: SemanticReviewResult[] = [];
    let liveRequests = 0, liveSuccessful = 0;
    const unresolved: Array<{ unit_id: string; reason: string }> = parsed.skipUnits.map(unit_id => ({ unit_id, reason: '같은 입력의 기존 실제 응답 검증 실패를 보존하며 재호출하지 않음. 미검증 상태 유지.' }));
    const append = (value: unknown) => fs.appendFileSync(chunkFile, JSON.stringify(value) + '\n');
    try {
        for (const unit of prepared.units) {
            guard();
            if (parsed.skipUnits.includes(unit.id)) continue;
            const cache = cached.get(unit.id);
            if (cache) {
                chunks.push(groundReviewChunk(cache.row.response, prepared, unit));
                fs.appendFileSync(reuseFile, JSON.stringify({ ...cache.row, record_kind: 'reused_actual_model_evidence', reused_at: new Date().toISOString(), original_log: cache.log, original_line: cache.line, original_log_hash: cache.log_hash, original_runtime_hash: cache.runtime_hash, new_api_request: false }) + '\n');
                continue;
            }
            const request = requests.get(unit.id)!;
            let lastError: unknown;
            for (let attempt = 1; attempt <= 2; attempt++) {
                guard();
                const meta: Record<string, unknown> = { set_id: set.id, unit_id: unit.id, content_hash: prepared.contentHash, bank_hash: prepared.bankHash, source_files: prepared.sourceFiles,
                    attempt, model, transport: 'model', performed_at: new Date().toISOString(), input_hash: request.input_hash, schema_hash: request.schema_hash, record_kind: 'new_actual_model_request', new_api_request: true };
                const exactInstructions = instructions + (attempt > 1 ? ' 직전 응답 검증 오류를 고치되 판정을 임의로 pass로 바꾸지 말라: ' + String(lastError) : '');
                meta.instructions_hash = sha(exactInstructions);
                let rawResponse: unknown = null;
                let grounded: SemanticReviewResult;
                liveRequests++;
                try {
                    rawResponse = await requestOpenAIStructured({ apiKey: process.env.OPENAI_API_KEY, model, name: 'question_semantic_review_unit', schema: request.schema,
                        maxOutputTokens: 6000, instructions: exactInstructions, input: request.input, timeoutMs: 60000, maxAttempts: 1 }, async (params, options) => {
                        try {
                            const response = await client.responses.create(params, options).withResponse();
                            meta.http_status = response.response.status; meta.request_id = response.request_id; meta.response_headers = safeHeaders(response.response.headers);
                            return response.data;
                        } catch (error) { meta.provider_error = safeError(error); throw error; }
                    });
                    grounded = groundReviewChunk(rawResponse, prepared, unit);
                } catch (error) {
                    lastError = error;
                    // Only locally generated empty/invalid_json messages enter the retry instruction;
                    // other provider errors retain safe metadata without the provider body/message.
                    const retryError = error instanceof OpenAIRequestError && !['invalid_json', 'empty'].includes(error.code) ? error.name : String(error);
                    append({ ...meta, response: rawResponse, error: retryError, error_code: error instanceof OpenAIRequestError ? error.code : 'validation', error_details: safeError(error) });
                    // A transport/provider failure stops new requests; no mass retries.
                    if (error instanceof OpenAIRequestError && !['invalid_json', 'empty'].includes(error.code)) throw error;
                    continue;
                }
                // Observer, filesystem, and guard errors are local execution failures.
                // They must escape the model-validation retry loop immediately.
                guard();
                append({ ...meta, response: rawResponse });
                chunks.push(grounded); liveSuccessful++; lastError = undefined;
                console.log(JSON.stringify({ set_id: set.id, unit_id: unit.id, attempt, status: 'grounded', checks: grounded.units[0].checks }));
                break;
            }
            if (lastError) {
                unresolved.push({ unit_id: unit.id, reason: String(lastError) });
                console.log(JSON.stringify({ set_id: set.id, unit_id: unit.id, status: 'validation_unresolved_continue_next_unit' }));
            }
        }
        guard();
        if (unresolved.length) {
            writeNew('partial-actual-model-evidence.json', { schema_version: 'partial-evidence-only', completed_receipt: false,
                set_id: set.id, content_hash: prepared.contentHash, bank_hash: prepared.bankHash,
                expected_units: prepared.units.map(unit => unit.id), unresolved_units: unresolved,
                units: chunks.flatMap(chunk => chunk.units), cases: chunks.flatMap(chunk => chunk.cases), notes: chunks.flatMap(chunk => chunk.notes),
                description: '모든 독립 단위의 실행 범위를 확보한 중간 증거다. 검증 실패 단위를 통과로 수락하거나 정식 의미검수 receipt로 사용하지 않는다.' });
            writeNew('summary.json', { finished_at: new Date().toISOString(), status: 'partial_units_completed', completed_receipt: false,
                unresolved_units: unresolved, reused_actual_units: cached.size, new_actual_api_requests: liveRequests,
                new_grounded_units: liveSuccessful, actual_grading_cases: 0, changed_inputs: [] });
            console.log(JSON.stringify({ set_id: set.id, status: 'partial_units_completed', unresolved_units: unresolved.map(unit => unit.unit_id), output }));
            return;
        }
        const receipt = completeSemanticReview(prepared, { units: chunks.flatMap(c => c.units), cases: chunks.flatMap(c => c.cases), notes: chunks.flatMap(c => c.notes) },
            { method: 'model_reasoned', model, transport: 'model', performed_at: new Date().toISOString(), description: `실제 과거 모델 근거 ${cached.size}단위를 원입력·스키마·모델·공통코드로 확인하고 직접 재ground하였다. 빠진 ${liveSuccessful}단위는 신규 실제 API ${liveRequests}요청으로 검수했다. 출처/코호트와 독립 actual grading은 별도다. cache-audit 및 raw chunks 참조.` });
        writeNew('semantic.json', { schema_version: '1.0', reviews: [receipt] });
        writeNew('summary.json', { finished_at: new Date().toISOString(), status: 'receipt_created', receipt_verdict: receipt.verdict, reused_actual_units: cached.size, new_actual_api_requests: liveRequests, new_grounded_units: liveSuccessful, actual_grading_cases: 0, changed_inputs: [] });
        console.log(JSON.stringify({ set_id: set.id, verdict: receipt.verdict, reused: cached.size, live_requests: liveRequests, output }));
    } catch (error) {
        writeNew('summary.json', { finished_at: new Date().toISOString(), status: 'stopped', error: safeError(error), validation_error: error instanceof OpenAIRequestError ? null : String(error), reused_available_units: cached.size, new_actual_api_requests: liveRequests, new_grounded_units: liveSuccessful, completed_receipt: false });
        throw error;
    } finally {
        writeNew('semantic.json.runtime-result.json', { finished_at: new Date().toISOString(),
            changed_code_files: Object.entries(runtimeCode).filter(([file, hash]) => !fs.existsSync(file) || fileHash(file) !== hash).map(([file]) => file),
            changed_input_files: [...snapshots].filter(([file, hash]) => !fs.existsSync(file) || fileHash(file) !== hash).map(([file]) => file),
            completed_receipt: fs.existsSync(path.join(output, 'semantic.json')), new_actual_api_requests: liveRequests });
    }
}

if (process.argv[1] && /continue-semantic-partial\.ts$/i.test(process.argv[1])) {
    void main().catch(error => { console.error(JSON.stringify({ error: safeError(error), validation_error: error instanceof OpenAIRequestError ? null : String(error) })); process.exitCode = 1; });
}
