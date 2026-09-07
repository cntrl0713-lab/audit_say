/**
 * 아직 구현되지 않은 화면의 자리표시. 어느 마일스톤에서 채워지는지 밝혀 둔다 —
 * 빈 화면이 버그인지 미구현인지 헷갈리지 않게 하려는 것이다.
 */
export function MilestonePlaceholder({
    milestone,
    title,
    description,
}: {
    milestone: string;
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-lg border border-dashed border-card-border bg-card px-6 py-10 text-center">
            <span className="inline-block rounded-full border border-card-border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                {milestone}
            </span>
            <h2 className="mt-3 text-lg">{title}</h2>
            <p className="mt-1.5 text-sm text-foreground/60">{description}</p>
        </div>
    );
}
