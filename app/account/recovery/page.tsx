'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RecoveryPage() {
    const [email, setEmail] = useState('');
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState('');
    async function submit(event: React.FormEvent) {
        event.preventDefault(); setPending(true); setNotice('');
        try {
            const response = await fetch('/api/account/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }), signal: AbortSignal.timeout(15000) });
            const result = await response.json();
            setNotice(response.ok ? result.message : result.error || '메일을 요청하지 못했습니다.');
        } catch { setNotice('요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
        finally { setPending(false); }
    }
    return <section className="mx-auto w-full max-w-lg rounded-lg border border-card-border bg-card p-6 space-y-5">
        <h1 className="text-xl">공통 비밀번호 재설정</h1>
        <p className="text-sm text-foreground/65">통합 계정의 가입 이메일을 입력해 주세요. 변경한 비밀번호는 감사·세법에 함께 적용됩니다.</p>
        <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm">가입 이메일<input className="mt-2 block w-full rounded-md border border-card-border bg-background px-3 py-2" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} /></label>
            <button disabled={pending} className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{pending ? '요청 중…' : '재설정 메일 받기'}</button>
        </form>
        {notice && <p role="status" className="text-sm">{notice}</p>}
        <Link href="/" className="inline-block text-sm underline">로그인으로 돌아가기</Link>
    </section>;
}
