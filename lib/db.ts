// Shared client/server DTO for audit learning and service administration.
export interface UserProfile {
    id: string;
    username: string;
    role: 'MEMBER' | 'ADMIN' | 'PRO' | 'GUEST';
    level: number;
    exp: number;
    email?: string;
    created_at?: string;
    is_service_admin?: boolean;
}
