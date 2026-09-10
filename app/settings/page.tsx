import type { Metadata } from 'next';
import SettingsClient from './SettingsClient';

export const metadata: Metadata = { title: '채용 소식 설정 | Audit Say' };

export default function SettingsPage() {
    return <SettingsClient />;
}
