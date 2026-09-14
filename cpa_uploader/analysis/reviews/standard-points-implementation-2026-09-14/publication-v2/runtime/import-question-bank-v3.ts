import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { compilePublicQuestionSet, computeQuestionSetMaxPoints, validateQuestionSetV3 } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { canonicalJson, contentHash } from '../lib/learningSubmission.ts';
import { publicLearningSet } from '../lib/learningPublic.ts';
import { buildLearningUnits, validateLearningClassification } from '../lib/learningUnits.ts';
import type { LearningClassification, LearningTopic } from '../lib/learningUnits.ts';

export function learningCatalogForBank(sets: QuestionSetV3[], catalog: { topics: LearningTopic[]; classifications: LearningClassification[] }) {
    const knownTopics = new Set(catalog.topics.map(topic => topic.id));
    const entries = sets.flatMap(set => set.subquestions.map(sub => {
        if (sub.question_style && sub.topic_ids?.length) {
            if (sub.topic_ids.some(id => !knownTopics.has(id))) throw new Error(`${set.id}/${sub.id}: 등록되지 않은 물음 주제입니다.`);
            return { set_id: set.id, subquestion_id: sub.id, question_style: sub.question_style, topic_ids: sub.topic_ids,
                standalone_prompt: sub.question_style === 'standard' ? sub.prompt : null, case_fact_ids: [] as string[] };
        }
        const row = catalog.classifications.find(row => row.source_set_id === set.id && row.subquestion_id === sub.id);
        if (!row || row.source_content_hash !== contentHash(set)) throw new Error(`${set.id}/${sub.id}: 원본과 일치하는 검토된 물음 분류가 필요합니다.`);
        validateLearningClassification(row);
        if (row.topic_ids.some(id => !knownTopics.has(id))) throw new Error('물음별 등록 주제가 일치하지 않습니다.');
        return { set_id: set.id, subquestion_id: sub.id, question_style: row.question_style, topic_ids: row.topic_ids,
            standalone_prompt: row.standalone_prompt, case_fact_ids: row.case_fact_ids ?? [] };
    }));
    return { learning_topics: catalog.topics, learning_classifications: entries };
}

export interface BankReadiness {
    checked_at: string;
    source_file_hash: string;
    bank_content_hash: string;
    public_content_hash: string;
    set_count: number;
    subquestion_count: number;
    criterion_count: number;
    max_points: number;
    ready: boolean;
    errors: string[];
    legacy_policy_subquestions: string[];
    source_hash_mismatches: string[];
    content_review_performed: boolean;
    full_bank_validation?: { exit_code: number | null; signal: string | null; elapsed_ms: number; error_code: string | null };
}

export function inspectBankSnapshot(authoring: string, publicText: string, options: { cwd?: string; verifySourceQuotes?: boolean; applicability?: unknown; contentReview?: boolean } = {}) {
    const parsed: unknown = JSON.parse(authoring);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('문제은행은 비어 있지 않은 배열이어야 합니다.');
    const sets = parsed as QuestionSetV3[];
    const errors: string[] = [];
    const legacy: string[] = [];
    const sourceHashMismatches: string[] = [];
    const seen = new Set<string>();
    for (const [index, set] of sets.entries()) {
        // Skipping source/content review does not permit a retired answer policy.
        // Keep the supplied snapshot intact and report each incompatible question.
        for (const sub of Array.isArray(set?.subquestions) ? set.subquestions : []) {
            if (sub?.selection?.type !== 'all' || sub.selection.n !== null || sub.constraints?.ordered !== false
                || sub.constraints.max_entries !== null || sub.constraints.overflow_policy !== 'none') {
                legacy.push(`${set.id}/${sub?.id}`);
            }
        }
        if (options.contentReview === false) {
            if (seen.has(set.id)) errors.push(`중복 세트 ID: ${set.id}`);
            seen.add(set.id);
            continue;
        }
        const checked = validateQuestionSetV3(set, { cwd: options.cwd ?? process.cwd(), verifySourceQuotes: options.verifySourceQuotes ?? true });
        errors.push(...checked.errors.map((error) => `[${index}] ${error}`));
        if (checked.errors.length) continue;
        if (seen.has(set.id)) errors.push(`중복 세트 ID: ${set.id}`);
        seen.add(set.id);
        if (!['exact', 'normalized', 'reconstructed', 'excerpt'].includes(set.verification.source_fidelity)) {
            errors.push(`${set.id}: 지원하지 않는 source_fidelity 값입니다.`);
        }
        for (const source of set.source_refs) {
            if (source.content_hash !== undefined && source.content_hash !== createHash('sha256').update(source.source_quote, 'utf8').digest('hex')) {
                sourceHashMismatches.push(`${set.id}/${source.id}`);
            }
        }
        if (set.status !== 'published' || set.verification.review_status !== 'verified') errors.push(`${set.id}: 게시·검토 상태 미완료`);
    }
    if (legacy.length) errors.push(`최종 모두 작성 정책 미완료: ${legacy.length}개 물음. 발문·정답·배점 검토 후 정본에서 수정해야 합니다.`);
    if (sourceHashMismatches.length) errors.push(`출처 인용 SHA-256 불일치: ${sourceHashMismatches.length}개. 최종 검수한 인용 문자열의 content_hash를 확인해야 합니다.`);
    const structurallyValid = sets.every((set) => Array.isArray(set?.subquestions) && set.subquestions.every((sub) => Array.isArray(sub.criteria)));
    const compiled = structurallyValid ? sets.map(compilePublicQuestionSet) : [];
    if (canonicalJson(JSON.parse(publicText)) !== canonicalJson(compiled)) errors.push('public JSON과 authoring의 공개 compile 결과가 다릅니다.');
    const applicability = options.applicability ?? {};
    const report: BankReadiness = {
        checked_at: new Date().toISOString(), source_file_hash: createHash('sha256').update(authoring).digest('hex'),
        bank_content_hash: contentHash({ sets, applicability }), public_content_hash: contentHash(compiled),
        set_count: sets.length,
        subquestion_count: structurallyValid ? sets.reduce((sum, set) => sum + set.subquestions.length, 0) : 0,
        criterion_count: structurallyValid ? sets.reduce((sum, set) => sum + set.subquestions.reduce((n, sub) => n + sub.criteria.length, 0), 0) : 0,
        max_points: structurallyValid ? sets.reduce((sum, set) => sum + computeQuestionSetMaxPoints(set), 0) : 0,
        ready: errors.length === 0, errors, legacy_policy_subquestions: legacy, source_hash_mismatches: sourceHashMismatches,
        content_review_performed: options.contentReview !== false,
    };
    return { report, sets, compiled, applicability };
}

function argument(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index < 0 ? undefined : args[index + 1];
}

export interface QuestionBankRetirementManifest {
    version: 1;
    artifact_type: 'question_bank_retirement_manifest';
    authorization: string;
    expected_active_release_id: string;
    expected_active_source_file_hash: string;
    candidate_source_file_hash: string;
    retired_set_ids: string[];
    historical_versions_and_learning_attempts: 'preserve';
    retirement_count?: number;
    source_to_replacement_lineage?: string;
    lineage_sha256?: string;
}

/** Explicit publication evidence, never inferred from missing set IDs. The RPC
 * repeats identity, active-release CAS and exact omission checks under its lock. */
export function validateRetirementManifest(document: string, expectedSha256: string, sourceHash: string, sets: QuestionSetV3[]) {
    const sha = (text: string) => createHash('sha256').update(text).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(expectedSha256) || sha(document) !== expectedSha256) throw new Error('퇴역 manifest의 SHA-256이 일치하지 않습니다.');
    const m = JSON.parse(document) as QuestionBankRetirementManifest;
    if (!m || m.version !== 1 || m.artifact_type !== 'question_bank_retirement_manifest'
        || typeof m.authorization !== 'string' || !m.authorization.trim()
        || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(m.expected_active_release_id)
        || !/^[a-f0-9]{64}$/.test(m.expected_active_source_file_hash)
        || m.candidate_source_file_hash !== sourceHash
        || m.historical_versions_and_learning_attempts !== 'preserve'
        || !Array.isArray(m.retired_set_ids) || !m.retired_set_ids.length
        || m.retired_set_ids.some(id => typeof id !== 'string' || !id.trim())
        || new Set(m.retired_set_ids).size !== m.retired_set_ids.length
        || m.retired_set_ids.some(id => sets.some(s => s.id === id))
        || m.retirement_count !== undefined && m.retirement_count !== m.retired_set_ids.length) {
        throw new Error('퇴역 manifest의 승인·기대 릴리스·최종 원본·정확한 퇴역 ID 계약이 잘못되었습니다.');
    }
    return m;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
    const root = process.cwd();
    const authoringPath = path.resolve(process.env.CPA_QUESTION_V3_AUTHORING_PATH || 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
    const publicPath = path.resolve(process.env.CPA_QUESTION_V3_PUBLIC_PATH || 'cpa_uploader/data/cpa_question_sets_v3.public.json');
    const reportPath = path.resolve(argument(args, '--report') || 'docs/reports/cpa-learning-db-readiness.json');
    const applicabilityFile = argument(args, '--applicability-file');
    const applicability: unknown = applicabilityFile ? JSON.parse(fs.readFileSync(path.resolve(applicabilityFile), 'utf8')) : {};
    const authoring = fs.readFileSync(authoringPath, 'utf8');
    const preserveSource = args.includes('--preserve-source');
    const snapshot = inspectBankSnapshot(authoring, fs.readFileSync(publicPath, 'utf8'), { cwd: root, applicability, contentReview: !preserveSource });
    const retirementFile = argument(args, '--retirement-manifest');
    const retirementSha = argument(args, '--retirement-manifest-sha256');
    if (Boolean(retirementFile) !== Boolean(retirementSha) || args.includes('--retirement-manifest') && !retirementFile
        || args.includes('--retirement-manifest-sha256') && !retirementSha) throw new Error('--retirement-manifest와 --retirement-manifest-sha256을 함께 지정해야 합니다.');
    if (retirementFile && preserveSource) throw new Error('퇴역을 포함하는 게시에서는 --preserve-source로 전체 검수를 생략할 수 없습니다.');
    const retirementDocument = retirementFile ? fs.readFileSync(path.resolve(retirementFile), 'utf8') : undefined;
    const retirement = retirementDocument !== undefined && retirementSha
        ? validateRetirementManifest(retirementDocument, retirementSha, snapshot.report.source_file_hash, snapshot.sets) : undefined;
    const retirementInputs: Array<{ file: string; sha256: string }> = [];
    if (retirement && retirementFile && retirementSha) {
        retirementInputs.push({ file: path.resolve(retirementFile), sha256: retirementSha });
        if (retirement.source_to_replacement_lineage || retirement.lineage_sha256) {
            if (!retirement.source_to_replacement_lineage || !retirement.lineage_sha256
                || !/^[a-f0-9]{64}$/.test(retirement.lineage_sha256)) throw new Error('퇴역 후속 계보 파일과 SHA-256이 함께 필요합니다.');
            retirementInputs.push({ file: path.resolve(retirement.source_to_replacement_lineage), sha256: retirement.lineage_sha256 });
        }
    }
    const guardRetirementInputs = () => {
        for (const input of retirementInputs) if (createHash('sha256').update(fs.readFileSync(input.file)).digest('hex') !== input.sha256)
            throw new Error('퇴역 승인 또는 후속 계보가 검증 중 변경되었습니다.');
    };
    guardRetirementInputs();
    let learningCatalog: ReturnType<typeof learningCatalogForBank> | undefined;
    try {
        const catalogFile = path.resolve(argument(args, '--learning-catalog') ?? 'cpa_uploader/data/learning-question-classifications.json');
        learningCatalog = learningCatalogForBank(snapshot.sets, JSON.parse(fs.readFileSync(catalogFile, 'utf8')));
    } catch (error) {
        snapshot.report.errors.push(error instanceof Error ? error.message : '물음 유형·주제 분류를 준비하지 못했습니다.');
    }
    if (!preserveSource) {
      const validationStarted = Date.now();
      const fullValidation = spawnSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), path.join(root, 'cpa_uploader/validate_cpa_v3.ts')], {
        // Immutable historical review receipts are replayed too; a growing bank
        // can exceed one minute without any content or publication failure.
        cwd: root, encoding: 'utf8', timeout: 300_000, windowsHide: true,
        env: { ...process.env, CPA_QUESTION_V3_AUTHORING_PATH: authoringPath, CPA_QUESTION_V3_PUBLIC_PATH: publicPath },
    });
      const errorCode = (fullValidation.error as NodeJS.ErrnoException | undefined)?.code ?? null;
      snapshot.report.full_bank_validation = { exit_code: fullValidation.status, signal: fullValidation.signal,
          elapsed_ms: Date.now() - validationStarted, error_code: errorCode };
      if (fullValidation.status !== 0) snapshot.report.errors.push(errorCode === 'ETIMEDOUT'
          ? '전체 은행 검증이 300초 실행 한도를 초과했습니다. 등록하지 않았습니다.'
          : '전체 은행의 기준서 범위·인용 구간·중복·주제별 최소 분포 검증이 실패했습니다. questions:v3:validate 결과를 확인하세요.');
    }
    if (createHash('sha256').update(fs.readFileSync(authoringPath)).digest('hex') !== snapshot.report.source_file_hash) snapshot.report.errors.push('검증 중 문제 정본이 변경되었습니다. 최종 수정 완료 후 다시 검증하세요.');
    guardRetirementInputs();
    if (retirement) Object.assign(snapshot.report, { retirement: { manifest_file: path.resolve(retirementFile!), manifest_sha256: retirementSha,
        expected_active_release_id: retirement.expected_active_release_id, expected_active_source_file_hash: retirement.expected_active_source_file_hash,
        retired_set_ids: retirement.retired_set_ids, historical_versions_and_learning_attempts: 'preserve' } });
    snapshot.report.ready = snapshot.report.errors.length === 0;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(snapshot.report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ ...snapshot.report, errors: snapshot.report.errors.slice(0, 10), legacy_policy_subquestions: undefined, report_path: reportPath }, null, 2));
    if (!snapshot.report.ready) { process.exitCode = 1; return; }
    if (!args.includes('--apply')) { console.log('읽기 전용 검증 완료. --apply 없이는 DB를 변경하지 않습니다.'); return; }
    const evidence = argument(args, '--evidence');
    if (!evidence?.trim()) throw new Error('--evidence에 최종 검수 근거를 지정해야 합니다.');
    if (argument(args, '--expected-hash') !== snapshot.report.source_file_hash) throw new Error('--expected-hash가 검토한 최종 파일 SHA-256과 일치해야 합니다.');
    if (createHash('sha256').update(fs.readFileSync(authoringPath)).digest('hex') !== snapshot.report.source_file_hash) throw new Error('검증 중 정본이 변경되었습니다. 새 최종본을 다시 검증하세요.');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secret) throw new Error('Supabase 서버 연결 설정이 필요합니다.');
    const expectedHost = argument(args, '--project-host');
    if (!expectedHost || new URL(url).hostname !== expectedHost) throw new Error('--project-host에 적용할 Supabase 호스트를 명시해야 합니다.');
    const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    guardRetirementInputs();
    const rpc = retirement ? 'cpa_import_learning_question_bank_with_retirements' : 'cpa_import_learning_question_bank';
    const retirementEvidence = retirement ? `${evidence}; retirement manifest ${retirementFile} SHA256 ${retirementSha}` : evidence;
    const { data, error } = await client.rpc(rpc, { p_payload: {
        sets: snapshot.sets, applicability: snapshot.applicability,
        ...learningCatalog,
        source_document: authoring,
        source_file_hash: snapshot.report.source_file_hash, bank_content_hash: snapshot.report.bank_content_hash,
        public_content_hash: snapshot.report.public_content_hash, evidence: retirementEvidence,
        ...(retirement ? { retirement: { manifest_document: retirementDocument, manifest_sha256: retirementSha } } : {}),
        source_validation: preserveSource ? 'source-identity-only; content-review-skipped-by-user' : 'external-importer',
        actor_user_id: argument(args, '--actor-id') ?? null,
    } });
    if (error) throw new Error(`문제은행 DB 이관 실패 (${error.code || 'unknown'}). 원문 데이터는 로그에 출력하지 않습니다.`);
    if (retirement && (data?.retirement_manifest_sha256 !== retirementSha
        || canonicalJson(data?.retirement_manifest) !== canonicalJson(retirement))) throw new Error('DB가 반환한 퇴역 승인 근거가 검증한 manifest와 다릅니다.');
    const { data: bank, error: readError } = await client.rpc('cpa_get_active_question_bank');
    if (readError || !Array.isArray(bank)) throw new Error('이관 후 공개 문제은행을 확인하지 못했습니다.');
    const projected = bank.map(publicLearningSet).map((set) => {
        delete set.release_id;
        delete set.set_version_id;
        for (const sub of set.subquestions) delete sub.logical_subquestion_id;
        return set;
    });
    if (canonicalJson(projected) !== canonicalJson(snapshot.compiled)) throw new Error('이관된 공개 문제은행이 검증본과 다릅니다. 서비스 전환을 중단하세요.');
    const { data: classifications, error: classificationError } = await client.rpc('cpa_get_learning_classifications', { p_release_id: data.release_id });
    if (classificationError || !Array.isArray(classifications) || !learningCatalog) throw new Error('물음 분류 이관 결과를 읽을 수 없습니다.');
    const units = buildLearningUnits(bank.map(publicLearningSet), classifications.map(validateLearningClassification), learningCatalog.learning_topics);
    const { data: storedSource, error: sourceReadError } = await client.from('cpa_question_bank_releases')
        .select('source_document, source_file_hash').eq('id', data.release_id).single();
    if (sourceReadError || storedSource?.source_document !== authoring || storedSource?.source_file_hash !== snapshot.report.source_file_hash) {
        throw new Error('이관된 최종 정본 스냅샷이 원본 파일과 다릅니다.');
    }
    const receipt = { applied_at: new Date().toISOString(), project_host: expectedHost, applied: true,
        ...data, source_file_hash: snapshot.report.source_file_hash, bank_content_hash: snapshot.report.bank_content_hash,
        public_round_trip: true, source_bytes_identical: true, content_review_performed: !preserveSource, progress_initialized: false };
    Object.assign(receipt, { learning_classification_count: classifications.length, learning_unit_count: units.length });
    fs.writeFileSync(path.resolve(argument(args, '--receipt') || 'docs/reports/cpa-learning-db-applied.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ ...receipt, question_versions: undefined }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
