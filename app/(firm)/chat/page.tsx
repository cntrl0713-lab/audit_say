import { MilestonePlaceholder } from '../_components/MilestonePlaceholder';

export default function ChatPage() {
    return (
        <MilestonePlaceholder
            milestone="M5"
            title="회계법인 전용 챗봇"
            description="법인 컨텍스트를 정해 두고 플랫폼 내부 데이터 범위 안에서만 답합니다. Gemini API 단일 엔진, 유료 구독 전용입니다."
        />
    );
}
