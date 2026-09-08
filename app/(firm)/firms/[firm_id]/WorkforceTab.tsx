import type { FirmAnnualSummary } from '../../../../lib/firm/types';
import { formatKrw, formatNumber, formatRatio } from '../../../../lib/firm/format';
import { Basis, EmptyState, StatTile } from '../../_components/ui';

export default function WorkforceTab({ periods, year }: { periods: FirmAnnualSummary[]; year: number }) {
    return <>
        <h3 className="mb-2 text-lg font-medium">{year}년 시작 실적 · 회계법인 자체 인력·재무</h3>
        <Basis>실적은 보고기간 시작연도로 구분합니다. 감사대상회사 사업연도와 실제 감사대상 기간이 같다는 뜻은 아닙니다. 인원은 각 보고기간 말 기준이며, 1인당 인건비는 이사 등을 포함한 전체 임직원 인건비를 기말 인원으로 나눈 값입니다.</Basis>
        {periods.length > 1 ? <p className="mb-3 text-base">같은 연도에 시작한 보고기간이 {periods.length}개입니다. 실적을 합산하지 않고 기간별로 표시합니다.</p> : null}
        {periods.length ? <div className="space-y-8">{periods.map(current => <AnnualPeriodCard key={current.fy_end_date} current={current} />)}</div> : <EmptyState title="보고기간 정보 미확보" description="선택한 연도에 시작한 사업보고서가 아직 적재되지 않았거나 검토 보류 중입니다." />}
    </>;
}

function AnnualPeriodCard({ current }: { current: FirmAnnualSummary }) {
    const fields = [
        { label: '회계법인 전 임직원 수', value: current?.employee_total, format: (n: number) => formatNumber(n, '명') },
        { label: '회계법인 이사 수', value: current?.director_count, format: (n: number) => formatNumber(n, '명') },
        { label: '회계법인 자체 매출액', value: current?.revenue_total, format: formatKrw },
        { label: '회계법인 자체 영업이익', value: current?.operating_income, format: formatKrw },
        { label: '회계법인 1인당 매출액', value: current?.revenue_per_employee, format: formatKrw },
        { label: '임직원 1인당 인건비', value: current?.salary_per_employee, format: formatKrw },
        { label: '감사부문 매출 비중', value: current?.audit_revenue_ratio, format: formatRatio },
    ];
    return (
        <>
            <p className="mb-3 text-[13px]">{current.fy_seq ? `제${current.fy_seq}기 · ` : ''}대상 기간 {current.fy_start_date} ~ {current.fy_end_date} · 접수일 {current.source_rcept_dt} · <a href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${current.source_rcept_no}`} target="_blank" rel="noreferrer" className="underline">DART 원문</a></p>
            {current?.consistency_warnings.length ? <p className="mb-3 rounded border border-card-border p-3 text-base">이 공시에는 표 간 수치 차이 또는 검증할 수 없는 항목이 {current.consistency_warnings.length}건 있습니다. 원문 값을 보존했으므로 비교할 때 공시의 기준을 확인해 주세요.</p> : null}
            {!fields.some((field) => field.value != null) ? (
                <EmptyState title="수치 미확보" description="이 보고기간의 인력·재무 수치가 확인되지 않았습니다." />
            ) : (
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((field) => <StatTile key={field.label} label={field.label} value={field.value == null ? '-' : field.format(field.value)} hint={field.value == null ? '공시 값 미확보' : undefined} />)}
                </dl>
            )}
        </>
    );
}

