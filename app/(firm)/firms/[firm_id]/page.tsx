import { notFound } from 'next/navigation';
import { getRegisteredFirm } from '../../../../lib/firm/queries';
import { MilestonePlaceholder } from '../../_components/MilestonePlaceholder';

export default async function FirmDetailPage({
    params,
}: {
    params: Promise<{ firm_id: string }>;
}) {
    const { firm_id } = await params;
    const firmId = Number(firm_id);
    if (!Number.isInteger(firmId) || firmId <= 0) notFound();

    const firm = await getRegisteredFirm(firmId);
    if (!firm) notFound();

    return (
        <section>
            <header className="mb-6 rounded-lg border border-card-border bg-card px-5 py-4">
                <h2 className="text-xl">{firm.firm_name}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                        <dt className="text-xs text-foreground/50">등록번호</dt>
                        <dd>{firm.registration_no ?? '미수집'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">군 구분</dt>
                        <dd>{firm.tier ?? '미수집'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">DART 코드</dt>
                        <dd>{firm.dart_corp_code ?? '미수집'}</dd>
                    </div>
                    <div>
                        <dt className="text-xs text-foreground/50">상태</dt>
                        <dd>{firm.status === 'active' ? '활성' : '폐업'}</dd>
                    </div>
                </dl>
            </header>

            <MilestonePlaceholder
                milestone="M3"
                title="포트폴리오 · 의견·KAM · 용역 · 인력 탭"
                description="M1 수집기가 engagement · 감사의견 · 재무 · 용역 · 인력 데이터를 적재하면 v_firm_summary와 v_firm_clients를 붙여 채웁니다."
            />
        </section>
    );
}
