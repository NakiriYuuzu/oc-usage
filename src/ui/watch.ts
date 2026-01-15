import chalk from 'chalk'

export interface WatchOptions {
    interval: number  // in seconds
    onRefresh: () => Promise<void>
    onError?: (error: Error) => void
}

// Clear screen and move cursor to top
export function clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[H')
}

// Format current time
export function formatTimestamp(): string {
    const now = new Date()
    return chalk.gray(`Last updated: ${now.toLocaleTimeString()}`)
}

// Watch mode controller
export async function startWatchMode(options: WatchOptions): Promise<void> {
    const { interval, onRefresh, onError } = options

    // Initial render
    clearScreen()
    await onRefresh()

    console.log()
    console.log(formatTimestamp())
    console.log(chalk.gray(`Refreshing every ${interval} seconds... Press Ctrl+C to exit`))

    // Set up interval
    const timer = setInterval(async () => {
        try {
            clearScreen()
            await onRefresh()
            console.log()
            console.log(formatTimestamp())
            console.log(chalk.gray(`Refreshing every ${interval} seconds... Press Ctrl+C to exit`))
        } catch (error) {
            if (onError && error instanceof Error) {
                onError(error)
            }
        }
    }, interval * 1000)

    // Handle exit
    process.on('SIGINT', () => {
        clearInterval(timer)
        console.log()
        console.log(chalk.gray('Watch mode stopped.'))
        process.exit(0)
    })

    // Keep process alive
    await new Promise(() => {})
}
