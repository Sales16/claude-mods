export type UsageWindow = { percent: number; resetsAt?: string }

/** Tokens the session's model requests reported, main loop and subagents together. */
export type TokenTally = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type InlineSnapshot = {
  /** Context window fill, 0-100. */
  ctxPercent?: number
  /** Input tokens of the last response. */
  ctxTokens?: number
  /** Token count at which auto-compaction runs. */
  compactAt?: number
  fiveHour?: UsageWindow
  sevenDay?: UsageWindow
  model?: string
  effort?: string
  costUsd?: number
  /** Last clock tick, ms since epoch; drives reset and projection redraws. */
  now?: number
  /** The session the tally counts, so a new session starts it over. */
  sessionId?: string
  tokens?: TokenTally
}

declare module 'claude-code' {
  interface PluginState {
    'status-inline': { snap: InlineSnapshot }
  }
}
