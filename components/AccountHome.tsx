'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_NAMES } from '../lib/utils';
import { Loading } from '../components/Loading';
import { Eye, EyeOff } from 'lucide-react';

export default function AccountHome() {
  const { user, account, login, signUp, loading, loginAsGuest, logout } = useAuth();

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
      setStatusMsg({ type: 'error', text: '이메일 또는 닉네임과 비밀번호를 입력해주세요.' });
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

  if (!user && account) {
    return <div className="mx-auto w-full max-w-lg rounded-lg border border-card-border bg-card p-8 space-y-5">
      <h1 className="text-xl">{account.user.nickname}님, 환영합니다.</h1>
      <p className="text-sm text-foreground/65">통합 계정으로 로그인했습니다. 감사 서비스 가입과 계정 정보를 확인해 주세요.</p>
      <Link href="/account" className="block rounded-md bg-primary px-4 py-3 text-center text-sm text-primary-foreground">계정 관리 · 감사 서비스 이용 시작</Link>
      <button onClick={() => { void logout(); }} className="text-sm text-foreground/60">로그아웃</button>
    </div>;
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
                  이메일 또는 공통 닉네임
                </label>
                <input
                  id="login-email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 또는 닉네임"
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
                    maxLength={128}
                    autoComplete="current-password"
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
                className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {formLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>로그인</span>
                )}
              </button>

              <Link href="/account/recovery" className="block text-center text-xs text-foreground/60 hover:text-foreground">비밀번호를 잊으셨나요?</Link>
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-card-border"></div>
                <span className="flex-shrink mx-4 text-foreground/40 text-xs font-medium">또는</span>
                <div className="flex-grow border-t border-card-border"></div>
              </div>

              <button
                type="button"
                disabled={formLoading}
                onClick={async () => {
                  setFormLoading(true);
                  try { await loginAsGuest(); }
                  catch (error) { setStatusMsg({ type: 'error', text: error instanceof Error ? error.message : '비회원 학습을 시작하지 못했습니다.' }); }
                  finally { setFormLoading(false); }
                }}
                className="w-full py-2.5 bg-card-border/30 hover:bg-card-border/60 border border-card-border text-foreground font-medium rounded-md transition-colors cursor-pointer text-sm"
              >
                비회원으로 둘러보기
              </button>
            </form>
          ) : (
            /* Signup tab content */
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="p-3 bg-card-border/40 border border-card-border text-foreground/70 rounded-md text-xs leading-relaxed">
                감사·세법에서 같은 계정을 사용합니다. 학습 기록과 이용권은 서비스별로 관리합니다.
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
                  minLength={2}
                  maxLength={12}
                  pattern="[가-힣a-zA-Z0-9]{2,12}"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="한글·영문·숫자 2~12자"
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
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
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
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
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
                className="w-full py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
    { href: '/firms', title: '회계법인', desc: '공시 기반 법인 정보와 수습·신입 CPA 채용공고를 확인합니다.' },
    { href: '/history', title: '풀이 기록', desc: '내 답안과 기준별 채점 결과를 다시 확인합니다.' },
    { href: '/review-notes', title: '오답노트', desc: '보완할 물음을 모아 다시 연습합니다.' },
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
          className="inline-flex items-center px-4 h-10 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium rounded-md transition-colors"
        >
          문제 풀러 가기
        </Link>
      </header>

      <div className="border-t border-card-border">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block py-4 border-b border-card-border hover:bg-card-border/25 -mx-3 px-3 transition-colors"
          >
            <span className="block text-sm font-medium text-foreground">{item.title}</span>
            <span className="block text-sm text-foreground/50 mt-0.5">{item.desc}</span>
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
