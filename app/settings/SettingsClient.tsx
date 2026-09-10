'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Bell, Info, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { KICPA_BOARDS, type KicpaBoard } from '@/lib/kicpa/types';
import { JOBS_BOARD_LABELS, JOBS_CONSENT_TEXT, JOBS_PREPARING_MESSAGE, type JobsSubscriptionStatus } from '@/lib/kicpa/subscription';

const ERRORS: Record<string, string> = {
    member_required: '회원 로그인이 필요합니다. 다시 로그인해 주세요.',
    consent_required: '알림 수신을 희망하면 아래 동의 내용을 확인하고 체크해 주세요.',
    invalid_request: '게시판 선택과 알림 수신 동의 내용을 확인해 주세요.',
    forbidden: '요청을 확인할 수 없습니다. 이 페이지를 새로고침한 뒤 다시 시도해 주세요.',
    service_unavailable: '설정 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
};

async function requestStatus(init?: RequestInit): Promise<JobsSubscriptionStatus> {
    let response: Response;
    try {
        response = await fetch('/api/jobs/subscription', { ...init, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    } catch { throw new Error('설정 요청이 지연되거나 연결이 끊겼습니다. 다시 시도해 주세요.'); }
    let result: unknown;
    try { result = await response.json(); } catch { throw new Error(ERRORS.service_unavailable); }
    if (!result || typeof result !== 'object') throw new Error(ERRORS.service_unavailable);
    const value = result as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof value.error === 'string' && Object.hasOwn(ERRORS, value.error)
        ? ERRORS[value.error] : ERRORS.service_unavailable);
    if (['saved', 'active', 'consentRequired'].some((key) => typeof value[key] !== 'boolean')
        || value.deliveryStatus !== 'preparing' || !Array.isArray(value.boards) || value.boards.length < 1
        || value.boards.some((board) => !KICPA_BOARDS.includes(board))) throw new Error(ERRORS.service_unavailable);
    return { saved: value.saved as boolean, active: value.active as boolean, consentRequired: value.consentRequired as boolean,
        deliveryStatus: 'preparing', boards: value.boards as KicpaBoard[] };
}

const buttonStyle = 'inline-flex items-center justify-center gap-2 rounded-md border border-card-border px-4 py-2.5 text-sm transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-45';

export default function SettingsClient() {
    const { user, loading: authLoading, login } = useAuth();
    const memberId = user && user.role !== 'GUEST' ? user.id : null;
    const [snapshot, setSnapshot] = useState<{ memberId: string; status: JobsSubscriptionStatus } | null>(null);
    const [loadError, setLoadError] = useState<{ memberId: string; text: string } | null>(null);
    const [retry, setRetry] = useState(0);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [active, setActive] = useState(false);
    const [boards, setBoards] = useState<KicpaBoard[]>([...KICPA_BOARDS]);
    const [consent, setConsent] = useState(false);
    const status = snapshot?.memberId === memberId ? snapshot.status : null;
    const failure = loadError?.memberId === memberId ? loadError.text : null;

    useEffect(() => {
        if (!memberId) return;
        let cancelled = false;
        requestStatus().then((result) => {
            if (!cancelled) {
                setSnapshot({ memberId, status: result });
                setActive(result.active);
                setBoards(result.boards);
                setConsent(false);
                setLoadError(null);
            }
        }).catch((error: unknown) => {
            if (!cancelled) setLoadError({ memberId, text: error instanceof Error ? error.message : ERRORS.service_unavailable });
        });
        return () => { cancelled = true; };
    }, [memberId, retry]);

    async function handleLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setNotice(null);
        try {
            const result = await login(email, password);
            if (!result.success) setNotice({ error: true, text: result.error ?? '로그인하지 못했습니다.' });
            else setPassword('');
        } catch { setNotice({ error: true, text: '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.' }); }
        finally { setBusy(false); }
    }

    async function updateSubscription(remove = false) {
        if (!memberId || !status) return;
        setBusy(true);
        setNotice(null);
        try {
            const updated = await requestStatus(remove ? { method: 'DELETE' }
                : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active, boards, consent }) });
            setSnapshot({ memberId, status: updated });
            setActive(updated.active);
            setBoards(updated.boards);
            setConsent(false);
            setNotice({ error: false, text: remove ? '저장된 구독 설정과 대기 중인 공고 전송을 삭제했습니다.'
                : updated.active ? '설정을 저장했습니다. 실제 발송은 서비스 준비 후 휴대전화 인증을 완료해야 시작됩니다.'
                    : '수신을 희망하지 않는 상태로 설정을 저장했습니다.' });
        } catch (error) {
            setNotice({ error: true, text: error instanceof Error ? error.message : ERRORS.service_unavailable });
        } finally { setBusy(false); }
    }

    function selectBoard(board: KicpaBoard, checked: boolean) {
        setBoards((current) => checked ? KICPA_BOARDS.filter((item) => item === board || current.includes(item)) : current.filter((item) => item !== board));
    }

    const canSave = Boolean(status && boards.length > 0 && (!active || !status.consentRequired || consent));
    return (
        <div className="mx-auto w-full max-w-2xl space-y-6 py-4 md:py-8">
            <div>
                <p className="text-sm text-foreground/50">내 설정</p>
                <h1 className="mt-2 text-2xl">채용 소식 설정</h1>
                <p className="mt-3 text-sm leading-6 text-foreground/65">받고 싶은 KICPA 수습·신입 CPA 채용공고를 선택하세요.</p>
            </div>

            <section aria-label="서비스 준비 안내" className="rounded-lg border border-card-border bg-card p-5">
                <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="text-sm leading-6">
                        <p className="font-medium">카카오 알림톡 서비스를 준비하고 있습니다.</p>
                        <p className="mt-1 text-foreground/65">{JOBS_PREPARING_MESSAGE}</p>
                        <p className="mt-2 text-foreground/65">서비스가 시작되면 공고는 한국시간 매일 오전 8시 30분부터 오후 6시 30분까지 정기적으로 확인합니다. 수집 일정과 서비스 상태에 따라 확인이 늦어질 수 있습니다.</p>
                    </div>
                </div>
            </section>

            {notice && <p role={notice.error ? 'alert' : 'status'} className={`rounded-md border p-4 text-sm leading-6 ${notice.error
                ? 'border-danger/25 bg-danger/5 text-danger' : 'border-success/25 bg-success/5 text-success'}`}>{notice.text}</p>}

            {authLoading ? <p role="status" className="py-6 text-sm text-foreground/60">로그인 정보를 확인하고 있습니다.</p> : !memberId ? (
                <section className="rounded-lg border border-card-border bg-card p-6">
                    <h2 className="text-lg">회원 계정으로 로그인</h2>
                    <p className="mt-2 text-sm leading-6 text-foreground/60">채용 소식 설정은 Audit Say 회원 계정에 저장됩니다. 비회원은 먼저 가입해 주세요.</p>
                    <form onSubmit={handleLogin} className="mt-5 space-y-4">
                        <div><label htmlFor="settings-email" className="mb-1.5 block text-sm">이메일</label>
                            <input id="settings-email" type="email" autoComplete="email" required value={email} disabled={busy}
                                onChange={(event) => setEmail(event.target.value)} className="w-full rounded-md border border-card-border px-3 py-2.5 text-sm" /></div>
                        <div><label htmlFor="settings-password" className="mb-1.5 block text-sm">비밀번호</label>
                            <input id="settings-password" type="password" autoComplete="current-password" required value={password} disabled={busy}
                                onChange={(event) => setPassword(event.target.value)} className="w-full rounded-md border border-card-border px-3 py-2.5 text-sm" /></div>
                        <div className="flex items-center gap-4"><button disabled={busy} className={`${buttonStyle} bg-primary text-white hover:bg-primary-hover`}>{busy ? '로그인 중…' : '로그인'}</button>
                            <Link href="/" className="text-sm text-foreground/60 underline underline-offset-4">회원가입</Link></div>
                    </form>
                </section>
            ) : (
                <section aria-busy={busy || (!status && !failure)} className="rounded-lg border border-card-border bg-card p-6">
                    <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-primary" aria-hidden="true" /><h2 className="text-lg">알림 수신 희망</h2></div>
                    {failure ? <div className="mt-4"><p role="alert" className="text-sm leading-6 text-danger">{failure}</p>
                        <button className={`${buttonStyle} mt-4`} disabled={busy} onClick={() => { setSnapshot(null); setLoadError(null); setRetry((value) => value + 1); }}>설정 새로고침</button></div>
                        : !status ? <p role="status" className="mt-4 text-sm text-foreground/60">저장된 설정을 확인하고 있습니다.</p>
                            : <form onSubmit={(event) => { event.preventDefault(); void updateSubscription(); }} className="mt-5 space-y-6">
                                <div className="rounded-md bg-background p-3 text-sm leading-6">
                                    <p className="font-medium">{!status.saved ? '아직 저장된 설정이 없습니다.' : status.active ? '알림 수신 희망으로 저장됨 · 발송 준비 중' : '수신 희망 안 함으로 저장됨'}</p>
                                    <p className="mt-1 text-foreground/60">바꾼 설정은 아래 저장 버튼을 눌러 적용해 주세요.</p>
                                </div>
                                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
                                    <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={busy} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                                    <span>서비스 준비 후 채용공고 알림 수신을 희망합니다.</span>
                                </label>
                                <fieldset disabled={busy} className="space-y-3">
                                    <legend className="mb-3 text-sm font-medium">받고 싶은 공고 <span className="font-normal text-foreground/50">· 1개 이상 선택</span></legend>
                                    {KICPA_BOARDS.map((board) => <label key={board} className="flex cursor-pointer items-start gap-3 text-sm leading-6">
                                        <input type="checkbox" checked={boards.includes(board)} onChange={(event) => selectBoard(board, event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                                        <span>{JOBS_BOARD_LABELS[board]}</span>
                                    </label>)}
                                    {boards.length === 0 && <p role="status" className="text-sm text-danger">게시판을 1개 이상 선택해 주세요.</p>}
                                </fieldset>
                                <div className="rounded-md border border-card-border p-4 text-sm leading-6">
                                    <h3 className="font-medium">정기 채용 소식 수신 동의</h3>
                                    <p id="jobs-consent-text" className="mt-2 text-foreground/65">{JOBS_CONSENT_TEXT}</p>
                                    {status.consentRequired ? <label className="mt-4 flex cursor-pointer items-start gap-3">
                                        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={busy || !active}
                                            aria-describedby="jobs-consent-text" className="mt-1 h-4 w-4 shrink-0 accent-primary" />
                                        <span>위 내용을 확인하고 정기 채용 소식 수신에 동의합니다.</span>
                                    </label> : <p className="mt-3 text-success">현재 동의 내용으로 신청한 기록이 있습니다.</p>}
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button type="submit" disabled={busy || !canSave} className={`${buttonStyle} bg-primary text-white hover:bg-primary-hover`}>
                                        <Save className="h-4 w-4" aria-hidden="true" />{busy ? '처리 중…' : '설정 저장'}</button>
                                    {status.saved && <button type="button" onClick={() => updateSubscription(true)} disabled={busy} className={buttonStyle}>
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />설정 삭제</button>}
                                </div>
                                <p className="text-xs leading-5 text-foreground/50">수신 희망을 해제한 뒤 저장하면 알림 신청을 중단합니다. 다시 신청하거나 게시판을 바꾸면 그 이후 새로 수집되는 공고부터 안내 대상이 됩니다.</p>
                            </form>}
                </section>
            )}
            <p className="text-sm text-foreground/60">수집된 공고는 <Link href="/firms" className="text-primary underline underline-offset-4">회계법인 정보</Link>의 채용공고 탭에서도 확인할 수 있습니다.</p>
        </div>
    );
}
