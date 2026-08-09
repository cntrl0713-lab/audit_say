import { loadPublicQuestionSetsV3 } from '../../lib/questionV3Store';
import QuizClient from './QuizClient';

export const dynamic = 'force-dynamic';

export default function QuizPage() {
    const questionSets = loadPublicQuestionSetsV3();
    return <QuizClient initialSets={questionSets} />;
}