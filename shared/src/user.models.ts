export interface UserInfo {
    id: number;
    username: string;
    valid: boolean;
    admin: boolean;
    created_at: string;
    ip_address: string | null;
    user_agent: string | null;
    last_login: string | null;
    credential_count: number;
}
