import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { PublicLearningQuestionSetV3 } from './learningTypes';
import { buildLearningUnits, selectLearningQuestionSet } from './learningUnits';
import type { LearningClassification, LearningTopic } from './learningUnits';
import { findAuthoringQuestionSetV3 } from './questionV3Store';
import { contentHash } from './learningSubmission';

interface Catalog {
    source_file: string;
    source_file_sha256: string;
    public_content_hash: string;
    topics: LearningTopic[];
    classifications: LearningClassification[];
}
function readCatalog(): Catalog {
    const file = process.env.CPA_LEARNING_CLASSIFICATIONS_PATH
        ? path.resolve(process.env.CPA_LEARNING_CLASSIFICATIONS_PATH)
        : path.join(process.cwd(), 'cpa_uploader/data/learning-question-classifications.json');
    const catalog = JSON.parse(fs.readFileSync(file, 'utf8')) as Catalog;
    if (!Array.isArray(catalog.classifications) || !Array.isArray(catalog.topics)) throw new Error('물음 유형·주제 장부가 올바르지 않습니다.');
    // The metadata-only artifact may be deployed beside the encrypted bank. In development also verify raw source bytes.
    if (process.env.NODE_ENV !== 'production') {
        const source = path.resolve(process.cwd(), catalog.source_file);
        if (createHash('sha256').update(fs.readFileSync(source)).digest('hex') !== catalog.source_file_sha256) {
            throw new Error('물음 유형·주제 장부의 원본이 변경되었습니다.');
        }
    }
    return catalog;
}

export function loadFileLearningUnits(sets: PublicLearningQuestionSetV3[]): PublicLearningQuestionSetV3[] {
    const catalog = readCatalog();
    if (contentHash(sets) !== catalog.public_content_hash) throw new Error('공개 문제은행과 물음 분류 장부의 판본이 다릅니다.');
    return buildLearningUnits(sets, catalog.classifications, catalog.topics);
}

export function findFileLearningUnit(unitId: string) {
    const catalog = readCatalog();
    const entries = catalog.classifications.filter(entry => entry.question_style === 'case'
        ? `${entry.source_set_id}--case` === unitId : `${entry.source_set_id}--${entry.subquestion_id}--standard` === unitId);
    if (entries.length === 0) throw new Error('학습 물음을 찾을 수 없습니다.');
    const source = findAuthoringQuestionSetV3(entries[0].source_set_id);
    if (entries.some(entry => entry.source_content_hash !== contentHash(source))) throw new Error('채점 원본과 물음 분류 장부의 판본이 다릅니다.');
    return selectLearningQuestionSet(source, entries, unitId);
}
