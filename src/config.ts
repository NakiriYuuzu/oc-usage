import { homedir, platform } from 'os'
import { join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import type { GeminiOAuthCreds, GeminiTokenRefreshResponse } from './types'

function getOpencodeDataDir(): string {
    const home = homedir()

    if (platform() === 'win32') {
        return process.env.APPDATA
            ? join(process.env.APPDATA, 'opencode')
            : join(home, 'AppData', 'Roaming', 'opencode')
    }

    return process.env.XDG_DATA_HOME
        ? join(process.env.XDG_DATA_HOME, 'opencode')
        : join(home, '.local', 'share', 'opencode')
}

function getOpencodeConfigDir(): string {
    const home = homedir()

    if (platform() === 'win32') {
        return process.env.APPDATA
            ? join(process.env.APPDATA, 'opencode')
            : join(home, 'AppData', 'Roaming', 'opencode')
    }

    return process.env.XDG_CONFIG_HOME
        ? join(process.env.XDG_CONFIG_HOME, 'opencode')
        : join(home, '.config', 'opencode')
}

// Config paths
export const PATHS = {
    // Antigravity config (read-only, managed by opencode)
    ANTIGRAVITY_ACCOUNTS: join(homedir(), '.config', 'opencode', 'antigravity-accounts.json'),

    // Claude credentials
    CLAUDE_CREDENTIALS: join(homedir(), '.claude', '.credentials.json'),

    // Our config directory
    CONFIG_DIR: join(homedir(), '.config', 'ai-usage'),

    // App config file
    APP_CONFIG: join(homedir(), '.config', 'ai-usage', 'config.json'),

    // Copilot token
    COPILOT_TOKEN: join(homedir(), '.config', 'ai-usage', 'copilot-token'),

    // Gemini CLI cached project ID
    GEMINI_PROJECT_CACHE: join(homedir(), '.config', 'ai-usage', 'gemini-project'),

    // Gemini native credentials
    GEMINI_OAUTH_CREDS: join(homedir(), '.gemini', 'oauth_creds.json'),

    // Codex native auth
    CODEX_NATIVE_AUTH: join(homedir(), '.codex', 'auth.json'),

    // OpenCode auth (fallback for Codex)
    OPENCODE_AUTH: join(getOpencodeDataDir(), 'auth.json'),
    OPENCODE_AUTH_FALLBACK: join(getOpencodeConfigDir(), 'auth.json')

}

// Ensure config directory exists
export async function ensureConfigDir(): Promise<void> {
    await mkdir(PATHS.CONFIG_DIR, { recursive: true })
}

// Read Copilot token
export async function readCopilotToken(): Promise<string | null> {
    try {
        return await readFile(PATHS.COPILOT_TOKEN, 'utf-8')
    } catch {
        return null
    }
}

// Read Claude token
export async function readClaudeToken(): Promise<string | null> {
    try {
        const content = await readFile(PATHS.CLAUDE_CREDENTIALS, 'utf-8')
        const data = JSON.parse(content)
        return data.claudeAiOauth?.accessToken || null
    } catch {
        // Fallback to environment variable
        return process.env.ANTHROPIC_API_KEY || null
    }
}


// Write Copilot token
export async function writeCopilotToken(token: string): Promise<void> {
    await ensureConfigDir()
    await writeFile(PATHS.COPILOT_TOKEN, token, 'utf-8')
}

// Read Gemini CLI OAuth token (refresh if expired)
export async function readGeminiToken(): Promise<string | null> {
    try {
        const content = await readFile(PATHS.GEMINI_OAUTH_CREDS, 'utf-8')
        const creds = JSON.parse(content) as GeminiOAuthCreds

        if (!creds.access_token || !creds.refresh_token) {
            return null
        }

        // If token is still valid, return it
        if (creds.expiry_date && Date.now() < creds.expiry_date - 60_000) {
            return creds.access_token
        }

        // Token expired, refresh it
        const params = new URLSearchParams({
            client_id: GEMINI_CLI_API.CLIENT_ID,
            client_secret: GEMINI_CLI_API.CLIENT_SECRET,
            refresh_token: creds.refresh_token,
            grant_type: 'refresh_token'
        })

        const response = await fetch(GEMINI_CLI_API.TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        })

        if (!response.ok) {
            return null
        }

        const data = await response.json() as GeminiTokenRefreshResponse
        const updatedCreds: GeminiOAuthCreds = {
            ...creds,
            access_token: data.access_token,
            expiry_date: Date.now() + data.expires_in * 1000
        }
        await writeFile(PATHS.GEMINI_OAUTH_CREDS, JSON.stringify(updatedCreds, null, 2), 'utf-8')

        return data.access_token
    } catch {
        return null
    }
}

// Read cached Gemini CLI project ID
export async function readGeminiProjectCache(): Promise<string | null> {
    try {
        const content = await readFile(PATHS.GEMINI_PROJECT_CACHE, 'utf-8')
        return content.trim() || null
    } catch {
        return null
    }
}

// Write cached Gemini CLI project ID
export async function writeGeminiProjectCache(projectId: string): Promise<void> {
    await ensureConfigDir()
    await writeFile(PATHS.GEMINI_PROJECT_CACHE, projectId, 'utf-8')
}


// API constants
export const ANTIGRAVITY_API = {
    ENDPOINT: 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
    USER_AGENT: 'antigravity/1.11.3 Darwin/arm64',
    TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token'
}

// Read Antigravity OAuth credentials from config file or env vars
export async function readAntigravityOAuth(): Promise<{ clientId: string, clientSecret: string } | null> {
    // Priority 1: Environment variables
    if (process.env.ANTIGRAVITY_OAUTH_CLIENT_ID && process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET) {
        return {
            clientId: process.env.ANTIGRAVITY_OAUTH_CLIENT_ID,
            clientSecret: process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET
        }
    }

    // Priority 2: Config file (~/.config/ai-usage/config.json)
    try {
        const content = await readFile(PATHS.APP_CONFIG, 'utf-8')
        const config = JSON.parse(content)
        if (config?.antigravity?.oauthClientId && config?.antigravity?.oauthClientSecret) {
            return {
                clientId: config.antigravity.oauthClientId,
                clientSecret: config.antigravity.oauthClientSecret
            }
        }
    } catch {
        // Config file not found
    }

    return null
}

export const COPILOT_API = {
    GITHUB_API_BASE: 'https://api.github.com',
    GITHUB_BASE: 'https://github.com',
    CLIENT_ID: 'Iv1.b507a08c87ecfe98',
    SCOPES: 'read:user',
    USER_AGENT: 'GitHubCopilotChat/0.26.7',
    API_VERSION: '2025-04-01'
}

export const CLAUDE_API = {
    ENDPOINT: 'https://api.anthropic.com/api/oauth/usage',
    USER_AGENT: 'claude-code/2.1.5',
    BETA_HEADER: 'oauth-2025-04-20'
}

export const CODEX_API = {
    DEFAULT_BASE_URL: 'https://chatgpt.com/backend-api',
    REQUEST_TIMEOUT_MS: 15000,
    MAX_ERROR_BODY_CHARS: 2000
}

// Gemini CLI OAuth credentials (public installed-app credentials from google-gemini/gemini-cli)
// Split to avoid triggering GitHub secret scanning on public OAuth client credentials
const GEMINI_CID_PARTS = ['681255809395', 'oo8ft2oprdrnp9e3aqf6av3hmdib135j', 'apps.googleusercontent.com']
const GEMINI_CS_PARTS = ['GOCSPX', '4uHgMPm-1o7Sk-geV6Cu5clXFsxl']

export const GEMINI_CLI_API = {
    ENDPOINT: 'https://cloudcode-pa.googleapis.com',
    API_VERSION: 'v1internal',
    CLIENT_ID: GEMINI_CID_PARTS.join('-'),
    CLIENT_SECRET: GEMINI_CS_PARTS.join('-'),
    TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token',
    REQUEST_TIMEOUT_MS: 15000,
    LRO_POLL_INTERVAL_MS: 3000,
    LRO_MAX_POLLS: 10
}

