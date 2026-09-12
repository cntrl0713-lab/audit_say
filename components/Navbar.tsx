'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ExternalLink, FileCheck2, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { StartLearningButton } from './StartLearningButton';

const learningLinks = [
  { href: '/curriculum', label: '커리큘럼' },
  { href: '/history', label: '풀이 기록' },
  { href: '/review-notes', label: '오답노트' },
  { href: '/ranking', label: '랭킹' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isFirm = ['/firms', '/companies', '/reports', '/reviews', '/chat', '/jobs']
    .some(path => pathname === path || pathname.startsWith(path + '/'));
  const closeDropdown = (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a, button')) event.currentTarget.closest('details')?.removeAttribute('open');
  };
  const navigation = (mobile = false) => <div className={`flex items-center ${mobile ? 'h-12 gap-5' : 'gap-7'}`}>
    <Link href="/quiz" aria-current={pathname.startsWith('/quiz') ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center text-sm ${pathname.startsWith('/quiz') ? 'font-semibold text-primary' : 'text-muted hover:text-foreground'}`}>문제 풀이</Link>
    <Link href="/firms" aria-current={isFirm ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center text-sm ${isFirm ? 'font-semibold text-primary' : 'text-muted hover:text-foreground'}`}>회계법인</Link>
    <details className="relative" key={`${pathname}-${mobile}`} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.removeAttribute('open'); event.currentTarget.querySelector('summary')?.focus(); } }}>
      <summary className={`flex min-h-11 list-none items-center gap-1.5 text-sm [&::-webkit-details-marker]:hidden ${learningLinks.some(link => pathname.startsWith(link.href)) ? 'font-semibold text-primary' : 'text-muted'}`}>
        내 학습 <ChevronDown aria-hidden="true" className="size-3.5" />
      </summary>
      <div onClick={closeDropdown} className="absolute right-0 z-50 mt-1 w-44 rounded-panel border border-card-border bg-card p-2 shadow-lg md:left-0 md:right-auto">
        {learningLinks.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} className="flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-surface-soft">{link.label}</Link>)}
      </div>
    </details>
  </div>;

  return <header className="sticky top-0 z-40 border-b border-card-border bg-background">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-control focus:bg-card focus:p-3">본문으로 바로가기</a>
    <div className="mx-auto max-w-[1440px] px-4 md:px-8">
      <div className="flex h-20 items-center justify-between gap-4">
        <Link href="/" aria-label="AuditSay 홈" className="inline-flex shrink-0 items-center gap-2.5 text-xl font-semibold tracking-tight">
          <span className="flex h-9 w-8 items-center justify-center rounded-md border border-primary/60 text-primary"><FileCheck2 aria-hidden="true" className="size-5" /></span>AuditSay
        </Link>
        <nav aria-label="주 메뉴" className="hidden md:block">{navigation()}</nav>
        <div className="flex items-center gap-2 sm:gap-3">
          {!pathname.startsWith('/quiz') && <div className="hidden xl:block"><StartLearningButton compact /></div>}
          <ThemeToggle />
          {user ? <details className="relative" key={pathname} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.removeAttribute('open'); event.currentTarget.querySelector('summary')?.focus(); } }}>
            <summary aria-label="계정 메뉴" className="flex min-h-11 list-none items-center gap-2 rounded-control border border-card-border bg-card px-3 text-sm [&::-webkit-details-marker]:hidden">
              <UserRound className="size-4" aria-hidden="true" /><span className="hidden max-w-24 truncate lg:inline">{user.username}</span><ChevronDown aria-hidden="true" className="size-3" />
            </summary>
            <div onClick={closeDropdown} className="absolute right-0 z-50 mt-2 w-48 rounded-panel border border-card-border bg-card p-2 shadow-lg">
              <p className="truncate px-3 py-2 text-xs text-muted">{user.username} · Lv.{user.level}</p>
              <Link href="/profile" className="flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-surface-soft">내 정보</Link>
              <Link href="/settings" className="flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-surface-soft">알림 설정</Link>
              <Link href="/account" className="flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-surface-soft">계정 관리</Link>
              {user.role === 'ADMIN' && <Link href="/admin" className="flex min-h-11 items-center rounded-control px-3 text-sm hover:bg-surface-soft">관리자</Link>}
              <a href="https://cta-tax-law.vercel.app/" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm hover:bg-surface-soft">세법학 <ExternalLink aria-hidden="true" className="size-3" /><span className="sr-only">새 탭</span></a>
              <button type="button" onClick={() => { void logout(); }} className="min-h-11 w-full rounded-control px-3 text-left text-sm text-muted hover:bg-surface-soft">로그아웃</button>
            </div>
          </details> : <Link href="/login" className="button-secondary px-4">로그인</Link>}
        </div>
      </div>
      <nav aria-label="모바일 주 메뉴" className="md:hidden">{navigation(true)}</nav>
    </div>
  </header>;
}
