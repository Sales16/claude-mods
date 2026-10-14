import type { InlineSnapshot, TokenTally, UsageWindow } from '../types'

export const NEON = '#39FF14'
export const YELLOW = '#FFE600'
export const RED = '#FF3131'

/** The `color` option's picks, by the name `/config` and the mods pane show. */
export const COLORS: Record<string, string> = {
  'verde-neon': NEON,
  ciano: '#00F0FF',
  magenta: '#FF2BD6',
  laranja: '#FF9F1C',
  azul: '#3D8BFF',
  roxo: '#B266FF',
  branco: '#F2F2F2',
}

/** The `bar_style` option's picks: the filled cell, then the empty one. */
export const BAR_STYLES = ['▰▱', '█░', '■□', '●○', '⣿⣀', '━┄']

/** How a reset time is labelled: hidden, `9:00`, `↻9:00` or `reset às 9:00`. */
export type ResetLabel = 'oculto' | 'valor' | 'ícone' | 'texto'

const RESET_LABELS: readonly ResetLabel[] = ['oculto', 'valor', 'ícone', 'texto']

const BAR_CELLS = 8

/** How the session's tokens show: hidden, every token, without cache reads, or in and out apart. */
export type TokensMode = 'oculto' | 'total' | 'sem-cache' | 'in/out'

const TOKENS_MODES: readonly TokensMode[] = ['oculto', 'total', 'sem-cache', 'in/out']

export type Part = { text: string; color: string; isDim?: boolean }

export type Show = {
  ctx: boolean
  fiveHour: boolean
  sevenDay: boolean
  model: boolean
  effort: boolean
  cost: boolean
  compact: boolean
  burn: boolean
  bars: boolean
  tokens: TokensMode
}

export type Limits = { warnAt: number; dangerAt: number }

export type Theme = { accent: string; full: string; empty: string; resetLabel: ResetLabel }

export const DEFAULT_THEME: Theme = { accent: NEON, full: '▰', empty: '▱', resetLabel: 'ícone' }

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
const MIN_ELAPSED_FOR_PROJECTION_MS = 10 * 60 * 1000
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const EFFORTS: Record<string, string> = { low: 'lo', medium: 'md', high: 'hi', xhigh: 'xh', max: 'max' }

/** Drop order for narrow terminals: each level removes one more group. */
const LEVELS = 6

export function readShow(options: Readonly<Record<string, unknown>>): Show {
  const on = (key: string) => options[key] !== false

  return {
    ctx: on('ctx'),
    fiveHour: on('five_hour'),
    sevenDay: on('seven_day'),
    model: on('model'),
    effort: on('effort'),
    cost: on('cost'),
    compact: on('compact'),
    burn: on('burn'),
    bars: on('bars'),
    tokens: TOKENS_MODES.find(mode => mode === options['tokens']) ?? 'total',
  }
}

export function readLimits(options: Readonly<Record<string, unknown>>): Limits {
  const num = (key: string, fallback: number) =>
    typeof options[key] === 'number' ? (options[key] as number) : fallback

  return { warnAt: num('warn_at', 70), dangerAt: num('danger_at', 90) }
}

export function readTheme(options: Readonly<Record<string, unknown>>): Theme {
  const accent = COLORS[String(options['color'])] ?? NEON
  const style = BAR_STYLES.includes(String(options['bar_style'])) ? String(options['bar_style']) : '▰▱'
  const [full = '▰', empty = '▱'] = Array.from(style)
  const resetLabel = RESET_LABELS.find(label => label === options['reset_label']) ?? DEFAULT_THEME.resetLabel

  return { accent, full, empty, resetLabel }
}

export function levelColor(percent: number, limits: Limits, theme: Theme = DEFAULT_THEME): string {
  if (percent >= limits.dangerAt) return RED
  if (percent >= limits.warnAt) return YELLOW

  return theme.accent
}

export function bar(percent: number, theme: Theme = DEFAULT_THEME): string {
  const filled = Math.max(0, Math.min(BAR_CELLS, Math.round((percent / 100) * BAR_CELLS)))

  return theme.full.repeat(filled) + theme.empty.repeat(BAR_CELLS - filled)
}

export function shortModel(model: string): string {
  return model
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/-\d{8}$/, '')
    .replace(/^claude[-\s]/, '')
    .trim()
    .replace(/(\d+)[-.](\d+)/g, '$1.$2')
    .replace(/[\s-]+/g, '')
}

export function shortEffort(effort: string): string {
  return EFFORTS[effort] ?? effort
}

export function resetClock(iso: string): string {
  const at = new Date(iso)

  return `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`
}

export function resetDay(iso: string): string {
  return WEEKDAYS[new Date(iso).getDay()] ?? ''
}

/** A reset as the `reset_label` option spells it; undefined when hidden. */
export function resetText(value: string, preposition: string, label: ResetLabel): string | undefined {
  if (label === 'oculto') return undefined
  if (label === 'valor') return value
  if (label === 'texto') return `reset ${preposition} ${value}`

  return `↻${value}`
}

export function kTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`

  return tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens)
}

export function tokensText(tally: TokenTally, mode: TokensMode): string | undefined {
  const input = tally.input + tally.cacheWrite
  if (mode === 'oculto') return undefined
  if (mode === 'in/out') return `tok ↑${kTokens(input + tally.cacheRead)} ↓${kTokens(tally.output)}`
  if (mode === 'sem-cache') return `tok ${kTokens(input + tally.output)}`

  return `tok ${kTokens(input + tally.cacheRead + tally.output)}`
}

/** Percent of the 5h window used at reset time if the current pace holds. */
export function projectFiveHour(window: UsageWindow, now: number): number | undefined {
  if (window.resetsAt === undefined) return undefined
  const startedAt = new Date(window.resetsAt).getTime() - FIVE_HOURS_MS
  const elapsed = now - startedAt
  if (elapsed < MIN_ELAPSED_FOR_PROJECTION_MS || elapsed > FIVE_HOURS_MS) return undefined

  return Math.round((window.percent * FIVE_HOURS_MS) / elapsed)
}

export function textWidth(text: string): number {
  let width = 0
  for (const char of text) width += (char.codePointAt(0) ?? 0) >= 0x1f000 ? 2 : 1

  return width
}

function meter(label: string, percent: number, limits: Limits, theme: Theme, hasBar: boolean): Part[] {
  const color = levelColor(percent, limits, theme)
  const parts: Part[] = [{ text: `${label} `, color: theme.accent }]
  if (hasBar) parts.push({ text: `${bar(percent, theme)} `, color })
  parts.push({ text: `${Math.round(percent)}%`, color })

  return parts
}

function segmentsAt(
  level: number,
  snap: InlineSnapshot,
  show: Show,
  limits: Limits,
  theme: Theme,
  now: number,
): Part[][] {
  const hasBars = show.bars && level < 1
  const hasExtras = level < 2
  const hasResets = level < 3
  const hasSevenDay = level < 4
  const hasModel = level < 5
  const segments: Part[][] = []

  if (show.ctx && snap.ctxPercent !== undefined) {
    segments.push(meter('ctx', snap.ctxPercent, limits, theme, hasBars))
  }

  if (show.fiveHour && snap.fiveHour !== undefined) {
    const parts = meter('5h', snap.fiveHour.percent, limits, theme, hasBars)
    const reset =
      snap.fiveHour.resetsAt === undefined
        ? undefined
        : resetText(resetClock(snap.fiveHour.resetsAt), 'às', theme.resetLabel)
    if (hasResets && reset !== undefined) parts.push({ text: ` ${reset}`, color: theme.accent, isDim: true })
    segments.push(parts)
  }

  if (show.sevenDay && hasSevenDay && snap.sevenDay !== undefined) {
    const parts = meter('7d', snap.sevenDay.percent, limits, theme, hasBars)
    const reset =
      snap.sevenDay.resetsAt === undefined
        ? undefined
        : resetText(resetDay(snap.sevenDay.resetsAt), 'em', theme.resetLabel)
    if (hasResets && reset !== undefined) parts.push({ text: ` ${reset}`, color: theme.accent, isDim: true })
    segments.push(parts)
  }

  if (hasModel) {
    const names = [
      show.model && snap.model !== undefined ? shortModel(snap.model) : undefined,
      show.effort && snap.effort !== undefined ? shortEffort(snap.effort) : undefined,
    ].filter((name): name is string => name !== undefined && name !== '')
    if (names.length > 0) segments.push([{ text: names.join('·'), color: theme.accent }])
  }

  if (hasExtras) {
    if (show.cost && snap.costUsd !== undefined) {
      segments.push([{ text: `$${snap.costUsd.toFixed(2)}`, color: theme.accent }])
    }

    const tokens = snap.tokens === undefined ? undefined : tokensText(snap.tokens, show.tokens)
    if (tokens !== undefined) segments.push([{ text: tokens, color: theme.accent }])

    if (show.compact && snap.compactAt !== undefined && snap.ctxTokens !== undefined) {
      const left = Math.max(0, snap.compactAt - snap.ctxTokens)
      const color = left < snap.compactAt * 0.1 ? YELLOW : theme.accent
      segments.push([{ text: `cmp ≈${kTokens(left)}`, color }])
    }

    const projected = show.burn && snap.fiveHour !== undefined ? projectFiveHour(snap.fiveHour, now) : undefined
    if (projected !== undefined) {
      segments.push([{ text: `🔥 →${projected}%`, color: levelColor(projected, limits, theme) }])
    }
  }

  return segments
}

function join(segments: Part[][], theme: Theme): Part[] {
  const separator: Part = { text: ' │ ', color: theme.accent, isDim: true }

  return segments.flatMap(segment => [separator, ...segment])
}

function width(parts: Part[]): number {
  return parts.reduce((sum, part) => sum + textWidth(part.text), 0)
}

/**
 * The parts to draw after the mode line, each led by a separator: the richest
 * level that fits in `room` columns, else the leanest (the line truncates it).
 */
export function layout(
  snap: InlineSnapshot,
  show: Show,
  limits: Limits,
  theme: Theme,
  room: number,
  now: number,
): Part[] {
  let parts: Part[] = []
  for (let level = 0; level < LEVELS; level++) {
    parts = join(segmentsAt(level, snap, show, limits, theme, now), theme)
    if (width(parts) <= room) return parts
  }

  return parts
}
