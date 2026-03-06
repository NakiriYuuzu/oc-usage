import chalk, { type ChalkInstance } from 'chalk'

// Dark OLED theme colors
export const colors = {
    // Base colors
    primary: chalk.hex('#0F172A'),
    secondary: chalk.hex('#334155'),
    muted: chalk.hex('#64748B'),
    text: chalk.hex('#F8FAFC'),

    // Status colors
    success: chalk.hex('#22C55E'),
    warning: chalk.hex('#EAB308'),
    error: chalk.hex('#EF4444'),

    // Accent colors
    cyan: chalk.hex('#06B6D4'),
    purple: chalk.hex('#A855F7'),
    blue: chalk.hex('#3B82F6'),

    // Provider-specific colors
    antigravity: chalk.hex('#4285F4'),  // Google Blue
    copilot: chalk.hex('#6E40C9'),      // GitHub Purple
    claude: chalk.hex('#DA7756'),       // Claude Terracotta
    codex: chalk.hex('#19C37D'),         // Codex Green
    gemini: chalk.hex('#886FBF')         // Gemini Purple
}

// Get color based on percentage (remaining quota)
export function getQuotaColor(percent: number): ChalkInstance {
    if (percent >= 50) return colors.success
    if (percent >= 20) return colors.warning
    return colors.error
}

// Progress bar characters
export const progressChars = {
    filled: '\u2588',    // █
    empty: '\u2591',     // ░
    half: '\u2592'       // ▒
}

// Box drawing characters
export const boxChars = {
    topLeft: '\u256D',      // ╭
    topRight: '\u256E',     // ╮
    bottomLeft: '\u2570',   // ╰
    bottomRight: '\u256F',  // ╯
    horizontal: '\u2500',   // ─
    vertical: '\u2502',     // │
    teeRight: '\u251C',     // ├
    teeLeft: '\u2524'       // ┤
}

// Square box characters (for inner sections)
export const squareBoxChars = {
    topLeft: '\u250C',      // ┌
    topRight: '\u2510',     // ┐
    bottomLeft: '\u2514',   // └
    bottomRight: '\u2518',  // ┘
    horizontal: '\u2500',   // ─
    vertical: '\u2502'      // │
}
