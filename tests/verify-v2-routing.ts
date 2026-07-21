import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.ts';
import { hydrateModelAnswers, QuestionAnswerRow } from '../lib/quizGrading.ts';
import { BatchItem } from '../lib/serverUtils.ts';
import { validateRubric } from '../lib/rubric.ts';


// ─────────────────────────────────────────────
// 1. 환경 변수 수동 로드 폴백 (.env.local) 및 테스트 모드 활성화
// ─────────────────────────────────────────────
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
        console.log(`ℹ️ [verify-v2-routing] 환경 변수 수동 로드 완료: ${envPath}`);
    }
    // 테스트 환경임을 명시하여 auth check 바이패스 유도
    process.env.DANGEROUSLY_BYPASS_AUTH_FOR_TESTS = 'true';
}

async function run() {
    loadEnvLocal();

    const { fetchAllQuestions } = await import('../lib/db.ts');

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('❌ 에러: GEMINI_API_KEY 또는 GOOGLE_API_KEY 환경 변수가 제공되지 않았습니다.');
        process.exit(1);
    }

    console.log(`\n⚙️ v2 채점 라우팅, 유출 차단 및 E2E 서버 액션 검증 시작...`);

    const adminSupabase = getSupabaseAdmin();

    // ─────────────────────────────────────────────
    // [동적 ID 탐색] v1-only 및 v2 문항 ID 획득
    // ─────────────────────────────────────────────
    const { data: v1List } = await adminSupabase.from('cpa_questions').select('id');
    const { data: v2List } = await adminSupabase.from('cpa_questions_v2').select('id');

    if (!v1List || !v2List) {
        console.error('❌ 에러: 데이터베이스에서 질문 목록을 가져오지 못했습니다.');
        process.exit(1);
    }

    const v2Ids = new Set(v2List.map(item => item.id));
    const v1OnlyItem = v1List.find(item => !v2Ids.has(item.id));
    const v2TestId = v2List[0]?.id || 134; // 기본 v2 ID

    if (!v1OnlyItem) {
        console.error('❌ 에러: DB 내에 v1-only 문항이 존재하지 않습니다 (모든 문항이 v2화 됨).');
        process.exit(1);
    }
    const v1OnlyId = v1OnlyItem.id;

    console.log(`- 식별된 동적 검증 대상 v2 ID: ${v2TestId}`);
    console.log(`- 식별된 동적 검증 대상 v1-only ID: ${v1OnlyId}`);

    // ─────────────────────────────────────────────
    // [검증 1] v2 대상 문항 라우팅 검증
    // ─────────────────────────────────────────────
    console.log('\n============================================================');
    console.log(`🔍 [검증 1] v2 문항 (ID ${v2TestId}) 라우팅 테스트`);
    console.log('============================================================');

    const v1Res = await adminSupabase.from('cpa_questions').select('id, model_answer, keywords, explanation').eq('id', v2TestId).single();
    const v2Res = await adminSupabase.from('cpa_questions_v2').select('id, model_answer, rubric').eq('id', v2TestId).single();

    const testItemV2: BatchItem = {
        id: 1,
        qid: v2TestId,
        q: 'v2 테스트 질문',
        a: '낮은 보수 수임 시 안전장치...',
        m: '',
        k: [],
        r: ''
    };

    hydrateModelAnswers([testItemV2], [v1Res.data as any], [v2Res.data as any]);

    const v2ModelStr = v2Res.data!.model_answer.join('\n');
    if (testItemV2.m === v2ModelStr) {
        console.log('✅ PASS: 모범답안(m)이 v2의 model_answer와 일치합니다.');
    } else {
        console.error('❌ FAIL: 모범답안(m)이 v2 데이터와 일치하지 않습니다.');
    }

    if (testItemV2.r === JSON.stringify(v2Res.data!.rubric)) {
        console.log('✅ PASS: r 필드가 v2의 rubric JSON 문자열과 일치합니다.');
    } else {
        console.error('❌ FAIL: r 필드가 v2 rubric JSON과 일치하지 않습니다.');
    }

    // ─────────────────────────────────────────────
    // [검증 2] v1-only 대상 문항 동적 회귀 검증
    // ─────────────────────────────────────────────
    console.log('\n============================================================');
    console.log(`🔍 [검증 2] v1-only 문항 (ID ${v1OnlyId}) 동적 회귀 테스트 (무간섭 증명)`);
    console.log('============================================================');

    const v1ResOnly = await adminSupabase.from('cpa_questions').select('id, model_answer, keywords, explanation').eq('id', v1OnlyId).single();

    const testItemV1: BatchItem = {
        id: 2,
        qid: v1OnlyId,
        q: 'v1 테스트 질문',
        a: '답안지 내용...',
        m: '',
        k: [],
        r: ''
    };

    // v2 데이터를 전달하지 않고 hydrate 수행
    hydrateModelAnswers([testItemV1], [v1ResOnly.data as any], []);

    const v1ModelStr = Array.isArray(v1ResOnly.data!.model_answer) ? v1ResOnly.data!.model_answer.join('\n') : String(v1ResOnly.data!.model_answer || '');
    if (testItemV1.m === v1ModelStr) {
        console.log('✅ PASS: 모범답안(m)이 v1의 model_answer와 일치합니다.');
    } else {
        console.error('❌ FAIL: 모범답안(m)이 v1 데이터와 일치하지 않습니다.');
    }

    const expectedKeywords = Array.isArray(v1ResOnly.data!.keywords) 
        ? v1ResOnly.data!.keywords 
        : (typeof v1ResOnly.data!.keywords === 'string' ? JSON.parse(v1ResOnly.data!.keywords) : []);

    if (JSON.stringify(testItemV1.k) === JSON.stringify(expectedKeywords)) {
        console.log('✅ PASS: k 필드가 v1의 keywords와 정확히 일치합니다.');
    } else {
        console.error('❌ FAIL: k 필드가 v1 keywords와 일치하지 않습니다.');
    }

    if (testItemV1.r === (v1ResOnly.data!.explanation || '참고 설명 없음')) {
        console.log('✅ PASS: r 필드가 v1의 explanation과 일치합니다.');
    } else {
        console.error('❌ FAIL: r 필드가 v1 explanation과 일치하지 않습니다.');
    }

    // ─────────────────────────────────────────────
    // [검증 3] 깨진 rubric 폴백 검증
    // ─────────────────────────────────────────────
    console.log('\n============================================================');
    console.log('🔍 [검증 3] 깨진 rubric에 대한 v1 폴백 테스트');
    console.log('============================================================');

    const brokenV2Match = {
        id: v2TestId,
        model_answer: ['가짜 모범답안'],
        rubric: [
            {
                sub: 1,
                label: '깨진 루브릭',
                points: 5, // 총합 5점이라 validateRubric 에러
                mode: 'all',
                items: [{ id: '1-1', item: '항목 1', points: 5, variants: ['변형'] }]
            }
        ]
    };

    const fallbackTestItem: BatchItem = {
        id: 3,
        qid: v2TestId,
        q: '테스트 질문',
        a: '답안...',
        m: '',
        k: [],
        r: ''
    };

    console.log('(다음 경고 로그가 출력되어야 정상입니다:)');
    hydrateModelAnswers([fallbackTestItem], [v1Res.data as any], [brokenV2Match]);

    if (fallbackTestItem.m === stringifyModelAnswer(v1Res.data!.model_answer)) {
        console.log('✅ PASS: 깨진 루브릭이 있을 때 v1의 model_answer로 정상 폴백 수화되었습니다.');
    } else {
        console.error('❌ FAIL: 깨진 루브릭 검출 후 폴백되지 않고 오염되었습니다.');
    }

    // ─────────────────────────────────────────────
    // [검증 4] R6 정답 관련 필드(루브릭 variants) 유출 차단 검증
    // ─────────────────────────────────────────────
    console.log('\n============================================================');
    console.log('🔍 [검증 4] R6 루브릭 variants 유출 차단 검증 (fetchAllQuestions)');
    console.log('============================================================');

    const clientQuestions = await fetchAllQuestions(true);
    const clientV2Question = clientQuestions.find(q => q.id === v2TestId);

    if (clientV2Question) {
        const keywordsCount = clientV2Question.keywords ? clientV2Question.keywords.length : 0;
        console.log(`- fetchAllQuestions에서 로드된 v2 문항 (ID ${v2TestId})의 keywords 개수: ${keywordsCount}개`);
        if (keywordsCount === 0) {
            console.log('✅ PASS: v2 문항의 keywords 필드가 마스킹(빈 배열)되어 유출이 완벽히 차단되었습니다.');
        } else {
            console.error(`❌ FAIL: v2 문항의 keywords에 variants가 노출되고 있습니다: ${JSON.stringify(clientV2Question.keywords)}`);
        }
    } else {
        console.warn('⚠️ 경고: fetchAllQuestions 결과 내에서 테스트 대상 v2 문항을 찾을 수 없습니다.');
    }

    // ─────────────────────────────────────────────
    // [검증 5] 실제 서버 액션 gradeQuizBatch 직접 호출 통합 검증
    // ─────────────────────────────────────────────
    console.log('\n============================================================');
    console.log('🔍 [검증 5] 실제 서버 액션 gradeQuizBatch 직접 호출 통합 검증 (E2E)');
    console.log('============================================================');

    const { gradeQuizBatch } = await import('../app/actions.ts');
    
    // 134번 문제 전문에 대한 채점 요청 전송
    const testBatch: BatchItem[] = [{
        id: 0,
        qid: v2TestId,
        q: `${v2TestId}번 질문`,
        a: v2ModelStr, // 모범답안 전송해 10점 근처 획득 기대
        m: '',
        k: [],
        r: ''
    }];

    console.log('⏳ gradeQuizBatch 액션 호출 중...');
    const results = await gradeQuizBatch(testBatch);
    const resultObj = results[0];

    if (resultObj) {
        console.log(`- 채점 결과 획득 점수: ${resultObj.score}점`);
        console.log(`- 채점 결과 평가 내용: "${resultObj.evaluation.substring(0, 100)}..."`);
        console.log(`- 반환된 수화 모범답안 (model_answer) 검출 여부: ${resultObj.model_answer ? '있음' : '없음'}`);

        if (resultObj.score >= 9) {
            console.log('✅ PASS: gradeQuizBatch 서버 액션 통합 호출 성공 및 고득점 판정 획득!');
        } else {
            console.warn(`⚠️ 경고: 예상치보다 점수가 낮게 나왔습니다 (${resultObj.score}점). API 응답을 검토해 보세요.`);
        }
    } else {
        console.error('❌ FAIL: gradeQuizBatch 응답 데이터가 누락되었습니다.');
    }

    console.log('\n============================================================');
    console.log('🏁 모든 채점 라우팅, 유출 방지 및 서버 액션 E2E 검증 완료!');
    console.log('============================================================');
}

function stringifyModelAnswer(modelAnswer: any): string {
    if (Array.isArray(modelAnswer)) return modelAnswer.join('\n');
    return String(modelAnswer ?? '');
}

run().catch(err => {
    console.error('❌ 실행 중 에러 발생:', err);
    process.exit(1);
});
