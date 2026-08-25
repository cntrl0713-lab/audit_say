import fs from 'node:fs';
import path from 'node:path';
import {
    compilePublicQuestionSet,
    validateQuestionSetV3,
} from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

// v3 문제은행 승급 도구.
//
// needs_review → verified → published 전환은 이 스크립트로만 수행한다.
// 모든 전환은 cpa_uploader/data/cpa_question_sets_v3.promotions.json 장부에 기록되며,
// 장부 없이 상태가 바뀐 은행은 validate_cpa_v3.ts가 거부한다(재현 불가한 승급 금지).
//
// 사용 예:
//   npx tsx --env-file-if-exists=.env.local cpa_uploader/promote_cpa_v3.ts --to verified \
//     --sets pilot-01-001,pilot-01-002 --evidence "2차 의미 검수 2026-08-24 (검수자: 홍길동)"
//   npx tsx cpa_uploader/promote_cpa_v3.ts --status   # 현재 상태·장부 요약 출력
//   npx tsx cpa_uploader/promote_cpa_v3.ts --backfill-verified \
//     --evidence "..." # 기존 published+verified 세트의 소급 장부 기록 (상태 변경 없음)

const ROOT = process.cwd();
const AUTHORING_PATH = path.join(ROOT, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const PUBLIC_PATH = path.join(ROOT, 'cpa_uploader/data/cpa_question_sets_v3.public.json');
const LEDGER_PATH = path.join(ROOT, 'cpa_uploader/data/cpa_question_sets_v3.promotions.json');

interface LedgerEntry {
    set_id: string;
    from_status: string;
    to_status: string;
    date: string;
    evidence: string;
}

interface Ledger {
    version: 1;
    entries: LedgerEntry[];
}

function readJson(file: string): unknown {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArgs(argv: string[]): Record<string, string> {
    const args: Record<string, string> = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--status' || arg === '--backfill-verified') {
            args[arg] = '1';
        } else if (arg === '--to' || arg === '--sets' || arg === '--evidence') {
            const value = argv[index + 1];
            if (!value) throw new Error(`${arg} 값이 필요합니다.`);
            args[arg] = value;
            index += 1;
        }
    }
    return args;
}

function loadLedger(): Ledger {
    if (!fs.existsSync(LEDGER_PATH)) return { version: 1, entries: [] };
    const parsed = readJson(LEDGER_PATH) as Ledger;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
        throw new Error(`승급 장부 형식이 올바르지 않습니다: ${LEDGER_PATH}`);
    }
    return parsed;
}

function saveLedgerAtomic(ledger: Ledger): void {
    const tempPath = `${LEDGER_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, LEDGER_PATH);
}

function normalize(value: string): string {
    return value.replace(/\s+/g, '').toLowerCase();
}

// 장부와 실제 status가 서술하는 바닥 상태가 일치하는지 확인한다.
// published는 verified의 상위 단계이므로, 장부 최종이 verified인 세트가
// published로 더 진행돼 있어도 불일치가 아니다(verified 기록은 유효한 흔적).
const STATUS_ORDER: Record<string, number> = { needs_review: 0, needs_review_placeholder: 0, verified: 1, published: 2 };
function assertStatusConsistentWithLedger(sets: QuestionSetV3[], ledger: Ledger): void {
    const lastTransition = new Map<string, string>();
    for (const entry of ledger.entries) {
        lastTransition.set(entry.set_id, entry.to_status);
    }
    const problems: string[] = [];
    for (const set of sets) {
        const expected = lastTransition.get(set.id);
        if (!expected) continue;
        if ((STATUS_ORDER[set.status] ?? -1) < (STATUS_ORDER[expected] ?? 99)) {
            problems.push(`${set.id}: 장부 최종 상태는 ${expected}이지만 authoring status는 ${set.status}입니다.`);
        }
    }
    if (problems.length > 0) {
        throw new Error(`승급 장부와 authoring status가 불일치합니다:\n${problems.join('\n')}`);
    }
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(AUTHORING_PATH)) throw new Error(`authoring 파일이 없습니다: ${AUTHORING_PATH}`);
    const sets = JSON.parse(fs.readFileSync(AUTHORING_PATH, 'utf8')) as QuestionSetV3[];
    const byId = new Map(sets.map((set) => [set.id, set]));

    // --status: 관측 전용 모드.
    if (args['--status']) {
        const counts = new Map<string, number>();
        for (const set of sets) counts.set(set.status, (counts.get(set.status) ?? 0) + 1);
        console.log(`세트 ${sets.length}개:`, Object.fromEntries(counts));
        const ledger = loadLedger();
        console.log(`장부 항목 ${ledger.entries.length}건`);
        const bySet = new Map<string, LedgerEntry[]>();
        for (const entry of ledger.entries) {
            const list = bySet.get(entry.set_id) ?? [];
            list.push(entry);
            bySet.set(entry.set_id, list);
        }
        for (const [setId, entries] of [...bySet].sort()) {
            for (const entry of entries) {
                console.log(`- ${entry.date} ${setId}: ${entry.from_status} → ${entry.to_status} (${entry.evidence})`);
            }
        }
        return;
    }

    // --backfill-verified: 이미 verified+published인 세트를 장부에 소급 기록한다. 상태는 그대로 둔다.
    if (args['--backfill-verified']) {
        const evidence = args['--evidence'];
        if (!evidence) throw new Error('--backfill-verified에는 --evidence가 필요합니다.');
        const ledger = loadLedger();
        const recorded = new Set(ledger.entries.map((entry) => `${entry.set_id}:${entry.to_status}`));
        let appended = 0;
        for (const set of sets) {
            if (set.status !== 'published') continue;
            if (set.verification.review_status !== 'verified') continue;
            const key = `${set.id}:verified`;
            if (recorded.has(key)) continue;
            ledger.entries.push({
                set_id: set.id,
                from_status: 'needs_review',
                to_status: 'verified',
                date: new Date().toISOString().slice(0, 10),
                evidence,
            });
            appended += 1;
        }
        assertStatusConsistentWithLedger(sets, ledger);
        saveLedgerAtomic(ledger);
        console.log(`소급 기록 완료: ${appended}건 (총 ${ledger.entries.length}건)`);
        return;
    }

    // 일반 승급 모드: --to verified | published
    const target = args['--to'];
    if (target !== 'verified' && target !== 'published') {
        throw new Error('--to는 verified 또는 published만 지원합니다.');
    }

    const requestedIds = (args['--sets'] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    if (requestedIds.length === 0) throw new Error('승급할 세트 id가 필요합니다. --sets pilot-01-001,...');
    const missing = requestedIds.filter((id) => !byId.has(id));
    if (missing.length > 0) throw new Error(`존재하지 않는 세트 id: ${missing.join(', ')}`);

    // published 승급은 전체 은행이 함께 게시되는 구조(compile 게이트)이므로,
    // 요청이 은행 전체를 가리키는지 확인한다. 이미 published인 세트는 멱등 no-op으로
    // 건너뛴다(재게시 시 나머지 세트만 승급). verified가 아닌 세트가 섞여 있으면 실패.
    if (target === 'published' && requestedIds.length !== sets.length) {
        throw new Error(`published 승급은 전체 ${sets.length}세트를 대상으로만 가능합니다. (요청 ${requestedIds.length}개)`);
    }
    const alreadyPublished = target === 'published'
        ? requestedIds.filter((setId) => byId.get(setId)!.status === 'published')
        : [];
    const promoteIds = requestedIds.filter((setId) => !alreadyPublished.includes(setId));
    if (target === 'published' && promoteIds.length === 0 && requestedIds.length > 0) {
        console.log(`모든 대상이 이미 published입니다. 변경 없음 (요청 ${requestedIds.length}세트).`);
        return;
    }

    const evidence = args['--evidence']?.trim();
    if (!evidence) throw new Error(`--to ${target} 승급에는 --evidence(검수 근거)가 필요합니다.`);

    const errors: string[] = [];
    for (const setId of promoteIds) {
        const set = byId.get(setId)!;
        const validation = validateQuestionSetV3(set, { verifySourceQuotes: true, cwd: ROOT });
        errors.push(...validation.errors.map((error) => `[${setId}] ${error}`));

        const requiredReview = target === 'published'
            ? 'verified'
            : undefined;
        if (requiredReview && set.verification.review_status !== requiredReview) {
            errors.push(`[${setId}] published 승급에는 review_status=verified가 필요하지만 ${set.verification.review_status}입니다.`);
        }
        if (target === 'verified' && set.status !== 'needs_review') {
            errors.push(`[${setId}] verified 승급은 needs_review 상태에서만 가능하지만 현재 ${set.status}입니다.`);
        }
        if (target === 'published' && set.status !== 'verified') {
            errors.push(`[${setId}] published 승급은 verified 상태에서만 가능하지만 현재 ${set.status}입니다.`);
        }
    }
    if (errors.length > 0) {
        throw new Error(`승급 전 검증 실패:\n${errors.join('\n')}`);
    }

    // published 승급 시 public JSON이 compile 결과와 일치하는지 미리 확인한다.
    if (target === 'published') {
        if (!fs.existsSync(PUBLIC_PATH)) throw new Error('public JSON이 없습니다.');
        const compiledPublic = sets.map(compilePublicQuestionSet);
        const existingPublic = readJson(PUBLIC_PATH);
        if (JSON.stringify(existingPublic) !== JSON.stringify(compiledPublic)) {
            throw new Error('public JSON이 authoring compile 결과와 다릅니다. 먼저 compile-question-bank-v3.ts를 실행하십시오.');
        }
    }

    const ledger = loadLedger();
    const today = new Date().toISOString().slice(0, 10);
    for (const setId of promoteIds) {
        const set = byId.get(setId)!;
        ledger.entries.push({
            set_id: setId,
            from_status: set.status,
            to_status: target,
            date: today,
            evidence,
        });
        set.status = target;
    }
    assertStatusConsistentWithLedger(sets, ledger);

    fs.writeFileSync(AUTHORING_PATH, `${JSON.stringify(sets, null, 2)}\n`, 'utf8');
    saveLedgerAtomic(ledger);

    // public JSON에서는 status 필드 자체를 노출하지 않으므로 재생성이 아니라 일치 확인으로 충분하다.
    console.log(`승급 완료: ${promoteIds.length}개 세트 → ${target}` + (alreadyPublished.length > 0 ? ` (이미 published로 건너뜀: ${alreadyPublished.length}세트)` : ''));
    console.log(`근거: ${evidence}`);
    console.log(`장부: ${path.relative(ROOT, LEDGER_PATH)} (총 ${ledger.entries.length}건)`);

    // 승급 후 전체 검증을 다시 돌려 실패 상태로 끝나지 않게 한다.
    const remainingErrors = sets.flatMap((set) => validateQuestionSetV3(set, { verifySourceQuotes: true, cwd: ROOT })
        .errors.map((error) => `${set.id}: ${error}`));
    if (remainingErrors.length > 0) {
        console.error(`경고: 승급 후 전체 검증 오류 ${remainingErrors.length}건`);
        for (const error of remainingErrors.slice(0, 10)) console.error(`- ${error}`);
        process.exitCode = 1;
        return;
    }
    console.log('승급 후 전체 검증 통과.');

    // 발문 중복 키(정규화)도 여기서 다시 점검해 중복 승급을 차단한다.
    const promptOwners = new Map<string, string>();
    for (const set of sets) {
        for (const subquestion of set.subquestions) {
            const key = normalize(subquestion.prompt);
            const owner = promptOwners.get(key);
            if (owner) {
                console.error(`경고: ${set.id}/${subquestion.id} 발문이 ${owner}와 중복됩니다.`);
                process.exitCode = 1;
            } else {
                promptOwners.set(key, `${set.id}/${subquestion.id}`);
            }
        }
    }
}

main();
