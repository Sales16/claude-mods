import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { InlineSnapshot } from '../types'
import { bar, DEFAULT_THEME, kTokens, layout, levelColor, NEON, RED, readShow, readTheme, shortEffort, shortModel, textWidth, tokensText, YELLOW } from './format'

const LIMITS = { warnAt: 70, dangerAt: 90 }
const SHOW_ALL = readShow({})
const NOW = Date.parse('2026-10-13T12:00:00Z')

const SNAP: InlineSnapshot = {
  ctxPercent: 62,
  ctxTokens: 120_000,
  compactAt: 138_000,
  fiveHour: { percent: 18, resetsAt: '2026-10-13T14:30:00Z' },
  sevenDay: { percent: 41, resetsAt: '2026-10-16T09:00:00Z' },
  model: 'claude-opus-5-5',
  effort: 'xhigh',
  costUsd: 1.234,
  now: NOW,
}

const MEASURE = {
  context: { tokens: 120_000, window: 200_000, percent: 62 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 18, resetsAt: '2026-10-13T14:30:00Z' },
    { kind: 'seven_day', percentUsed: 41, resetsAt: '2026-10-16T09:00:00Z' },
  ],
  cost: { usd: 1.234 },
  changed: ['context', 'rateLimits', 'cost'] as const,
}

function world(on: On) {
  mock.clock(on, { now: NOW })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text key="engine-hint">{e.props.hint}</Text>
  })
}

const text = (parts: { text: string }[]) => parts.map(part => part.text).join('')

describe('format', () => {
  test('bar fills one of 8 cells per 12.5%', () => {
    expect(bar(0)).toBe('▱▱▱▱▱▱▱▱')
    expect(bar(62)).toBe('▰▰▰▰▰▱▱▱')
    expect(bar(100)).toBe('▰▰▰▰▰▰▰▰')
    expect(bar(140)).toBe('▰▰▰▰▰▰▰▰')
  })

  test('model and effort are abbreviated', () => {
    expect(shortModel('claude-opus-5-5')).toBe('opus5.5')
    expect(shortModel('Opus 5.5 (1M context)')).toBe('opus5.5')
    expect(shortModel('claude-sonnet-4-5-20250929')).toBe('sonnet4.5')
    expect(shortEffort('xhigh')).toBe('xh')
    expect(shortEffort('medium')).toBe('md')
  })

  test('colors follow the thresholds', () => {
    expect(levelColor(10, LIMITS)).toBe(NEON)
    expect(levelColor(70, LIMITS)).toBe(YELLOW)
    expect(levelColor(95, LIMITS)).toBe(RED)
  })

  test('wide room shows every segment with bars', () => {
    const line = text(layout(SNAP, SHOW_ALL, LIMITS, DEFAULT_THEME, 500, NOW))
    expect(line).toContain('ctx ▰▰▰▰▰▱▱▱ 62%')
    expect(line).toContain('5h ▰▱▱▱▱▱▱▱ 18% ↻')
    expect(line).toContain('7d ▰▰▰▱▱▱▱▱ 41% ↻sex')
    expect(line).toContain('opus5.5·xh')
    expect(line).toContain('$1.23')
    expect(line).toContain('cmp ≈18k')
    expect(line).toContain('🔥 →')
  })

  test('narrow room drops bars, then extras, then resets, then 7d', () => {
    const noBars = text(layout(SNAP, SHOW_ALL, LIMITS, DEFAULT_THEME, 90, NOW))
    expect(noBars).toContain('ctx 62%')
    expect(noBars).toContain('$1.23')

    const noExtras = text(layout(SNAP, SHOW_ALL, LIMITS, DEFAULT_THEME, 56, NOW))
    expect(noExtras).not.toContain('$')
    expect(noExtras).toContain('↻')

    const leanest = text(layout(SNAP, SHOW_ALL, LIMITS, DEFAULT_THEME, 10, NOW))
    expect(leanest).toBe(' │ ctx 62% │ 5h 18%')
  })

  test('hidden fields are left out', () => {
    const line = text(layout(SNAP, readShow({ seven_day: false, cost: false }), LIMITS, DEFAULT_THEME, 500, NOW))
    expect(line).not.toContain('7d')
    expect(line).not.toContain('$')
  })

  test('color and bar style come from the options', () => {
    const theme = readTheme({ color: 'ciano', bar_style: '█░' })
    expect(theme).toEqual({ accent: '#00F0FF', full: '█', empty: '░', resetLabel: 'ícone' })
    expect(bar(62, theme)).toBe('█████░░░')
    expect(levelColor(10, LIMITS, theme)).toBe('#00F0FF')
    expect(readTheme({ color: 'nope', bar_style: 'xx' })).toEqual(DEFAULT_THEME)
  })

  test('reset label hides, shows the value, an icon or text', () => {
    const line = (resetLabel: string) =>
      text(layout(SNAP, SHOW_ALL, LIMITS, readTheme({ reset_label: resetLabel }), 500, NOW))
    expect(line('oculto')).not.toMatch(/↻|reset|sex/)
    expect(line('valor')).toContain('41% sex')
    expect(line('ícone')).toContain('41% ↻sex')
    expect(line('texto')).toContain('41% reset em sex')
    expect(line('texto')).toMatch(/18% reset às \d{1,2}:30/)
  })

  test('session tokens show as total, without cache reads, or in and out', () => {
    const tally = { input: 5_000, output: 40_000, cacheRead: 1_150_000, cacheWrite: 30_000 }
    expect(kTokens(1_225_000)).toBe('1.2M')
    expect(tokensText(tally, 'total')).toBe('tok 1.2M')
    expect(tokensText(tally, 'sem-cache')).toBe('tok 75k')
    expect(tokensText(tally, 'in/out')).toBe('tok ↑1.2M ↓40k')
    expect(tokensText(tally, 'oculto')).toBeUndefined()

    const line = text(layout({ ...SNAP, tokens: tally }, readShow({ tokens: 'sem-cache' }), LIMITS, DEFAULT_THEME, 500, NOW))
    expect(line).toContain(' │ tok 75k │ ')
  })

  test('emoji count two columns', () => {
    expect(textWidth('🔥→9%')).toBe(5)
  })
})

describe('mode line', () => {
  test('meters draw after the mode line on every surface', async ($, on) => {
    world(on)
    await $.session.measure({ ...MEASURE, changed: [...MEASURE.changed] })

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({
        plugin: 'status-inline',
        surface,
        component: 'PromptHint',
        props: { isDraft: false, isWorking: false, hint: '⏵⏵ auto mode on' },
        viewport: { columns: 200, rows: 40 },
      })
      expect(await ui.find({ type: 'Text', text: /ctx/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /5h ▰▱▱▱▱▱▱▱ 18%/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('disabled mod draws the engine line alone', { options: { enabled: false } }, async ($, on) => {
    world(on)
    await $.session.measure({ ...MEASURE, changed: [...MEASURE.changed] })
    const ui = await $.ui.mount({
      plugin: 'status-inline',
      surface: 'terminal',
      component: 'PromptHint',
      props: { isDraft: false, isWorking: false, hint: '⏵⏵ auto mode on' },
      viewport: { columns: 200, rows: 40 },
    })
    expect(await ui.find({ type: 'Text', text: /ctx/ })).toBeUndefined()
    await ui.unmount()
  })
})
