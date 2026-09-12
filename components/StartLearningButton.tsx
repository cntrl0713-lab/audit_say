'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function StartLearningButton({ compact = false }: { compact?: boolean }) {
  const { user, account, loading, loginAsGuest } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div>
    <button type="button" disabled={loading || pending} className={`button-primary ${compact ? 'px-4' : 'min-h-12 px-6'}`}
      onClick={async () => {
        if (user) { router.push('/quiz'); return; }
        if (account) { router.push('/account'); return; }
        setPending(true); setError(null);
        try { await loginAsGuest(); router.push('/quiz'); }
        catch (cause) {
          setPending(false);
          setError(cause instanceof Error ? cause.message : '학습을 시작하지 못했습니다. 다시 시도해 주세요.');
        }
        finally { setPending(false); }
      }}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? '학습 준비 중…' : user ? '이어서 학습하기' : '감사 문제 풀어보기'}
      {!compact && !pending && <ArrowRight className="size-4" aria-hidden="true" />}
    </button>
    {error && <p role="alert" className="mt-3 max-w-md text-sm text-danger">{error}</p>}
  </div>;
}
