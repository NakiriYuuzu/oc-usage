import type { Provider, ProviderResult } from '../types'

// Base provider class
export abstract class BaseProvider implements Provider {
    abstract id: string
    abstract name: string
    abstract color: string

    abstract fetch(): Promise<ProviderResult>

    protected createErrorResult(error: string): ProviderResult {
        return {
            provider: this.id,
            displayName: this.name,
            color: this.color,
            accounts: [],
            error
        }
    }
}
