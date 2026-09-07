import Link from 'next/link';
import { listRegisteredFirms } from '../../../lib/firm/queries';

export default async function FirmsPage() {
    const firms = await listRegisteredFirms();

    return (
        <section>
            <div className="mb-4 flex items-baseline justify-between gap-4">
                <h2 className="text-lg">등록회계법인 {firms.length}곳</h2>
                <p className="text-xs text-foreground/50">
                    등록번호·군 구분은 M1 수집기가 채웁니다
                </p>
            </div>

            {firms.length === 0 ? (
                <p className="rounded-lg border border-card-border bg-card px-6 py-10 text-center text-sm text-foreground/60">
                    등록된 회계법인이 없습니다.
                </p>
            ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {firms.map((firm) => (
                        <li key={firm.firm_id}>
                            <Link
                                href={`/firms/${firm.firm_id}`}
                                className="block rounded-lg border border-card-border bg-card px-4 py-3 transition-colors hover:border-primary"
                            >
                                <span className="block text-sm font-medium">{firm.firm_name}</span>
                                <span className="mt-0.5 block text-xs text-foreground/50">
                                    {firm.tier ?? '군 미상'} · 등록번호 {firm.registration_no ?? '미수집'}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
