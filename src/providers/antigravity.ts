import { readFile } from 'fs/promises'
import { BaseProvider } from './base'
import { PATHS, ANTIGRAVITY_API } from '../config'
import type {
    ProviderResult,
    AccountResult,
    QuotaInfo,
    AntigravityAccountsFile,
    AntigravityModelsResponse,
    AntigravityTokenResponse,
    AntigravityModelType
} from '../types'

export class AntigravityProvider extends BaseProvider {
    id = 'antigravity'
    name = 'Antigravity'
    color = '#4285F4'

    async fetch(): Promise<ProviderResult> {
        try {
            const config = await this.loadAccounts()
            const accounts: AccountResult[] = []

            for (const account of config.accounts) {
                try {
                    const accessToken = await this.refreshAccessToken(account.refreshToken)
                    const quotas = await this.fetchQuotas(accessToken, account.projectId)

                    accounts.push({
                        name: account.email,
                        quotas
                    })
                } catch (error) {
                    accounts.push({
                        name: account.email,
                        quotas: [],
                        error: error instanceof Error ? error.message : String(error)
                    })
                }
            }

            return {
                provider: this.id,
                displayName: this.name,
                color: this.color,
                accounts
            }
        } catch (error) {
            return this.createErrorResult(
                error instanceof Error ? error.message : String(error)
            )
        }
    }

    private async loadAccounts(): Promise<AntigravityAccountsFile> {
        try {
            const content = await readFile(PATHS.ANTIGRAVITY_ACCOUNTS, 'utf-8')
            const data = JSON.parse(content) as AntigravityAccountsFile

            if (!data.accounts || !Array.isArray(data.accounts)) {
                throw new Error('Invalid accounts.json format')
            }

            return data
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
                throw new Error(
                    `Config not found: ${PATHS.ANTIGRAVITY_ACCOUNTS}\n` +
                    'Please make sure you are logged in to Antigravity/OpenCode.'
                )
            }
            throw error
        }
    }

    private async refreshAccessToken(refreshToken: string): Promise<string> {
        const params = new URLSearchParams({
            client_id: ANTIGRAVITY_API.OAUTH_CLIENT_ID,
            client_secret: ANTIGRAVITY_API.OAUTH_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })

        const response = await fetch(ANTIGRAVITY_API.TOKEN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Failed to refresh token: ${response.status} ${errorText}`)
        }

        const data = await response.json() as AntigravityTokenResponse
        return data.access_token
    }

    private async fetchQuotas(accessToken: string, projectId: string): Promise<QuotaInfo[]> {
        const response = await fetch(ANTIGRAVITY_API.ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': ANTIGRAVITY_API.USER_AGENT
            },
            body: JSON.stringify({ project: projectId })
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Failed to fetch quota: ${response.status} ${errorText}`)
        }

        const data = await response.json() as AntigravityModelsResponse
        return this.processQuotaData(data)
    }

    private processQuotaData(data: AntigravityModelsResponse): QuotaInfo[] {
        const quotaMap = new Map<AntigravityModelType, QuotaInfo>()

        for (const [modelName, modelInfo] of Object.entries(data.models)) {
            if (!modelInfo.quotaInfo) continue

            let modelType: AntigravityModelType | null = null
            let displayLabel: string = ''

            if (modelName.startsWith('gemini-3-pro-high')) {
                modelType = 'gemini-3-pro'
                displayLabel = 'gemini-3-pro'
            } else if (modelName.startsWith('gemini-3-flash')) {
                modelType = 'gemini'
                displayLabel = 'gemini'
            } else if (modelName.startsWith('claude')) {
                modelType = 'claude'
                displayLabel = 'claude'
            }

            if (modelType && !quotaMap.has(modelType)) {
                const fraction = modelInfo.quotaInfo.remainingFraction
                const remainingPercent = typeof fraction === 'number' && !isNaN(fraction)
                    ? Math.round(fraction * 1000) / 10
                    : 0

                quotaMap.set(modelType, {
                    label: displayLabel,
                    used: Math.round((100 - remainingPercent) * 10) / 10,
                    total: 100,
                    percent: remainingPercent,
                    resetTime: new Date(modelInfo.quotaInfo.resetTime)
                })
            }
        }

        // Sort: gemini-3-pro, gemini, claude
        const modelOrder: AntigravityModelType[] = ['gemini-3-pro', 'gemini', 'claude']
        const sortedQuotas: QuotaInfo[] = []

        for (const model of modelOrder) {
            const quota = quotaMap.get(model)
            if (quota) {
                sortedQuotas.push(quota)
            }
        }

        return sortedQuotas
    }
}

// Export singleton instance
export const antigravityProvider = new AntigravityProvider()
