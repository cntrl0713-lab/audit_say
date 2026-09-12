import fs from 'node:fs';
import path from 'node:path';
import { loadPromotionLedger, publicationPaths, reviewedContentHash, snapshotFile, snapshotSources, validateAuthoringBank, validatePromotionLedger, withPublicationLock, writePublicationFiles, } from './questionBankPublication.mjs';
import { readSemanticReviewDocument, validateSemanticReviewReceipt } from './questionSemanticReview.mjs';
import { readGradingAcceptanceDocument, gradingAcceptanceFiles } from './questionGradingAcceptance.mjs';
// New transitions are evidence-backed and tied to the reviewed content.
// Public/encrypted artifacts are produced only after publication; neither is a prerequisite.
function parseArgs(argv) {
    const args = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--status' || arg === '--backfill-verified' || arg === '--reverify')
            args[arg] = '1';
        else if (arg === '--to' || arg === '--sets' || arg === '--evidence' || arg === '--review' || arg === '--grading-acceptance') {
            const value = argv[++index];
            if (!value || value.startsWith('--'))
                throw new Error(`${arg} 값이 필요합니다.`);
            args[arg] = value;
        }
        else
            throw new Error(`지원하지 않는 옵션: ${arg}`);
    }
    return args;
}
try {
    const args = parseArgs(process.argv.slice(2));
    if (args['--grading-acceptance'] && args['--to'] !== 'verified')
        throw new Error('--grading-acceptance는 --to verified에서만 선택합니다.');
    if (args['--reverify'] && (args['--to'] !== 'verified' || args['--status'] || args['--backfill-verified'])) {
        throw new Error('--reverify는 --to verified와 함께 사용하는 명시적 재검수입니다.');
    }
    const paths = publicationPaths();
    if (new Set(Object.values(paths)).size !== 4)
        throw new Error('정본·장부·공개본·암호화본 경로는 서로 달라야 합니다.');
    if (args['--status']) {
        const sets = JSON.parse(fs.readFileSync(paths.authoring, 'utf8'));
        console.log(`세트 ${sets.length}개:`, sets.reduce((counts, set) => {
            counts[set.status] = (counts[set.status] || 0) + 1;
            return counts;
        }, {}));
        const ledger = loadPromotionLedger(paths.ledger);
        console.log(`장부 항목 ${ledger.entries.length}건`);
        for (const entry of ledger.entries)
            console.log(`- ${entry.date} ${entry.set_id}: ${entry.from_status} → ${entry.to_status} (${entry.evidence})`);
    }
    else
        withPublicationLock(paths.authoring, () => {
            const evidence = args['--evidence']?.trim();
            if (!evidence)
                throw new Error('승급 또는 소급 기록에는 --evidence(실제 검수 근거)가 필요합니다.');
            const guards = [snapshotFile(paths.authoring), snapshotFile(paths.ledger)];
            const sets = JSON.parse(fs.readFileSync(paths.authoring, 'utf8'));
            guards.push(...snapshotSources(sets));
            const result = validateAuthoringBank(sets);
            if (result.errors.length)
                throw new Error(`승급 전 전체 정본 검증 실패:\n${result.errors.join('\n')}`);
            const ledger = loadPromotionLedger(paths.ledger);
            const today = new Date().toISOString().slice(0, 10);
            if (args['--backfill-verified']) {
                // The historical 96-set backfill is complete. Never use that migration
                // switch to create unaudited approvals for a newly forged published set.
                if (sets.some((set) => !ledger.entries.some((entry) => entry.set_id === set.id && entry.to_status === 'verified')))
                    throw new Error('새 소급 검수 기록은 지원하지 않습니다. needs_review 초안을 의미검수한 뒤 정상 승급하십시오.');
                const errors = validatePromotionLedger(sets, ledger);
                if (errors.length)
                    throw new Error(errors.join('\n'));
                console.log(`기존 소급 장부 확인 완료: 변경 없음 (총 ${ledger.entries.length}건)`);
                return;
            }
            const target = args['--to'];
            if (target !== 'verified' && target !== 'published')
                throw new Error('--to는 verified 또는 published만 지원합니다.');
            const ids = (args['--sets'] || '').split(',').map((id) => id.trim()).filter(Boolean);
            if (!ids.length)
                throw new Error('승급할 세트 id가 필요합니다. --sets ID,...');
            if (new Set(ids).size !== ids.length)
                throw new Error('승급 대상 ID가 중복됩니다.');
            const byId = new Map(sets.map((set) => [set.id, set]));
            const missing = ids.filter((id) => !byId.has(id));
            if (missing.length)
                throw new Error(`존재하지 않는 세트 id: ${missing.join(', ')}`);
            const reverify = Boolean(args['--reverify']);
            if (reverify) {
                for (const id of ids) {
                    const set = byId.get(id);
                    if (!['verified', 'published'].includes(set.status))
                        throw new Error(`[${id}] --reverify는 기존 verified/published 문항에만 사용합니다. needs_review는 일반 검수 승급을 사용하십시오.`);
                }
            }
            const priorErrors = validatePromotionLedger(sets, ledger, false, reverify ? { pendingReverificationIds: new Set(ids) } : {});
            if (priorErrors.length)
                throw new Error(`승급 전 검수 장부 검증 실패:\n${priorErrors.join('\n')}`);
            const reviewPath = args['--review'] ? path.resolve(args['--review']) : null;
            if (reviewPath)
                guards.push(snapshotFile(reviewPath));
            const reviewDocument = reviewPath ? readSemanticReviewDocument(reviewPath) : null;
            const acceptancePath = args['--grading-acceptance'] ? path.resolve(args['--grading-acceptance']) : null;
            const acceptanceDocument = acceptancePath ? readGradingAcceptanceDocument(acceptancePath) : null;
            if (acceptancePath)
                guards.push(snapshotFile(acceptancePath));
            if (acceptanceDocument)
                for (const acceptance of acceptanceDocument.acceptances) {
                    if (!ids.includes(acceptance.set_id))
                        throw new Error('선택하지 않은 세트의 편차 수락 문서입니다.');
                    guards.push(...gradingAcceptanceFiles(acceptance).map(item => snapshotFile(path.resolve(item.file))));
                }
            let promoted = 0;
            for (const id of ids) {
                const set = byId.get(id);
                if (set.status === target && !reverify)
                    continue;
                const expected = target === 'verified' ? 'needs_review' : 'verified';
                if (!reverify && set.status !== expected)
                    throw new Error(`[${id}] ${target} 승급에는 ${expected} 상태가 필요합니다.`);
                if (target === 'published' && set.verification.review_status !== 'verified')
                    throw new Error(`[${id}] published 승급에는 review_status=verified가 필요합니다.`);
                const receipt = target === 'verified' ? reviewDocument?.reviews.find((review) => review.set_id === id) : undefined;
                const gradingAcceptance = acceptanceDocument?.acceptances.find(a => a.set_id === id);
                if (target === 'verified') {
                    if (!receipt)
                        throw new Error(`[${id}] 신규 검수·재검수에는 --review <review.json> 의미검수 receipt가 필요합니다.`);
                    const errors = validateSemanticReviewReceipt(receipt, set, { bank: sets, gradingAcceptance });
                    if (errors.length)
                        throw new Error(`[${id}] 의미검수 receipt 검증 실패:\n${errors.join('\n')}`);
                }
                const previousReview = ledger.entries.filter((entry) => entry.set_id === id && entry.to_status === 'verified').at(-1)?.semantic_review;
                const previousAcceptanceHash = ledger.entries.filter(entry => entry.set_id === id && entry.to_status === 'verified').at(-1)?.grading_acceptance_hash;
                ledger.entries.push({ set_id: id, from_status: set.status, to_status: target, date: today, evidence, content_hash: reviewedContentHash(set),
                    ...(gradingAcceptance ? { grading_acceptance: gradingAcceptance, grading_acceptance_hash: gradingAcceptance.acceptance_hash }
                        : target === 'published' && previousAcceptanceHash ? { grading_acceptance_hash: previousAcceptanceHash } : {}),
                    ...(receipt ? { semantic_review: receipt, review_receipt_hash: receipt.receipt_hash,
                        review_summary: { units: receipt.units.length, cases: receipt.cases.length, method: receipt.execution.method, verdict: 'pass' } }
                        : previousReview ? { review_receipt_hash: previousReview.receipt_hash } : {}) });
                set.status = target;
                if (target === 'verified')
                    set.verification.review_status = 'verified';
                promoted += 1;
            }
            const errors = validatePromotionLedger(sets, ledger, target === 'published');
            if (errors.length)
                throw new Error(`승급 결과 검증 실패:\n${errors.join('\n')}`);
            if (!promoted) {
                console.log('모든 대상이 이미 요청 상태입니다. 변경 없음.');
                return;
            }
            writePublicationFiles([
                { file: paths.authoring, content: `${JSON.stringify(sets, null, 2)}\n` },
                { file: paths.ledger, content: `${JSON.stringify(ledger, null, 2)}\n` },
            ], guards);
            console.log(`승급 완료: ${promoted}개 세트 → ${target}`);
            console.log(`검수 근거: ${evidence}`);
            console.log(`장부: ${paths.ledger} (총 ${ledger.entries.length}건)`);
            if (reverify)
                console.log('재검수된 대상은 verified 상태입니다. 재게시 승급과 컴파일이 필요합니다.');
            if (target === 'published')
                console.log('다음 단계: compile-question-bank-v3.ts 실행 후 기본 전체 은행 검증.');
        });
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
