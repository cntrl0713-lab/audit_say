/**
 * ordered 플래그 실측 및 회귀 검증 프로브 스크립트
 *
 * 이 스크립트는 다음 사항을 실측 검증합니다:
 * 1. 307번 (ordered: true) 정순 답안의 고득점 (9~10점) 및 역순 답안의 감점 (≤8점) 일관성 검증
 * 2. 316번, 122번 (ordered: false) 열거형 문항의 셔플 답안의 고득점 (9~10점) 유지 검증 (회귀 방지)
 * 3. 각 시나리오를 3회씩 실행하여 채점의 통계적 일관성 확인
 *
 * 실행: npx tsx tests/verify-ordered-probe.ts
 */
import fs from 'fs';
import path from 'path';
import type { BatchItem } from '../lib/serverUtils.ts';

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
        console.log(`ℹ️ [verify-ordered-probe] 환경 변수 수동 로드 완료: ${envPath}`);
    }
}

function getCpaProblem(qid: number): any {
    const jsonPath = path.resolve(process.cwd(), 'cpa_uploader/data/cpa_problems_v2.json');
    const problems = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const problem = problems.find((p: any) => p.id === qid);
    if (!problem) throw new Error(`ID ${qid} 문제를 JSON에서 찾을 수 없습니다.`);
    return problem;
}

// 딜레이 헬퍼
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    loadEnvLocal();
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ 에러: GOOGLE_API_KEY 또는 GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
        process.exit(1);
    }

    const { gradeBatch } = await import('../lib/serverUtils.ts');

    const p307 = getCpaProblem(307);
    const p316 = getCpaProblem(316);
    const p122 = getCpaProblem(122);

    // 시나리오 정의
    const scenarios = [
        {
            id: '307_forward',
            qid: 307,
            name: '307번 (순차형) 정순 답안',
            answer: p307.model_answer.join('\n'),
            problem: p307,
            expected: 'high' // 9~10점 기대
        },
        {
            id: '307_backward',
            qid: 307,
            name: '307번 (순차형) 역순 답안',
            answer: [...p307.model_answer].reverse().join('\n'),
            problem: p307,
            expected: 'low' // ≤8점 기대
        },
        {
            id: '316_shuffle',
            qid: 316,
            name: '316번 (열거형) 셔플 답안',
            answer: [
                '감사인이 위험을 평가하고 추가감사절차를 설계하기 위해 적절하다고 판단한 기타 통제들을 제시합니다.',
                '또한 감사인이 운영효과성을 테스트할 계획인 통제들이 있고, 분개와 재무제표 작성을 위한 조정사항에 대한 통제들도 검토 대상입니다.',
                '마지막으로 유의적 위험에 대처하는 통제들도 해당합니다.'
            ].join('\n'),
            problem: p316,
            expected: 'high' // 9~10점 기대
        },
        {
            id: '122_shuffle',
            qid: 122,
            name: '122번 (열거형) 셔플 답안',
            answer: [
                '상거래를 위해 약관에 따라 체결된 3천만원 미만의 채권·채무 및 상속 등 비자발적으로 발생된 채권 또는 채무가 예외 사유에 들어갑니다.',
                '또한 퇴직연금 등 채권이 있고, 정상가액으로 구입한 회원권 및 시설물이용권이 있으며, 금융상품에 대해 약관에 따라 체결한 채권·채무(담보대출 등) 및 직무와 직접 관련된 채권도 예외에 해당합니다.'
            ].join('\n'),
            problem: p122,
            expected: 'high' // 9~10점 기대
        }
    ];

    console.log('===================================================');
    console.log('      ordered 플래그 실측 및 일관성 검증 프로브');
    console.log('===================================================');

    // 시나리오당 3회 반복 측정
    const ITERATIONS = 3;
    const scoresMap: Record<string, number[]> = {};
    const feedbackMap: Record<string, string[]> = {};

    for (let iter = 1; iter <= ITERATIONS; iter++) {
        console.log(`\n🔄 반복 회차 [${iter}/${ITERATIONS}] 실행 중...`);
        
        // API 요동 방지를 위해 개별 시나리오 배치 실행
        for (const sc of scenarios) {
            console.log(`👉 ${sc.name} 채점 요청...`);
            
            const batchItem: BatchItem = {
                id: 1,
                qid: sc.qid,
                q: sc.problem.question_description,
                a: sc.answer,
                m: sc.problem.model_answer.join('\n'),
                k: sc.problem.rubric.flatMap((r: any) => r.items.flatMap((i: any) => i.variants)),
                r: JSON.stringify(sc.problem.rubric)
            };

            const response = await gradeBatch([batchItem], apiKey);
            const res = response[1];
            
            const score = res ? res.score : 0;
            const evalText = res ? res.evaluation : '채점 결과 실패';

            if (!scoresMap[sc.id]) {
                scoresMap[sc.id] = [];
                feedbackMap[sc.id] = [];
            }
            scoresMap[sc.id].push(score);
            feedbackMap[sc.id].push(evalText);

            console.log(`   └ 결과 점수: ${score}점 | 피드백: ${evalText.replace(/\n/g, ' ')}`);
            
            // API 호출 간 짧은 딜레이
            await delay(1000);
        }
    }

    console.log('\n===================================================');
    console.log('                  최종 실측 요약 리포트');
    console.log('===================================================');

    let allPassed = true;
    let resultMarkdown = `\n### 5.1. 실측 스코어 보드\n\n`;
    resultMarkdown += `| 시나리오 | 기대 수준 | 1차 점수 | 2차 점수 | 3차 점수 | 평균 점수 | 판정 |\n`;
    resultMarkdown += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n`;

    for (const sc of scenarios) {
        const scores = scoresMap[sc.id] || [];
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        
        let pass = false;
        if (sc.expected === 'high') {
            pass = scores.every(s => s >= 9);
        } else if (sc.expected === 'low') {
            pass = scores.every(s => s <= 8);
        }

        if (!pass) allPassed = false;
        
        console.log(`[${sc.name}]`);
        console.log(`  - 점수 기록: [${scores.join(', ')}] (평균: ${avg.toFixed(1)}점)`);
        console.log(`  - 검증 기대: ${sc.expected === 'high' ? '만점대(9~10점)' : '감점(≤8점)'}`);
        console.log(`  - 판정 결과: ${pass ? '🟢 PASS' : '🔴 FAIL'}`);
        
        resultMarkdown += `| ${sc.name} | ${sc.expected === 'high' ? '만점대 (≥9)' : '감점 (≤8)'} | ${scores[0]}점 | ${scores[1]}점 | ${scores[2]}점 | ${avg.toFixed(1)}점 | ${pass ? '🟢 PASS' : '🔴 FAIL'} |\n`;
    }

    console.log('\n===================================================');
    if (allPassed) {
        console.log('✅ 성공: 모든 순차성 및 회귀 검증이 무사히 통과되었습니다!');
    } else {
        console.error('❌ 실패: 일부 검증 케이스가 요건을 충족하지 못했습니다.');
    }
    console.log('===================================================');

    // tests/ordered_audit_results.md에 실측 데이터 덧붙여서 기록 보존
    const auditResultsPath = path.resolve(process.cwd(), 'tests/ordered_audit_results.md');
    if (fs.existsSync(auditResultsPath)) {
        let content = fs.readFileSync(auditResultsPath, 'utf-8');
        content += '\n\n## 5. 실측 프로브 및 회귀 검증 결과\n';
        content += `> 본 검증은 실제 Gemini 3.1 Flash-lite API 환경에서 각 시나리오별로 3회 반복 채점을 수행하여 산출한 통계적 일관성 실측 결과입니다.\n\n`;
        content += resultMarkdown;
        content += `\n- **종합 결과**: ${allPassed ? '🟢 모든 검증 통과 (Pass)' : '🔴 일부 회귀 발생 (Fail)'}\n`;
        
        // 피드백 로그 요약도 남김
        content += `\n### 5.2. 시나리오별 실제 추출된 대표 피드백\n`;
        scenarios.forEach(sc => {
            const feedbacks = feedbackMap[sc.id] || [];
            content += `- **${sc.name}**:\n  > ${feedbacks[0].replace(/\n/g, '\n  > ')}\n`;
        });

        fs.writeFileSync(auditResultsPath, content, 'utf-8');
        console.log(`ℹ️ 감사 보고서(${auditResultsPath})에 실측 데이터가 업데이트되었습니다.`);
    }
}

main().catch(err => {
    console.error('실행 중 치명적 에러 발생:', err);
    process.exit(1);
});
