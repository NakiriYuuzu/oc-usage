// Provider types
export interface QuotaInfo {
    label: string
    used: number
    total: number | 'unlimited'
    percent: number
    resetTime?: Date
}

export interface ProviderResult {
    provider: string
    displayName: string
    color: string
    accounts: AccountResult[]
    error?: string
}

export interface AccountResult {
    name: string
    plan?: string
    quotas: QuotaInfo[]
    error?: string
}

export interface Provider {
    id: string
    name: string
    color: string
    fetch(): Promise<ProviderResult>
}

// Antigravity types
export interface AntigravityAccount {
    email: string
    refreshToken: string
    projectId: string
}

export interface AntigravityAccountsFile {
    version: number
    accounts: AntigravityAccount[]
}

export interface AntigravityQuotaInfo {
    remainingFraction: number
    resetTime: string
}

export interface AntigravityModelInfo {
    quotaInfo?: AntigravityQuotaInfo
}

export interface AntigravityModelsResponse {
    models: Record<string, AntigravityModelInfo>
}

export interface AntigravityTokenResponse {
    access_token: string
    expires_in: number
    scope: string
    token_type: string
    id_token: string
}

export type AntigravityModelType = 'gemini-3-pro' | 'gemini' | 'claude'

// Copilot types
export interface CopilotQuotaDetail {
    entitlement: number
    overage_count: number
    overage_permitted: boolean
    percent_remaining: number
    quota_id: string
    quota_remaining: number
    remaining: number
    unlimited: boolean
}

export interface CopilotQuotaSnapshots {
    chat?: CopilotQuotaDetail
    completions?: CopilotQuotaDetail
    premium_interactions: CopilotQuotaDetail
}

export interface CopilotUsageResponse {
    access_type_sku: string
    analytics_tracking_id: string
    assigned_date: string
    can_signup_for_limited: boolean
    chat_enabled: boolean
    copilot_plan: string
    organization_login_list: unknown[]
    organization_list: unknown[]
    quota_reset_date: string
    quota_snapshots: CopilotQuotaSnapshots
}

export interface CopilotDeviceCodeResponse {
    device_code: string
    user_code: string
    verification_uri: string
    expires_in: number
    interval: number
}

export interface CopilotAccessTokenResponse {
    access_token: string
    token_type: string
    scope: string
}

// Claude types
export interface ClaudeCredentialsFile {
    claudeAiOauth?: {
        accessToken?: string
    }
}

export interface ClaudeQuotaWindow {
    utilization: number  // 0-100 percentage used
    resets_at: string    // ISO 8601 timestamp
}

export interface ClaudeUsageResponse {
    seven_day?: ClaudeQuotaWindow
    five_hour?: ClaudeQuotaWindow
}

// OpenCode auth types (for Codex provider)
export interface OpencodeOauthAuth {
    type: 'oauth'
    access: string
    refresh: string
    expires: number
    enterpriseUrl?: string
}

export interface OpencodeApiAuth {
    type: 'api'
    key: string
}

export interface OpencodeWellKnownAuth {
    type: 'wellknown'
    key: string
    token: string
}

export type OpencodeAuthInfo = OpencodeOauthAuth | OpencodeApiAuth | OpencodeWellKnownAuth
export type OpencodeAuthFile = Record<string, OpencodeAuthInfo>

// Codex usage types
export interface CodexRateLimitWindow {
    used_percent?: number
    limit_window_seconds?: number
    reset_after_seconds?: number
    reset_at?: number
}

export interface CodexRateLimitInfo {
    primary_window?: CodexRateLimitWindow | null
    secondary_window?: CodexRateLimitWindow | null
}

export interface CodexCreditsInfo {
    unlimited?: boolean
    balance?: string | number | null
}

export interface CodexUsageResponse {
    plan_type?: string
    rate_limit?: CodexRateLimitInfo | null
    credits?: CodexCreditsInfo | null
}

// Gemini native OAuth credentials (~/.gemini/oauth_creds.json)
export interface GeminiOAuthCreds {
    access_token: string
    refresh_token: string
    scope: string
    token_type: string
    id_token: string
    expiry_date: number
}

// Codex native auth (~/.codex/auth.json)
export interface CodexNativeAuth {
    auth_mode: string
    OPENAI_API_KEY: string | null
    tokens: {
        id_token: string
        access_token: string
        refresh_token: string
        account_id: string
    }
    last_refresh: string
}

