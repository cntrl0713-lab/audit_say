import { notFound } from 'next/navigation';
import { getCompany } from '../../../../lib/firm/queries';
import { MARKET_LABEL } from '../../../../lib/firm/types';
import { MilestonePlaceholder } from '../../_components/MilestonePlaceholder';

export default async function CompanyDetailPage({
    params,
}: {
    params: Promise<{ corp_code: string }>;
}) {
    const { corp_code } = await params;
    // DART corp_code 는 8자리 숫자다. 형식이 아니면 조회 없이 404.
    if (!/^\d{8}$/.test(corp_code)) notFound();

    const company = await getCompany(corp_code);
    if (!company) notFound();

    return (
        <section>
            <header className="mb-6 rounded-lg border border-card-border bg-card px-5 py-4">
                <h2 className="text-xl">{company.corp_name}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                        <dt className="text-xs text-foreground/50">시장</dt>
                        <dd>{company.corp_cls ? MARKET_LABEL[company.corp_cls] : '미분류'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">종목코드</dt>
                        <dd>{company.stock_code ?? '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">상장 여부</dt>
                        <dd>{company.listed_yn ? '상장' : '비상장'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">업종</dt>
                        <dd>{company.induty ?? '-'}</dd>
                    </div>
                </dl>
            </header>

            <MilestonePlaceholder
                milestone="M3"
                title="재무 3지표 · 감사 이력 · KAM"
                description="v_firm_company_audit_history와 v_firm_kam을 붙여 감사인 변천과 의견 변화를 보여줍니다."
            />
        </section>
    );
}
