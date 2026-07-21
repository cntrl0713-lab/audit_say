/**
 * 5개 문제 선별 순서 변경(셔플 및 교차 매칭) 테스트 스크립트
 *
 * 필수 환경변수: GOOGLE_API_KEY
 */
// server-only 패키지가 Node 테스트 런타임에서 예외를 던지는 현상을 방어하기 위해 mock 설정
import { createRequire } from 'module';
const requireMock = createRequire(import.meta.url);
try {
    const serverOnlyPath = requireMock.resolve('server-only');
    requireMock.cache[serverOnlyPath] = {
        id: serverOnlyPath,
        filename: serverOnlyPath,
        loaded: true,
        exports: {},
        paths: [],
        children: []
    } as any;
} catch (e) {}

import type { BatchItem, GradeResult } from '../lib/serverUtils.ts';
import fs from 'fs';
import path from 'path';

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
        console.log(`ℹ️ [verify-shuffled] 환경 변수 수동 로드 완료: ${envPath}`);
    }
}


// ─── 5개 문제 선별 픽스처 ───────────────────────────

const FIXTURES = [
    {
        qid: 1,
        label: 'Q1: 독립감사인의 전반적 목적 (감사기준서 200)',
        question: '독립감사인의 전반적 목적을 서술하시오.',
        modelAnswer: '재무제표가 중요한 왜곡표시 없이 작성되었는지 합리적인 확신을 얻고, 의견을 표명하는 감사보고서를 발행하는 것이다.',
        keywords: ['합리적인 확신', '의견 표명', '감사보고서'],
        explanation: '감사인의 전반적 목적은 합리적 확신 획득 및 의견 보고서 발행이다.',
        strongAnswer: '재무제표가 중요한 왜곡표시가 없는지에 대해 합리적인 확신을 얻고, 감사인의 발견사항에 따라 의견을 표명하는 감사보고서를 발행하는 것입니다.',
    },
    {
        qid: 2,
        label: 'Q2: 중요한 왜곡표시 위험 식별 (감사기준서 315)',
        question: '감사인이 감사계획 수립 시 중요한 왜곡표시 위험을 식별하고 평가하는 절차를 설명하시오.',
        modelAnswer: '기업과 기업환경을 이해하여 재무제표 수준과 경영진 주장 수준의 위험을 식별하고 평가한다. 이를 위해 질문, 분석적절차, 관찰 등을 수행한다.',
        keywords: ['기업환경 이해', '재무제표 수준', '경영진 주장 수준', '위험평가절차'],
        explanation: '위험 식별과 평가를 위해 수행하는 절차적 이해 검증.',
        strongAnswer: '기업과 기업환경에 대한 이해를 수행하고, 재무제표 및 경영진주장 수준에서 중요한 왜곡표시 위험을 식별 및 평가하기 위해 질문, 관찰, 분석적 절차 등의 위험평가절차를 수행합니다.',
    },
    {
        qid: 3,
        label: 'Q3: 감사의견의 종류 (감사기준서 700/705)',
        question: '적정의견, 한정의견, 부적정의견, 의견거절의 차이를 설명하시오.',
        modelAnswer: '적정은 왜곡표시 없음. 한정은 중요하나 전반적이지 않음. 부적정은 중요하고 전반적임. 의견거절은 증거 부족하며 전반적임.',
        keywords: ['적정의견', '한정의견', '부적정의견', '의견거절', '전반적'],
        explanation: '감사의견 결정의 왜곡표시 수준 및 전반성 여부에 따른 분류.',
        strongAnswer: '적정의견은 왜곡표시가 없는 경우 표명하며, 왜곡표시가 중요하지만 전반적이지 않을 때는 한정의견을, 중요하고 전반적일 때는 부적정의견을 표명합니다. 충분한 감사증거를 얻지 못해 전반적인 영향이 예상될 때는 의견거절을 표명합니다.',
    },
    {
        qid: 4,
        label: 'Q4: 감사증거의 충분성과 적합성 (감사기준서 500)',
        question: '감사증거의 충분성과 적합성의 개념적 차이를 설명하시오.',
        modelAnswer: '충분성은 감사증거의 수량적(양적) 측면이며, 적합성은 감사증거의 질적 측면(관련성과 신뢰성)을 의미한다.',
        keywords: ['충분성', '적합성', '수량적 측면', '질적 측면', '관련성', '신뢰성'],
        explanation: '감사증거의 양(수량)과 질(관련성/신뢰성)에 대한 정의 구분.',
        strongAnswer: '충분성은 감사인이 획득해야 하는 감사증거의 수량적 또는 양적인 측면을 뜻하며, 적합성은 증거의 질적인 측면으로서 주장과의 관련성과 원천의 신뢰성을 의미합니다.',
    },
    {
        qid: 5,
        label: 'Q5: 감사조서의 보존과 소유권 (감사기준서 230)',
        question: '감사조서의 최소 보존기간과 소유권 귀속 주체를 밝히시오.',
        modelAnswer: '감사보고서일로부터 최소 8년간 보존하며, 소유권은 감사인(회계법인)에게 귀속된다.',
        keywords: ['최소 8년', '보존기간', '소유권', '회계법인', '감사인'],
        explanation: '감사기준서에 근거한 조서 관리 의무 기한 및 권리 귀속처.',
        strongAnswer: '감사조서는 감사보고서일로부터 최소 8년 동안 보존하여야 하며, 감사조서에 대한 소유권은 감사를 수행한 감사인(회계법인)에게 귀속됩니다.',
    },
];

// ─── 셔플 함수 (Fisher-Yates) ──────────────────────

function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ─── 메인 실행 ─────────────────────────────────────

async function main() {
    loadEnvLocal();
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('❌ GOOGLE_API_KEY 환경변수가 필요합니다.');
        process.exit(1);
    }
    const { gradeBatch } = await import('../lib/serverUtils.ts');

    console.log('===================================================');
    console.log('  audit_say 순서 변경 및 교차 검증 테스트 (5개 문제)');
    console.log('===================================================');

    // ----------------------------------------------------
    // [시나리오 1] 문제 순서 셔플 (정상 채점 확인)
    // ----------------------------------------------------
    console.log('\n🔄 [시나리오 1] 배치 내 항목 순서 무작위 셔플 테스트');
    console.log('---------------------------------------------------');

    const correctItems: BatchItem[] = FIXTURES.map((f, index) => ({
        id: index + 1,
        qid: f.qid,
        q: f.question,
        a: f.strongAnswer,
        m: f.modelAnswer,
        k: f.keywords,
        r: f.explanation
    }));

    // 배열 순서를 무작위로 섞음
    const shuffledItems = shuffleArray(correctItems);
    console.log('  정렬된 원래 qid 순서: 1, 2, 3, 4, 5');
    console.log(`  셔플된 요청 qid 순서: ${shuffledItems.map(i => i.qid).join(', ')}`);
    
    console.log('  ⏳ 채점 요청 중...');
    const result1 = await gradeBatch(shuffledItems, apiKey);

    console.log('\n  📊 시나리오 1 결과:');
    let s1Passed = true;
    for (const item of shuffledItems) {
        const res = result1[item.id];
        const status = res.score >= 7 ? '✅ PASS' : '❌ FAIL';
        if (res.score < 7) s1Passed = false;
        console.log(`    [Q${item.qid}] 점수: ${res.score}점 (${status})`);
        console.log(`      피드백: ${res.evaluation}`);
    }

    // ----------------------------------------------------
    // [시나리오 2] 교차 오염 (답안이 밀려서 매칭된 경우)
    // ----------------------------------------------------
    console.log('\n💥 [시나리오 2] 답안 교차 오염 테스트 (질문과 어긋난 답안)');
    console.log('---------------------------------------------------');

    // 답안을 한 칸씩 밀어서 설정 (Q1 -> Q2의 답안, Q2 -> Q3의 답안, ..., Q5 -> Q1의 답안)
    const crossedItems: BatchItem[] = FIXTURES.map((f, index) => {
        const crossedIndex = (index + 1) % FIXTURES.length; // 다음 질문의 인덱스
        const nextFixture = FIXTURES[crossedIndex];
        return {
            id: index + 1,
            qid: f.qid,
            q: f.question,
            a: nextFixture.strongAnswer, // 다른 문제의 정답
            m: f.modelAnswer,
            k: f.keywords,
            r: f.explanation
        };
    });

    for (const item of crossedItems) {
        const correspondingFixture = FIXTURES[item.id - 1];
        console.log(`  질문: "${item.q}"`);
        console.log(`  제출된 답안: "${item.a}"`);
        console.log('  ---');
    }

    console.log('  ⏳ 채점 요청 중...');
    const result2 = await gradeBatch(crossedItems, apiKey);

    console.log('\n  📊 시나리오 2 결과:');
    let s2Passed = true;
    for (const item of crossedItems) {
        const res = result2[item.id];
        // 다른 문제의 답안이므로 3점 이하의 매우 낮은 점수를 받아야 함
        const status = res.score <= 3 ? '✅ PASS (오답 감지 성공)' : '❌ FAIL (부당한 고득점)';
        if (res.score > 3) s2Passed = false;
        console.log(`    [Q${item.qid}] 점수: ${res.score}점 (${status})`);
        console.log(`      피드백: ${res.evaluation}`);
    }

    console.log('\n===================================================');
    console.log('  종합 검증 완료');
    console.log('===================================================');
    console.log(`  [시나리오 1] 순서 셔플 정상 채점: ${s1Passed ? '성공 (PASS)' : '실패 (FAIL)'}`);
    console.log(`  [시나리오 2] 오답 매칭 감지 여부: ${s2Passed ? '성공 (PASS)' : '실패 (FAIL)'}`);
    
    if (s1Passed && s2Passed) {
        console.log('\n🎉 모든 순서 정밀성 검증 통과!');
        process.exit(0);
    } else {
        console.log('\n⚠️ 일부 시나리오가 실패했습니다.');
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
