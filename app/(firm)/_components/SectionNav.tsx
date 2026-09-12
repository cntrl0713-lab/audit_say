'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
    { href: '/firms', label: '법인 목록' },
    { href: '/reports', label: '리포트' },
    { href: '/chat', label: '챗봇' },
    { href: '/reviews', label: '평점' },
] as const;

export function SectionNav() {
    const pathname = usePathname();
    const isJobs = pathname === '/jobs' || pathname.startsWith('/jobs/');

    return (
        <div className="mb-6">
            <nav aria-label="회계법인 메뉴" className="flex gap-1 border-b border-card-border">
                {[
                    { href: '/firms', label: '회계법인 정보', active: !isJobs },
                    { href: '/jobs', label: '채용공고', active: isJobs },
                ].map((section) => (
                    <Link
                        key={section.href}
                        href={section.href}
                        aria-current={section.active ? 'page' : undefined}
                        className={`inline-flex min-h-11 items-center border-b-2 -mb-px px-4 py-2 text-sm font-medium ${section.active
                            ? 'border-primary text-foreground'
                            : 'border-transparent text-foreground/60 hover:text-foreground'
                            }`}
                    >
                        {section.label}
                    </Link>
                ))}
            </nav>
            {!isJobs && (
                <nav aria-label="회계법인 정보 메뉴" className="mt-3 flex flex-wrap gap-1">
                    {SECTIONS.map((section) => {
                        // /firms/123 처럼 하위 경로에서도 상위 탭이 켜져 있어야 한다
                        const active =
                            pathname === section.href || pathname.startsWith(`${section.href}/`)
                            || (section.href === '/firms' && (pathname === '/companies' || pathname.startsWith('/companies/')));

                        return (
                            <Link
                                key={section.href}
                                href={section.href}
                                aria-current={active ? 'page' : undefined}
                                className={`inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors ${active
                                    ? 'bg-primary/5 text-primary'
                                    : 'text-foreground/60 hover:text-foreground'
                                    }`}
                            >
                                {section.label}
                            </Link>
                        );
                    })}
                </nav>
            )}
        </div>
    );
}
