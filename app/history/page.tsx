import { learningDbEnabled } from '../../lib/learningSubmission';
import HistoryClient from './HistoryClient';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
    return <HistoryClient learningDbEnabled={learningDbEnabled()} />;
}
