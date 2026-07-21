/**
 * v2 문제의 model_answer 배열로부터 각 sub 번호별 모범답안 텍스트를 분리하여 매핑합니다.
 * @param modelAnswer 모범답안 문자열 배열
 * @returns 각 sub 번호를 key로, 해당 sub의 모범답안 병합 텍스트를 value로 가지는 객체
 */
export function splitModelAnswerBySub(modelAnswer: string[]): { [subNum: number]: string } {
    const subAnswers: { [subNum: number]: string } = {};
    let currentSubNum = 1;

    modelAnswer.forEach((ans: string) => {
        // 문두가 숫자 + "." 인 패턴 탐색 (예: "1. 낮은 보수...", "2. 제2의견...")
        const match = ans.trim().match(/^(\d+)\./);
        if (match) {
            currentSubNum = parseInt(match[1], 10);
        }
        if (!subAnswers[currentSubNum]) {
            subAnswers[currentSubNum] = '';
        }
        subAnswers[currentSubNum] += (ans + '\n');
    });

    // 각 결과 문자열의 양끝 공백 정리
    Object.keys(subAnswers).forEach(key => {
        const k = parseInt(key, 10);
        subAnswers[k] = subAnswers[k].trim();
    });

    return subAnswers;
}
