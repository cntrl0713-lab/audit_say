/**
 * Slice 3 — DB 데이터 품질 감사 스크립트 (Read-only)
 *
 * cpa_questions 테이블의 데이터를 전수조사하여
 * 키워드 설계 결함(키워드가 아예 없거나, 1개뿐이라 상시 0점이 되거나,
 * 모범답안 자체가 자기 키워드 필터를 통과하지 못하는 모순 행)을 분석합니다.
 */
import { getSupabaseAdmin } from '../lib/supabaseAdmin.ts';
import { calculateMatchedCount } from '../lib/utils.ts';

// 필터 요구량 공식
function getRequiredMin(kLength: number): number {
    return Math.max(2, Math.ceil(kLength * 0.3));
}

// 모범답안 문자열 변환 (@see quizGrading.ts)
function stringifyModelAnswer(modelAnswer: string | string[] | null | undefined): string {
    if (Array.isArray(modelAnswer)) return modelAnswer.join('\n');
    return String(modelAnswer ?? '');
}

async function runDbQualityAudit() {
    console.log('===================================================');
    console.log('   cpa_questions 테이블 데이터 품질 감사 리포트');
    console.log('===================================================');

    const adminSupabase = getSupabaseAdmin();
    const { data: questions, error } = await adminSupabase
        .from('cpa_questions')
        .select('id, part, chapter, question_title, model_answer, keywords');

    if (error || !questions) {
        console.error('❌ Supabase DB 데이터를 조회할 수 없습니다:', error?.message || '데이터 없음');
        process.exit(1);
    }

    console.log(`  총 조회된 문제 수: ${questions.length}개\n`);

    // 집계 변수들
    const keywordCountsDistribution: Record<number, number> = {};
    const zeroKeywordIds: number[] = [];
    const oneKeywordIds: number[] = [];
    const twoKeywordIds: number[] = [];
    const emptyKeywordRowIds: number[] = []; // 빈 문자열이나 공백-only 키워드를 가진 행
    const emptyModelAnswerIds: number[] = [];
    const selfInconsistencyRows: {
        id: number;
        title: string;
        kLength: number;
        requiredMin: number;
        matchedCount: number;
        keywords: string[];
        matchedKeywords: string[];
        unmatchedKeywords: string[];
    }[] = [];

    for (const q of questions) {
        const qid = Number(q.id);
        const keywords: string[] = Array.isArray(q.keywords) 
            ? q.keywords 
            : (q.keywords ? JSON.parse(q.keywords as any) : []);
        
        const kLength = keywords.length;

        // 1. 키워드 개수 분포 집계
        keywordCountsDistribution[kLength] = (keywordCountsDistribution[kLength] || 0) + 1;

        // 2. 키워드가 0, 1, 2개인 행 ID 탐색
        if (kLength === 0) zeroKeywordIds.push(qid);
        else if (kLength === 1) oneKeywordIds.push(qid);
        else if (kLength === 2) twoKeywordIds.push(qid);

        // 3. 빈 문자열 또는 공백만 있는 키워드 탐색
        const hasEmptyKeyword = keywords.some(k => !k || k.trim().length === 0);
        if (hasEmptyKeyword) {
            emptyKeywordRowIds.push(qid);
        }

        // 4. 빈 모범답안 탐색
        const rawModelAnswer = q.model_answer;
        const modelAnswerStr = stringifyModelAnswer(rawModelAnswer).trim();
        if (!modelAnswerStr) {
            emptyModelAnswerIds.push(qid);
        }

        // 5. 자기일관성 검사 (Self-consistency check)
        // 모범답안(m)을 사용자 답안으로 제출했을 때 자기 키워드 임계값 필터를 통과하는지 검증
        if (kLength > 0 && modelAnswerStr) {
            const matchedCount = calculateMatchedCount(modelAnswerStr, keywords);
            const requiredMin = getRequiredMin(kLength);

            if (matchedCount < requiredMin) {
                // 어떤 키워드가 매칭되었고 매칭되지 않았는지 추출
                const userAnsNorm = modelAnswerStr.replace(/\s+/g, '').toLowerCase();
                const matchedKeywords: string[] = [];
                const unmatchedKeywords: string[] = [];

                for (const k of keywords) {
                    const kNorm = k.replace(/\s+/g, '').toLowerCase();
                    if (userAnsNorm.includes(kNorm)) {
                        matchedKeywords.push(k);
                    } else {
                        unmatchedKeywords.push(k);
                    }
                }

                selfInconsistencyRows.push({
                    id: qid,
                    title: q.question_title || '제목 없음',
                    kLength,
                    requiredMin,
                    matchedCount,
                    keywords,
                    matchedKeywords,
                    unmatchedKeywords
                });
            }
        }
    }

    // ──────────────── 리포트 출력 ────────────────

    console.log('📊 1. 키워드 개수별 문항 분포');
    console.log('---------------------------------------------------');
    Object.keys(keywordCountsDistribution)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(kNum => {
            console.log(`  • 키워드 ${kNum}개 문항: ${keywordCountsDistribution[kNum]}개`);
        });
    console.log();

    console.log('🚨 2. 결함 가능 키워드 문항 목록');
    console.log('---------------------------------------------------');
    console.log(`  • 키워드 0개 문항 (${zeroKeywordIds.length}개): [ ${zeroKeywordIds.join(', ') || '없음'} ]`);
    console.log(`    *(설명: 룰 필터가 완전히 우회되어 LLM 검증만 받게 됩니다.)`);
    console.log(`  • 키워드 1개 문항 (${oneKeywordIds.length}개): [ ${oneKeywordIds.join(', ') || '없음'} ]`);
    console.log(`    *(결함: requiredMin=2에 도달할 수 없어 정답을 제출해도 무조건 0점 처리됩니다.)`);
    console.log(`  • 키워드 2개 문항 (${twoKeywordIds.length}개): [ ${twoKeywordIds.join(', ') || '없음'} ]`);
    console.log(`    *(특징: requiredMin=2가 되어 100% 모든 키워드가 정확히 일치해야 합니다.)`);
    console.log();

    console.log('⚠️ 3. 비정상 데이터 검출');
    console.log('---------------------------------------------------');
    console.log(`  • 빈 문자열/공백 포함 키워드 문항 (${emptyKeywordRowIds.length}개): [ ${emptyKeywordRowIds.join(', ') || '없음'} ]`);
    console.log(`  • 모범답안 누락/빈 값 문항 (${emptyModelAnswerIds.length}개): [ ${emptyModelAnswerIds.join(', ') || '없음'} ]`);
    console.log();

    console.log('❌ 4. 자기일관성 결함 문항 (자기 모범답안으로도 0점 처리되는 심각한 오류)');
    console.log('---------------------------------------------------');
    if (selfInconsistencyRows.length === 0) {
        console.log('  🎉 자기일관성을 위반하는 문항이 없습니다. (모범답안 제출 시 모두 패스)');
    } else {
        console.log(`  🔥 총 ${selfInconsistencyRows.length}개의 문항이 자기일관성을 위반하여 '정답 제출 시 0점' 결함을 가집니다:\n`);
        selfInconsistencyRows.forEach(row => {
            console.log(`  [문항 ID ${row.id}] 제목: "${row.title}"`);
            console.log(`    - 키워드 총수: ${row.kLength}개 (요구 통과치: 최소 ${row.requiredMin}개)`);
            console.log(`    - 모범답안 실제 매칭 수: ${row.matchedCount}개`);
            console.log(`    - 전체 키워드: ${JSON.stringify(row.keywords)}`);
            console.log(`    - 매칭된 키워드: ${JSON.stringify(row.matchedKeywords)}`);
            console.log(`    - 매칭 안된 키워드: ${JSON.stringify(row.unmatchedKeywords)}`);
            console.log('    -----------------------------------------------');
        });
    }
    console.log('===================================================');
}

runDbQualityAudit().catch(err => {
    console.error('품질 감사 중 오류 발생:', err);
    process.exit(1);
});
