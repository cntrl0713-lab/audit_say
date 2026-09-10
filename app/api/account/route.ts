import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { accountRpc } from '@/lib/accountRepository';
import { AccountError, validateNickname } from '@/lib/accountPolicy';
import { accountBody, accountFailure, accountRateLimit, accountResponse, accountSnapshot, authenticatedAccount, reauthenticateAccount } from '@/lib/accountServer';

export async function GET() {
    try { return accountResponse(await accountSnapshot()); }
    catch (error) { return accountFailure(error); }
}
export async function PATCH(request: Request) {
    try {
        const body = await accountBody(request);
        const { user } = await authenticatedAccount();
        await accountRateLimit(request, 'nickname', user.id);
        await accountRpc('common_update_nickname', { p_user_id: user.id, p_nickname: validateNickname(body.nickname) });
        return accountResponse({ ok: true, message: '두 서비스의 공통 닉네임을 변경했습니다.' });
    } catch (error) { return accountFailure(error); }
}
export async function DELETE(request: Request) {
    try {
        const body = await accountBody(request);
        const { user, client, profile } = await authenticatedAccount(true);
        if (profile.account_status === 'locked') throw new AccountError('계정 잠금을 해제한 뒤 삭제를 요청해 주세요.', 403);
        if (body.confirmation !== '통합 계정 삭제') throw new AccountError('확인 문구를 정확히 입력해 주세요.');
        await accountRateLimit(request, 'delete', user.id);
        await reauthenticateAccount(user.id, user.email, body.currentPassword);
        const result = await accountRpc<{ ready_for_auth_delete: boolean }>('common_prepare_account_deletion', { p_user_id: user.id });
        if (result.ready_for_auth_delete !== true) {
            return accountResponse({ ok: true, cleanupPending: true, message: '계정 이용을 중단했습니다. 결제 종료 처리가 끝나면 삭제를 다시 진행해 주세요.' });
        }
        const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.id);
        if (error) throw new AccountError('계정 삭제 후처리를 완료하지 못했습니다. 다시 시도해 주세요.', 409);
        await client.auth.signOut({ scope: 'local' });
        return accountResponse({ ok: true, cleanupPending: false, message: '통합 계정을 삭제했습니다.' });
    } catch (error) { return accountFailure(error); }
}
