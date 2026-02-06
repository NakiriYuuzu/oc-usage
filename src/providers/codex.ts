import { readFile } from 'fs/promises'
import { BaseProvider } from './base'
import { PATHS, CODEX_API } from '../config'
import type {
    ProviderResult,
    AccountResult,
    QuotaInfo,
    OpencodeAuthFile,
    OpencodeOauthAuth,
    CodexUsageResponse,
    CodexRateLimitWindow,
    CodexCreditsInfo
} from '../types'

interface OauthSelection {
    providerID: string
    access: string
    enterpriseUrl?: string
}

export class CodexProvider extends BaseProvider {
    id = 'codex'
    name = 'Codex'
    color = '#19C37D'

    async fetch(): Promise<ProviderResult> {
        try {
            const auth = await this.readAuthFile()
            const oauth = this.pickOauthAuth(auth)

            if (!oauth) {
                return this.createErrorResult('Codex OAuth credentials missing in OpenCode auth.json')
            }

            const baseUrl = process.env.OPENCODE_CODEX_BASE_URL || oauth.enterpriseUrl || CODEX_API.DEFAULT_BASE_URL
            const usage = await this.fetchUsage(oauth.access, baseUrl)
            const account = this.processUsageData(usage)

            return {
                provider: this.id,
                displayName: this.name,
                color: this.color,
                accounts: [account]
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)

            if (message.includes('401') || message.includes('403') || message.includes('Unauthorized')) {
                return this.createErrorResult(
                    'Session expired. Please re-authenticate OpenCode to refresh Codex token.'
                )
            }

            return this.createErrorResult(message)
        }
    }

    private async readAuthFile(): Promise<OpencodeAuthFile> {
        const candidates = [PATHS.OPENCODE_AUTH, PATHS.OPENCODE_AUTH_FALLBACK]
        let bestError: { path: string, message: string } | null = null

        for (const path of candidates) {
            try {
                const content = await readFile(path, 'utf-8')
                return JSON.parse(content) as OpencodeAuthFile
            } catch (error) {
                if (this.isMissingFileError(error)) {
                    continue
                }

                if (!bestError) {
                    bestError = {
                        path,
                        message: error instanceof Error ? error.message : String(error)
                    }
                }

                continue
            }
        }

        if (bestError) {
            throw new Error(`Failed to read OpenCode auth.json at ${bestError.path}: ${bestError.message}`)
        }

        throw new Error(
            `Codex auth.json not found. Checked: ${candidates.join(', ')}`
        )
    }

    private pickOauthAuth(auth: OpencodeAuthFile): OauthSelection | null {
        const preferred = ['opencode', 'codex', 'openai']

        for (const providerID of preferred) {
            const info = auth[providerID]
            if (info?.type === 'oauth') {
                return {
                    providerID,
                    access: info.access,
                    enterpriseUrl: info.enterpriseUrl
                }
            }
        }

        for (const [providerID, info] of Object.entries(auth)) {
            if (info.type === 'oauth') {
                const oauthInfo = info as OpencodeOauthAuth
                return {
                    providerID,
                    access: oauthInfo.access,
                    enterpriseUrl: oauthInfo.enterpriseUrl
                }
            }
        }

        return null
    }

    private async fetchUsage(accessToken: string, baseUrl: string): Promise<CodexUsageResponse> {
        const url = this.buildUsageUrl(baseUrl)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), CODEX_API.REQUEST_TIMEOUT_MS)

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                signal: controller.signal
            })

            const endpointPath = this.getEndpointPath(url)
            if (!response.ok) {
                throw new Error(`Failed to fetch usage: ${response.status} (${endpointPath})`)
            }

            const bodyText = await response.text()
            const payload = JSON.parse(bodyText) as CodexUsageResponse
            return payload
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error('Failed to parse Codex usage response')
            }
            throw error
        } finally {
            clearTimeout(timeout)
        }
    }

    private processUsageData(data: CodexUsageResponse): AccountResult {
        const quotas: QuotaInfo[] = []
        const rateLimit = data.rate_limit

        if (rateLimit?.primary_window) {
            const primary = this.parseRateLimitWindow('Primary', rateLimit.primary_window)
            if (primary) {
                quotas.push(primary)
            }
        }

        if (rateLimit?.secondary_window) {
            const secondary = this.parseRateLimitWindow('Secondary', rateLimit.secondary_window)
            if (secondary) {
                quotas.push(secondary)
            }
        }

        if (data.credits) {
            const credits = this.parseCreditsQuota(data.credits)
            if (credits) {
                quotas.push(credits)
            }
        }

        if (quotas.length === 0) {
            throw new Error('Codex quota payload did not include rate limits or credits')
        }

        return {
            name: 'default',
            plan: data.plan_type,
            quotas
        }
    }

    private parseCreditsQuota(credits: CodexCreditsInfo): QuotaInfo | null {
        if (credits.unlimited) {
            return {
                label: 'Credits',
                used: 0,
                total: 'unlimited',
                percent: 100
            }
        }

        const balance = this.toNumber(credits.balance)
        if (balance === null) {
            return null
        }

        return {
            label: 'Credits',
            used: this.roundOneDecimal(balance),
            total: 'unlimited',
            percent: 100
        }
    }

    private parseRateLimitWindow(label: string, snapshot: CodexRateLimitWindow): QuotaInfo | null {
        const usedPercent = this.toNumber(snapshot.used_percent)
        if (usedPercent === null) {
            return null
        }

        const clampedUsed = this.clampPercent(usedPercent)
        const remainingPercent = this.roundOneDecimal(100 - clampedUsed)
        const resetTime = this.getResetTime(snapshot)

        const quota: QuotaInfo = {
            label,
            used: this.roundOneDecimal(clampedUsed),
            total: 100,
            percent: remainingPercent
        }

        if (resetTime) {
            quota.resetTime = resetTime
        }

        return quota
    }

    private getResetTime(snapshot: CodexRateLimitWindow): Date | null {
        const resetAfter = this.toNumber(snapshot.reset_after_seconds)
        if (resetAfter !== null) {
            return new Date(Date.now() + Math.max(0, resetAfter * 1000))
        }

        const resetAt = this.toNumber(snapshot.reset_at)
        if (resetAt !== null) {
            return new Date(resetAt * 1000)
        }

        return null
    }

    private buildUsageUrl(baseUrl: string): string {
        const trimmed = baseUrl.replace(/\/+$/, '')
        if (trimmed.includes('/backend-api')) {
            return `${trimmed}/wham/usage`
        }
        return `${trimmed}/api/codex/usage`
    }

    private getEndpointPath(url: string): string {
        try {
            return new URL(url).pathname
        } catch {
            return url
        }
    }

    private toNumber(value: unknown): number | null {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value
        }

        if (typeof value === 'string') {
            const parsed = Number.parseFloat(value)
            if (Number.isFinite(parsed)) {
                return parsed
            }
        }

        return null
    }

    private clampPercent(value: number): number {
        return Math.max(0, Math.min(100, value))
    }

    private roundOneDecimal(value: number): number {
        return Math.round(value * 10) / 10
    }

    private isMissingFileError(error: unknown): boolean {
        if (!error || typeof error !== 'object') {
            return false
        }

        return 'code' in error && error.code === 'ENOENT'
    }
}

// Export singleton instance
export const codexProvider = new CodexProvider()
