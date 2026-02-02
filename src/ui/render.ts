import chalk from 'chalk'
import type { ProviderResult, QuotaInfo } from '../types'
import { colors } from './colors'
import {
    createBoxHeader,
    createBoxFooter,
    createBoxLine,
    createEmptyBoxLine,
    createTitleBanner,
    padEnd,
    padStart
} from './box'
import { createProgressBar, formatResetTime } from './progress'

const BOX_WIDTH = 65
const CONTENT_WIDTH = BOX_WIDTH - 4  // Account for borders and padding

// Get provider color
function getProviderColor(provider: string): (text: string) => string {
    switch (provider) {
        case 'antigravity': return colors.antigravity
        case 'copilot': return colors.copilot
        default: return colors.cyan
    }
}

// Wrap text to fit within box width
function wrapText(text: string, maxWidth: number): string[] {
    // Replace newlines with spaces
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

    const words = cleanText.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
        if (currentLine.length === 0) {
            currentLine = word
        } else if (currentLine.length + 1 + word.length <= maxWidth) {
            currentLine += ' ' + word
        } else {
            lines.push(currentLine)
            currentLine = word
        }
    }

    if (currentLine.length > 0) {
        lines.push(currentLine)
    }

    return lines
}

// Render the title banner
export function renderTitle(): void {
    const lines = createTitleBanner('AI Usage Monitor', BOX_WIDTH)
    for (const line of lines) {
        console.log(line)
    }
}

// Render a single provider's usage
export function renderProvider(result: ProviderResult): void {
    const providerColor = getProviderColor(result.provider)

    console.log()
    console.log(createBoxHeader({ title: result.displayName, titleColor: providerColor, width: BOX_WIDTH }))

    if (result.error) {
        // Wrap error message to fit in box
        const errorLines = wrapText(result.error, CONTENT_WIDTH - 7)  // -7 for "Error: "
        console.log(createBoxLine(chalk.red(`Error: ${errorLines[0]}`), BOX_WIDTH))
        for (let i = 1; i < errorLines.length; i++) {
            console.log(createBoxLine(chalk.red(`       ${errorLines[i]}`), BOX_WIDTH))
        }
        console.log(createBoxFooter(BOX_WIDTH))
        return
    }

    for (const account of result.accounts) {
        if (result.accounts.length > 1 || account.name !== 'default') {
            console.log(createBoxLine(chalk.white(`Account: ${account.name}`), BOX_WIDTH))
        }

        if (account.plan) {
            console.log(createBoxLine(chalk.gray(`Plan: ${account.plan}`), BOX_WIDTH))
        }

        if (account.error) {
            console.log(createBoxLine(chalk.red(`Error: ${account.error}`), BOX_WIDTH))
            continue
        }

        console.log(createEmptyBoxLine(BOX_WIDTH))

        for (const quota of account.quotas) {
            renderQuotaLine(quota)
        }
    }

    console.log(createBoxFooter(BOX_WIDTH))
}

// Render a single quota line with progress bar
function renderQuotaLine(quota: QuotaInfo): void {
    const labelWidth = 14
    const label = padEnd(quota.label, labelWidth)

    const progressBar = createProgressBar(quota.percent, { width: 16, showPercent: false })

    let usageStr: string
    if (quota.total === 'unlimited') {
        usageStr = chalk.gray('unlimited')
    } else {
        usageStr = `${quota.percent.toFixed(1)}%`
    }
    usageStr = padStart(usageStr, 10)

    let resetStr = ''
    if (quota.resetTime) {
        const isFullQuota = quota.percent >= 99.9
        resetStr = '  ' + formatResetTime(quota.resetTime, isFullQuota)
    }

    const content = `${chalk.white(label)} ${progressBar} ${usageStr}${resetStr}`
    console.log(createBoxLine(content, BOX_WIDTH))
}

// Render all providers
export function renderAll(results: ProviderResult[]): void {
    renderTitle()

    for (const result of results) {
        renderProvider(result)
    }
}

// Render as JSON
export function renderJson(results: ProviderResult[]): void {
    const output = results.map(result => ({
        provider: result.provider,
        displayName: result.displayName,
        error: result.error,
        accounts: result.accounts.map(account => ({
            name: account.name,
            plan: account.plan,
            error: account.error,
            quotas: account.quotas.map(quota => ({
                label: quota.label,
                used: quota.used,
                total: quota.total,
                percent: quota.percent,
                resetTime: quota.resetTime?.toISOString()
            }))
        }))
    }))

    console.log(JSON.stringify(output, null, 2))
}
