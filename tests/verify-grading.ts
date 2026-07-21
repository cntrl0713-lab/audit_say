/**
 * CTA 스타일 채점 통합 테스트 (Gemini API 호출 포함)
 *
 * CTA_tax_law의 verify-grading.ts 패턴을 audit_say에 맞게 적용:
 * - 인라인 픽스처 데이터 (DB 비의존)
 * - Strong/Incomplete/Half 모드별 기대 점수 범위 검증
 * - 응답 구조 일관성 검증 (score 0~10, evaluation 존재)
 *
 * 실행 방법:
 *   npx tsx tests/verify-grading.ts [--mode strong|incomplete|half|all]
 *
 * 필수 환경변수: GOOGLE_API_KEY
 */
import { GoogleGenAI } from '@google/genai';

// ─── 타입 정의 ─────────────────────────────────────

interface BatchItem {
    id: number;
    qid: number;
    q: string;       // 문제
    a: string;       // 사용자 답안
    m: string;       // 모범 답안
    k: string[];     // 키워드
    r: string;       // 참고 설명
}

interface GradeResult {
    score: number;
    evaluation: string;
}

type Mode = 'strong' | 'incomplete' | 'half';

// ─── 인라인 픽스처 데이터 (DB 비의존) ──────────────

const FIXTURES = [
    {
        label: '감사기준서 200 — 독립감사의 전반적 목적 및 감사기준에 따른 감사의 수행',
        qid: 1,
        question: '독립감사인의 전반적 목적을 서술하시오.',
        modelAnswer: '독립감사인의 전반적 목적은 재무제표가 중요한 왜곡표시 없이 해당 재무보고체계에 따라 작성되었는지에 대하여 합리적인 확신을 얻고, 감사인의 발견사항에 따라 감사보고서를 통해 의견을 표명하는 것이다.',
        keywords: ['독립감사인', '전반적 목적', '재무제표', '중요한 왜곡표시', '합리적인 확신', '감사보고서', '의견표명'],
        explanation: '감사기준서 200에 따르면, 감사인의 전반적 목적은 (1) 합리적 확신 획득, (2) 의견 표명이다.',
        strongAnswer: '독립감사인의 전반적 목적은 재무제표 전체가 부정이나 오류에 의한 중요한 왜곡표시가 없는지에 대하여 합리적인 확신을 얻어, 그 발견사항에 따라 감사보고서를 통하여 재무제표에 대한 의견을 표명하는 것이다. 이는 감사기준서 200에서 규정하는 감사인의 핵심적 역할이다.',
        incompleteAnswer: '감사를 잘 하는 것입니다. 재무제표를 검토합니다.',
        halfAnswer: '독립감사인의 전반적 목적은 재무제표에 중요한 왜곡표시가 없는지 확인하여 합리적인 확신을 얻는 것이다.',
    },
    {
        label: '감사기준서 315 — 중요한 왜곡표시 위험의 식별과 평가',
        qid: 2,
        question: '감사인이 감사계획 수립 시 중요한 왜곡표시 위험을 식별하고 평가하는 절차를 설명하시오.',
        modelAnswer: '감사인은 기업과 기업환경에 대한 이해(산업, 규제, 내부통제 포함)를 통해 재무제표 수준 및 경영진주장 수준의 중요한 왜곡표시 위험을 식별하고 평가해야 한다. 이를 위해 경영진 질문, 분석적 절차, 관찰 및 검사 등의 위험평가절차를 수행한다.',
        keywords: ['기업환경', '내부통제', '중요한 왜곡표시', '위험평가절차', '경영진주장', '재무제표 수준', '질문', '분석적 절차'],
        explanation: '감사기준서 315에 따른 위험평가 절차의 핵심 요소를 포함해야 한다.',
        strongAnswer: '감사인은 감사계획 수립 시 기업과 기업환경(산업, 규제 환경, 내부통제 포함)에 대한 이해를 바탕으로, 재무제표 수준 및 경영진주장 수준에서 중요한 왜곡표시 위험을 식별하고 평가해야 한다. 이를 위해 위험평가절차로서 경영진 및 기업 내 관련자에 대한 질문, 분석적 절차의 수행, 관찰 및 검사를 실시한다.',
        incompleteAnswer: '위험을 평가하기 위해 여러 절차를 수행합니다. 회사에 대해 잘 파악합니다.',
        halfAnswer: '감사인은 기업환경을 이해하고 중요한 왜곡표시 위험을 식별해야 한다. 경영진 질문과 분석적 절차를 수행한다.',
    },
    {
        label: '감사기준서 700 — 감사의견의 형성',
        qid: 3,
        question: '적정의견, 한정의견, 부적정의견, 의견거절의 차이를 설명하시오.',
        modelAnswer: '적정의견은 재무제표가 중요성의 관점에서 해당 재무보고체계에 따라 작성되었다고 판단될 때 표명한다. 한정의견은 왜곡표시가 중요하지만 전반적이지 않을 때, 또는 충분하고 적합한 감사증거를 입수할 수 없으나 그 영향이 전반적이지 않을 때 표명한다. 부적정의견은 왜곡표시가 중요하고 전반적일 때 표명한다. 의견거절은 충분하고 적합한 감사증거를 입수할 수 없고 그 영향이 전반적일 때 표명한다.',
        keywords: ['적정의견', '한정의견', '부적정의견', '의견거절', '왜곡표시', '전반적', '충분하고 적합한 감사증거'],
        explanation: '감사기준서 700, 705에서 정의하는 네 가지 감사의견 유형.',
        strongAnswer: '적정의견은 재무제표가 중요성의 관점에서 해당 재무보고체계에 따라 작성되었다고 판단할 때 표명한다. 한정의견은 충분하고 적합한 감사증거를 기초로 왜곡표시가 중요하지만 전반적이지는 않다고 결론 내리거나, 충분하고 적합한 감사증거를 입수할 수 없으나 미발견 왜곡표시의 재무제표에 대한 영향이 전반적이지 않을 때 표명한다. 부적정의견은 왜곡표시가 중요하고 전반적이라고 결론 내릴 때 표명한다. 의견거절은 충분하고 적합한 감사증거를 입수할 수 없고, 미발견 왜곡표시의 영향이 중요하고 전반적일 수 있을 때 표명한다.',
        incompleteAnswer: '적정의견은 좋은 거고, 부적정의견은 나쁜 겁니다.',
        halfAnswer: '적정의견은 재무제표가 적정할 때, 한정의견은 왜곡표시가 중요하지만 전반적이지 않을 때, 부적정의견은 왜곡표시가 전반적일 때, 의견거절은 감사증거를 충분히 입수할 수 없을 때 표명한다.',
    },
];

// ─── gradeBatch 독립 재구현 ────────────────────────

async function gradeBatch(items: BatchItem[], apiKey: string): Promise<{ [id: number]: GradeResult }> {
    const ai = new GoogleGenAI({ apiKey });

    const promptLines = [
        "당신은 엄격하고 보수적인 KICPA(공인회계사) 회계감사 2차 시험 채점 위원입니다.",
        "제공된 [문제], [사용자 답안], [모범 답안], [참고 설명]를 분석하여 0~10점 척도로 냉정하게 채점하세요.",
        "",
        "[엄격한 채점 기준]",
        "1. **전문 용어의 정확성 (필수)**: [모범 답안]에 명시된 전문 용어(Technical Terms)가 정확히 사용되었는지 확인하십시오. 의미가 비슷하더라도 일반적인 서술어(풀어쓴 말)는 인정하지 마십시오.",
        "2. **인과관계의 완결성**: 단순 나열이 아닌 '원인 -> 결과' 또는 '상황 -> 대응'의 논리 구조가 모범 답안과 일치해야 합니다.",
        "3. **감점 가이드라인**:",
        "   - 두루뭉술한 표현('잘 확인한다', '검토한다' 등 구체적 대상 없는 서술): 가차 없이 감점.",
        "   - 답안 길이가 길어도 핵심 논리가 없으면 0점.",
        "",
        "[점수 척도 가이드]",
        "- **10점**: 모범 답안의 논리 구조와 전문 용어 사용이 100% 일치함.",
        "- **7~9점**: 핵심 내용은 포함되었으나, 문장 연결이 매끄럽지 않거나 일부 전문 용어가 누락됨.",
        "- **4~6점**: 논리는 맞으나 전문 용어 대신 일반 용어를 사용하였거나 설명이 다소 부족함.",
        "- **1~3점**: 핵심 개념 서술이 부족하고 내용이 모호함.",
        "",
        "[출력 형식]",
        "마크다운 없이 **순수 JSON 리스트**만 출력하시오.",
        "feedback 필드는 반드시 아래 마크다운 형식을 따라야 합니다:",
        "  - **⚠️ 부족한 점**: (냉철한 지적, 전문 용어 미사용, 논리적 비약 언급, 30자 이내)",
        "  - **👍 잘한 점**: (논리적 서술 및 전문 용어 활용 위주, 30자 이내)",
        "",
        "[{'id': 문제ID, 'score': 점수(0~10점으로 정수 단위), 'feedback': '마크다운 형식의 피드백 문자열'}]",
        "---"
    ];

    for (const item of items) {
        const keywordsStr = item.k ? item.k.join(', ') : '별도 지정 없음';
        promptLines.push(
            `ID: ${item.id}`,
            `문제: ${item.q}`,
            `모범 답안: ${item.m}`,
            `참고 설명: ${item.r || '없음'}`,
            `키워드 가이드: ${keywordsStr}`,
            `사용자 답안: ${item.a}`,
            `---`
        );
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: promptLines.join('\n'),
        config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
        },
    });

    const responseText = response.text || '';
    let text = responseText.trim();
    if (text.startsWith('```json')) text = text.substring(7);
    if (text.endsWith('```')) text = text.slice(0, -3);
    text = text.trim();

    const parseScore = (s: any) => {
        let fs = parseFloat(s);
        if (isNaN(fs)) return 0;
        return Math.max(0, Math.min(10, fs));
    };

    const regexMatch = text.match(/\[[^]*\]/);
    const sourceList = regexMatch ? JSON.parse(regexMatch[0]) : JSON.parse(text);
    const outputMap: { [id: number]: GradeResult } = {};
    for (const r of sourceList) {
        outputMap[Number(r.id)] = {
            score: parseScore(r.score),
            evaluation: r.feedback || '피드백 없음',
        };
    }
    return outputMap;
}

// ─── 답안 빌더 ─────────────────────────────────────

function buildBatchItems(mode: Mode): BatchItem[] {
    return FIXTURES.map((f, idx) => ({
        id: idx + 1,
        qid: f.qid,
        q: f.question,
        a: mode === 'strong' ? f.strongAnswer
         : mode === 'incomplete' ? f.incompleteAnswer
         : f.halfAnswer,
        m: f.modelAnswer,
        k: f.keywords,
        r: f.explanation,
    }));
}

// ─── 검증 로직 (CTA 패턴) ──────────────────────────

interface Check {
    name: string;
    passed: boolean;
    detail: string;
}

function verifyResults(results: { [id: number]: GradeResult }, mode: Mode, items: BatchItem[]): Check[] {
    const checks: Check[] = [];

    // 1. 응답 완전성: 모든 문제에 대한 결과가 있는지
    for (const item of items) {
        const has = item.id in results;
        checks.push({
            name: `응답 완전성: ID ${item.id}`,
            passed: has,
            detail: has ? '결과 존재' : '결과 누락!',
        });
    }

    // 2. 점수 범위: 모든 점수가 0~10 범위 내
    for (const [id, grade] of Object.entries(results)) {
        const inRange = grade.score >= 0 && grade.score <= 10;
        checks.push({
            name: `점수 범위: ID ${id}`,
            passed: inRange,
            detail: `score=${grade.score}`,
        });
    }

    // 3. evaluation 존재: 비어 있지 않은 문자열
    for (const [id, grade] of Object.entries(results)) {
        const hasEval = typeof grade.evaluation === 'string' && grade.evaluation.length > 0;
        checks.push({
            name: `피드백 존재: ID ${id}`,
            passed: hasEval,
            detail: hasEval ? `${grade.evaluation.substring(0, 50)}...` : 'evaluation 비어있음',
        });
    }

    // 4. 모드별 점수 기대치
    const scores = Object.values(results).map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (mode === 'strong') {
        // CTA 패턴: strong 답안은 평균 7점 이상 기대
        const passed = avgScore >= 7;
        checks.push({
            name: '모드 검증: strong 평균 ≥ 7',
            passed,
            detail: `평균=${avgScore.toFixed(2)}`,
        });
        // 개별 점수도 최소 5점 이상
        for (const [id, grade] of Object.entries(results)) {
            checks.push({
                name: `strong 개별 ≥ 5: ID ${id}`,
                passed: grade.score >= 5,
                detail: `score=${grade.score}`,
            });
        }
    } else if (mode === 'incomplete') {
        // 불완전한 답안은 평균 4점 이하 기대
        const passed = avgScore <= 4;
        checks.push({
            name: '모드 검증: incomplete 평균 ≤ 4',
            passed,
            detail: `평균=${avgScore.toFixed(2)}`,
        });
        // 개별 점수도 최대 5점 이하
        for (const [id, grade] of Object.entries(results)) {
            checks.push({
                name: `incomplete 개별 ≤ 5: ID ${id}`,
                passed: grade.score <= 5,
                detail: `score=${grade.score}`,
            });
        }
    } else if (mode === 'half') {
        // half 답안은 평균 4~7점 기대
        const passed = avgScore >= 4 && avgScore <= 7;
        checks.push({
            name: '모드 검증: half 평균 4~7',
            passed,
            detail: `평균=${avgScore.toFixed(2)}`,
        });
    }

    return checks;
}

// ─── 메인 실행 ─────────────────────────────────────

async function main() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('❌ GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.');
        console.error('   .env.local 파일에서 로드하려면:');
        console.error('   $env = Get-Content .env.local | ForEach-Object { $_.Trim() } | Where-Object { $_ -and !$_.StartsWith("#") }');
        console.error('   $env | ForEach-Object { $k,$v = $_.Split("=",2); [Environment]::SetEnvironmentVariable($k,$v,"Process") }');
        process.exit(1);
    }

    // CLI 인자로 모드 선택
    const args = process.argv.slice(2);
    const modeArg = args.find(a => a.startsWith('--mode'))?.split('=')[1]
        || args[args.indexOf('--mode') + 1]
        || 'all';

    const modes: Mode[] = modeArg === 'all'
        ? ['strong', 'incomplete', 'half']
        : [modeArg as Mode];

    console.log('═══════════════════════════════════════════════════');
    console.log('  audit_say 채점 통합 테스트 (CTA 패턴 적용)');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  대상 문제: ${FIXTURES.length}개`);
    console.log(`  실행 모드: ${modes.join(', ')}`);
    console.log(`  모델: gemini-3.1-flash-lite`);
    console.log('───────────────────────────────────────────────────\n');

    let totalChecks = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    for (const mode of modes) {
        console.log(`\n📋 [${mode.toUpperCase()} 모드 테스트]`);
        console.log('─'.repeat(50));

        const items = buildBatchItems(mode);
        console.log(`  답안 예시 (ID 1): "${items[0].a.substring(0, 60)}..."`);

        try {
            console.log('  ⏳ Gemini API 호출 중...');
            const results = await gradeBatch(items, apiKey);

            // 결과 출력
            console.log('\n  📊 채점 결과:');
            for (const [id, grade] of Object.entries(results)) {
                const fixture = FIXTURES[Number(id) - 1];
                console.log(`    ID ${id} [${fixture.label.substring(0, 30)}...]: ${grade.score}점`);
                console.log(`      ${grade.evaluation.substring(0, 100)}${grade.evaluation.length > 100 ? '...' : ''}`);
            }

            // 검증
            const checks = verifyResults(results, mode, items);
            console.log(`\n  ✅ 검증 결과 (${checks.length}개):`);

            for (const check of checks) {
                const icon = check.passed ? '✅' : '❌';
                console.log(`    ${icon} ${check.name}: ${check.detail}`);
                totalChecks++;
                if (check.passed) totalPassed++;
                else totalFailed++;
            }

        } catch (err: any) {
            console.error(`  ❌ API 호출 실패: ${err.message}`);
            totalChecks++;
            totalFailed++;
        }
    }

    // 최종 요약
    console.log('\n═══════════════════════════════════════════════════');
    console.log(`  최종 결과: ${totalPassed}/${totalChecks} PASS, ${totalFailed} FAIL`);
    console.log('═══════════════════════════════════════════════════');

    if (totalFailed > 0) {
        console.log('\n⚠️  실패한 검증이 있습니다. 위 결과를 확인하세요.');
        process.exit(1);
    } else {
        console.log('\n🎉 모든 검증 통과!');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('치명적 오류:', err);
    process.exit(1);
});
