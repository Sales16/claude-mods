import { describe, expect, test } from 'claude-code/testing'
import type { ConfigRow, On } from 'claude-code'

import { descriptionLines } from './register'

const PROVIDER = { plugin: 'status-inline', tier: 'user' } as const

const ROWS: ConfigRow[] = [
  { key: 'theme', label: 'Theme', kind: 'choice', value: 'dark', options: ['dark', 'light'], provider: { plugin: 'engine', tier: 'core' }, isLocked: false },
  { key: 'status-inline.enabled', label: 'Ativo', kind: 'boolean', value: true, provider: PROVIDER, isLocked: false },
  { key: 'status-inline.ctx', label: 'ctx %', kind: 'boolean', value: true, provider: PROVIDER, isLocked: false },
  { key: 'status-inline.warn_at', label: 'Amarelo a partir de %', kind: 'number', value: 70, provider: PROVIDER, isLocked: false },
  {
    key: 'status-inline.reset_label',
    label: 'Reset',
    description: 'Como mostrar o reset.\nEx.: {#39FF14}5h 18% ↻9:00{/}\n-- valor\nSó o horário.\nEx.: {#39FF14}5h 18% 9:00{/}\n-- texto\nA frase completa.\nEx.: 5h 18% {#00F0FF}reset às 9:00{/}',
    kind: 'choice',
    value: 'valor',
    options: ['valor', 'texto'],
    provider: PROVIDER,
    isLocked: false,
  },
]

const PANE = {
  plugin: 'mods-hub',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'mods-hub',
  props: { bodyColumns: 60 } as never,
  viewport: { columns: 120, rows: 40 },
} as const

const HINT = {
  plugin: 'mods-hub',
  component: 'PromptHint',
  props: { isDraft: false, isWorking: false, hint: '⏵⏵ auto mode on' },
  viewport: { columns: 200, rows: 40 },
} as const

function world(on: On) {
  const opened: string[] = []
  const sets: { key: string; value: unknown }[] = []
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text key="engine-hint">{e.props.hint}</Text>
  })
  on('ui.open', ($, e) => {
    opened.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('config.list', () => ({ value: ROWS }))
  on('config.set', ($, e) => {
    sets.push({ key: e.key, value: e.value })

    return { value: e.value }
  })

  return { opened, sets }
}

describe('mods-hub', () => {
  test('a description whose line breaks the engine dropped splits back into its lines', () => {
    const dropped =
      'Quanto o modelo raciocina, trocado na hora como o /effort faz.Um /effort digitado à mão aparece aqui também.-- lowRaciocina pouco: respostas rápidas e baratas.Ex.: {#39FF14}opus5.5·lo{/}-- xhighRaciocínio extra para problemas difíceis.Ex.: {#39FF14}opus5.5·xh{/}-- maxO máximo de raciocínio: mais lento e caro.Ex.: {#39FF14}opus5.5·max{/}'
    expect(descriptionLines(dropped, ['low', 'xhigh', 'max'])).toEqual([
      'Quanto o modelo raciocina, trocado na hora como o /effort faz.',
      'Um /effort digitado à mão aparece aqui também.',
      '-- low',
      'Raciocina pouco: respostas rápidas e baratas.',
      'Ex.: {#39FF14}opus5.5·lo{/}',
      '-- xhigh',
      'Raciocínio extra para problemas difíceis.',
      'Ex.: {#39FF14}opus5.5·xh{/}',
      '-- max',
      'O máximo de raciocínio: mais lento e caro.',
      'Ex.: {#39FF14}opus5.5·max{/}',
    ])
  })

  test('symbol options and an example with trailing text split too', () => {
    const dropped =
      'Desenho da barra.Ex.: {#39FF14}ctx ▰▰▰▰▰▱▱▱ 62%{/}-- █░Cheia █, vazia ░.Ex.: {#39FF14}ctx █████░░░ 62%{/}-- ▰▱Cheia ▰.Ex.: {#00F0FF}◆ mods{/} ⏵⏵ auto mode on'
    expect(descriptionLines(dropped, ['▰▱', '█░'])).toEqual([
      'Desenho da barra.',
      'Ex.: {#39FF14}ctx ▰▰▰▰▰▱▱▱ 62%{/}',
      '-- █░',
      'Cheia █, vazia ░.',
      'Ex.: {#39FF14}ctx █████░░░ 62%{/}',
      '-- ▰▱',
      'Cheia ▰.',
      'Ex.: {#00F0FF}◆ mods{/} ⏵⏵ auto mode on',
    ])
    expect(descriptionLines('Uma linha.\nOutra.')).toEqual(['Uma linha.', 'Outra.'])
  })

  test('◆ on the mode line opens the pane', async ($, on) => {
    const { opened } = world(on)

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...HINT, surface })
      expect(await ui.find({ type: 'Text', text: /auto mode on/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '◆ mods' })).toBeDefined()
      await ui.press({ key: 'mods-hub-open' })
      await ui.unmount()
    }
    expect(opened).toEqual(['mods-hub', 'mods-hub'])
  })

  test('pane lists plugin rows only and toggles them', async ($, on) => {
    const { sets } = world(on)
    const ui = await $.ui.mount({
      plugin: 'mods-hub',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'mods-hub',
      props: { bodyColumns: 40 } as never,
      viewport: { columns: 120, rows: 40 },
    })
    expect(await ui.find({ type: 'Text', text: /Theme/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /status-inline/ })).toBeDefined()

    await ui.press({ key: 'toggle:status-inline' })
    await ui.press({ key: 'row:status-inline.ctx' })
    await ui.press({ key: 'inc:status-inline.warn_at' })
    expect(sets).toEqual([
      { key: 'status-inline.enabled', value: false },
      { key: 'status-inline.ctx', value: false },
      { key: 'status-inline.warn_at', value: 75 },
    ])
    await ui.unmount()
  })

  test('a choice row opens its options as a list and picks one', async ($, on) => {
    const { sets } = world(on)
    const ui = await $.ui.mount(PANE)
    expect(await ui.find({ key: 'opt:status-inline.reset_label=texto' })).toBeUndefined()

    await ui.press({ key: 'row:status-inline.reset_label' })
    expect(await ui.find({ key: 'opt:status-inline.reset_label=valor' })).toBeDefined()
    expect(await ui.find({ key: 'opt:status-inline.reset_label=texto' })).toBeDefined()

    await ui.press({ key: 'opt:status-inline.reset_label=texto' })
    expect(sets).toEqual([{ key: 'status-inline.reset_label', value: 'texto' }])
    expect(await ui.find({ key: 'opt:status-inline.reset_label=texto' })).toBeUndefined()
    await ui.unmount()
  })

  test('each row and option carries its help with an example', async ($, on) => {
    world(on)
    const ui = await $.ui.mount(PANE)
    expect(await ui.find({ type: 'Text', text: 'Como mostrar o reset.' })).toBeDefined()
    expect((await ui.findAll({ type: 'Text', text: '5h 18% ↻9:00' })).map(el => el.props['color'])).toContain('#39FF14')

    await ui.press({ key: 'row:status-inline.reset_label' })
    expect(await ui.find({ type: 'Text', text: 'A frase completa.' })).toBeDefined()
    expect((await ui.findAll({ type: 'Text', text: 'reset às 9:00' })).map(el => el.props['color'])).toContain('#00F0FF')
    expect(await ui.find({ type: 'Text', text: '5h 18% ' })).toBeDefined()
    await ui.unmount()
  })
})
