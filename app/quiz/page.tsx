import { loadLearningQuestionSetsV3 } from '../../lib/questionV3Repository';
import { learningDbEnabled } from '../../lib/learningSubmission';
import QuizClient from './QuizClient';

export const dynamic = 'force-dynamic';

export default async function QuizPage() {
    const questionSets = await loadLearningQuestionSetsV3();
    return <QuizClient initialSets={questionSets} learningDbEnabled={learningDbEnabled()} />;
}
