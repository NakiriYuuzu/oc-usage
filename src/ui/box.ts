import chalk from 'chalk'
import { boxChars, squareBoxChars, colors } from './colors'

export interface BoxOptions {
    title?: string
    titleColor?: (text: string) => string
    width?: number
    padding?: number
}

// Create a rounded box header
export function createBoxHeader(options: BoxOptions = {}): string {
    const { title, titleColor = colors.cyan, width = 60 } = options

    if (title) {
        const titleStr = ` ${title} `
        const remainingWidth = width - titleStr.length - 2
        const leftPad = 2
        const rightPad = remainingWidth - leftPad

        return (
            chalk.gray(boxChars.topLeft) +
            chalk.gray(boxChars.horizontal.repeat(leftPad)) +
            titleColor(titleStr) +
            chalk.gray(boxChars.horizontal.repeat(Math.max(0, rightPad))) +
            chalk.gray(boxChars.topRight)
        )
    }

    return (
        chalk.gray(boxChars.topLeft) +
        chalk.gray(boxChars.horizontal.repeat(width - 2)) +
        chalk.gray(boxChars.topRight)
    )
}

// Create a box footer
export function createBoxFooter(width: number = 60): string {
    return (
        chalk.gray(boxChars.bottomLeft) +
        chalk.gray(boxChars.horizontal.repeat(width - 2)) +
        chalk.gray(boxChars.bottomRight)
    )
}

// Create a box line with content
export function createBoxLine(content: string, width: number = 60): string {
    // Strip ANSI codes for length calculation
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '')
    const contentLength = stripAnsi(content).length
    const padding = Math.max(0, width - contentLength - 4)

    return (
        chalk.gray(boxChars.vertical) +
        ' ' +
        content +
        ' '.repeat(padding) +
        ' ' +
        chalk.gray(boxChars.vertical)
    )
}

// Create empty line in box
export function createEmptyBoxLine(width: number = 60): string {
    return (
        chalk.gray(boxChars.vertical) +
        ' '.repeat(width - 2) +
        chalk.gray(boxChars.vertical)
    )
}

// Create a square section header (for inner sections)
export function createSquareBoxHeader(title: string, width: number = 58, color?: (text: string) => string): string {
    const colorFn = color || chalk.white
    const titleStr = ` ${title} `
    const remainingWidth = width - titleStr.length - 2
    const leftPad = 1
    const rightPad = Math.max(0, remainingWidth - leftPad)

    return (
        chalk.gray(squareBoxChars.topLeft) +
        chalk.gray(squareBoxChars.horizontal.repeat(leftPad)) +
        colorFn(titleStr) +
        chalk.gray(squareBoxChars.horizontal.repeat(rightPad)) +
        chalk.gray(squareBoxChars.topRight)
    )
}

// Create a title banner
export function createTitleBanner(title: string, width: number = 60): string[] {
    const lines: string[] = []

    lines.push(
        chalk.gray(boxChars.topLeft) +
        chalk.gray(boxChars.horizontal.repeat(width - 2)) +
        chalk.gray(boxChars.topRight)
    )

    const titleStr = `  ${title}  `
    const padding = Math.max(0, width - titleStr.length - 2)
    lines.push(
        chalk.gray(boxChars.vertical) +
        chalk.bold.cyan(titleStr) +
        ' '.repeat(padding) +
        chalk.gray(boxChars.vertical)
    )

    lines.push(
        chalk.gray(boxChars.bottomLeft) +
        chalk.gray(boxChars.horizontal.repeat(width - 2)) +
        chalk.gray(boxChars.bottomRight)
    )

    return lines
}

// Pad string to specific visible length
export function padEnd(str: string, length: number): string {
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
    const visibleLength = stripAnsi(str).length
    const paddingNeeded = Math.max(0, length - visibleLength)
    return str + ' '.repeat(paddingNeeded)
}

export function padStart(str: string, length: number): string {
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
    const visibleLength = stripAnsi(str).length
    const paddingNeeded = Math.max(0, length - visibleLength)
    return ' '.repeat(paddingNeeded) + str
}
