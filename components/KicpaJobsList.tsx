import Link from 'next/link';
import { firmJobsHref, safeKicpaSourceUrl } from '../lib/kicpa/jobLinks';
import type { KicpaJobsResult } from '../lib/kicpa/types';

export default function KicpaJobsList({ result, firmName }: { result: KicpaJobsResult; firmName?: string }) {
    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-card-border bg-card p-4">
                <div className="min-w-0">
                    <p className="font-medium">받고 싶은 수습CPA 채용공고를 선택하세요.</p>
                    <p className="mt-1 text-sm text-foreground/65">채용 소식 설정에서 신청 상태를 확인할 수 있습니다.</p>
                </div>
                <Link href="/settings" className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white">
                    채용 소식 설정
                </Link>
            </div>

            {result.status === 'unavailable' ? (
                <div role="status" className="rounded-lg border border-dashed border-card-border px-5 py-10 text-center">
                    <p className="font-medium">채용공고를 준비하고 있습니다.</p>
                    <p className="mt-2 text-sm text-foreground/65">잠시 후 다시 확인해주세요.</p>
                </div>
            ) : result.jobs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-card-border px-5 py-10 text-center">
                    <p className="font-medium">{firmName ? `${firmName}의 등록된 채용공고가 아직 없습니다.` : '등록된 채용공고가 아직 없습니다.'}</p>
                    <p className="mt-2 text-sm text-foreground/65">새 공고가 확인되면 이곳에 표시됩니다.</p>
                </div>
            ) : (
                <>
                    <p className="text-sm text-foreground/65">최근 공고 {result.jobs.length}건 · 마감 여부와 지원 방법은 원문에서 확인해주세요.</p>
                    <ul className="space-y-3">
                        {result.jobs.map(job => {
                            const sourceUrl = safeKicpaSourceUrl(job.source_url);
                            const firmHref = !firmName ? firmJobsHref(job.firm_id) : null;
                            return (
                                <li key={`${job.board}:${job.id}`} id={`job-${job.board}-${encodeURIComponent(job.id)}`} className="scroll-mt-24 rounded-lg border border-card-border bg-card p-4 sm:p-5">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-foreground/65">
                                        <span className="rounded-md bg-foreground/5 px-2 py-1">{job.board === 'trainee_cpa' ? '수습CPA' : 'CPA'}</span>
                                        {job.company ? <span className="break-words">{job.company}</span> : null}
                                    </div>
                                    <h3 className="mt-3 break-words text-lg font-medium leading-relaxed">{job.title}</h3>
                                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                                        <div className="flex gap-2">
                                            <dt className="shrink-0 text-foreground/60">게시일</dt>
                                            <dd>{job.posted_at ? <time dateTime={job.posted_at}>{job.posted_at}</time> : '확인되지 않음'}</dd>
                                        </div>
                                        <div className="flex min-w-0 gap-2">
                                            <dt className="shrink-0 text-foreground/60">마감</dt>
                                            <dd className="break-words">{job.deadline?.trim() ? job.deadline : '원문 확인'}</dd>
                                        </div>
                                    </dl>
                                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                                        {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">KICPA 원문 보기 ↗</a>
                                            : <span className="py-3 text-foreground/60">원문 링크를 확인하고 있습니다.</span>}
                                        {firmHref ? <Link href={firmHref} className="inline-flex min-h-11 items-center text-foreground/70 hover:text-primary">이 법인의 채용공고 →</Link> : null}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
            {firmName ? <Link href="/jobs" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">전체 수습CPA 채용공고 보기 →</Link> : null}
        </div>
    );
}
