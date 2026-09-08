import { learningDbEnabled } from '../../lib/learningSubmission';
import RankingClient from './RankingClient';

export const dynamic = 'force-dynamic';

export default function RankingPage() {
    return <RankingClient periodsEnabled={learningDbEnabled()} />;
}
