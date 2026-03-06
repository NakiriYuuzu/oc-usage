import { BaseProvider } from './base'
import {
    GEMINI_CLI_API,
    readGeminiToken,
    readGeminiProjectCache,
    writeGeminiProjectCache
} from '../config'
import type {
    ProviderResult,
    QuotaInfo,
    GeminiLoadCodeAssistResponse,
    GeminiLongRunningOperation,
    GeminiRetrieveUserQuotaResponse,
    GeminiBucketInfo
} from '../types'

export class GeminiProvider extends BaseProvider {
    id = 'gemini'
    name = 'Gemini CLI'
    color = '#4285F4'

    async fetch(): Promise<ProviderResult> {
        try {
            const token = await readGeminiToken()

            if (!token) {
                return this.createErrorResult(
                    'Not authenticated. Please run "gemini" to login first.'
                )
            }

            const projectId = await this.resolveProjectId(token)
            const quota = await this.fetchQuota(token, projectId)
            const quotas = this.processQuotaData(quota)

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

            if (message.includes('401') || message.includes('403')) {
                return this.createErrorResult(
                    'Session expired. Please run "gemini" to re-authenticate.'
                )
            }

            return this.createErrorResult(message)
        }
    }

    private async resolveProjectId(token: string): Promise<string> {
        // Priority 1: Environment variable
        const envProject = process.env.GOOGLE_CLOUD_PROJECT
            || process.env.GOOGLE_CLOUD_PROJECT_ID
        if (envProject) {
            return envProject
        }

        // Priority 2: Cached project ID
        const cached = await readGeminiProjectCache()
        if (cached) {
            return cached
        }

        // Priority 3: Discover via Code Assist API
        const projectId = await this.discoverProjectId(token)
        await writeGeminiProjectCache(projectId)
        return projectId
    }

    private async discoverProjectId(token: string): Promise<string> {
        // Step 1: loadCodeAssist to get tier and possibly project ID
        const loadResponse = await this.callApi<GeminiLoadCodeAssistResponse>(
            token,
            'loadCodeAssist',
            {
                metadata: this.getClientMetadata()
            }
        )

        if (loadResponse.cloudaicompanionProject) {
            return loadResponse.cloudaicompanionProject
        }

        // Step 2: Determine tier for onboarding
        const tier = loadResponse.paidTier
            || loadResponse.currentTier
            || loadResponse.allowedTiers?.[0]

        const tierId = tier?.id || 'FREE'

        // Step 3: Onboard to get project ID
        const lro = await this.callApi<GeminiLongRunningOperation>(
            token,
            'onboardUser',
            {
                tierId,
                cloudaicompanionProject: undefined,
                metadata: this.getClientMetadata()
            }
        )

        // If LRO is already done
        const projectFromLro = this.extractProjectFromLro(lro)
        if (projectFromLro) {
            return projectFromLro
        }

        // Poll LRO if not done
        if (lro.name) {
            return await this.pollLro(token, lro.name)
        }

        throw new Error('Failed to discover Gemini CLI project ID. Set GOOGLE_CLOUD_PROJECT env var.')
    }

    private async pollLro(token: string, operationName: string): Promise<string> {
        for (let i = 0; i < GEMINI_CLI_API.LRO_MAX_POLLS; i++) {
            await this.sleep(GEMINI_CLI_API.LRO_POLL_INTERVAL_MS)

            const result = await this.callApi<GeminiLongRunningOperation>(
                token,
                `operations/${operationName}`,
                undefined,
                'GET'
            )

            const projectId = this.extractProjectFromLro(result)
            if (projectId) {
                return projectId
            }

            if (result.done) {
                break
            }
        }

        throw new Error('Gemini CLI onboarding timed out. Set GOOGLE_CLOUD_PROJECT env var.')
    }

    private extractProjectFromLro(lro: GeminiLongRunningOperation): string | null {
        if (!lro.done) {
            return null
        }

        return lro.response?.cloudaicompanionProject?.id
            || lro.response?.cloudaicompanionProject?.name
            || null
    }

    private async fetchQuota(
        token: string,
        projectId: string
    ): Promise<GeminiRetrieveUserQuotaResponse> {
        return this.callApi<GeminiRetrieveUserQuotaResponse>(
            token,
            'retrieveUserQuota',
            { project: projectId }
        )
    }

    private processQuotaData(data: GeminiRetrieveUserQuotaResponse): QuotaInfo[] {
        if (!data.buckets || data.buckets.length === 0) {
            return []
        }

        // Filter out _vertex variants and group by base model name
        const modelMap = new Map<string, GeminiBucketInfo>()

        for (const bucket of data.buckets) {
            const modelId = bucket.modelId || 'unknown'

            // Skip vertex-specific buckets
            if (modelId.endsWith('_vertex')) continue

            const existing = modelMap.get(modelId)

            // Keep the bucket with lower remaining fraction (most constrained)
            if (!existing || this.getBucketFraction(bucket) < this.getBucketFraction(existing)) {
                modelMap.set(modelId, bucket)
            }
        }

        const quotas: QuotaInfo[] = []

        for (const [modelId, bucket] of modelMap) {
            const fraction = this.getBucketFraction(bucket)
            const remainingPercent = Math.round(fraction * 1000) / 10

            const quota: QuotaInfo = {
                label: this.formatModelLabel(modelId),
                used: Math.round((100 - remainingPercent) * 10) / 10,
                total: 100,
                percent: remainingPercent
            }

            if (bucket.resetTime) {
                quota.resetTime = new Date(bucket.resetTime)
            }

            quotas.push(quota)
        }

        // Sort by remaining percent (most used first)
        quotas.sort((a, b) => a.percent - b.percent)

        return quotas
    }

    private getBucketFraction(bucket: GeminiBucketInfo): number {
        if (typeof bucket.remainingFraction === 'number') {
            return bucket.remainingFraction
        }

        return 1
    }

    private formatModelLabel(modelId: string): string {
        return modelId
            .replace(/^gemini-/, '')
            .replace(/-preview$/, '')
            .replace(/-latest$/, '')
    }

    private async callApi<T>(
        token: string,
        method: string,
        body?: object,
        httpMethod: string = 'POST'
    ): Promise<T> {
        const baseUrl = process.env.CODE_ASSIST_ENDPOINT || GEMINI_CLI_API.ENDPOINT
        const version = process.env.CODE_ASSIST_API_VERSION || GEMINI_CLI_API.API_VERSION

        const isOperation = method.startsWith('operations/')
        const url = isOperation
            ? `${baseUrl}/${version}/${method}`
            : `${baseUrl}/${version}:${method}`

        const controller = new AbortController()
        const timeout = setTimeout(
            () => controller.abort(),
            GEMINI_CLI_API.REQUEST_TIMEOUT_MS
        )

        try {
            const options: RequestInit = {
                method: httpMethod,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            }

            if (body && httpMethod === 'POST') {
                options.body = JSON.stringify(body)
            }

            const response = await fetch(url, options)

            if (!response.ok) {
                throw new Error(
                    `Gemini CLI API error: ${response.status} (${method})`
                )
            }

            return await response.json() as T
        } finally {
            clearTimeout(timeout)
        }
    }

    private getClientMetadata(): { ideType: string, platform: string } {
        const arch = process.arch === 'arm64' ? 'ARM64' : 'AMD64'
        let os = 'LINUX'
        if (process.platform === 'darwin') os = 'DARWIN'
        if (process.platform === 'win32') os = 'WINDOWS'

        return {
            ideType: 'GEMINI_CLI',
            platform: `${os}_${arch}`
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}

// Export singleton instance
export const geminiProvider = new GeminiProvider()
