import fs from 'node:fs';
import path from 'node:path';
import {
    compilePublicQuestionSet,
    computeQuestionSetMaxPoints,
    validateQuestionSetV3,
} from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

const root = process.cwd();
const authoringPath = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const publicPath = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.public.json');
const v2Path = path.join(root, 'cpa_uploader/data/cpa_problems_v2.json');
const allowedStandardsByTopic: Record<string, string[]> = {
    '01': ['KGA 200', 'KGA 220'],
    '02': ['KGA 200'],
    '03': ['KGA 210'],
    '04': ['KGA 230', 'KGA 300', 'KGA 320'],
    '05': ['KGA 240', 'KGA 250', 'KGA 260', 'KGA 265'],
    '06': ['KGA 315'],
    '07': ['KGA 330'],
    '08': ['KGA 500'],
    '09': ['KGA 501', 'KGA 505', 'KGA 510'],
    '10': ['KGA 520', 'KGA 530'],
    '11': ['KGA 540', 'KGA 550'],
    '12': ['KGA 450', 'KGA 560', 'KGA 570', 'KGA 580'],
    '13': ['KGA 402', 'KGA 610', 'KGA 620'],
    '14': ['KGA 600'],
    '15': ['KGA 700', 'KGA 705'],
    '16': ['KGA 701', 'KGA 706', 'KGA 710', 'KGA 720'],
    '17': ['KGA 1100'],
    '18': ['KGA 1200'],
    '19': [],
};

function normalize(value: string): string {
    return value.replace(/\s+/g, '').toLowerCase();
}

function readJson(file: string): unknown {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

function stableJson(value: unknown): string {
    return JSON.stringify(value);
}

function quoteBelongsToStandardSection(source: QuestionSetV3['source_refs'][number]): boolean {
    if (!source.page?.startsWith('KGA ')) return true;
    const file = path.resolve(root, source.file);
    if (!fs.existsSync(file)) return false;
    const content = fs.readFileSync(file, 'utf8');
    const headings = [...content.matchAll(/^#{1,3}\s+(KGA\s+\d+)(?:\s|:)/gmu)];
    return headings.some((heading, index) => {
        if (heading[1] !== source.page) return false;
        const sectionEnd = headings[index + 1]?.index ?? content.length;
        const section = content.slice(heading.index, sectionEnd);
        return normalize(section).includes(normalize(source.source_quote));
    });
}

function main(): void {
    if (!fs.existsSync(authoringPath)) throw new Error(`authoring 파일이 없습니다: ${authoringPath}`);
    const raw = readJson(authoringPath);
    if (!Array.isArray(raw)) throw new Error('v3 authoring 루트는 배열이어야 합니다.');

    const errors: string[] = [];
    const v2Seeds = fs.existsSync(v2Path) ? readJson(v2Path) : [];
    const oldPrompts = new Set(
        (Array.isArray(v2Seeds) ? v2Seeds : [])
            .map((item) => (
                typeof item === 'object' && item !== null
                    ? (item as Record<string, unknown>).question_description
                    : null
            ))
            .filter((prompt): prompt is string => typeof prompt === 'string')
            .map(normalize),
    );
    const ids = new Set<string>();
    const topicCounts = new Map<string, number>();
    const promptOwners = new Map<string, string>();
    const sourceQuoteOwners = new Map<string, string>();
    let subquestionCount = 0;
    let criterionCount = 0;
    let totalPoints = 0;

    for (const [index, value] of raw.entries()) {
        const result = validateQuestionSetV3(value, { verifySourceQuotes: true, cwd: root });
        const set = value as QuestionSetV3;
        if (result.errors.length > 0) {
            errors.push(...result.errors.map((error) => `[index ${index}, ${set.id || 'id 없음'}] ${error}`));
            continue;
        }
        if (ids.has(set.id)) errors.push(`중복 문제 세트 id: ${set.id}`);
        ids.add(set.id);
        const topicId = set.classification.topic_id;
        topicCounts.set(topicId, (topicCounts.get(topicId) ?? 0) + 1);
        if (set.subquestions.length < 2 || set.subquestions.length > 3) {
            errors.push(`${set.id}: linked set은 세부 물음 2~3개를 가져야 합니다.`);
        }
        const sourceStandards = [...new Set(
            set.source_refs
                .map((source) => source.page)
                .filter((page): page is string => Boolean(page?.startsWith('KGA '))),
        )].sort();
        const classifiedStandards = [...set.classification.standards].sort();
        if (stableJson(sourceStandards) !== stableJson(classifiedStandards)) {
            errors.push(`${set.id}: classification.standards와 실제 사용한 KGA source가 다릅니다.`);
        }
        const allowedStandards = new Set(allowedStandardsByTopic[set.classification.topic_id] || []);
        const outOfScopeStandards = sourceStandards.filter((standard) => !allowedStandards.has(standard));
        if (outOfScopeStandards.length > 0) {
            errors.push(`${set.id}: 주제 범위 밖 KGA source를 사용했습니다: ${outOfScopeStandards.join(', ')}`);
        }
        for (const source of set.source_refs) {
            if (!quoteBelongsToStandardSection(source)) {
                errors.push(`${set.id}/${source.id}: source_quote가 ${source.page || '지정된 기준서'} 구간에 존재하지 않습니다.`);
            }
            const sourceKey = normalize(source.source_quote);
            const existingOwner = sourceQuoteOwners.get(sourceKey);
            if (existingOwner) {
                errors.push(`${set.id}/${source.id}: source_quote가 ${existingOwner}와 중복됩니다.`);
            } else {
                sourceQuoteOwners.set(sourceKey, `${set.id}/${source.id}`);
            }
        }
        for (const subquestion of set.subquestions) {
            const promptKey = normalize(subquestion.prompt);
            const existingOwner = promptOwners.get(promptKey);
            if (existingOwner) {
                errors.push(`${set.id}/${subquestion.id}: 발문이 ${existingOwner}와 중복됩니다.`);
            } else {
                promptOwners.set(promptKey, `${set.id}/${subquestion.id}`);
            }
            if (oldPrompts.has(normalize(subquestion.prompt))) {
                errors.push(`${set.id}/${subquestion.id}: 기존 v2 발문을 그대로 재사용했습니다.`);
            }
            if (/계산하시오|산출하시오|금액을\s*구하시오/u.test(subquestion.prompt)) {
                errors.push(`${set.id}/${subquestion.id}: 계산형 발문은 파일럿 범위에서 제외됩니다.`);
            }
        }
        const setMaxPoints = computeQuestionSetMaxPoints(set);
        if (setMaxPoints > 8) {
            errors.push(`${set.id}: 세트 총점은 8점을 초과할 수 없지만 ${setMaxPoints}점입니다.`);
        }
        subquestionCount += set.subquestions.length;
        criterionCount += set.subquestions.reduce((sum, subquestion) => sum + subquestion.criteria.length, 0);
        totalPoints += setMaxPoints;
    }

    const expectedTopicCounts = new Map<string, number>([
        ['01', 2],
        ['02', 3],
        ['03', 2],
        ['04', 2],
        ['05', 3],
        ['06', 3],
        ['07', 2],
        ['08', 2],
        ['09', 2],
        ['10', 2],
        ['11', 2],
        ['12', 2],
        ['13', 2],
        ['14', 3],
        ['15', 3],
        ['16', 3],
        ['17', 2],
        ['18', 2],
        ['19', 3],
    ]);
    for (const [topicId, expectedCount] of expectedTopicCounts) {
        const actualCount = topicCounts.get(topicId) ?? 0;
        if (actualCount !== expectedCount) {
            errors.push(`topic_id ${topicId} 세트 수는 ${expectedCount}개여야 하지만 ${actualCount}개입니다.`);
        }
    }
    if (raw.length !== 45) errors.push(`파일럿 문제 세트는 45개여야 하지만 ${raw.length}개입니다.`);

    const compiled = (raw as QuestionSetV3[]).map(compilePublicQuestionSet);
    if (fs.existsSync(publicPath)) {
        const existingPublic = readJson(publicPath);
        if (stableJson(existingPublic) !== stableJson(compiled)) {
            errors.push('public JSON이 authoring JSON의 최신 compile 결과와 다릅니다.');
        }
    } else {
        errors.push(`public 파일이 없습니다: ${publicPath}`);
    }

    if (errors.length > 0) {
        console.error(`v3 검증 실패: ${errors.length}개 오류`);
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
        return;
    }

    console.log(`v3 검증 통과: ${raw.length}세트, ${subquestionCount}개 세부 물음, ${criterionCount}개 criterion, 총 ${totalPoints}점`);
    console.log('모든 source_quote가 원자료에 존재하며 public JSON에는 비공개 채점 데이터가 없습니다.');
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
