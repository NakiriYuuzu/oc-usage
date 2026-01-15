import chalk from 'chalk'
import { getQuotaColor, progressChars } from './colors'

export interface ProgressBarOptions {
    width?: number
    showPercent?: boolean
}

export function createProgressBar(
    percent: number,
    options: ProgressBarOptions = {}
): string {
    const { width = 20, showPercent = true } = options

    // Clamp percent between 0 and 100
    const clampedPercent = Math.max(0, Math.min(100, percent))
    const filledCount = Math.round((clampedPercent / 100) * width)
    const emptyCount = width - filledCount

    const colorFn = getQuotaColor(clampedPercent)

    const filled = colorFn(progressChars.filled.repeat(filledCount))
    const empty = chalk.gray(progressChars.empty.repeat(emptyCount))

    const bar = filled + empty

    if (showPercent) {
        const percentStr = clampedPercent.toFixed(1).padStart(5) + '%'
        return `${bar}  ${colorFn(percentStr)}`
    }

    return bar
}

// Format used/total with proper alignment
export function formatUsage(used: number, total: number | 'unlimited'): string {
    if (total === 'unlimited') {
        return `${used}/\u221E`  // ∞
    }
    return `${used}/${total}`
}

// Format reset time as relative time
export function formatResetTime(date: Date, isFullQuota: boolean = false): string {
    const now = new Date()
    let diffMs = date.getTime() - now.getTime()

    // For 100% quota, add 1 minute for cleaner display
    if (isFullQuota) {
        diffMs += 60 * 1000
    }

    // Already reset
    if (diffMs <= 0) {
        return chalk.gray('expired')
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const totalHours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60

    // Days
    if (totalHours >= 24) {
        const days = Math.floor(totalHours / 24)
        const hours = totalHours % 24
        const dayLabel = days === 1 ? 'day' : 'days'

        if (hours > 0 && minutes > 0) {
            return chalk.cyan(`${days} ${dayLabel} ${hours}h ${minutes}m`)
        } else if (hours > 0) {
            return chalk.cyan(`${days} ${dayLabel} ${hours}h`)
        } else if (minutes > 0) {
            return chalk.cyan(`${days} ${dayLabel} ${minutes}m`)
        }
        return chalk.cyan(`${days} ${dayLabel}`)
    }

    // Hours and minutes
    if (totalHours > 0 && minutes > 0) {
        return chalk.cyan(`${totalHours}h ${minutes}m`)
    } else if (totalHours > 0) {
        return chalk.cyan(`${totalHours}h`)
    }

    return chalk.cyan(`${minutes}m`)
}

// Format date as YYYY-MM-DD
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
}
