// 채점 서버 액션의 실행 시간 상한.
//
// 한 번 제출하면 문항 수만큼 Gemini를 호출하고(문항당 최대 3회 재시도), 배포 플랫폼의
// 기본 함수 타임아웃은 그보다 짧을 수 있다. 타임아웃이 나면 채점이 통째로 실패하므로
// 여유를 명시한다.
//
// maxDuration은 라우트 세그먼트 설정이라 서버 컴포넌트에서만 export할 수 있다.
// page.tsx는 'use client'라 여기에 둔다 — 이 레이아웃은 그 목적 하나뿐이다.
export const maxDuration = 60;

export default function QuizLayout({ children }: { children: React.ReactNode }) {
    return children;
}
