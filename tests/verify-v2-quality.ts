import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.ts';
import { validateCpaQuestionV2 } from '../lib/rubric.ts';
import { calculateBigramJaccard } from '../lib/utils.ts';
import { splitModelAnswerBySub } from './lib/subSplit.ts';


// ─────────────────────────────────────────────
// 1. 환경 변수 수동 로드 폴백 (.env.local)
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
        console.log(`ℹ️ [verify-v2-quality] 환경 변수 수동 로드 완료: ${envPath}`);
    }
}

// ─────────────────────────────────────────────
// 2. 검증 스크립트 핵심 로직
// ─────────────────────────────────────────────
async function run() {
    loadEnvLocal();

    const targetId = parseInt(process.argv[2] || '134', 10);
    console.log(`⚙️ 문제 ${targetId} 파일럿 종합 테스트 시작...`);

    const jsonPath = path.resolve(process.cwd(), 'cpa_uploader/data/cpa_problems_v2.json');
    if (!fs.existsSync(jsonPath)) {
        console.error(`❌ 에러: 로컬 JSON 파일을 찾을 수 없습니다: ${jsonPath}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const allProblems: any[] = JSON.parse(rawData);
    const targetLocal = allProblems.find(p => p.id === targetId);

    if (!targetLocal) {
        console.error(`❌ 에러: 로컬 JSON 파일 내에서 ID ${targetId} 문항을 찾을 수 없습니다.`);
        process.exit(1);
    }

    console.log('\n============================================================');
    console.log('🔍 [R1] validateCpaQuestionV2 + validateRubric 로컬 검증');
    console.log('============================================================');
    const localValidationErrors = validateCpaQuestionV2(targetLocal);
    if (localValidationErrors.length === 0) {
        console.log('✅ 로컬 스키마 및 루브릭 정합성 통과!');
    } else {
        console.error('❌ 로컬 스펙 검증 실패:', localValidationErrors);
    }

    // DB 연동
    const supabase = getSupabaseAdmin();
    console.log('\nSupabase DB에서 데이터를 읽어옵니다...');
    
    // v2 조회
    const { data: dbV2, error: errV2 } = await supabase
        .from('cpa_questions_v2')
        .select('*')
        .eq('id', targetId)
        .single();

    if (errV2 || !dbV2) {
        console.error(`❌ 에러: DB cpa_questions_v2에서 ID ${targetId} 조회 실패:`, errV2?.message);
        process.exit(1);
    }

    // DB 정합성 및 로컬 파일 교차 검증
    console.log('DB v2 레코드 검증 진행 중...');
    const dbValidationErrors = validateCpaQuestionV2(dbV2);
    if (dbValidationErrors.length === 0) {
        console.log('✅ DB v2 스키마 및 루브릭 정합성 통과!');
    } else {
        console.error('❌ DB v2 스펙 검증 실패:', dbValidationErrors);
    }

    // 로컬과 DB 데이터 일치성 검증 (Assumptions.A3)
    const localQuestionDesc = targetLocal.question_description.replace(/\s+/g, '');
    const dbQuestionDesc = dbV2.question_description.replace(/\s+/g, '');
    if (localQuestionDesc === dbQuestionDesc) {
        console.log('✅ [A3] 로컬 JSON과 DB v2 레코드 일치 확인!');
    } else {
        console.warn('⚠️ 경고: 로컬 JSON과 DB v2 레코드 간의 텍스트가 일치하지 않습니다.');
    }

    console.log('\n============================================================');
    console.log('🔍 [R2] 물음 정합 검증 (번호 개수 vs 루브릭 Sub 개수)');
    console.log('============================================================');
    // 문제 설명에서 "1.", "2." 등의 번호 매칭
    const fullDesc = targetLocal.question_description;
    const matchedNumbers = Array.from(
        fullDesc.matchAll(/(?:^|[\s,])(\d+)\.\s?[^\d]/g)
    ).map((m: any) => m[1]);
        
    const descQuestionCount = matchedNumbers.length;
    const rubricSubCount = targetLocal.rubric.length;
    console.log(`- 설명 문두 질문 개수: ${descQuestionCount}개 (${matchedNumbers.join(', ')}번 물음 식별됨)`);
    console.log(`- 루브릭 Sub 개수: ${rubricSubCount}개`);

    if (descQuestionCount === rubricSubCount) {
        console.log('✅ 질문 번호 개수와 루브릭 Sub 개수가 일치합니다.');
    } else {
        console.error(`❌ 불합치: 문제 설명의 질문 개수(${descQuestionCount}) != 루브릭 Sub 개수(${rubricSubCount})`);
    }

    // 배점 합산 검증
    let rubricPointsSum = 0;
    targetLocal.rubric.forEach((sub: any) => {
        rubricPointsSum += sub.points;
    });
    console.log(`- 루브릭 총 배점 합계: ${rubricPointsSum}점`);
    if (Math.abs(rubricPointsSum - 10) < 1e-9) {
        console.log('✅ 총 배점 10점 만족!');
    } else {
        console.error(`❌ 배점 오류: 배점 합계가 ${rubricPointsSum}점입니다 (10점이어야 함)`);
    }

    console.log('\n============================================================');
    console.log('🔍 [R3] 자기 커버리지 검증');
    console.log('============================================================');
    // 모범답안 전문 정규화 (공백/줄바꿈 제거)
    const normalizedModelAnswer = targetLocal.model_answer.join('').replace(/\s+/g, '').toLowerCase();
    
    let allCovered = true;
    targetLocal.rubric.forEach((sub: any) => {
        console.log(`* Sub ${sub.sub} (${sub.label}) 검증:`);
        sub.items.forEach((item: any) => {
            const matchedVariant = item.variants.find((v: string) => {
                const normV = v.replace(/\s+/g, '').toLowerCase();
                return normalizedModelAnswer.includes(normV);
            });

            if (matchedVariant) {
                console.log(`  - [정상] Item ${item.id} ("${item.item.substring(0, 30)}...") ➡️ 매칭 variant: "${matchedVariant}"`);
            } else {
                allCovered = false;
                console.error(`  - [미달] Item ${item.id} ("${item.item.substring(0, 30)}...") ➡️ 모범답안에 매칭되는 variant가 없습니다!`);
            }
        });
    });

    if (allCovered) {
        console.log('✅ 모든 루브릭 아이템이 모범답안 내에 정상 커버되었습니다 (자기 커버리지 100%).');
    }

    console.log('\n============================================================');
    console.log('🔍 [R4] 교차 오염 정량화 (물음 간 키워드 오염 분석)');
    console.log('============================================================');
    // 각 sub 별 모범답안 텍스트 영역 동적 추출
    const subAnswers = splitModelAnswerBySub(targetLocal.model_answer);

    // 물음 1만 및 물음 2만 필터 테스트용으로 안전하게 백업
    const answer1 = subAnswers[1] || '';
    const answer2 = subAnswers[2] || '';

    // 교차 오염 계산
    targetLocal.rubric.forEach((sub: any) => {
        const subNum = sub.sub;
        
        // 이 subNum이 아닌 다른 subNum의 텍스트 영역들
        const otherTexts: string[] = [];
        Object.keys(subAnswers).forEach(key => {
            const k = parseInt(key, 10);
            if (k !== subNum) {
                otherTexts.push(subAnswers[k]);
            }
        });
        const otherTextCombined = otherTexts.join('').replace(/\s+/g, '').toLowerCase();

        console.log(`* 물음 ${subNum} 루브릭의 variants 중 다른 물음 모범답안에 포함되는 항목 리스트:`);
        let count = 0;
        sub.items.forEach((item: any) => {
            const matched = item.variants.filter((v: string) => {
                const normV = v.replace(/\s+/g, '').toLowerCase();
                return otherTextCombined.includes(normV);
            });
            if (matched.length > 0) {
                count++;
                console.log(`  - Item ${item.id}: 매칭된 variants ➡️ ${JSON.stringify(matched)}`);
            }
        });
        console.log(`➡️ 총 오염도: ${count}/${sub.items.length}개 항목 매칭됨\n`);
    });


    console.log('\n============================================================');
    console.log('🔍 [R5] 범용어 variants 리포트 (전체 v2 문항 대상)');
    console.log('============================================================');
    const wordCounts: { [word: string]: Set<number> } = {};

    allProblems.forEach(p => {
        p.rubric.forEach((sub: any) => {
            sub.items.forEach((item: any) => {
                item.variants.forEach((v: string) => {
                    const cleanWord = v.replace(/\s+/g, '').toLowerCase();
                    if (cleanWord.length >= 2) {
                        if (!wordCounts[cleanWord]) {
                            wordCounts[cleanWord] = new Set<number>();
                        }
                        wordCounts[cleanWord].add(p.id);
                    }
                });
            });
        });
    });

    const crossProblemWords = Object.keys(wordCounts)
        .map(word => ({
            word,
            problems: Array.from(wordCounts[word]),
            count: wordCounts[word].size
        }))
        .filter(w => w.count > 1)
        .sort((a, b) => b.count - a.count);

    console.log('여러 문항에서 공통적으로 반복 등장하는 variants 상위 15개:');
    crossProblemWords.slice(0, 15).forEach((w, idx) => {
        console.log(`  ${idx + 1}. "${w.word}" ➡️ ${w.count}개 문항에서 발견 (문항 ID: ${w.problems.join(', ')})`);
    });

    console.log('\n============================================================');
    console.log('🔍 [R6] 신구 대조 (v1 vs v2 Jaccard 유사도 분석)');
    console.log('============================================================');
    // v1 조회
    const { data: dbV1, error: errV1 } = await supabase
        .from('cpa_questions')
        .select('*')
        .eq('id', targetId)
        .single();

    if (errV1 || !dbV1) {
        console.warn(`⚠️ 경고: DB cpa_questions(v1)에서 ID ${targetId} 조회에 실패했습니다. Jaccard 비교를 건너뜁니다: ${errV1?.message}`);
    } else {
        const descJaccard = calculateBigramJaccard(dbV1.question_description, targetLocal.question_description);
        
        // model_answer 들을 join
        const v1ModelStr = Array.isArray(dbV1.model_answer) ? dbV1.model_answer.join('') : (dbV1.model_answer || '');
        const v2ModelStr = targetLocal.model_answer.join('');
        const modelJaccard = calculateBigramJaccard(v1ModelStr, v2ModelStr);

        console.log(`- 문제 설명(question_description) Bigram Jaccard 유사도: ${descJaccard.toFixed(4)}`);
        console.log(`- 모범 답안(model_answer) Bigram Jaccard 유사도: ${modelJaccard.toFixed(4)}`);

        if (descJaccard > 0.95 && modelJaccard > 0.95) {
            console.log('✅ 신구 버전 간 텍스트 원형 보존율이 매우 높습니다 (원형 보존 통과).');
        } else {
            console.warn('⚠️ 주의: 신구 버전 간 텍스트 변형이 감지되었습니다. 의도적인 개정인지 확인이 필요합니다.');
        }
    }

    console.log('\n============================================================');
    console.log('🔍 [R7] 필터 시뮬레이션 (4종 시나리오 통과 여부)');
    console.log('============================================================');
    // variants 키워드 풀 구성
    const collectKeywords = (subNum?: number): string[] => {
        const keywords: string[] = [];
        targetLocal.rubric.forEach((sub: any) => {
            if (subNum === undefined || sub.sub === subNum) {
                sub.items.forEach((item: any) => {
                    item.variants.forEach((v: string) => {
                        keywords.push(v);
                    });
                });
            }
        });
        return Array.from(new Set(keywords));
    };

    const allKeywords = collectKeywords();
    


    // 시뮬레이션용 입력 4종 정의
    const inputs = [
        {
            name: '① 모범답안 전문',
            text: targetLocal.model_answer.join('\n')
        },
        {
            name: '② 물음 1 부분 답안 (1만 입력)',
            text: answer1
        },
        {
            name: '③ 물음 2 부분 답안 (2만 입력)',
            text: answer2
        },
        {
            name: '④ 무관 텍스트 (다른 챕터 주제)',
            text: '성공보수 조건으로 인증업무나 비인증업무를 수임할 때 위협받는 윤리강령은 공정성이며 수임 조건에 따른 안전장치를 서면동의와 검토 등으로 마련하여야 한다.'
        }
    ];

    console.log(`(사용된 키워드 풀 개수: ${allKeywords.length}개)`);
    inputs.forEach(inp => {
        const userNorm = inp.text.replace(/\s+/g, '').toLowerCase();
        const matchedList = allKeywords.filter(kw => {
            const kwNorm = kw.replace(/\s+/g, '').toLowerCase();
            return userNorm.includes(kwNorm);
        });
        const matchCount = matchedList.length;
        const jaccardScore = calculateBigramJaccard(inp.text, targetLocal.model_answer.join('\n'));
        const pass = matchCount > 0 || jaccardScore >= 0.15;

        console.log(`\n* 입력: ${inp.name}`);
        console.log(`  - 매칭 키워드 수: ${matchCount}개`);
        console.log(`  - 매칭된 variants: ${JSON.stringify(matchedList)}`);
        console.log(`  - 모범답안과의 Jaccard 유사도: ${jaccardScore.toFixed(4)}`);
        console.log(`  - 사전 필터 통과 판정: ${pass ? '🟢 PASS (채점 진행)' : '🔴 BLOCK (0점 즉시 확정)'}`);
    });

    console.log('\n============================================================');
    console.log('🏁 문제 134 파일럿 데이터 검증 완료!');
    console.log('============================================================');
}

run().catch(err => {
    console.error('❌ 실행 중 에러 발생:', err);
    process.exit(1);
});
