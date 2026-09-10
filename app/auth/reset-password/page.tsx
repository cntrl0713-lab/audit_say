'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Loading } from '../../../components/Loading';

const inputClass = 'w-full rounded-md border border-card-border bg-background px-3 py-2.5 text-sm focus:border-primary';

export default function ResetPasswordPage() {
    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);
    const [pending, setPending] = useState(false);
    const [complete, setComplete] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/account', { cache: 'no-store', signal: controller.signal })
            .then(async response => {
                if (!response.ok) throw new Error('복구 링크를 확인할 수 없습니다. 복구 이메일을 다시 요청해 주세요.');
                const account = await response.json() as { recoveryAllowed?: boolean };
                setAllowed(account.recoveryAllowed === true);
                if (!account.recoveryAllowed) setError('복구 링크가 만료되었거나 유효하지 않습니다. 복구 이메일을 다시 요청해 주세요.');
            })
            .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '복구 링크를 확인하지 못했습니다.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, []);

    async function resetPassword(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        const form = event.currentTarget;
        const values = new FormData(form);
        if (values.get('password') !== values.get('passwordConfirm')) {
            setError('새 비밀번호가 일치하지 않습니다.');
            return;
        }
        setPending(true);
        setError('');
        try {
            const response = await fetch('/api/account/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: values.get('password'), recovery: true }),
            });
            const result = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(result.error && /[가-힣]/.test(result.error) ? result.error : '비밀번호를 변경하지 못했습니다. 복구 링크가 만료되었다면 이메일을 다시 요청해 주세요.');
            form.reset();
            setComplete(true);
        } catch (reason: unknown) {
            setError(reason instanceof Error ? reason.message : '비밀번호를 변경하지 못했습니다.');
        } finally {
            setPending(false);
        }
    }

    if (loading) return <Loading label="복구 링크를 확인하는 중" />;

    return <div className="mx-auto my-8 w-full max-w-md rounded-lg border border-card-border bg-card p-6 md:my-16 md:p-8">
        <h1 className="text-2xl">비밀번호 재설정</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/60">변경한 비밀번호로 Audit Say와 세법학에 로그인합니다.</p>
        {error && <p role="alert" className="mt-5 rounded-md border border-danger/25 bg-danger/5 p-3 text-sm leading-6 text-danger">{error}</p>}
        {complete ? <div className="mt-6 space-y-5">
            <p role="status" className="text-sm leading-6 text-success">비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.</p>
            <Link href="/" className="inline-block text-sm text-primary underline underline-offset-4">로그인하러 가기</Link>
        </div> : allowed ? <form onSubmit={resetPassword} className="mt-6">
            <fieldset disabled={pending} className="space-y-5">
                <label htmlFor="recovery-password" className="block space-y-2 text-sm"><span>새 비밀번호 (8자 이상)</span><input id="recovery-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={inputClass} /></label>
                <label htmlFor="recovery-password-confirm" className="block space-y-2 text-sm"><span>새 비밀번호 확인</span><input id="recovery-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={inputClass} /></label>
                <button type="submit" className="w-full rounded-md bg-primary px-4 py-2.5 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{pending ? '변경 중…' : '새 비밀번호 저장'}</button>
            </fieldset>
        </form> : <Link href="/account/recovery" className="mt-6 inline-block text-sm text-primary underline underline-offset-4">복구 이메일 다시 요청</Link>}
    </div>;
}
