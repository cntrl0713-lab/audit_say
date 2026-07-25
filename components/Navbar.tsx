'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Award, User, Settings, BookOpen, Target, PenTool } from 'lucide-react';

export const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const pathname = usePathname();

    if (!user) return null;

    const navItems = [
        { name: '문제 풀기', href: '/quiz', icon: PenTool },
        { name: '커리큘럼', href: '/curriculum', icon: BookOpen },
        { name: '랭킹', href: '/ranking', icon: Award },
        { name: '내 정보', href: '/profile', icon: User },
    ];

    if (user.role === 'ADMIN') {
        navItems.push({ name: '관리자', href: '/admin', icon: Settings });
    }

    return (
        <nav className="bg-card border-b border-card-border sticky top-0 z-50 px-4 md:px-8 py-3">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Brand Logo */}
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-xl font-normal text-foreground flex items-center gap-2 hover:opacity-90">
                        <Target className="w-6 h-6 text-primary" />
                        <span className="font-normal tracking-tight">Audit Say</span>
                    </Link>
                </div>

                {/* Navigation Links */}
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                                    ? 'bg-foreground text-background'
                                    : 'text-foreground/70 hover:bg-card-border/50 hover:text-foreground'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* User Profile & Logout */}
                <div className="flex items-center justify-between md:justify-end gap-4 border-t border-card-border pt-4 md:pt-0 md:border-t-0">
                    <div className="text-right">
                        <div className="text-sm font-medium">{user.username}</div>
                        <div className="text-xs text-foreground/50">
                            Lv.{user.level} | <span className="font-medium text-foreground/70">{user.exp} EXP</span>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>로그아웃</span>
                    </button>
                </div>
            </div>
        </nav>
    );
};
