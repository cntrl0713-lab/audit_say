'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loading } from './Loading';

type MembershipStatus = 'active' | 'suspended' | 'withdrawing' | 'withdrawn' | 'none';
type Account = {
    user: { id: string; email: string; nickname: string };
    accountStatus: 'active' | 'locked' | 'deleting';
    membership: { status: MembershipStatus; version: number; isAdmin: boolean; role: string } | null;
    entitlement: { kind: 'free' | 'pro'; expiresAt: string | null };
};
type Section = 'nickname' | 'email' | 'password' | 'service' | 'delete';
type Notice = { type: 'success' | 'error'; text: string };
type ApiResult = { ok?: boolean; message?: string; error?: string; cleanupPending?: boolean };

const inputClass = 'w-full rounded-md border border-card-border bg-background px-3 py-2.5 text-sm focus:border-primary disabled:opacity-50';
const buttonClass = 'rounded-md bg-primary px-4 py-2.5 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50';
const quietButtonClass = 'rounded-md border border-card-border px-4 py-2.5 text-sm hover:bg-background disabled:cursor-not-allowed disabled:opacity-50';
const dangerButtonClass = 'rounded-md border border-danger/40 px-4 py-2.5 text-sm text-danger hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-50';
const withdrawalPhrase = '감사 서비스 탈퇴';
const deletionPhrase = '통합 계정 삭제';
const membershipNames: Record<MembershipStatus, string> = {
    active: '이용 중', suspended: '이용 제한', withdrawing: '탈퇴 처리 중', withdrawn: '탈퇴', none: '미가입',
};

function StatusNotice({ notice }: { notice?: Notice }) {
    if (!notice) return null;
    return <p role={notice.type === 'error' ? 'alert' : 'status'} className={`rounded-md border p-3 text-sm leading-6 ${notice.type === 'error' ? 'border-danger/25 bg-danger/5 text-danger' : 'border-success/25 bg-success/5 text-success'}`}>{notice.text}</p>;
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return <section className="rounded-lg border border-card-border bg-card p-5 md:p-6">
        <h2 className="text-lg">{title}</h2>
        <p className="mb-5 mt-2 text-sm leading-6 text-foreground/60">{description}</p>
        {children}
    </section>;
}

function PasswordField({ id, label = '현재 비밀번호', autoComplete = 'current-password' }: { id: string; label?: string; autoComplete?: string }) {
    return <label htmlFor={id} className="block space-y-2 text-sm">
        <span>{label}</span>
        <input id={id} name={autoComplete === 'current-password' ? 'currentPassword' : id} type="password" autoComplete={autoComplete} required minLength={autoComplete === 'new-password' ? 8 : undefined} maxLength={128} className={inputClass} />
    </label>;
}

export default function AccountSettings() {
    const router = useRouter();
    const { refreshProfile } = useAuth();
    const [account, setAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [needsLogin, setNeedsLogin] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const [pending, setPending] = useState<Section | null>(null);
    const [notices, setNotices] = useState<Partial<Record<Section, Notice>>>({});
    const [withdrawalConfirmation, setWithdrawalConfirmation] = useState('');
    const [deletionConfirmation, setDeletionConfirmation] = useState('');

    const loadAccount = useCallback(async (signal?: AbortSignal) => {
        const response = await fetch('/api/account', { cache: 'no-store', signal });
        if (response.status === 401) {
            setNeedsLogin(true);
            setAccount(null);
            return;
        }
        if (!response.ok) throw new Error('계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        const data = await response.json() as Account;
        setAccount(data);
        setNeedsLogin(false);
        setLoadError('');
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        loadAccount(controller.signal)
            .catch((error: unknown) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : '계정 정보를 불러오지 못했습니다.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [loadAccount]);

    async function submit(section: Section, endpoint: string, method: string, body: Record<string, unknown>, message: string, form?: HTMLFormElement) {
        if (pending) return;
        setPending(section);
        setNotices(previous => ({ ...previous, [section]: undefined }));
        try {
            const response = await fetch(endpoint, {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const result = await response.json().catch(() => ({})) as ApiResult;
            if (!response.ok) throw new Error(result.message || (result.error && /[가-힣]/.test(result.error) ? result.error : '요청을 처리하지 못했습니다. 입력 내용과 로그인 상태를 확인해 주세요.'));
            form?.reset();
            if (section === 'delete' && result.ok && !result.cleanupPending) {
                setDeleted(true);
                setAccount(null);
                await refreshProfile();
                router.refresh();
                return;
            }
            await loadAccount();
            await refreshProfile();
            router.refresh();
            setNotices(previous => ({ ...previous, [section]: { type: 'success', text: result.message || message } }));
            if (section === 'service') setWithdrawalConfirmation('');
        } catch (error: unknown) {
            setNotices(previous => ({ ...previous, [section]: { type: 'error', text: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.' } }));
        } finally {
            setPending(null);
        }
    }

    function formValues(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        return { form, values: new FormData(form) };
    }

    if (loading) return <Loading label="계정 정보를 불러오는 중" />;
    if (deleted) return <div className="mx-auto w-full max-w-xl space-y-4 py-16 text-center"><h1 className="text-2xl">통합 계정이 삭제되었습니다</h1><p className="text-sm leading-6 text-foreground/60">두 서비스의 계정 삭제 처리가 완료되었습니다.</p><Link href="/" className="inline-block text-sm text-primary underline underline-offset-4">처음으로</Link></div>;
    if (needsLogin) return <div className="mx-auto w-full max-w-xl space-y-4 py-16 text-center"><h1 className="text-2xl">통합 계정 관리</h1><p className="text-sm leading-6 text-foreground/60">이메일 또는 공통 닉네임으로 로그인해 주세요. 게스트 계정은 통합 계정 관리를 이용할 수 없습니다.</p><Link href="/" className={buttonClass}>로그인하러 가기</Link></div>;
    if (!account) return <div className="mx-auto w-full max-w-xl space-y-4 py-16"><StatusNotice notice={{ type: 'error', text: loadError || '계정 정보를 불러오지 못했습니다.' }} /><button type="button" onClick={() => { setLoading(true); loadAccount().catch((error: unknown) => setLoadError(error instanceof Error ? error.message : '계정 정보를 불러오지 못했습니다.')).finally(() => setLoading(false)); }} className={quietButtonClass}>다시 불러오기</button></div>;

    const status = account.membership?.status ?? 'none';
    const editable = account.accountStatus === 'active';
    const disabled = !!pending || !editable;
    const canJoin = status === 'none' || status === 'withdrawn';
    const canWithdraw = status === 'active' || status === 'suspended';

    return <div className="mx-auto w-full max-w-3xl space-y-6 py-4 md:py-8">
        <header>
            <Link href="/profile" className="text-sm text-foreground/60 hover:text-foreground">← 내 프로필</Link>
            <h1 className="mt-5 text-3xl">통합 계정 관리</h1>
            <p className="mt-3 text-sm leading-6 text-foreground/60">Audit Say와 세법학에서 같은 계정을 사용합니다. 닉네임·이메일·비밀번호를 변경하면 두 서비스에 함께 적용됩니다.</p>
        </header>

        {!editable && <StatusNotice notice={{ type: 'error', text: account.accountStatus === 'deleting' ? '통합 계정 삭제를 처리하고 있습니다. 두 서비스의 종료 처리가 모두 끝나기 전에는 삭제 완료로 표시되지 않습니다.' : '보안을 위해 통합 계정 이용이 제한되었습니다. 계정 상태가 확인될 때까지 정보를 변경하거나 서비스를 이용할 수 없습니다.' }} />}

        <Panel title="공통 닉네임" description="두 서비스의 프로필과 랭킹에 같은 닉네임이 표시됩니다. 변경 후에는 새 닉네임 또는 이메일로 로그인해 주세요.">
            <form onSubmit={event => { const { form, values } = formValues(event); void submit('nickname', '/api/account', 'PATCH', { nickname: String(values.get('nickname') ?? '').trim() }, '공통 닉네임을 변경했습니다.', form); }} className="space-y-4">
                <fieldset disabled={disabled} className="space-y-4">
                    <label htmlFor="account-nickname" className="block space-y-2 text-sm"><span>닉네임</span><input key={account.user.nickname} id="account-nickname" name="nickname" autoComplete="nickname" defaultValue={account.user.nickname} required minLength={2} maxLength={12} pattern="[가-힣a-zA-Z0-9]{2,12}" aria-describedby="nickname-help" className={inputClass} /></label>
                    <p id="nickname-help" className="text-xs leading-5 text-foreground/50">한글·영문·숫자 2~12자. 대소문자를 구분하지 않고 중복을 확인합니다.</p>
                    <button type="submit" className={buttonClass}>{pending === 'nickname' ? '저장 중…' : '닉네임 저장'}</button>
                </fieldset>
                <StatusNotice notice={notices.nickname} />
            </form>
        </Panel>

        <Panel title="이메일 변경" description="새 이메일로 보낸 인증 안내를 완료하면 두 서비스의 로그인 이메일이 변경됩니다.">
            <p className="mb-4 break-all text-sm text-foreground/60">현재 이메일: <span className="text-foreground">{account.user.email}</span></p>
            <form onSubmit={event => { const { form, values } = formValues(event); void submit('email', '/api/account/email', 'POST', { email: String(values.get('email') ?? '').trim(), currentPassword: values.get('currentPassword') }, '이메일 변경 요청을 보냈습니다. 현재 이메일과 새 이메일의 인증 안내를 확인해 주세요.', form); }} className="space-y-4">
                <fieldset disabled={disabled} className="space-y-4">
                    <label htmlFor="account-email" className="block space-y-2 text-sm"><span>새 이메일</span><input id="account-email" name="email" type="email" autoComplete="email" required className={inputClass} /></label>
                    <PasswordField id="email-current-password" />
                    <button type="submit" className={buttonClass}>{pending === 'email' ? '요청 중…' : '이메일 변경 요청'}</button>
                </fieldset>
                <StatusNotice notice={notices.email} />
            </form>
        </Panel>

        <Panel title="비밀번호 변경" description="변경한 비밀번호로 두 서비스에 로그인합니다.">
            <form onSubmit={event => {
                const { form, values } = formValues(event);
                if (values.get('new-password') !== values.get('confirm-password')) { setNotices(previous => ({ ...previous, password: { type: 'error', text: '새 비밀번호가 일치하지 않습니다.' } })); return; }
                void submit('password', '/api/account/password', 'POST', { password: values.get('new-password'), currentPassword: values.get('currentPassword') }, '비밀번호를 변경했습니다.', form);
            }} className="space-y-4">
                <fieldset disabled={disabled} className="space-y-4">
                    <PasswordField id="password-current-password" />
                    <PasswordField id="new-password" label="새 비밀번호 (8자 이상)" autoComplete="new-password" />
                    <PasswordField id="confirm-password" label="새 비밀번호 확인" autoComplete="new-password" />
                    <button type="submit" className={buttonClass}>{pending === 'password' ? '변경 중…' : '비밀번호 변경'}</button>
                </fieldset>
                <StatusNotice notice={notices.password} />
            </form>
        </Panel>

        <Panel title="감사 서비스 이용" description="감사 서비스의 학습 기록과 이용권을 관리합니다. 세법학의 이용 상태와는 별도로 적용됩니다.">
            <p className="mb-4 text-sm">현재 상태: <span className="rounded-md bg-background px-2 py-1">{membershipNames[status]}</span></p>
            {status === 'active' && <Link href="/profile" className="text-sm text-primary underline underline-offset-4">감사 학습 프로필 보기</Link>}
            {status === 'withdrawing' && <p role="status" className="text-sm leading-6 text-foreground/60">탈퇴 처리를 진행하고 있습니다. 완료될 때까지 감사 서비스를 이용하거나 재가입할 수 없습니다.</p>}
            {status === 'suspended' && <p className="mb-4 text-sm leading-6 text-foreground/60">감사 서비스 이용이 제한되어 있습니다. 제한이 해제되기 전에는 재가입으로 이용을 다시 시작할 수 없습니다.</p>}
            {canJoin && <form onSubmit={event => { const { form } = formValues(event); void submit('service', '/api/account/service', 'POST', { action: 'join', membershipVersion: account.membership?.version }, '감사 서비스 이용을 시작했습니다.', form); }}>
                <fieldset disabled={disabled} className="space-y-4">
                    <p className="text-sm leading-6 text-foreground/60">{status === 'withdrawn' ? '재가입하면 학습을 새로 시작합니다. 이전 학습 기록·경험치·종료된 이용권과 남은 기간은 복원되지 않습니다.' : '기존 통합 계정으로 감사 서비스 이용을 시작합니다. 가입하면 감사 학습 기록과 경험치를 저장할 수 있습니다.'}</p>
                    <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" required className="mt-1.5 accent-primary" /><span>위 내용을 확인하고 감사 서비스 {status === 'withdrawn' ? '재가입' : '이용 시작'}에 동의합니다.</span></label>
                    <button type="submit" className={buttonClass}>{pending === 'service' ? '처리 중…' : status === 'withdrawn' ? '감사 서비스 재가입' : '감사 서비스 이용 시작'}</button>
                </fieldset>
            </form>}
            {canWithdraw && <details className="mt-5 border-t border-card-border pt-5">
                <summary className="cursor-pointer text-sm text-danger">감사 서비스 탈퇴</summary>
                <div className="mt-4 space-y-4 text-sm leading-6">
                    <p>감사 답안·채점 결과·풀이 이력·오답노트·메모·학습 진도·경험치·알림 설정을 삭제하고, 감사 이용권과 남은 이용기간을 종료합니다. 재가입해도 복원되지 않습니다.</p>
                    {account.entitlement.kind === 'pro' && <p>종료되는 감사 PRO 이용권의 원래 만료일: {account.entitlement.expiresAt ? new Date(account.entitlement.expiresAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '기간 정보 없음'}. 탈퇴하면 부여된 이용권이 종료됩니다.</p>}
                    <p className="text-foreground/60">통합 계정과 세법학 기록·이용권은 유지됩니다. 탈퇴는 자동 환불을 의미하지 않습니다. 결제·환불·혜택 지급 및 최소 운영 기록은 별도 정책에 따라 관리됩니다.</p>
                    <form onSubmit={event => { const { form, values } = formValues(event); void submit('service', '/api/account/service', 'POST', { action: 'withdraw', membershipVersion: account.membership?.version, currentPassword: values.get('currentPassword'), confirmation: withdrawalConfirmation }, '감사 서비스 탈퇴 처리를 요청했습니다.', form); }} className="space-y-4">
                        <fieldset disabled={disabled} className="space-y-4">
                            <PasswordField id="withdraw-current-password" />
                            <label htmlFor="withdraw-confirmation" className="block space-y-2"><span>확인을 위해 “{withdrawalPhrase}”를 입력해 주세요.</span><input id="withdraw-confirmation" autoComplete="off" value={withdrawalConfirmation} onChange={event => setWithdrawalConfirmation(event.target.value)} required className={inputClass} /></label>
                            <button type="submit" disabled={withdrawalConfirmation !== withdrawalPhrase} className={dangerButtonClass}>{pending === 'service' ? '탈퇴 처리 중…' : '감사 서비스 탈퇴하기'}</button>
                        </fieldset>
                    </form>
                </div>
            </details>}
            <div className="mt-4"><StatusNotice notice={notices.service} /></div>
        </Panel>

        <section className="rounded-lg border border-danger/25 bg-card p-5 md:p-6">
            <h2 className="text-lg">통합 계정 삭제</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/60">Audit Say와 세법학을 모두 탈퇴하고 공통 계정을 삭제합니다. 각 서비스의 학습 기록과 이용권·남은 이용기간은 복원되지 않습니다.</p>
            <details className="mt-5">
                <summary className="cursor-pointer text-sm text-danger">두 서비스의 계정 삭제 안내 보기</summary>
                <div className="mt-4 space-y-4 text-sm leading-6">
                    <p>자동갱신 중단과 미처리 결제·환불 확인을 포함해 두 서비스의 종료 처리가 완료된 뒤 계정을 삭제합니다. 처리 중에는 두 서비스를 이용할 수 없습니다. 삭제 요청은 자동 환불을 의미하지 않습니다.</p>
                    <p className="text-foreground/60">거래 증빙과 최소 운영 기록은 별도 정책에 따라 관리합니다.</p>
                    <form onSubmit={event => { const { form, values } = formValues(event); void submit('delete', '/api/account', 'DELETE', { currentPassword: values.get('currentPassword'), confirmation: deletionConfirmation }, '통합 계정 삭제를 요청했습니다. 두 서비스의 종료 처리 상태를 확인하고 있습니다.', form); }} className="space-y-4">
                        <fieldset disabled={!!pending || account.accountStatus === 'locked'} className="space-y-4">
                            <PasswordField id="delete-current-password" />
                            <Link href="/account/recovery" className="inline-block text-sm text-primary underline underline-offset-4">비밀번호를 잊으셨나요?</Link>
                            <label htmlFor="delete-confirmation" className="block space-y-2"><span>확인을 위해 “{deletionPhrase}”를 입력해 주세요.</span><input id="delete-confirmation" autoComplete="off" value={deletionConfirmation} onChange={event => setDeletionConfirmation(event.target.value)} required className={inputClass} /></label>
                            <button type="submit" disabled={deletionConfirmation !== deletionPhrase} className={dangerButtonClass}>{pending === 'delete' ? '삭제 처리 중…' : account.accountStatus === 'deleting' ? '계정 삭제 처리 재시도' : '통합 계정 삭제 요청'}</button>
                        </fieldset>
                        <StatusNotice notice={notices.delete} />
                    </form>
                </div>
            </details>
        </section>
    </div>;
}
