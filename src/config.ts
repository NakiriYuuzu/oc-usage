import { homedir, platform } from 'os'
import { join } from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'

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

    // Copilot token
    COPILOT_TOKEN: join(homedir(), '.config', 'ai-usage', 'copilot-token'),

    // OpenCode auth (for Codex)
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


// API constants
export const ANTIGRAVITY_API = {
    ENDPOINT: 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
    USER_AGENT: 'antigravity/1.11.3 Darwin/arm64',
    OAUTH_CLIENT_ID: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
    OAUTH_CLIENT_SECRET: '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',
    TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token'
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

