'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_NAMES } from '../lib/utils';
import { Loading } from '../components/Loading';
import { Eye, EyeOff } from 'lucide-react';

export default function Home() {
  const { user, login, signUp, loading, loginAsGuest } = useAuth();

  // Auth Form State
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup extra fields
  const [username, setUsername] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Status State
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setStatusMsg({ type: 'error', text: '이메일과 비밀번호를 입력해주세요.' });
      return;
    }

    setFormLoading(true);
    setStatusMsg(null);

    const res = await login(email, password);
    setFormLoading(false);

    if (!res.success) {
      setStatusMsg({ type: 'error', text: res.error || '이메일 또는 비밀번호가 잘못되었습니다.' });
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username) {
      setStatusMsg({ type: 'error', text: '모든 항목을 입력해주세요.' });
      return;
    }

    if (password !== passwordConfirm) {
      setStatusMsg({ type: 'error', text: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    setFormLoading(true);
    setStatusMsg(null);

    const res = await signUp(email, password, username);
    setFormLoading(false);

    if (res.success) {
      if (res.msg === 'SUCCESS') {
        setStatusMsg({ type: 'success', text: '가입이 완료되었습니다. 로그인해 주세요.' });
        setActiveTab('login');
      } else if (res.msg === 'CHECK_EMAIL') {
        setStatusMsg({ type: 'success', text: '인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 마쳐주세요.' });
      }
      // Reset fields
      setPassword('');
      setPasswordConfirm('');
    } else {
      setStatusMsg({ type: 'error', text: res.error || '회원가입 중 오류가 발생했습니다.' });
    }
  };

  if (loading) {
    return <Loading />;
  }

  // --- Auth View (Not logged in) ---
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 max-w-md mx-auto w-full py-8 md:py-16">
        <div className="bg-card w-full rounded-lg border border-card-border overflow-hidden p-6 md:p-8">

          <div className="mb-8">
            <h1 className="text-2xl text-foreground">Audit Say</h1>
            <p className="text-sm text-foreground/60 mt-1.5">회계감사 서술형 문제를 풀고 답안 채점 피드백을 받습니다.</p>
          </div>

          {/* Alert messages */}
          {statusMsg && (
            <div className={`p-4 mb-4 rounded-md text-sm font-medium border ${statusMsg.type === 'success'
              ? 'bg-success/15 border-success/30 text-success'
              : 'bg-danger/15 border-danger/30 text-danger'
              }`}>
              {statusMsg.text}
            </div>
          )}

          {/* Form Tabs */}
          <div className="flex border-b border-card-border mb-6">
            <button
              onClick={() => { setActiveTab('login'); setStatusMsg(null); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'login'
                ? 'border-primary text-foreground'
                : 'border-transparent text-foreground/40 hover:text-foreground/70'
                }`}
            >
              로그인
            </button>
            <button
              onClick={() => { setActiveTab('signup'); setStatusMsg(null); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'signup'
                ? 'border-primary text-foreground'
                : 'border-transparent text-foreground/40 hover:text-foreground/70'
                }`}
            >
              회원가입
            </button>
          </div>

          {/* Login tab content */}
          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm text-foreground/70 mb-1.5">
                  이메일
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm text-foreground/70 mb-1.5">
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md pl-4 pr-10 py-2.5 text-sm focus:outline-none transition-colors"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/45 hover:text-foreground/90 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {formLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>로그인</span>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-card-border"></div>
                <span className="flex-shrink mx-4 text-foreground/40 text-xs font-medium">또는</span>
                <div className="flex-grow border-t border-card-border"></div>
              </div>

              <button
                type="button"
                onClick={loginAsGuest}
                className="w-full py-2.5 bg-card-border/30 hover:bg-card-border/60 border border-card-border text-foreground font-medium rounded-md transition-colors cursor-pointer text-sm"
              >
                비회원으로 둘러보기
              </button>
            </form>
          ) : (
            /* Signup tab content */
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="p-3 bg-card-border/40 border border-card-border text-foreground/70 rounded-md text-xs leading-relaxed">
                기존 ID 사용자는 이메일로 새로 가입해야 합니다.
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-sm text-foreground/70 mb-1.5">
                  이메일
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="signup-username" className="block text-sm text-foreground/70 mb-1.5">
                  닉네임
                </label>
                <input
                  id="signup-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="닉네임 입력"
                  className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-sm text-foreground/70 mb-1.5">
                  비밀번호
                </label>
                <input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="signup-password-confirm" className="block text-sm text-foreground/70 mb-1.5">
                  비밀번호 확인
                </label>
                <input
                  id="signup-password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-card-border/30 border border-card-border focus:border-primary text-foreground rounded-md px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {formLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>회원가입</span>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    );
  }

  // --- Dashboard View (Logged In) ---
  const roleName = ROLE_NAMES[user.role] || user.role;
  const levelProgress = user.exp % 100;

  const shortcuts = [
    { href: '/quiz', title: '문제 풀기', desc: '서술형 문제를 풀고 채점 피드백을 받습니다.' },
    { href: '/curriculum', title: '커리큘럼', desc: '단원별 문제 구성을 확인합니다.' },
    { href: '/ranking', title: '랭킹', desc: '경험치 기준 상위 학습자를 봅니다.' },
    { href: '/profile', title: '내 정보', desc: '학습 통계와 오답 노트를 봅니다.' },
  ];

  return (
    <div className="max-w-3xl mx-auto w-full py-8 space-y-10">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl text-foreground">안녕하세요, {user.username}님</h1>
          <p className="text-sm text-foreground/55 mt-1.5">
            {roleName} · 레벨 {user.level} · 누적 {user.exp} EXP
          </p>
        </div>

        <div className="max-w-sm">
          <div className="flex justify-between text-xs text-foreground/50 mb-1.5">
            <span>다음 레벨까지</span>
            <span>{levelProgress} / 100 EXP</span>
          </div>
          <div className="w-full h-1 bg-card-border rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground/40 transition-all duration-500"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </div>

        <Link
          href="/quiz"
          className="inline-flex items-center px-4 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-md transition-colors"
        >
          문제 풀러 가기
        </Link>
      </header>

      <div className="border-t border-card-border">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-baseline justify-between gap-6 py-4 border-b border-card-border hover:bg-card-border/25 -mx-3 px-3 transition-colors"
          >
            <span className="text-sm font-medium text-foreground whitespace-nowrap">{item.title}</span>
            <span className="text-sm text-foreground/50 text-right">{item.desc}</span>
          </Link>
        ))}
      </div>

      {user.role === 'ADMIN' && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-foreground/55">문제 데이터와 회원 권한은 관리자 페이지에서 관리합니다.</p>
          <Link
            href="/admin"
            className="px-3 py-1.5 border border-card-border rounded-md font-medium hover:bg-card-border/40 transition-colors whitespace-nowrap"
          >
            관리자 페이지
          </Link>
        </div>
      )}
    </div>
  );
}
