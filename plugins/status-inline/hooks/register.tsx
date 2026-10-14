import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMeasureInput } from 'claude-code'

import type { InlineSnapshot, TokenTally } from '../types'
import { layout, readLimits, readShow, readTheme, textWidth } from './format'

const snap = atom({ plugin: 'status-inline', key: 'snap' } as const, {})

/** Columns the mods-hub pane takes from the transcript while docked beside it. */
const hubDock = { plugin: 'mods-hub', key: 'dock' } as const

const NO_TOKENS: TokenTally = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

/** Columns kept free for the mods-hub `◆ mods` button and its space. */
const HUB_RESERVE = 7
const TICK_MS = 60 * 1000

type Usage = Pick<SessionMeasureInput, 'context' | 'rateLimits' | 'cost'>

function fromUsage(usage: Usage): Partial<InlineSnapshot> {
  const window = (kind: string) => {
    const found = usage.rateLimits.find(limit => limit.kind === kind)

    return found === undefined ? undefined : { percent: found.percentUsed, resetsAt: found.resetsAt }
  }

  return {
    ctxPercent: usage.context.percent,
    ctxTokens: usage.context.tokens,
    fiveHour: window('five_hour'),
    sevenDay: window('seven_day'),
    costUsd: usage.cost?.usd,
  }
}

async function readCompactAt($: EngineInterface): Promise<number | undefined> {
  try {
    const { context } = await $.session.usage({ breakdown: 'summary' })

    return context.breakdown?.autoCompactThreshold
  } catch {
    // The breakdown needs a bound session; the meters draw without cmp.
    return undefined
  }
}

export const register: Register = (on, options) => {
  const show = readShow(options)
  const limits = readLimits(options)
  const theme = readTheme(options)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // The first turn.step reports the effort in force; until then the
    // process environment and the settings hold the session's choice.
    const [sessionId, usage, model, settings, envEffort, compactAt, now] = await Promise.all([
      $.session.id(),
      $.session.usage(),
      $.session.model(),
      $.settings.read(),
      $.env.get('CLAUDE_EFFORT'),
      readCompactAt($),
      $.clock.now(),
    ])
    const settingsEffort = (settings as Record<string, unknown>)['effortLevel']
    const effort = envEffort ?? (typeof settingsEffort === 'string' ? settingsEffort : undefined)
    await update($, snap, old => ({
      ...old,
      ...fromUsage(usage),
      model,
      effort: effort ?? old.effort,
      compactAt: compactAt ?? old.compactAt,
      now,
      sessionId,
      tokens: old.sessionId === sessionId ? old.tokens : undefined,
    }))
    $.clock.every(TICK_MS, () => {
      void $.clock.now().then(now => update($, snap, old => ({ ...old, now })))
    })

    return started
  })

  on('session.measure', async ($, e, next) => {
    const now = await $.clock.now()
    const old = await read($, snap)
    const compactAt = old.compactAt ?? (await readCompactAt($))
    await update($, snap, current => ({ ...current, ...fromUsage(e), compactAt, now }))

    return next(e)
  })

  on('session.end', { reason: 'clear' }, async ($, e, next) => {
    await update($, snap, old => ({ ...old, tokens: undefined }))

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const effort = e.effort === undefined ? undefined : String(e.effort)
      const old = await read($, snap)
      const hasModelChanged = old.model !== undefined && old.model !== e.model
      await update($, snap, current => ({
        ...current,
        model: e.model,
        effort: effort ?? current.effort,
        compactAt: hasModelChanged ? undefined : current.compactAt,
      }))
    }

    const result = yield* next(e)
    const usage = result.usage
    if (usage !== null) {
      await update($, snap, current => {
        const tally = current.tokens ?? NO_TOKENS

        return {
          ...current,
          tokens: {
            input: tally.input + usage.input_tokens,
            output: tally.output + usage.output_tokens,
            cacheRead: tally.cacheRead + usage.cache_read_input_tokens,
            cacheWrite: tally.cacheWrite + usage.cache_creation_input_tokens,
          },
        }
      })
    }

    return result
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const drawn = await next(e)
    if (options['enabled'] === false) return drawn

    const current = await read($, snap)
    // The mode line runs under the transcript and a docked pane alike, while
    // the viewport counts the transcript's columns alone.
    const { value: dock = 0 } = await $.state.get(hubDock)
    const columns = (e.viewport?.columns ?? 100) + dock
    const used = textWidth(e.props.hint) + textWidth(e.props.tail ?? '') + HUB_RESERVE
    const parts = layout(current, show, limits, theme, columns - used - 1, current.now ?? 0)
    if (parts.length === 0) return drawn

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row">
        {drawn}
        <Text wrap="truncate-end">
          {parts.map(part => (
            <Text color={part.color} dimColor={part.isDim === true}>
              {part.text}
            </Text>
          ))}
        </Text>
      </Box>
    )
  })
}
