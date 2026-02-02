import { BaseProvider } from './base'
import { CLAUDE_API, readClaudeToken } from '../config'
import type {
    ProviderResult,
    QuotaInfo,
    ClaudeUsageResponse
} from '../types'

export class ClaudeProvider extends BaseProvider {
    id = 'claude'
    name = 'Claude'
    color = '#D4714C'

    async fetch(): Promise<ProviderResult> {
        try {
            // Get token
            const token = await readClaudeToken()

            if (!token) {
                return this.createErrorResult(
                    'Not authenticated. Please configure ~/.claude/.credentials.json or set ANTHROPIC_API_KEY.'
                )
            }

            const usage = await this.fetchUsage(token)
            const quotas = this.processUsageData(usage)

            return {
                provider: this.id,
                displayName: this.name,
                color: this.color,
                accounts: [{
                    name: 'default',
                    quotas
                }]
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)

            // Check if token is invalid
            if (message.includes('401') || message.includes('403') || message.includes('Unauthorized')) {
                return this.createErrorResult(
                    'Session expired. Please update ~/.claude/.credentials.json or ANTHROPIC_API_KEY.'
                )
            }

            return this.createErrorResult(message)
        }
    }

    private async fetchUsage(token: string): Promise<ClaudeUsageResponse> {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        try {
            const response = await fetch(CLAUDE_API.ENDPOINT, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'anthropic-beta': CLAUDE_API.BETA_HEADER,
                    'User-Agent': CLAUDE_API.USER_AGENT
                },
                signal: controller.signal
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch usage: ${response.status}`)
            }

            return await response.json() as ClaudeUsageResponse
        } finally {
            clearTimeout(timeout)
        }
    }

    private processUsageData(data: ClaudeUsageResponse): QuotaInfo[] {
        const quotas: QuotaInfo[] = []

        // Seven day quota (Weekly)
        if (data.seven_day) {
            const window = data.seven_day
            const percent = 100 - window.utilization
            const resetTime = new Date(window.resets_at)

            quotas.push({
                label: 'Weekly',
                used: window.utilization,
                total: 100,
                percent,
                resetTime
            })
        }

        // Five hour quota (Daily)
        if (data.five_hour) {
            const window = data.five_hour
            const percent = 100 - window.utilization
            const resetTime = new Date(window.resets_at)

            quotas.push({
                label: 'Daily',
                used: window.utilization,
                total: 100,
                percent,
                resetTime
            })
        }

        return quotas
    }
}

// Export singleton instance
export const claudeProvider = new ClaudeProvider()
