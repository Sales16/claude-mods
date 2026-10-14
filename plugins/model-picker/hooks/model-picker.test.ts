import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { toPick } from './register'

const START = { cwd: 'C:/work', source: 'startup', isInteractive: true } as never
const APPLIED = { applied: { model: 'opus', effort: 'high' } }

function world(on: On, store: Record<string, unknown> = APPLIED) {
  const sets: { key: string; value: unknown }[] = []
  const commands: { command: string; args: string }[] = []
  mock.store(on, store)
  mock.env(on, { CLAUDE_EFFORT: 'medium' })
  on('session.start', () => ({ cwd: 'C:/work' }))
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('config.set', ($, e) => {
    sets.push({ key: e.key, value: e.value })

    return { value: e.value }
  })
  on('command.run', ($, e) => {
    commands.push({ command: e.command, args: e.args })

    return { text: '' }
  })

  return { sets, commands }
}

describe('model-picker', () => {
  test('spellings map to picks', () => {
    expect(toPick('model', 'claude-opus-5-5')).toBe('opus')
    expect(toPick('model', 'sonnet[1m]')).toBe('sonnet')
    expect(toPick('model', 'Default')).toBe('default')
    expect(toPick('model', 'gpt')).toBeUndefined()
    expect(toPick('effort', 'xhigh')).toBe('xhigh')
    expect(toPick('effort', 'auto')).toBeUndefined()
  })

  test('the first load adopts the session instead of changing it', async ($, on) => {
    const { sets, commands } = world(on, {})
    await $.session.start(START)
    expect(sets).toEqual([
      { key: 'model-picker.model', value: 'sonnet' },
      { key: 'model-picker.effort', value: 'medium' },
    ])
    expect(commands).toEqual([])
  })

  test('a store with an empty pick adopts the session too', async ($, on) => {
    const { sets, commands } = world(on, { applied: {} })
    await $.session.start(START)
    expect(sets).toEqual([
      { key: 'model-picker.model', value: 'sonnet' },
      { key: 'model-picker.effort', value: 'medium' },
    ])
    expect(commands).toEqual([])
  })

  test('a changed pick sets the model and the effort once', { options: { model: 'sonnet', effort: 'max' } }, async ($, on) => {
    const { sets, commands } = world(on)
    await $.session.start(START)
    expect(sets).toEqual([{ key: 'model', value: 'sonnet' }])
    expect(commands).toEqual([{ command: 'effort', args: 'max' }])

    await $.session.start(START)
    expect(sets).toEqual([{ key: 'model', value: 'sonnet' }])
    expect(commands).toHaveLength(1)
  })

  test('an unchanged pick leaves the session alone', { options: { model: 'opus', effort: 'high' } }, async ($, on) => {
    const { sets, commands } = world(on)
    await $.session.start(START)
    expect(sets).toEqual([])
    expect(commands).toEqual([])
  })

  test('disabled applies nothing', { options: { enabled: false, model: 'haiku' } }, async ($, on) => {
    const { sets } = world(on)
    await $.session.start(START)
    expect(sets).toEqual([])
  })

  test('/model typed by hand becomes the pick', async ($, on) => {
    const { sets } = world(on)
    await $.command.run({ command: 'model', args: 'claude-haiku-5-5' } as never)
    expect(sets).toEqual([{ key: 'model-picker.model', value: 'haiku' }])
  })

  test('/config model change by the person becomes the pick', async ($, on) => {
    const { sets } = world(on)
    await $.config.set({ key: 'model', value: 'opus' } as never)
    expect(sets).toEqual([
      { key: 'model', value: 'opus' },
      { key: 'model-picker.model', value: 'opus' },
    ])
  })

  test('/effort with an unknown level changes no pick', async ($, on) => {
    const { sets } = world(on)
    await $.command.run({ command: 'effort', args: 'auto' } as never)
    expect(sets).toEqual([])
  })
})
