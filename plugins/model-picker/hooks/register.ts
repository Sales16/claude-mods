import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import { EFFORTS, MODELS } from './choices'

/** What this mod last set or adopted, so a reload applies only a pick that changed. */
type Applied = { model?: string; effort?: string }

type Field = 'model' | 'effort'

/** True while this mod sets the model or effort itself, so its own change is not adopted back. */
let isApplyingModel = false
let isApplyingEffort = false

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The pick a model or effort spelling stands for, or undefined when none does. */
export function toPick(field: Field, raw: string): string | undefined {
  const value = raw.trim().toLowerCase()
  if (field === 'effort') return EFFORTS.includes(value) ? value : undefined
  if (MODELS.includes(value)) return value

  // A full id or a variant (`claude-opus-5-5`, `opus[1m]`) counts as its family.
  return MODELS.find(model => model !== 'default' && value.includes(model))
}

async function readApplied($: EngineInterface): Promise<Applied | undefined> {
  const value = await $.store.get('applied')

  return value !== null && typeof value === 'object' ? (value as Applied) : undefined
}

async function setOwnRow($: EngineInterface, field: Field, value: string): Promise<void> {
  await $.config.set({ key: field === 'model' ? 'model-picker.model' : 'model-picker.effort', value })
}

/**
 * The first load takes the session's model and effort as the picks, so
 * installing the mod changes nothing.
 */
async function adoptSession($: EngineInterface, options: PluginOptions): Promise<void> {
  const [model, effort] = await Promise.all([$.session.model(), $.env.get('CLAUDE_EFFORT')])
  const applied: Applied = {
    model: toPick('model', model) ?? String(options['model']),
    effort: (effort === undefined ? undefined : toPick('effort', effort)) ?? String(options['effort']),
  }
  // Stored before the rows change: each change reloads this mod.
  await $.store.set('applied', applied)
  if (applied.model !== options['model']) await setOwnRow($, 'model', applied.model ?? '')
  if (applied.effort !== options['effort']) await setOwnRow($, 'effort', applied.effort ?? '')
}

/**
 * Sets the session's model and effort to the picks in `options`, each only
 * when it differs from what this mod last set: a config change reloads the
 * mod, and every load runs this again.
 */
async function applyPicks($: EngineInterface, options: PluginOptions, applied: Applied): Promise<void> {
  const model = String(options['model'])
  const effort = String(options['effort'])
  const next: Applied = { ...applied }

  if (model !== applied.model) {
    isApplyingModel = true
    const result = await $.config.set({ key: 'model', value: model }).finally(() => {
      isApplyingModel = false
    })
    if (result.deny === undefined) {
      next.model = model
      $.ui.toast(`modelo → ${model}`)
    } else {
      $.ui.toast(`modelo: ${result.deny}`)
    }
  }

  if (effort !== applied.effort) {
    next.effort = effort
    $.ui.toast(`effort → ${effort}`)
    isApplyingEffort = true
    // Queued until the session is idle; nothing here waits on it.
    void $.command
      .run({ command: 'effort', args: effort })
      .catch(error => $.ui.toast(`effort: ${message(error)}`))
      .finally(() => {
        isApplyingEffort = false
      })
  }

  await $.store.set('applied', next)
}

/**
 * Takes a model or effort the person set elsewhere (/model, /effort, /config)
 * as this mod's pick, so the mods pane shows what the session runs.
 */
async function adopt($: EngineInterface, options: PluginOptions, field: Field, raw: string): Promise<void> {
  const pick = toPick(field, raw)
  if (pick === undefined) return

  const applied = (await readApplied($)) ?? {}
  await $.store.set('applied', { ...applied, [field]: pick })
  if (options[field] !== pick) await setOwnRow($, field, pick)
}

export const register: Register = (on, options) => {
  const isEnabled = options['enabled'] !== false

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    if (!isEnabled) return started

    // A pick never set or adopted yet (a first load, or a store from before
    // every field had a pick) takes the session's own instead of changing it.
    const applied = await readApplied($)
    if (applied?.model === undefined || applied.effort === undefined) {
      await adoptSession($, options)
    } else {
      await applyPicks($, options, applied)
    }

    return started
  })

  on('command.run', { command: 'model' }, async ($, e, next) => {
    const ran = await next(e)
    if (isEnabled && !isApplyingModel && e.args.trim() !== '') await adopt($, options, 'model', e.args)

    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'effort' }, async ($, e, next) => {
    const ran = await next(e)
    if (isEnabled && !isApplyingEffort && e.args.trim() !== '') await adopt($, options, 'effort', e.args)

    return ran
  }).catch(($, e, next) => next(e))

  on('config.set', { key: 'model' }, async ($, e, next) => {
    const set = await next(e)
    const isOwn = isApplyingModel || (e.origin?.kind === 'plugin' && e.origin.name === 'model-picker')
    if (isEnabled && !isOwn && set.deny === undefined) await adopt($, options, 'model', String(set.value))

    return set
  }).catch(($, e, next) => next(e))
}
