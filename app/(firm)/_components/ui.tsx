import Link from 'next/link';
import type { AuditOpinion } from '../../../lib/firm/types';

/** 숫자 하나를 크게 보여 주는 타일. 결측은 "-" 로 두고 단위를 붙이지 않는다. */
export function StatTile({
    label,
    value,
    hint,
}: {
    label: string;
    value: string;
    hint?: string;
}) {
    return (
        <div className="rounded-lg border border-card-border bg-card px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                {label}
            </dt>
            <dd className="mt-1 text-xl tabular-nums">{value}</dd>
            {hint ? <p className="mt-0.5 text-xs text-foreground/50">{hint}</p> : null}
        </div>
    );
}

const OPINION_TONE: Record<AuditOpinion, string> = {
    적정: 'border-success/30 text-success',
    한정: 'border-primary/40 text-primary',
    부적정: 'border-danger/40 text-danger',
    의견거절: 'border-danger/40 text-danger',
};

/** 감사의견 배지. 적정이 아닌 의견은 눈에 띄어야 한다 — 그게 이 화면을 보는 이유다. */
export function OpinionBadge({ opinion }: { opinion: AuditOpinion | null }) {
    if (!opinion) {
        return <span className="text-xs text-foreground/40">미상</span>;
    }
    return (
        <span
            className={`inline-block rounded-full border px-2 py-0.5 text-xs ${OPINION_TONE[opinion]}`}
        >
            {opinion}
        </span>
    );
}

export function Chip({
    href,
    active,
    children,
}: {
    href: string;
    active: boolean;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            aria-current={active ? 'true' : undefined}
            className={`inline-block whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                    ? 'border-primary bg-primary text-white'
                    : 'border-card-border bg-card text-foreground/70 hover:border-primary/50'
            }`}
        >
            {children}
        </Link>
    );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
    return (
        <div className="rounded-lg border border-dashed border-card-border bg-card px-6 py-10 text-center">
            <p className="text-sm">{title}</p>
            {description ? (
                <p className="mt-1.5 text-xs text-foreground/60">{description}</p>
            ) : null}
        </div>
    );
}

/**
 * 데이터가 아직 하나도 없을 때. "비어 있음"과 "아직 수집 전"은 다른 상태이고,
 * 사용자가 필터를 잘못 걸었다고 오해하지 않도록 구분해서 알린다.
 */
export function NotCollectedNotice({ what }: { what: string }) {
    return (
        <div className="rounded-lg border border-dashed border-card-border bg-card px-6 py-10 text-center">
            <span className="inline-block rounded-full border border-card-border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                데이터 미확보
            </span>
            <p className="mt-3 text-sm">{what} 데이터가 아직 없습니다.</p>
            <p className="mt-1.5 text-xs text-foreground/60">
                API 조회 결과가 없거나 감사인 식별이 보류된 경우일 수 있습니다. 실제 고객사가 0곳이라는 뜻은 아닙니다.
            </p>
        </div>
    );
}

export function Pagination({
    page,
    pageCount,
    hrefFor,
}: {
    page: number;
    pageCount: number;
    hrefFor: (page: number) => string;
}) {
    if (pageCount <= 1) return null;

    // 현재 페이지 주변만 보여 준다. 수백 페이지짜리 번호줄은 쓸모가 없다.
    const start = Math.max(1, Math.min(page - 2, pageCount - 4));
    const end = Math.min(pageCount, start + 4);
    const pages: number[] = [];
    for (let i = start; i <= end; i += 1) pages.push(i);

    return (
        <nav className="mt-4 flex items-center justify-center gap-1" aria-label="페이지">
            {page > 1 ? (
                <Link
                    href={hrefFor(page - 1)}
                    className="rounded border border-card-border px-2.5 py-1 text-xs hover:border-primary"
                >
                    이전
                </Link>
            ) : null}

            {pages.map((n) => (
                <Link
                    key={n}
                    href={hrefFor(n)}
                    aria-current={n === page ? 'page' : undefined}
                    className={`rounded border px-2.5 py-1 text-xs tabular-nums ${
                        n === page
                            ? 'border-primary bg-primary text-white'
                            : 'border-card-border hover:border-primary'
                    }`}
                >
                    {n}
                </Link>
            ))}

            {page < pageCount ? (
                <Link
                    href={hrefFor(page + 1)}
                    className="rounded border border-card-border px-2.5 py-1 text-xs hover:border-primary"
                >
                    다음
                </Link>
            ) : null}
        </nav>
    );
}

/**
 * 검색 상자. 평범한 GET 폼이라 자바스크립트 없이도 동작한다.
 * hidden 필드로 나머지 필터를 실어 보내 검색해도 필터가 풀리지 않게 한다.
 */
export function SearchForm({
    action,
    defaultValue,
    placeholder,
    hidden,
}: {
    action: string;
    defaultValue?: string;
    placeholder: string;
    hidden?: Record<string, string>;
}) {
    return (
        <form action={action} method="get" className="flex gap-2">
            {Object.entries(hidden ?? {}).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
            ))}
            <input
                type="search"
                name="q"
                defaultValue={defaultValue}
                placeholder={placeholder}
                aria-label={placeholder}
                className="min-w-0 flex-1 rounded-lg border border-card-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
                검색
            </button>
        </form>
    );
}
