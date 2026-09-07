import type { Metadata } from 'next';
import { SectionNav } from './_components/SectionNav';

export const metadata: Metadata = {
    title: '회계법인 리서치 | Audit Say',
    description: 'DART 공시 데이터로 보는 회계법인 감사 포트폴리오·운영지표·평점',
};

export default function FirmLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full">
            <header className="mb-4">
                <h1 className="text-2xl">회계법인 리서치</h1>
                <p className="mt-1 text-sm text-foreground/60">
                    DART 공시 데이터를 회계법인 중심으로 재구조화한 탐색 공간입니다.
                </p>
            </header>
            <SectionNav />
            {children}
        </div>
    );
}
