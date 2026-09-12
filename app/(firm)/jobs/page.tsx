import type { Metadata } from 'next';
import KicpaJobsList from '../../../components/KicpaJobsList';
import { getKicpaJobs } from '../../../lib/kicpa/jobs';

export const metadata: Metadata = {
    title: '수습CPA 채용공고 | Audit Say',
    description: '한국공인회계사회에 올라온 수습·신입 CPA 채용공고를 확인하고 채용 소식 수신을 설정하세요.',
};

export default async function JobsPage() {
    const result = await getKicpaJobs();
    return (
        <section className="mx-auto w-full max-w-4xl">
            <header className="mb-6">
                <h2 className="text-xl sm:text-2xl">수습CPA 채용공고</h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/65">한국공인회계사회의 수습CPA 공고와 CPA 게시판의 수습·신입 공고를 모았습니다.</p>
            </header>
            <KicpaJobsList result={result} />
        </section>
    );
}
