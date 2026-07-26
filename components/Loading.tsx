import React from 'react';

/**
 * 페이지 단위 로딩 표시. 각 페이지가 제각각 문구와 크기를 만들지 않도록 한 곳에 둔다.
 * 스피너는 hairline 톤을 쓰고 브랜드 오렌지는 CTA에만 남긴다 (DESIGN.md).
 */
export const Loading: React.FC<{ label?: string }> = ({ label = '불러오는 중' }) => (
    <div className="flex flex-col items-center justify-center flex-1 py-24 gap-3">
        <div className="w-6 h-6 border-2 border-card-border border-t-foreground/50 rounded-full animate-spin" />
        <p className="text-sm text-foreground/50">{label}</p>
    </div>
);
