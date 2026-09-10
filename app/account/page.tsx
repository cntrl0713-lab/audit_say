import type { Metadata } from 'next';
import AccountSettings from '../../components/AccountSettings';

export const metadata: Metadata = {
    title: '통합 계정 관리 | Audit Say',
};

export default function AccountPage() {
    return <AccountSettings />;
}
