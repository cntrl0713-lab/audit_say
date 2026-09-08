// 채점 서버 액션의 실행 시간 상한.
//
// 한 번 제출하면 문제 세트당 OpenAI를 최대 3회 호출한다. 배포 플랫폼의 기본 함수
// 타임아웃이 이보다 짧으면 채점이 통째로 실패하므로 여유를 명시한다.
//
// maxDuration은 라우트 세그먼트 설정이라 서버 컴포넌트에서만 export할 수 있다.
// Server Action의 실행 시간 상한은 이 라우트 세그먼트에 둔다.
export const maxDuration = 180;

export default function QuizLayout({ children }: { children: React.ReactNode }) {
    return children;
}
