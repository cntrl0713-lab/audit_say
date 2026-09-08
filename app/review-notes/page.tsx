import { learningDbEnabled } from '../../lib/learningSubmission';
import ReviewNotesClient from './ReviewNotesClient';

export const dynamic = 'force-dynamic';

export default function ReviewNotesPage() {
    return <ReviewNotesClient learningDbEnabled={learningDbEnabled()} />;
}
