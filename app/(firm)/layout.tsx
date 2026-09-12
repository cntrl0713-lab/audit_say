import type { Metadata } from 'next';
import { SectionNav } from './_components/SectionNav';

export const metadata: Metadata = {
    title: '회계법인 | Audit Say',
    description: 'DART 공시 기반 회계법인 정보와 수습·신입 CPA 채용공고',
};

export default function FirmLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full">
            <header className="mb-4">
                <h1 className="text-2xl">회계법인</h1>
                <p className="mt-1 text-sm text-foreground/60">
                    DART 공시 기반 회계법인 정보와 수습·신입 CPA 채용공고를 확인하세요.
                </p>
            </header>
            <SectionNav />
            {children}
        </div>
    );
}
