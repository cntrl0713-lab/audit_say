'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const pathname = usePathname();

    if (!user) return null;

    const navItems = [
        { name: '문제 풀기', href: '/quiz' },
        { name: '커리큘럼', href: '/curriculum' },
        { name: '랭킹', href: '/ranking' },
        { name: '내 정보', href: '/profile' },
    ];

    if (user.role === 'ADMIN') {
        navItems.push({ name: '관리자', href: '/admin' });
    }

    return (
        <nav className="bg-background border-b border-card-border sticky top-0 z-50 px-4 md:px-8">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 h-16">
                <div className="flex items-center gap-8 min-w-0">
                    <Link href="/" className="text-base tracking-tight text-foreground whitespace-nowrap">
                        Audit Say
                    </Link>

                    <div className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                                        ? 'text-foreground'
                                        : 'text-foreground/55 hover:text-foreground'
                                        }`}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-4 whitespace-nowrap">
                    <span className="text-sm text-foreground/60">
                        {user.username} <span className="text-foreground/35">Lv.{user.level}</span>
                    </span>
                    <button
                        onClick={logout}
                        className="text-sm text-foreground/55 hover:text-foreground transition-colors cursor-pointer"
                    >
                        로그아웃
                    </button>
                </div>
            </div>

            {/* 모바일: 링크를 아래 줄에 가로 스크롤로 둔다. */}
            <div className="md:hidden flex items-center gap-1 -mx-1 pb-2 overflow-x-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                                ? 'bg-card border border-card-border text-foreground'
                                : 'text-foreground/55'
                                }`}
                        >
                            {item.name}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
