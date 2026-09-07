'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
    { href: '/firms', label: '회계법인' },
    { href: '/reports', label: '리포트' },
    { href: '/chat', label: '챗봇' },
    { href: '/reviews', label: '평점' },
] as const;

export function SectionNav() {
    const pathname = usePathname();

    return (
        <nav className="flex gap-1 border-b border-card-border -mx-1 mb-6 overflow-x-auto">
            {SECTIONS.map((section) => {
                // /firms/123 처럼 하위 경로에서도 상위 탭이 켜져 있어야 한다
                const active =
                    pathname === section.href || pathname.startsWith(`${section.href}/`)
                    || (section.href === '/firms' && pathname.startsWith('/companies/'));

                return (
                    <Link
                        key={section.href}
                        href={section.href}
                        aria-current={active ? 'page' : undefined}
                        className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                            active
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-foreground/60 hover:text-foreground'
                        }`}
                    >
                        {section.label}
                    </Link>
                );
            })}
        </nav>
    );
}
