import fs from 'node:fs';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import { loadPromotionLedger, publicationPaths, validateAuthoringBank, validatePromotionLedger } from './questionBankPublication.ts';

try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--authoring-only')) throw new Error('지원하는 옵션: --authoring-only');
    const authoringOnly = args.includes('--authoring-only');
    const paths = publicationPaths();
    const result = validateAuthoringBank(JSON.parse(fs.readFileSync(paths.authoring, 'utf8')));
    const errors = [...result.errors];
    if (!errors.length) errors.push(...validatePromotionLedger(result.sets, loadPromotionLedger(paths.ledger), !authoringOnly));
    if (!authoringOnly && !errors.length) {
        if (!fs.existsSync(paths.public)) errors.push(`public 파일이 없습니다: ${paths.public}`);
        else if (JSON.stringify(JSON.parse(fs.readFileSync(paths.public, 'utf8'))) !== JSON.stringify(result.sets.map(compilePublicQuestionSet))) {
            errors.push('public JSON이 authoring JSON의 최신 compile 결과와 다릅니다.');
        }
    }
    if (errors.length) throw new Error(`v3 검증 실패: ${errors.length}개 오류\n${errors.map((error) => `- ${error}`).join('\n')}`);
    console.log(`v3 ${authoringOnly ? '편집 정본 ' : ''}검증 통과: ${result.sets.length}세트, ${result.subquestionCount}개 세부 물음, ${result.criterionCount}개 criterion, 총 ${result.totalPoints}점`);
    console.log(authoringOnly
        ? '구조·출처·중복·커버리지·승급 장부 확인. 공개본 일치와 전체 게시 완료는 검사하지 않았습니다.'
        : '구조·출처·중복·커버리지·게시/검수·승급 장부 및 public 일치 확인.');
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
