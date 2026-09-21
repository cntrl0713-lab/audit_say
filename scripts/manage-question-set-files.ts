import fs from 'node:fs';
import path from 'node:path';
import { publicationPaths, snapshotFile, withPublicationLock, writePublicationFiles } from '../cpa_uploader/questionBankPublication.ts';
import { buildBankFromSetFiles, checkSetFiles, listSetFiles, planSetFileWrites, setFileLayout, styleMap } from '../cpa_uploader/questionSetFiles.ts';
import type { ClassificationReviewDocument } from '../cpa_uploader/questionSetFiles.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

// 세트별 파일과 정본 파일을 맞추는 도구. 설계: docs/문항-세트별-파일-분리-설계.md
//   split  정본 파일을 세트 파일과 순서 파일로 한 번 나눈다(sets/가 이미 있으면 거절).
//   build  세트 파일과 순서 파일로 정본 파일을 다시 만든다(세트 파일을 직접 고친 뒤 실행).
//   check  세트 파일이 정본과 같은 바이트를 만들고 위치가 분류와 맞는지 확인한다(쓰기 없음, pre-commit 게이트).
const usage = '사용법: manage-question-set-files.ts <split|build|check>';

function relative(file: string): string {
    return path.relative(process.cwd(), file).split(path.sep).join('/');
}

function main(args: string[]): void {
    const [command, ...rest] = args;
    if (rest.length || !['split', 'build', 'check'].includes(command ?? '')) throw new Error(usage);
    const paths = publicationPaths();
    const layout = setFileLayout(paths.authoring);
    if (command === 'check') {
        const errors = checkSetFiles(layout);
        if (errors.length) throw new Error(`세트 파일 검사 실패: ${errors.length}개 오류\n${errors.map((error) => `- ${error}`).join('\n')}`);
        const built = buildBankFromSetFiles(layout);
        console.log(`세트 파일 검사 통과: ${built.sets.length}세트가 ${relative(layout.authoring)}과 같은 바이트를 만들고 위치가 분류와 맞습니다.`);
        return;
    }
    if (command === 'split') {
        // README.md만 있는 디렉터리는 아직 나뉘지 않은 상태다. 순서 파일이나 세트 파일이 하나라도 있으면 거절한다.
        if (fs.existsSync(layout.orderFile) || listSetFiles(layout).length) throw new Error(`이미 나뉘어 있습니다: ${relative(layout.directory)}. 정본을 바꿨으면 build가 아니라 정본을 쓰는 도구가 세트 파일을 함께 씁니다.`);
        if (!fs.existsSync(layout.classificationReview)) throw new Error(`분류 입력이 없습니다: ${relative(layout.classificationReview)}`);
        const document = fs.readFileSync(layout.authoring, 'utf8');
        const sets = JSON.parse(document) as QuestionSetV3[];
        const styles = styleMap(JSON.parse(fs.readFileSync(layout.classificationReview, 'utf8')) as ClassificationReviewDocument);
        const plan = planSetFileWrites(sets, styles, layout);
        withPublicationLock(paths.authoring, () => writePublicationFiles(plan.writes, [snapshotFile(layout.authoring), snapshotFile(layout.classificationReview)]));
        const rebuilt = buildBankFromSetFiles(layout);
        if (rebuilt.document !== document) throw new Error('나눈 세트 파일로 만든 문서가 정본과 다릅니다. 파일을 검토하십시오.');
        const counts = plan.placements.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.style]: (acc[item.style] ?? 0) + 1 }), {});
        console.log(`정본 ${sets.length}세트를 ${relative(layout.directory)}/ 아래로 나눴습니다(${Object.entries(counts).map(([style, count]) => `${style} ${count}`).join(', ')}). 정본 파일은 바꾸지 않았고 재생성 결과가 같은 바이트임을 확인했습니다.`);
        return;
    }
    // build
    const built = buildBankFromSetFiles(layout);
    const current = fs.existsSync(layout.authoring) ? fs.readFileSync(layout.authoring, 'utf8') : null;
    if (current === built.document) { console.log('정본 파일이 이미 세트 파일과 같습니다. 변경 없음.'); return; }
    const guards = [snapshotFile(layout.orderFile), ...built.files.map(snapshotFile)];
    // 세트 파일이 원천이므로 정본 쓰기에서 세트 파일을 다시 만들지 않는다.
    withPublicationLock(paths.authoring, () => writePublicationFiles([{ file: layout.authoring, content: built.document }], guards, { deriveSetFiles: false }));
    console.log(`정본 파일을 세트 파일 ${built.sets.length}개로 다시 만들었습니다: ${relative(layout.authoring)}`);
    for (const problem of checkSetFiles(layout)) console.log(`주의: ${problem}`);
    console.log('다음: npm run questions:v3:validate:authoring (승급 장부·공개본과의 일치는 별도 도구가 검사합니다)');
}

try { main(process.argv.slice(2)); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
