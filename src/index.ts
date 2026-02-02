#!/usr/bin/env bun

import { Command } from 'commander'
import chalk from 'chalk'
import type { ProviderResult } from './types'
import { antigravityProvider } from './providers/antigravity'
import { copilotProvider } from './providers/copilot'
import { claudeProvider } from './providers/claude'
import { renderAll, renderProvider, renderTitle, renderJson } from './ui/render'
import { startWatchMode } from './ui/watch'

const program = new Command()

program
    .name('oc-usage')
    .description('Monitor AI platform usage quotas')
    .version('1.1.0')

// Global options
program
    .option('-w, --watch', 'Watch mode - auto refresh')
    .option('-i, --interval <seconds>', 'Refresh interval in seconds', '30')
    .option('-j, --json', 'Output as JSON')

// Default command - show all providers
program
    .action(async (options) => {
        const providers = [antigravityProvider, copilotProvider, claudeProvider]

        const fetchAll = async (): Promise<ProviderResult[]> => {
            return Promise.all(providers.map(p => p.fetch()))
        }

        if (options.json) {
            const results = await fetchAll()
            renderJson(results)
            return
        }

        if (options.watch) {
            const interval = parseInt(options.interval, 10)
            await startWatchMode({
                interval,
                onRefresh: async () => {
                    const results = await fetchAll()
                    renderAll(results)
                }
            })
            return
        }

        const results = await fetchAll()
        renderAll(results)
    })

// Antigravity subcommand
program
    .command('antigravity')
    .alias('ag')
    .description('Show only Antigravity usage')
    .option('-w, --watch', 'Watch mode - auto refresh')
    .option('-i, --interval <seconds>', 'Refresh interval in seconds', '30')
    .option('-j, --json', 'Output as JSON')
    .action(async (options, command) => {
        const jsonFlag = command.opts().json || options?.json || process.argv.includes('-j') || process.argv.includes('--json')
        if (jsonFlag) {
            const result = await antigravityProvider.fetch()
            renderJson([result])
            return
        }

        if (options.watch) {
            const interval = parseInt(options.interval, 10)
            await startWatchMode({
                interval,
                onRefresh: async () => {
                    const result = await antigravityProvider.fetch()
                    renderTitle()
                    renderProvider(result)
                }
            })
            return
        }

        const result = await antigravityProvider.fetch()
        renderTitle()
        renderProvider(result)
    })

// Copilot subcommand
const copilotCmd = program
    .command('copilot')
    .alias('cp')
    .description('Show only Copilot usage')
    .option('-w, --watch', 'Watch mode - auto refresh')
    .option('-i, --interval <seconds>', 'Refresh interval in seconds', '30')
    .option('-j, --json', 'Output as JSON')
    .action(async (options, command) => {
        const jsonFlag = command.opts().json || options?.json || process.argv.includes('-j') || process.argv.includes('--json')
        if (jsonFlag) {
            const result = await copilotProvider.fetch()
            renderJson([result])
            return
        }

        if (options.watch) {
            const interval = parseInt(options.interval, 10)
            await startWatchMode({
                interval,
                onRefresh: async () => {
                    const result = await copilotProvider.fetch()
                    renderTitle()
                    renderProvider(result)
                }
            })
            return
        }

        const result = await copilotProvider.fetch()
        renderTitle()
        renderProvider(result)
    })

// Copilot auth subcommand
copilotCmd
    .command('auth')
    .description('Authenticate with GitHub Copilot')
    .action(async () => {
        try {
            await copilotProvider.authenticate()
        } catch (error) {
            console.error(chalk.red('Authentication failed:'), error instanceof Error ? error.message : String(error))
            process.exit(1)
        }
    })

// Claude subcommand
program
    .command('claude')
    .alias('cl')
    .description('Show only Claude usage')
    .option('-w, --watch', 'Watch mode - auto refresh')
    .option('-i, --interval <seconds>', 'Refresh interval in seconds', '30')
    .option('-j, --json', 'Output as JSON')
    .action(async (options, command) => {
        const jsonFlag = command.opts().json || options?.json || process.argv.includes('-j') || process.argv.includes('--json')
        if (jsonFlag) {
            const result = await claudeProvider.fetch()
            renderJson([result])
            return
        }

        if (options.watch) {
            const interval = parseInt(options.interval, 10)
            await startWatchMode({
                interval,
                onRefresh: async () => {
                    const result = await claudeProvider.fetch()
                    renderTitle()
                    renderProvider(result)
                }
            })
            return
        }

        const result = await claudeProvider.fetch()
        renderTitle()
        renderProvider(result)
    })

// Parse arguments
program.parse()
