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
        for (const sub of set.subquestions) {
            if (sub.selection.type !== 'all' || sub.selection.n !== null || sub.constraints.ordered
                || sub.constraints.max_entries !== null || sub.constraints.overflow_policy !== 'none') {
                legacy.push(`${set.id}/${sub.id}`);
            }
        }
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
    if (!preserveSource) {
      const fullValidation = spawnSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), path.join(root, 'cpa_uploader/validate_cpa_v3.ts')], {
        cwd: root, encoding: 'utf8', timeout: 60_000,
        env: { ...process.env, CPA_QUESTION_V3_AUTHORING_PATH: authoringPath, CPA_QUESTION_V3_PUBLIC_PATH: publicPath },
    });
      if (fullValidation.status !== 0) snapshot.report.errors.push('전체 은행의 기준서 범위·인용 구간·중복·주제별 최소 분포 검증이 실패했습니다. questions:v3:validate 결과를 확인하세요.');
    }
    if (createHash('sha256').update(fs.readFileSync(authoringPath)).digest('hex') !== snapshot.report.source_file_hash) snapshot.report.errors.push('검증 중 문제 정본이 변경되었습니다. 최종 수정 완료 후 다시 검증하세요.');
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
    const { data, error } = await client.rpc('cpa_import_question_bank', { p_payload: {
        sets: snapshot.sets, applicability: snapshot.applicability,
        source_document: authoring,
        source_file_hash: snapshot.report.source_file_hash, bank_content_hash: snapshot.report.bank_content_hash,
        public_content_hash: snapshot.report.public_content_hash, evidence,
        source_validation: preserveSource ? 'source-identity-only; content-review-skipped-by-user' : 'external-importer',
        actor_user_id: argument(args, '--actor-id') ?? null,
    } });
    if (error) throw new Error(`문제은행 DB 이관 실패 (${error.code || 'unknown'}). 원문 데이터는 로그에 출력하지 않습니다.`);
    const { data: bank, error: readError } = await client.rpc('cpa_get_active_question_bank');
    if (readError || !Array.isArray(bank)) throw new Error('이관 후 공개 문제은행을 확인하지 못했습니다.');
    const projected = bank.map(publicLearningSet).map((set) => {
        delete set.release_id;
        delete set.set_version_id;
        for (const sub of set.subquestions) delete sub.logical_subquestion_id;
        return set;
    });
    if (canonicalJson(projected) !== canonicalJson(snapshot.compiled)) throw new Error('이관된 공개 문제은행이 검증본과 다릅니다. 서비스 전환을 중단하세요.');
    const { data: storedSource, error: sourceReadError } = await client.from('cpa_question_bank_releases')
        .select('source_document, source_file_hash').eq('id', data.release_id).single();
    if (sourceReadError || storedSource?.source_document !== authoring || storedSource?.source_file_hash !== snapshot.report.source_file_hash) {
        throw new Error('이관된 최종 정본 스냅샷이 원본 파일과 다릅니다.');
    }
    const receipt = { applied_at: new Date().toISOString(), project_host: expectedHost, applied: true,
        ...data, source_file_hash: snapshot.report.source_file_hash, bank_content_hash: snapshot.report.bank_content_hash,
        public_round_trip: true, source_bytes_identical: true, content_review_performed: !preserveSource, progress_initialized: false };
    fs.writeFileSync(path.resolve(argument(args, '--receipt') || 'docs/reports/cpa-learning-db-applied.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ ...receipt, question_versions: undefined }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
