/**
 * Slice 5 — 정답 보존 및 반복 일관성 API 검증 (False Negative 탐지)
 *
 * 정답의 표현 방식을 바꾸거나(패러프레이징) 동의어로 치환했을 때,
 * 룰 필터를 정상 통과하고 고득점(≥7점)을 보존하는지,
 * 그리고 동일 답안 채점 시 점수 편차가 크지 않고 재현(일관성 ≤2점 편차)되는지 확인합니다.
 */
import type { BatchItem } from '../lib/serverUtils.ts';
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
        console.log(`ℹ️ [verify-paraphrase] 환경 변수 수동 로드 완료: ${envPath}`);
    }
}


// [주의] 동의어 시나리오 구성 시, 감사기준서가 요구하는 핵심 전문 용어(예: 신뢰성, 감사인, 회계법인)는 일반적인 유사어(신용성, 감사수행팀, 감사회사)로 치환 시
// 채점 엔진의 전문용어 정확성 정책에 따라 감점될 수 있으므로, 핵심 전문 용어는 보존하고 주변 서술어(예: 보존->보관, 귀속->속함)만 치환해야 합니다.
const PARAPHRASE_FIXTURES = [
    {
        qid: 4,
        label: 'Q4: 감사증거의 충분성과 적합성 (감사기준서 500)',
        question: '감사증거의 충분성과 적합성의 개념적 차이를 설명하시오.',
        modelAnswer: '충분성은 감사증거의 수량적(양적) 측면이며, 적합성은 감사증거의 질적 측면(관련성과 신뢰성)을 의미한다.',
        keywords: ['충분성', '적합성', '수량적 측면', '질적 측면', '관련성', '신뢰성'],
        explanation: '증거의 양과 질 구분 검증',
        // 1. 어순 및 조사 변형 정답 (패러프레이즈)
        paraphrased: '감사증거에서 적합성이 지니는 의의는 질적인 부분으로 신뢰성과 관련성이며, 충분함은 양적 내지 수량적인 면을 뜻한다.',
        // 2. 동의어 치환 정답 (핵심 용어는 보존하고 주변부 연결 구조 변경)
        synonymAnswer: '감사증거의 충분성은 수량적 측면을, 적합성은 질적 측면 즉 관련성과 신뢰성을 나타내는 개념이다.'
    },
    {
        qid: 5,
        label: 'Q5: 감사조서의 보존과 소유권 (감사기준서 230)',
        question: '감사조서의 최소 보존기간과 소유권 귀속 주체를 밝히시오.',
        modelAnswer: '감사보고서일로부터 최소 8년간 보존하며, 소유권은 감사인(회계법인)에게 귀속된다.',
        keywords: ['최소 8년', '보존기간', '소유권', '회계법인', '감사인'],
        explanation: '감사조서 기한 및 소유권 귀속',
        // 어순 및 조사 변형 정답
        paraphrased: '보존기간의 최소 하한선은 감사보고서일로부터 8개년이며 조서의 소유 권한은 감사보고 주체인 회계법인(감사인)이 가집니다.',
        // 동의어 치환 정답 (keywords인 최소 8년, 보존기간, 소유권, 감사인, 회계법인은 유지하며 보존->보관, 귀속->속함 등 부차 서술 치환)
        synonymAnswer: '감사보고서일로부터 최소 8년의 보존기간 동안 보관해야 하며, 조서 소유권은 감사인(회계법인)에게 속한다.'
    }
];

async function runParaphraseTest() {
    loadEnvLocal();
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('❌ GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.');
        process.exit(1);
    }
    const { gradeBatch } = await import('../lib/serverUtils.ts');

    console.log('===================================================');
    console.log('   Slice 5: 정답 보존 생존율 및 채점 일관성 실측');
    console.log('===================================================');

    // ────────────────────────────────────────────────
    // 시나리오 1: 조사/어순 변형 정답 채점 (생존율 검증)
    // ────────────────────────────────────────────────
    console.log('\n🔄 시나리오 1: 조사 및 어순 변형 정답 (패러프레이즈)');
    console.log('---------------------------------------------------');
    const paraItems: BatchItem[] = PARAPHRASE_FIXTURES.map((f, i) => ({
        id: i + 1,
        qid: f.qid,
        q: f.question,
        a: f.paraphrased,
        m: f.modelAnswer,
        k: f.keywords,
        r: f.explanation
    }));

    const paraResults = await gradeBatch(paraItems, apiKey);
    for (const item of paraItems) {
        const res = paraResults[item.id];
        console.log(`DEBUG: item.id=${item.id}, res=${JSON.stringify(res)}`);
        // 룰 필터를 통과하고 점수가 7점 이상이어야 성공
        const passed = res && res.score >= 7;
        console.log(`  • [${PARAPHRASE_FIXTURES[item.id-1].label}] 점수: ${res ? res.score : -1}점 | 결과: ${passed ? '✅ 정답 보존 성공' : '❌ 정답 오폐기/감점'}`);
        console.log(`    - 피드백: ${res && typeof res.evaluation === 'string' ? res.evaluation.replace(/\n/g, ' ') : '피드백 없음(오류)'}`);
    }

    // ────────────────────────────────────────────────
    // 시나리오 2: 동의어 치환 정답 채점 (약어/동의어 대응력 검증)
    // ────────────────────────────────────────────────
    console.log('\n📖 시나리오 2: 동의어/유사어 치환 정답');
    console.log('---------------------------------------------------');
    const synonymItems: BatchItem[] = PARAPHRASE_FIXTURES.map((f, i) => ({
        id: i + 1,
        qid: f.qid,
        q: f.question,
        a: f.synonymAnswer,
        m: f.modelAnswer,
        k: f.keywords,
        r: f.explanation
    }));

    const synonymResults = await gradeBatch(synonymItems, apiKey);
    for (const item of synonymItems) {
        const res = synonymResults[item.id];
        // 동의어 치환 시에도 7점 이상을 보존하는가?
        const passed = res && res.score >= 7;
        console.log(`  • [${PARAPHRASE_FIXTURES[item.id-1].label}] 점수: ${res ? res.score : -1}점 | 결과: ${passed ? '✅ 동의어 보존 성공' : '❌ 동의어 탈락 (감점/0점)'}`);
        console.log(`    - 피드백: ${res && typeof res.evaluation === 'string' ? res.evaluation.replace(/\n/g, ' ') : '피드백 없음(오류)'}`);
    }

    // ────────────────────────────────────────────────
    // 시나리오 3: 동일 답안 3회 반복 채점 (재현성 검증)
    // ────────────────────────────────────────────────
    console.log('\n🔁 시나리오 3: 동일 답안 3회 연속 호출 (반복 점수 편차)');
    console.log('---------------------------------------------------');
    // Q4 패러프레이즈 답안으로 3회 반복
    const targetFixture = PARAPHRASE_FIXTURES[0];
    const repeatedScores: number[] = [];

    for (let i = 0; i < 3; i++) {
        const singleItem: BatchItem = {
            id: i + 1,
            qid: targetFixture.qid,
            q: targetFixture.question,
            a: targetFixture.paraphrased,
            m: targetFixture.modelAnswer,
            k: targetFixture.keywords,
            r: targetFixture.explanation
        };
        // 순차 지연 500ms
        const singleResult = await gradeBatch([singleItem], apiKey);
        const resObj = singleResult[i + 1];
        repeatedScores.push(resObj.score);
        const evalStr = resObj && typeof resObj.evaluation === 'string' 
            ? resObj.evaluation.replace(/\n/g, ' ') 
            : (resObj && typeof resObj.evaluation === 'object' ? JSON.stringify(resObj.evaluation) : '피드백 없음');
        console.log(`    - ${i + 1}회차 채점 결과: ${resObj.score}점 (피드백: ${evalStr})`);
        
        if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    const minScore = Math.min(...repeatedScores);
    const maxScore = Math.max(...repeatedScores);
    const scoreDiff = maxScore - minScore;
    const isConsistent = scoreDiff <= 2;

    console.log(`  • [Q4 3회 반복 편차] 최소: ${minScore}점 | 최대: ${maxScore}점 | 편차: ${scoreDiff}점 | 결과: ${isConsistent ? '✅ 일관성 충족' : '❌ 일관성 상실'}`);

    console.log('\n===================================================');
    console.log('   Slice 5 검증 완료');
    console.log('===================================================');
}

runParaphraseTest().catch(err => {
    console.error(err);
    process.exit(1);
});
