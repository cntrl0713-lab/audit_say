import fs from 'fs';
import path from 'path';
import type { BatchItem } from '../lib/serverUtils.ts';

// 1. 환경변수 수동 로드
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
        console.log(`ℹ️ [verify-logic-inversion] 환경 변수 수동 로드 완료: ${envPath}`);
    }
}

// JSON 파일에서 200번 및 218번 문제 가져오기
function getCpaProblem(qid: number) {
    const jsonPath = path.resolve(process.cwd(), 'cpa_uploader/data/cpa_problems_v2.json');
    if (!fs.existsSync(jsonPath)) {
        throw new Error(`cpa_problems_v2.json 파일을 찾을 수 없습니다: ${jsonPath}`);
    }
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const problems = JSON.parse(raw);
    const problem = problems.find((p: any) => p.id === qid);
    if (!problem) {
        throw new Error(`ID가 ${qid}인 문제를 JSON에서 찾을 수 없습니다.`);
    }
    return problem;
}

// 각 sub별 실제 커버리지를 구하는 헬퍼 함수
function getCoveragePerSub(answer: string, rubric: any[]) {
    const normalizedAnswer = (answer || '').replace(/\s+/g, '').toLowerCase();
    const result: Record<number, number> = {};

    rubric.forEach(sub => {
        let matchedInSub = 0;
        const itemsCount = sub.items ? sub.items.length : 0;

        if (sub.items && Array.isArray(sub.items)) {
            sub.items.forEach((item: any) => {
                const isMatched = item.variants && Array.isArray(item.variants) && item.variants.some((v: any) => {
                    if (typeof v !== 'string') return false;
                    const normalizedVariant = v.replace(/\s+/g, '').toLowerCase();
                    if (normalizedVariant.length === 0) return false;
                    return normalizedAnswer.includes(normalizedVariant);
                });

                if (isMatched) {
                    matchedInSub++;
                }
            });
        }

        let denominator = itemsCount;
        if (sub.mode === 'best_n') {
            const nVal = typeof sub.n === 'number' ? sub.n : itemsCount;
            denominator = Math.min(nVal, itemsCount);
        }

        const coverage = denominator > 0 ? Math.min(1.0, matchedInSub / denominator) : 0;
        result[sub.sub] = coverage;
    });

    return result;
}

async function main() {
    loadEnvLocal();
    const apiKey = process.env.GOOGLE_API_KEY;
    
    // --check-only 플래그 여부 확인
    const checkOnly = process.argv.includes('--check-only');

    console.log('===================================================');
    console.log('    "키워드 완전 포함 + 물음 귀속 역전" 적대적 테스트');
    console.log('===================================================');

    // ----------------------------------------------------
    // [대상 1] 200번 문항: 물음1 ↔ 물음2 통째로 역전
    // ----------------------------------------------------
    console.log('\n🔍 [200번 문항] 물음 귀속 역전 답안 조립');
    const p200 = getCpaProblem(200);

    const sub1 = p200.rubric.find((r: any) => r.sub === 1);
    const sub2 = p200.rubric.find((r: any) => r.sub === 2);

    if (!sub1 || !sub2) {
        throw new Error('200번 문항의 rubric에 sub 1 또는 sub 2가 누락되었습니다.');
    }

    // sub1과 sub2의 아이템 문장 목록 추출
    const sub1Items = sub1.items.map((i: any) => i.item);
    const sub2Items = sub2.items.map((i: any) => i.item);

    // 물음 귀속 역전 답안 조립
    // 1번 물음 표제 아래에 2번 물음 아이템들을, 2번 물음 표제 아래에 1번 물음 아이템들을 나열
    const invertedAnswer200 = [
        "1. 전문가적 의구심 필요 상황",
        ...sub2Items.map((item: string, index: number) => `(${index + 1}) ${item}`),
        "2. 전문가적 판단 필요 상황",
        ...sub1Items.map((item: string, index: number) => `(${index + 1}) ${item}`)
    ].join('\n');

    console.log('\n--- [조립된 역전 답안 (200번)] ---');
    console.log(invertedAnswer200);
    console.log('---------------------------------\n');

    // 각 sub별 커버리지 계산
    const coverage200 = getCoveragePerSub(invertedAnswer200, p200.rubric);
    console.log('📊 [200번 사전 필터 실측 결과 (커버리지)]');
    console.log(`  - Sub 1 커버리지: ${coverage200[1] * 100}%`);
    console.log(`  - Sub 2 커버리지: ${coverage200[2] * 100}%`);

    let result200Score = null;
    let result200Feedback = '';

    if (!checkOnly) {
        if (!apiKey) {
            console.error('❌ GOOGLE_API_KEY 환경변수가 설정되지 않아 실제 채점 호출을 건너뜁니다.');
            process.exit(1);
        }
        
        const { gradeBatch } = await import('../lib/serverUtils.ts');

        console.log('\n⏳ Gemini API 실채점 호출 중...');
        const batchItems: BatchItem[] = [{
            id: 1,
            qid: 200,
            q: p200.question_description,
            a: invertedAnswer200,
            m: p200.model_answer.join('\n'),
            k: p200.rubric.flatMap((r: any) => r.items.flatMap((i: any) => i.variants)),
            r: JSON.stringify(p200.rubric)
        }];

        const scoreResults = await gradeBatch(batchItems, apiKey);
        const res = scoreResults[1];
        result200Score = res.score;
        result200Feedback = res.evaluation;
        console.log(`  ➡️ [실채점 결과] 점수: ${res.score}점`);
        console.log(`  ➡️ [실채점 피드백]: ${res.evaluation.replace(/\n/g, ' ')}`);
    }

    // ----------------------------------------------------
    // [대상 2] 218번 문항: 같은 물음(sub 2) 내부의 item 간 목적 바꿈
    // ----------------------------------------------------
    console.log('\n🔍 [218번 문항] 같은 물음(sub 2) 내의 item 간 목적 역전 답안 조립');
    const p218 = getCpaProblem(218);
    const sub2_218 = p218.rubric.find((r: any) => r.sub === 2);
    if (!sub2_218) {
        throw new Error('218번 문항의 rubric에 sub 2가 누락되었습니다.');
    }

    // sub2_218.items:
    // 1. 위험평가 절차 단계: 분석적절차가 다른 위험평가절차와 함께... (R1.25)
    // 2. 실증적인 대처 단계: 감사보고서일 또는 그 부근에서... (R1.25)
    // 3. 감사의 전반적인 결론을 도출하는 단계: 재무제표가... (R1.25)
    
    // 이 단계와 목적 서술을 엇갈리게 교차시킵니다.
    // 원래:
    // (1) 위험평가절차 단계: 중요왜곡표시위험의 식별 및 평가 목적
    // (2) 실증절차 단계: 경영진 주장 수준에서 유의적인 왜곡표시를 발견 목적
    // (3) 감사 보고 부근(감사종료) 단계: 재무제표가 기업의 이해와 일치하는지에 대하여 전반적인 결론을 내리기 위함
    
    // 교차 변형:
    // - 위험평가절차 단계의 목적: "전반적인 결론을 도출하기 위함"
    // - 실증절차 단계의 목적: "중요왜곡표시위험을 식별하고 평가하기 위함"
    // - 감사종료 단계의 목적: "경영진 주장 수준에서 유의적인 왜곡표시를 발견하기 위함"
    const invertedAnswer218 = [
        "1. 필수 수행 단계",
        "감사인은 계획 수립 시점(위험평가절차), 실증절차 수행 시점, 그리고 감사 보고 직전(감사종료 시점)에 분석적절차를 필수로 수행해야 한다.",
        "2. 단계별 수행 목적",
        "(1) 위험평가절차 단계: 분석적절차는 재무제표가 기업의 이해와 일치하는지에 대하여 전반적인 결론을 내리기 위해 수행한다.",
        "(2) 실증절차 단계: 경영진주장 수준의 중요왜곡표시위험을 식별하고 평가하기 위해 수행한다.",
        "(3) 감사종료 단계: 경영진 주장 수준에서 유의적인 왜곡표시를 발견하기 위해 수행한다."
    ].join('\n');

    console.log('\n--- [조립된 역전 답안 (218번)] ---');
    console.log(invertedAnswer218);
    console.log('---------------------------------\n');

    // 각 sub별 커버리지 계산
    const coverage218 = getCoveragePerSub(invertedAnswer218, p218.rubric);
    console.log('📊 [218번 사전 필터 실측 결과 (커버리지)]');
    console.log(`  - Sub 1 커버리지: ${coverage218[1] * 100}%`);
    console.log(`  - Sub 2 커버리지: ${coverage218[2] * 100}%`);

    let result218Score = null;
    let result218Feedback = '';

    if (!checkOnly) {
        const { gradeBatch } = await import('../lib/serverUtils.ts');

        console.log('\n⏳ Gemini API 실채점 호출 중...');
        const batchItems: BatchItem[] = [{
            id: 2,
            qid: 218,
            q: p218.question_description,
            a: invertedAnswer218,
            m: p218.model_answer.join('\n'),
            k: p218.rubric.flatMap((r: any) => r.items.flatMap((i: any) => i.variants)),
            r: JSON.stringify(p218.rubric)
        }];

        if (apiKey) {
            const scoreResults = await gradeBatch(batchItems, apiKey);
            const res = scoreResults[2];
            result218Score = res.score;
            result218Feedback = res.evaluation;
            console.log(`  ➡️ [실채점 결과] 점수: ${res.score}점`);
            console.log(`  ➡️ [실채점 피드백]: ${res.evaluation.replace(/\n/g, ' ')}`);
        }
    }

    // ----------------------------------------------------
    // 결과 마크다운 문서 작성 (R7)
    // ----------------------------------------------------
    const mdPath = path.resolve(process.cwd(), 'tests/logic_inversion_test_results.md');
    let mdContent = `# 적대적 테스트 결과: "키워드 완전 포함 + 물음 귀속 역전"\n\n`;
    mdContent += `> 작성일시: ${new Date().toISOString()}\n`;
    mdContent += `> 본 검증은 물음 간 귀속을 엇갈리게 작성했으나 개별 문장은 모범답안과 똑같은 적대적 답안에 대한 필터 통과율 및 채점 엔진(Gemini LLM)의 방어 성능을 측정합니다.\n\n`;

    mdContent += `## 1. 200번 문항 실측 (물음1 ↔ 물음2 역전)\n`;
    mdContent += `- **답안 조립 방식**: 물음 1에 sub 2 아이템들을 나열하고, 물음 2에 sub 1 아이템들을 나열.\n`;
    mdContent += `- **사전 필터(커버리지) 결과**:\n`;
    mdContent += `  - Sub 1 커버리지: ${coverage200[1] * 100}%\n`;
    mdContent += `  - Sub 2 커버리지: ${coverage200[2] * 100}%\n`;
    mdContent += `  - **필터 통과 결과**: 🟢 PASS (필터는 위치/구조를 보지 않으므로 차단 불가)\n`;
    if (!checkOnly) {
        mdContent += `- **Gemini API 실채점 결과**: **${result200Score}점** (배점: 10점)\n`;
        mdContent += `- **Gemini 피드백**:\n  > ${result200Feedback.replace(/\n/g, '\n  > ')}\n`;
        const is200Defended = result200Score !== null && result200Score <= 3;
        mdContent += `- **방어 판정**: ${is200Defended ? '🟢 방어 성공 (≤3점)' : '🔴 결함 발견 (오답에 고득점 허용)'}\n\n`;
    } else {
        mdContent += `- **Gemini API 실채점 결과**: [체크 전용으로 건너뜀]\n\n`;
    }

    mdContent += `## 2. 218번 문항 실측 (sub2 내의 item 간 목적 교차 역전)\n`;
    mdContent += `- **답안 조립 방식**: sub 2 내부의 3가지 수행 단계의 목적을 서로 뒤바꿈.\n`;
    mdContent += `- **사전 필터(커버리지) 결과**:\n`;
    mdContent += `  - Sub 1 커버리지: ${coverage218[1] * 100}%\n`;
    mdContent += `  - Sub 2 커버리지: ${coverage218[2] * 100}%\n`;
    mdContent += `  - **필터 통과 결과**: 🟢 PASS (필터 통과)\n`;
    if (!checkOnly) {
        mdContent += `- **Gemini API 실채점 결과**: **${result218Score}점** (배점: 10점)\n`;
        mdContent += `- **Gemini 피드백**:\n  > ${result218Feedback.replace(/\n/g, '\n  > ')}\n`;
        const is218Defended = result218Score !== null && result218Score <= 3;
        mdContent += `- **방어 판정**: ${is218Defended ? '🟢 방어 성공 (≤3점)' : '🔴 결함 발견 (오답에 고득점 허용)'}\n\n`;
    } else {
        mdContent += `- **Gemini API 실채점 결과**: [체크 전용으로 건너뜀]\n\n`;
    }

    if (!checkOnly) {
        mdContent += `## 3. 종합 결론\n`;
        const is200Defended = result200Score !== null && result200Score <= 3;
        const is218Defended = result218Score !== null && result218Score <= 3;
        if (is200Defended && is218Defended) {
            mdContent += `**🟢 방어 성공 (Found No Defect)**\n\n`;
            mdContent += `사전 필터(\`computeRubricCoverage\`)는 구조 정보가 유실되어 이 역전 답안들을 거르지 못했으나, 최종 방어선인 Gemini 채점기가 홀리스틱 판단을 통해 질문의 귀속과 매칭되지 않은 오답임을 완벽하게 감지하여 모두 낮은 점수(≤3점)를 부여했습니다.\n`;
        } else {
            mdContent += `**🔴 결함 발견 (Defect Detected)**\n\n`;
            mdContent += `논리가 엉망(물음과 답이 불일치)임에도 불구하고 Gemini가 개별 키워드의 완결성에 속아 높은 점수를 부여했습니다. 이에 대한 채점 프롬프트(systemInstruction) 보완 또는 위치 인식을 가미하는 추가 패치가 필요합니다.\n`;
        }
    }

    fs.writeFileSync(mdPath, mdContent, 'utf-8');
    console.log(`🎉 검증 완료! 결과가 ${mdPath} 에 저장되었습니다.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
