import Link from 'next/link';
import { listCompanies } from '../../../lib/firm/queries';
import { MARKET_LABEL } from '../../../lib/firm/types';

export default async function CompaniesPage() {
    const companies = await listCompanies();

    return (
        <section>
            <h2 className="mb-4 text-lg">감사대상회사 {companies.length}곳</h2>

            {companies.length === 0 ? (
                <p className="rounded-lg border border-card-border bg-card px-6 py-10 text-center text-sm text-foreground/60">
                    아직 적재된 회사가 없습니다. M1 수집기가 OpenDART에서 채웁니다.
                </p>
            ) : (
                <ul className="divide-y divide-card-border rounded-lg border border-card-border bg-card">
                    {companies.map((company) => (
                        <li key={company.corp_code}>
                            <Link
                                href={`/companies/${company.corp_code}`}
                                className="flex items-baseline justify-between gap-4 px-4 py-3 transition-colors hover:bg-background"
                            >
                                <span className="text-sm">{company.corp_name}</span>
                                <span className="text-xs text-foreground/50">
                                    {company.corp_cls ? MARKET_LABEL[company.corp_cls] : '미분류'}
                                    {company.induty ? ` · ${company.induty}` : ''}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
