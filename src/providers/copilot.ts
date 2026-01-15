import chalk from 'chalk'
import { BaseProvider } from './base'
import { COPILOT_API, readCopilotToken, writeCopilotToken, ensureConfigDir } from '../config'
import type {
    ProviderResult,
    QuotaInfo,
    CopilotUsageResponse,
    CopilotDeviceCodeResponse,
    CopilotAccessTokenResponse
} from '../types'

export class CopilotProvider extends BaseProvider {
    id = 'copilot'
    name = 'GitHub Copilot'
    color = '#6E40C9'

    private token: string | null = null

    async fetch(): Promise<ProviderResult> {
        try {
            // Try to load existing token
            if (!this.token) {
                this.token = await readCopilotToken()
            }

            if (!this.token) {
                return this.createErrorResult(
                    'Not authenticated. Run "oc-usage copilot auth" to login.'
                )
            }

            const usage = await this.fetchUsage()
            const quotas = this.processUsageData(usage)

            return {
                provider: this.id,
                displayName: this.name,
                color: this.color,
                accounts: [{
                    name: 'default',
                    plan: usage.copilot_plan,
                    quotas
                }]
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)

            // Check if token is invalid
            if (message.includes('401') || message.includes('403') || message.includes('Unauthorized')) {
                this.token = null
                return this.createErrorResult(
                    'Session expired. Run "oc-usage copilot auth" to re-authenticate.'
                )
            }

            return this.createErrorResult(message)
        }
    }

    async authenticate(): Promise<void> {
        await ensureConfigDir()

        console.log(chalk.cyan('Starting GitHub authentication...'))

        // Get device code
        const deviceCode = await this.getDeviceCode()

        console.log()
        console.log(chalk.yellow('Please visit:'), chalk.bold(deviceCode.verification_uri))
        console.log(chalk.yellow('Enter code:'), chalk.bold.green(deviceCode.user_code))
        console.log()
        console.log(chalk.gray('Waiting for authorization...'))

        // Poll for access token
        const token = await this.pollAccessToken(deviceCode)

        // Save token
        await writeCopilotToken(token)
        this.token = token

        console.log(chalk.green('Successfully authenticated!'))
    }

    private async getDeviceCode(): Promise<CopilotDeviceCodeResponse> {
        const response = await fetch(`${COPILOT_API.GITHUB_BASE}/login/device/code`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: COPILOT_API.CLIENT_ID,
                scope: COPILOT_API.SCOPES
            })
        })

        if (!response.ok) {
            throw new Error(`Failed to get device code: ${response.status}`)
        }

        return await response.json() as CopilotDeviceCodeResponse
    }

    private async pollAccessToken(deviceCode: CopilotDeviceCodeResponse): Promise<string> {
        const pollInterval = deviceCode.interval * 1000
        const expiresAt = Date.now() + deviceCode.expires_in * 1000

        while (Date.now() < expiresAt) {
            await this.sleep(pollInterval)

            const response = await fetch(`${COPILOT_API.GITHUB_BASE}/login/oauth/access_token`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: COPILOT_API.CLIENT_ID,
                    device_code: deviceCode.device_code,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                })
            })

            if (!response.ok) {
                continue
            }

            const data = await response.json() as CopilotAccessTokenResponse & { error?: string }

            if (data.error === 'authorization_pending') {
                continue
            }

            if (data.error === 'slow_down') {
                await this.sleep(5000)
                continue
            }

            if (data.error === 'expired_token') {
                throw new Error('Device code expired. Please try again.')
            }

            if (data.error) {
                throw new Error(`Authentication error: ${data.error}`)
            }

            if (data.access_token) {
                return data.access_token
            }
        }

        throw new Error('Authentication timed out. Please try again.')
    }

    private async fetchUsage(): Promise<CopilotUsageResponse> {
        const response = await fetch(`${COPILOT_API.GITHUB_API_BASE}/copilot_internal/user`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `token ${this.token}`,
                'User-Agent': COPILOT_API.USER_AGENT,
                'X-GitHub-Api-Version': COPILOT_API.API_VERSION
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch usage: ${response.status}`)
        }

        return await response.json() as CopilotUsageResponse
    }

    private processUsageData(usage: CopilotUsageResponse): QuotaInfo[] {
        const quotas: QuotaInfo[] = []
        const resetDate = new Date(usage.quota_reset_date)

        // Premium interactions
        const premium = usage.quota_snapshots.premium_interactions
        const premiumTotal = premium.entitlement
        const premiumUsed = premiumTotal - premium.remaining
        const premiumPercent = premium.percent_remaining

        quotas.push({
            label: 'Premium',
            used: premiumUsed,
            total: premiumTotal,
            percent: premiumPercent,
            resetTime: resetDate
        })

        // Chat
        if (usage.quota_snapshots.chat) {
            const chat = usage.quota_snapshots.chat
            if (chat.unlimited) {
                quotas.push({
                    label: 'Chat',
                    used: chat.entitlement - chat.remaining,
                    total: 'unlimited',
                    percent: 100
                })
            } else {
                quotas.push({
                    label: 'Chat',
                    used: chat.entitlement - chat.remaining,
                    total: chat.entitlement,
                    percent: chat.percent_remaining,
                    resetTime: resetDate
                })
            }
        }

        // Completions
        if (usage.quota_snapshots.completions) {
            const completions = usage.quota_snapshots.completions
            if (completions.unlimited) {
                quotas.push({
                    label: 'Completions',
                    used: completions.entitlement - completions.remaining,
                    total: 'unlimited',
                    percent: 100
                })
            } else {
                quotas.push({
                    label: 'Completions',
                    used: completions.entitlement - completions.remaining,
                    total: completions.entitlement,
                    percent: completions.percent_remaining,
                    resetTime: resetDate
                })
            }
        }

        return quotas
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}

// Export singleton instance
export const copilotProvider = new CopilotProvider()
