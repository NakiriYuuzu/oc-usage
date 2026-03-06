# oc-usage

CLI tool to monitor AI platform usage quotas with a pretty terminal UI.

## Features

- **Antigravity** (Google Cloud Code/IDX) usage monitoring
- **GitHub Copilot** usage monitoring
- **Claude** (Anthropic) usage monitoring
- **Gemini CLI** (Google) usage monitoring
- Pretty terminal UI with box drawing
- Watch mode with auto-refresh
- JSON output for scripting

## Installation

```bash
# Using npx (no install)
npx @yuuzu/oc-usage

# Using bunx
bunx @yuuzu/oc-usage

# Global install
npm install -g @yuuzu/oc-usage
```

## Usage

```bash
# Show all providers
oc-usage

# Show specific provider
oc-usage ag          # Antigravity
oc-usage cp          # GitHub Copilot
oc-usage cl          # Claude
oc-usage gm          # Gemini CLI

# Watch mode (auto-refresh every 30s)
oc-usage -w
oc-usage ag -w -i 60  # Custom interval (60s)

# JSON output
oc-usage -j
oc-usage cl -j
```

## Authentication

### Antigravity

Reads credentials from `~/.config/opencode/antigravity-accounts.json` (managed by OpenCode/IDX).

### GitHub Copilot

```bash
# Authenticate with GitHub
oc-usage cp auth
```

This uses GitHub Device Code flow to authenticate.

### Claude

Reads OAuth token from `~/.claude/.credentials.json` (managed by Claude CLI).

Alternatively, set the `ANTHROPIC_API_KEY` environment variable.

### Gemini CLI

Reads OAuth credentials from `~/.gemini/oauth_creds.json` (managed by Gemini CLI).

Optionally set `GOOGLE_CLOUD_PROJECT` environment variable for explicit project ID.

## Screenshot

```
╭───────────────────────────────────────────────────────────────╮
│  AI Usage Monitor                                             │
╰───────────────────────────────────────────────────────────────╯
╭── Antigravity ────────────────────────────────────────────────╮
│ Account: user@example.com                                     │
│                                                               │
│ gemini-3-pro   ████████████████     100.0%  22m               │
│ gemini         ████████████░░░░      75.0%  5h 1m             │
│ claude         ██████░░░░░░░░░░      40.0%  4h 44m            │
╰───────────────────────────────────────────────────────────────╯
╭── GitHub Copilot ─────────────────────────────────────────────╮
│ Plan: individual                                              │
│                                                               │
│ Premium        ███████████████░      94.1%  16 days           │
│ Chat           ████████████████  unlimited                    │
│ Completions    ████████████████  unlimited                    │
╰───────────────────────────────────────────────────────────────╯
╭── Claude ─────────────────────────────────────────────────────╮
│                                                               │
│ Weekly         ██████████░░░░░░      63.0%  3 days            │
│ Daily          ████████████░░░░      76.0%  3h                │
╰───────────────────────────────────────────────────────────────╯
╭── Gemini CLI ─────────────────────────────────────────────────╮
│                                                               │
│ 2.5-pro        ██████████░░░░░░      65.0%  1 day             │
│ 2.5-flash      ████████████████     100.0%  1 day             │
│ 3-pro          ████████████████     100.0%  1 day             │
╰───────────────────────────────────────────────────────────────╯
```

## License

MIT
