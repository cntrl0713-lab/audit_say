import KicpaJobsList from '../../../../components/KicpaJobsList';
import { getKicpaJobs } from '../../../../lib/kicpa/jobs';

export default async function JobsTab({ firmId, firmName }: { firmId: number; firmName: string }) {
    const result = await getKicpaJobs(firmId);
    return <section aria-label="채용공고"><KicpaJobsList result={result} firmName={firmName} /></section>;
}
