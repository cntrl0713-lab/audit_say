/**
 * 적대적/공정성 테스트: "답안 항목 순서 변경"
 *
 * 지난 verify-logic-inversion.ts(물음 귀속 역전)와 달리, 이번엔 물음 귀속은 올바르게
 * 유지한 채 항목 나열 순서만 바꾼 답안을 측정한다. 두 방향을 모두 본다:
 *  - [공정성] 순서가 무의미한 열거형(200, 122)에서 순서 변경을 부당 감점하면 결함
 *  - [측정] 순서 자체가 절차 논리인 순차형(307: 평가→이해→결정)에서 역순 답안의 점수 관찰
 *
 * 실행: npx tsx tests/verify-item-reorder.ts [--check-only]
 */
import fs from 'fs';
import path from 'path';
import type { BatchItem } from '../lib/serverUtils.ts';
import { computeRubricCoverage } from '../lib/rubric.ts';

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const parts = trimmed.split('=');
                const k = parts[0]?.trim();
                const v = parts.slice(1).join('=').trim();
                if (k) {
                    process.env[k] = v;
                }
            }
        });
        console.log(`ℹ️ [verify-item-reorder] 환경 변수 수동 로드 완료: ${envPath}`);
    }
}

function getCpaProblem(qid: number): any {
    const jsonPath = path.resolve(process.cwd(), 'cpa_uploader/data/cpa_problems_v2.json');
    const problems = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const problem = problems.find((p: any) => p.id === qid);
    if (!problem) throw new Error(`ID ${qid} 문제를 JSON에서 찾을 수 없습니다.`);
    return problem;
}

// ─── 답안 조립 헬퍼 ─────────────────────────────────

/** 200번: "N. 표제" 줄로 물음을 구분하고, 각 물음 안의 "(n)" 항목들을 역순으로 재배열 (귀속은 유지) */
function buildWithinSubReversed(modelAnswer: string[]): string {
    const out: string[] = [];
    let buffer: string[] = [];
    const flush = () => {
        buffer.reverse().forEach((text, i) => out.push(`(${i + 1}) ${text}`));
        buffer = [];
    };
    modelAnswer.forEach((line: string) => {
        if (/^\d+\./.test(line.trim())) {
            flush();
            out.push(line);
        } else {
            buffer.push(line.trim().replace(/^\(\d+\)\s*/, ''));
        }
    });
    flush();
    return out.join('\n');
}

/** 122번: "N. 내용" 열거 줄들을 고정 순열로 섞고 학생이 하듯 1부터 다시 번호 매김 */
function buildRenumberedShuffle(modelAnswer: string[], permutation: number[]): string {
    const texts = modelAnswer.map((line: string) => line.trim().replace(/^\d+\.\s*/, ''));
    return permutation.map((origIdx, i) => `${i + 1}. ${texts[origIdx]}`).join('\n');
}

/** 307번: 순차 절차 문장들을 통째로 역순 배열 */
function buildReversed(modelAnswer: string[]): string {
    return [...modelAnswer].reverse().join('\n');
}

// ─── 메인 ───────────────────────────────────────────

async function main() {
    loadEnvLocal();
    const apiKey = process.env.GOOGLE_API_KEY;
    const checkOnly = process.argv.includes('--check-only');

    console.log('===================================================');
    console.log('     "답안 항목 순서 변경" 공정성/방어력 테스트');
    console.log('===================================================');

    const p200 = getCpaProblem(200);
    const p122 = getCpaProblem(122);
    const p307 = getCpaProblem(307);

    const scenarios = [
        {
            id: 1,
            problem: p200,
            name: '200번 (열거형, 물음 내 항목 역순 — 귀속은 올바름)',
            answer: buildWithinSubReversed(p200.model_answer),
            kind: 'fairness' as const, // 순서 무의미 → 고득점 유지가 정답
        },
        {
            id: 2,
            problem: p122,
            name: '122번 (열거형 6항목, 고정 순열 [6,3,1,5,2,4] 셔플 + 재번호)',
            answer: buildRenumberedShuffle(p122.model_answer, [5, 2, 0, 4, 1, 3]),
            kind: 'fairness' as const,
        },
        {
            id: 3,
            problem: p307,
            name: '307번 (순차 절차 3단계 역순: 결정→이해→평가)',
            answer: buildReversed(p307.model_answer),
            kind: 'strict_ordered' as const, // 순서 감점 정책 적용 대상
        },
    ];

    const results: Array<{
        scenario: typeof scenarios[number];
        coverage: number;
        score: number | null;
        feedback: string;
    }> = [];

    for (const sc of scenarios) {
        console.log(`\n🔍 [${sc.name}]`);
        console.log('--- [조립된 답안] ---');
        console.log(sc.answer);
        console.log('---------------------');
        const cov = computeRubricCoverage(sc.answer, sc.problem.rubric);
        console.log(`📊 사전 필터 최고 물음 커버리지: ${(cov.bestSubCoverage * 100).toFixed(0)}% (통과 예상: ${cov.bestSubCoverage >= 0.5 ? '🟢' : '🔴'})`);
        results.push({ scenario: sc, coverage: cov.bestSubCoverage, score: null, feedback: '' });
    }

    if (!checkOnly) {
        if (!apiKey) {
            console.error('❌ GOOGLE_API_KEY 환경변수가 없어 실채점을 건너뜁니다.');
            process.exit(1);
        }
        const { gradeBatch } = await import('../lib/serverUtils.ts');

        const batchItems: BatchItem[] = scenarios.map(sc => ({
            id: sc.id,
            qid: sc.problem.id,
            q: sc.problem.question_description,
            a: sc.answer,
            m: sc.problem.model_answer.join('\n'),
            k: sc.problem.rubric.flatMap((r: any) => r.items.flatMap((i: any) => i.variants)),
            r: JSON.stringify(sc.problem.rubric),
        }));

        console.log('\n⏳ Gemini API 실채점 호출 중 (3콜)...');
        const scoreResults = await gradeBatch(batchItems, apiKey);
        results.forEach(res => {
            const r = scoreResults[res.scenario.id];
            res.score = r ? r.score : null;
            res.feedback = r ? r.evaluation : '(결과 누락)';
            console.log(`\n➡️ [${res.scenario.name}] 점수: ${res.score}점`);
            console.log(`   피드백: ${res.feedback.replace(/\n/g, ' ')}`);
        });
    }

    // ─── 결과 문서 작성 ───────────────────────────────
    let md = `# 테스트 결과: "답안 항목 순서 변경" (공정성/방어력)\n\n`;
    md += `> 작성일시: ${new Date().toISOString()}\n`;
    md += `> 물음 귀속은 올바르게 유지한 채 항목 나열 순서만 바꾼 답안에 대한 채점 결과 측정.\n`;
    md += `> 판정 기준 — 열거형(공정성): 순서는 무의미하므로 ≥9점이어야 정상, 미달 시 "순서 부당 감점" 결함.\n`;
    md += `> 순차형(관찰): ≤3 = 절차 순서까지 엄격 반영 / 4~8 = 부분 감점 / ≥9 = 순서 불감(정책 판단 필요).\n\n`;

    let anyDefect = false;
    results.forEach((res, idx) => {
        md += `## ${idx + 1}. ${res.scenario.name}\n`;
        md += `- **사전 필터 최고 물음 커버리지**: ${(res.coverage * 100).toFixed(0)}% (${res.coverage >= 0.5 ? '🟢 통과' : '🔴 차단'})\n`;
        if (res.score === null) {
            md += `- **Gemini 실채점**: [체크 전용으로 건너뜀]\n\n`;
            return;
        }
        md += `- **Gemini 실채점 결과**: **${res.score}점** (배점 10점)\n`;
        md += `- **피드백**:\n  > ${res.feedback.replace(/\n/g, '\n  > ')}\n`;
        if (res.scenario.kind === 'fairness') {
            const ok = res.score >= 9;
            if (!ok) anyDefect = true;
            md += `- **판정**: ${ok ? '🟢 정상 (순서 변경에도 고득점 유지)' : '🔴 결함 — 내용이 동일한 정답에 순서만 다르다고 감점됨 (부당 감점)'}\n\n`;
        } else if (res.scenario.kind === 'strict_ordered') {
            const ok = res.score !== null && res.score <= 8;
            if (!ok) anyDefect = true;
            md += `- **판정**: ${ok ? `🟢 정상 (절차 순서 역전 시 감점됨, 점수: ${res.score}점)` : '🔴 결함 — 순차 절차 문항의 순서 역전인데 감점되지 않음 (순서 불감)'}\n\n`;
        }
    });

    if (!checkOnly) {
        md += `## 종합 결론\n`;
        md += anyDefect
            ? `**🔴 결함 발견** — 순서가 무의미한 열거형 답안이 순서 변경만으로 감점되었습니다. 채점 프롬프트의 "논리 구조 일치" 규칙이 열거형에 과잉 적용되는 것으로 보이며, 별도 수정 계획이 필요합니다.\n`
            : `**🟢 공정성 확인** — 열거형 문항은 순서 변경에도 고득점이 유지되었고, 순차형 문항의 결과는 위 관찰 구간 해석을 참고.\n`;
    }

    const mdPath = path.resolve(process.cwd(), 'tests/item_reorder_test_results.md');
    fs.writeFileSync(mdPath, md, 'utf-8');
    console.log(`\n🎉 완료! 결과가 ${mdPath} 에 저장되었습니다.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
