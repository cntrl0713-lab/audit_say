/**
 * 채점 로직 미탐 영역 프로브 5종
 *
 * 기존 테스트(샐러드/주입/무관/귀속역전/순서변경)가 다루지 않은 공격면:
 *  1. [엄격성] 단일 항목 부정 뒤집기 — 314번, 4개 항목 중 1개만 의미 반전
 *  2. [엄격성] 법정 수치 변조 — 122번, "3천만원"→"5천만원" (키워드 유지, 법적 오류)
 *  3. [엄격성] 주체 바꿔치기 — 316번, "감사인이"→"경영진이" (역할 귀속 오류)
 *  4. [정책관찰] 샷건 답안 — 316번, 정답 4개 + 그럴듯한 오답 3개 추가
 *  5. [공정성] 정답 + 무관 패딩 — 200번 정답 전문 뒤에 타 주제(122번) 텍스트 부착
 *
 * 실행: npx tsx tests/verify-grading-gaps.ts [--check-only]
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
        console.log(`ℹ️ [verify-grading-gaps] 환경 변수 수동 로드 완료: ${envPath}`);
    }
}

function getCpaProblem(qid: number): any {
    const jsonPath = path.resolve(process.cwd(), 'cpa_uploader/data/cpa_problems_v2.json');
    const problems = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const problem = problems.find((p: any) => p.id === qid);
    if (!problem) throw new Error(`ID ${qid} 문제를 JSON에서 찾을 수 없습니다.`);
    return problem;
}

/** 특정 줄에 외과적 치환을 적용. 치환이 실제로 일어나지 않으면 throw (데이터 변경 시 무효 테스트 방지) */
function surgicalReplace(lines: string[], from: string, to: string): string[] {
    const joined = lines.join('\n');
    if (!joined.includes(from)) {
        throw new Error(`치환 대상 문자열을 찾지 못했습니다: "${from}" — 원본 데이터가 바뀌었는지 확인 필요`);
    }
    return lines.map((l: string) => l.replace(from, to));
}

type Kind = 'strict' | 'observe' | 'fairness';

async function main() {
    loadEnvLocal();
    const apiKey = process.env.GOOGLE_API_KEY;
    const checkOnly = process.argv.includes('--check-only');

    console.log('===================================================');
    console.log('        채점 로직 미탐 영역 프로브 5종 실측');
    console.log('===================================================');

    const p314 = getCpaProblem(314);
    const p122 = getCpaProblem(122);
    const p316 = getCpaProblem(316);
    const p200 = getCpaProblem(200);

    // 1. 단일 항목 부정 뒤집기 (314: 내부통제 고유한계 4항목 중 '경영진 무력화'만 반전)
    const negatedAnswer314 = surgicalReplace(
        p314.model_answer,
        '경영진이 내부통제를 부적절하게 무력화할 수 있음',
        '경영진은 내부통제를 부적절하게 무력화할 수는 없음'
    ).join('\n');

    // 2. 법정 수치 변조 (122: 상거래 채권·채무 한도 3천만원 → 5천만원)
    const tamperedAnswer122 = surgicalReplace(
        p122.model_answer,
        '3천만원',
        '5천만원'
    ).join('\n');

    // 3. 주체 바꿔치기 (316: 운영효과성 테스트 계획의 주체를 감사인 → 경영진으로)
    const swappedAnswer316 = surgicalReplace(
        p316.model_answer,
        '감사인이 운영효과성을 테스트할 계획인 통제',
        '경영진이 운영효과성을 테스트할 계획인 통제'
    ).join('\n');

    // 4. 샷건 답안 (316: 정답 4개 전부 + 요구 유형에 해당하지 않는 그럴듯한 오답 3개 추가)
    const shotgunAnswer316 = [
        ...p316.model_answer,
        '일상적이고 반복적인 소액 현금 지출의 승인에 대한 통제',
        '임직원 복리후생비 지급의 정확성에 대한 통제',
        '급여의 단순 반복 지급을 처리하는 자동화된 통제',
    ].join('\n');

    // 5. 정답 + 무관 패딩 (200: 정답 전문 뒤에 타 주제(122, 공인회계사법)의 텍스트 부착)
    const paddedAnswer200 = [
        ...p200.model_answer,
        ...p122.model_answer,
    ].join('\n');

    const scenarios: Array<{
        id: number;
        problem: any;
        name: string;
        answer: string;
        kind: Kind;
        expectNote: string;
    }> = [
        {
            id: 1, problem: p314, kind: 'strict',
            name: '314번 단일 항목 부정 뒤집기 (4항목 중 경영진 무력화만 "할 수 없음"으로 반전)',
            answer: negatedAnswer314,
            expectNote: '항목 1개(2.5점 상당)가 명백한 오류이므로 ≤8점이어야 정상, ≥9점이면 미세 반전 불감 결함',
        },
        {
            id: 2, problem: p122, kind: 'strict',
            name: '122번 법정 수치 변조 (3천만원 → 5천만원)',
            answer: tamperedAnswer122,
            expectNote: '법정 한도 오기이므로 ≤8점이어야 정상, ≥9점이면 수치 변조 불감 결함',
        },
        {
            id: 3, problem: p316, kind: 'strict',
            name: '316번 주체 바꿔치기 (운영효과성 테스트 주체: 감사인 → 경영진)',
            answer: swappedAnswer316,
            expectNote: '역할 귀속 오류이므로 ≤8점이어야 정상, ≥9점이면 주체 오류 불감 결함',
        },
        {
            id: 4, problem: p316, kind: 'observe',
            name: '316번 샷건 답안 (정답 4개 + 요구 유형이 아닌 오답 3개 추가)',
            answer: shotgunAnswer316,
            expectNote: '≤8 = 오답 혼입 감점 작동 / ≥9 = 오답 혼입 불감(모르면 다 쓰는 전략 허용 — 정책 판단 필요)',
        },
        {
            id: 5, problem: p200, kind: 'fairness',
            name: '200번 정답 전문 + 무관 주제(공인회계사법) 패딩 부착',
            answer: paddedAnswer200,
            // 정책 확정(2026-07-20): 불필요/무관 서술에 대한 감점은 의도된 채점 정책.
            // 따라서 감점 자체는 결함이 아니며, 무관 패딩만으로 정답 가치가 과반 이상
            // 소멸(≤4점)하거나 "주제 이탈 0점" 규칙이 오발동하는 경우만 결함으로 판정.
            expectNote: '무관 서술 감점은 정책상 허용. 단 정답 가치 과반은 보존(≥5점)되어야 하며, 미달 시 과잉 감점 결함',
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
        console.log(`📊 사전 필터 최고 물음 커버리지: ${(cov.bestSubCoverage * 100).toFixed(0)}%`);
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

        console.log('\n⏳ Gemini API 실채점 호출 중 (5콜)...');
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
    let md = `# 테스트 결과: 채점 로직 미탐 영역 프로브 5종\n\n`;
    md += `> 작성일시: ${new Date().toISOString()}\n`;
    md += `> 기존 테스트가 다루지 않은 공격면 5종에 대한 실측: 단일 항목 부정 뒤집기 / 법정 수치 변조 / 주체 바꿔치기 / 샷건 답안 / 정답+무관 패딩.\n\n`;

    const defects: string[] = [];
    results.forEach((res, idx) => {
        md += `## ${idx + 1}. ${res.scenario.name}\n`;
        md += `- **기대 기준**: ${res.scenario.expectNote}\n`;
        md += `- **사전 필터 최고 물음 커버리지**: ${(res.coverage * 100).toFixed(0)}%\n`;
        if (res.score === null) {
            md += `- **Gemini 실채점**: [체크 전용으로 건너뜀]\n\n`;
            return;
        }
        md += `- **Gemini 실채점 결과**: **${res.score}점** (배점 10점)\n`;
        md += `- **피드백**:\n  > ${res.feedback.replace(/\n/g, '\n  > ')}\n`;

        let verdict = '';
        if (res.scenario.kind === 'strict') {
            if (res.score <= 8) verdict = '🟢 정상 (오류 삽입분이 감점됨)';
            else { verdict = '🔴 결함 — 명백한 오류가 삽입됐는데도 만점대 유지'; defects.push(res.scenario.name); }
        } else if (res.scenario.kind === 'fairness') {
            if (res.score >= 5) verdict = '🟢 정상 (무관 서술 감점은 정책상 허용 범위 — 정답 가치 과반 보존, 0점 오발동 없음)';
            else { verdict = '🔴 결함 — 무관 패딩만으로 정답 가치가 과반 이상 소멸 (과잉 감점)'; defects.push(res.scenario.name); }
        } else {
            verdict = res.score <= 8 ? '⚪ 관찰: 오답 혼입 감점 작동' : '⚪ 관찰: 오답 혼입 불감 (샷건 전략 허용 — 정책 판단 필요)';
        }
        md += `- **판정**: ${verdict}\n\n`;
    });

    if (!checkOnly) {
        md += `## 종합 결론\n`;
        md += defects.length === 0
            ? `**🟢 결함 미발견** — 5종 프로브 모두 기대 범위 내 (관찰 항목의 정책 판단은 별도).\n`
            : `**🔴 결함 ${defects.length}건 발견**:\n${defects.map(d => `- ${d}`).join('\n')}\n`;
    }

    const mdPath = path.resolve(process.cwd(), 'tests/grading_gap_probe_results.md');
    fs.writeFileSync(mdPath, md, 'utf-8');
    console.log(`\n🎉 완료! 결과가 ${mdPath} 에 저장되었습니다.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
