import { atom, read, update } from 'claude-code'
import type { ConfigRow, ConfigValue, EngineInterface, Register } from 'claude-code'

const PANE = 'mods-hub'
const TITLE = '◆ mods'
const COLORS: Record<string, string> = {
  'verde-neon': '#39FF14',
  ciano: '#00F0FF',
  magenta: '#FF2BD6',
  laranja: '#FF9F1C',
  azul: '#3D8BFF',
  roxo: '#B266FF',
  branco: '#F2F2F2',
}
const NUMBER_STEP = 5
const HOVER_BACKGROUND = '#1E2A1E'

const expanded = atom({ plugin: 'mods-hub', key: 'expanded' } as const, null)
const dock = atom({ plugin: 'mods-hub', key: 'dock' } as const, 0)

/** The docked pane's frame and divider, around its body's columns. */
const DOCK_FRAME_COLUMNS = 3

/** The `userConfig` field a mod declares to be switched on and off as a whole. */
const ENABLED_FIELD = 'enabled'

type ModGroup = { plugin: string; enabledRow?: ConfigRow; rows: ConfigRow[] }

function groupByPlugin(rows: readonly ConfigRow[]): ModGroup[] {
  const groups = new Map<string, ModGroup>()
  for (const row of rows) {
    const { plugin, tier } = row.provider
    if (tier === 'core' || tier === 'builtin' || plugin === 'engine') continue

    const group = groups.get(plugin) ?? { plugin, rows: [] }
    if (row.key === `${plugin}.${ENABLED_FIELD}`) {
      group.enabledRow = row
    } else {
      group.rows.push(row)
    }
    groups.set(plugin, group)
  }

  return [...groups.values()].sort((a, b) => a.plugin.localeCompare(b.plugin))
}

async function setRow($: EngineInterface, row: ConfigRow, value: ConfigValue): Promise<void> {
  try {
    const result = await $.config.set({ key: row.key, value })
    if ('deny' in result && result.deny !== undefined) {
      $.ui.toast(`${row.label}: ${result.deny}`)
    }
  } catch (error) {
    $.ui.toast(`${row.label}: ${error instanceof Error ? error.message : String(error)}`)
  }
  $.ui.invalidate('ui.render')
}

type Help = { row: string[]; options: Record<string, string[]> }

type Segment = { text: string; color?: string }

/** Starts a line that shows an example of the row or option. */
const EXAMPLE_PREFIX = 'Ex.: '

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Splits a description into its lines. The engine hands a plugin field's
 * description with its line breaks dropped, so a line is found again at each
 * `-- <option>` (an option of the row, longest first), at each `Ex.: ` and
 * after each sentence.
 */
export function descriptionLines(description: string, options: readonly string[] = []): string[] {
  let text = description
  if (!text.includes('\n')) {
    const names = [...options].sort((a, b) => b.length - a.length).map(escapeRegExp)
    if (names.length > 0) {
      text = text.replace(new RegExp(`\\s*--\\s*(${names.join('|')})\\s*`, 'gu'), '\n-- $1\n')
    }
    text = text.replace(/\s*Ex\.:\s*/g, '\nEx.: ').replace(/([.!?])\s*(?=\p{Lu})/gu, '$1\n')
  }

  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
}

/** A plugin's name without the marketplace it came from (`status-inline@inline`). */
function displayName(plugin: string): string {
  return plugin.replace(/@.*$/, '')
}

/**
 * Reads a row's help from its description: the lines before the first
 * `-- <option>` line explain the row, and each `-- <option>` line starts that
 * option's own lines. A line led by `Ex.: ` is an example.
 */
function parseHelp(row: ConfigRow): Help {
  const help: Help = { row: [], options: {} }
  let lines = help.row
  for (const line of descriptionLines(row.description ?? '', row.options)) {
    const option = /^--\s+(.+)$/.exec(line)?.[1]?.trim()
    if (option === undefined) {
      if (line.trim() !== '') lines.push(line)
    } else {
      lines = help.options[option] = []
    }
  }

  return help
}

/** Splits an example into its parts: `{#RRGGBB}text{/}` draws `text` in that color. */
function exampleSegments(example: string): Segment[] {
  const segments: Segment[] = []
  let at = 0
  for (const match of example.matchAll(/\{(#[0-9A-Fa-f]{6})\}(.*?)\{\/\}/g)) {
    if (match.index > at) segments.push({ text: example.slice(at, match.index) })
    segments.push({ text: match[2] ?? '', color: match[1] })
    at = match.index + match[0].length
  }
  if (at < example.length) segments.push({ text: example.slice(at) })

  return segments
}

function helpScope(key: string, option?: string): string {
  return (option === undefined ? `h:${key}` : `h:${key}=${option}`).slice(0, 64)
}

async function choose($: EngineInterface, row: ConfigRow, value: string): Promise<void> {
  await update($, expanded, () => null)
  if (value !== row.value) await setRow($, row, value)
}

async function openPane($: EngineInterface): Promise<void> {
  try {
    await $.ui.open({ id: PANE, title: TITLE })
  } catch (error) {
    $.ui.toast(`mods: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export const register: Register = (on, options) => {
  const NEON = COLORS[String(options['color'])] ?? '#39FF14'

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mods',
      description: 'Open the mods pane: toggle mods and edit their settings',
    })
    const isShown = (await $.ui.panes()).some(pane => pane.id === PANE && pane.isShown)
    if (!isShown) await update($, dock, () => 0)

    return next(e)
  })

  on('ui.close', async ($, e, next) => {
    const closed = await next(e)
    if (e.id === PANE) await update($, dock, () => 0)

    return closed
  })

  on('command.run', { command: 'mods' }, async $ => {
    await openPane($)

    return { text: 'Painel de mods aberto.' }
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const drawn = await next(e)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row">
        <Button key="mods-hub-open" plain onPress={() => void openPane($)}>
          <Text color={NEON}>◆ mods</Text>
        </Button>
        <Text> </Text>
        {drawn}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const groups = groupByPlugin(await $.config.list())
    const openKey = await read($, expanded)

    // A render never writes state: the docked width is published right after.
    const docked = e.props.placement === 'dock' ? e.props.bodyColumns + DOCK_FRAME_COLUMNS : 0
    if ((await read($, dock)) !== docked) {
      $.clock.after(0, () => void update($, dock, () => docked))
    }

    if (groups.length === 0) {
      return <Text dimColor>Nenhum mod com configurações carregado.</Text>
    }

    const helps: { scope: string; title: string; lines: string[] }[] = []

    return (
      <Box flexDirection="column">
        {groups.map(group => {
          const isOn = group.enabledRow === undefined || group.enabledRow.value !== false
          if (group.enabledRow !== undefined) {
            helps.push({
              scope: helpScope(group.enabledRow.key),
              title: displayName(group.plugin),
              lines: parseHelp(group.enabledRow).row,
            })
          }

          return (
            <Box flexDirection="column" marginBottom={1}>
              {group.enabledRow === undefined ? (
                <Text color={NEON} bold>
                  ● {displayName(group.plugin)}
                </Text>
              ) : (
                <Box hover={{ scope: helpScope(group.enabledRow.key), backgroundColor: HOVER_BACKGROUND }}>
                  <Button
                    key={`toggle:${group.plugin}`}
                    plain
                    onPress={() => {
                      const row = group.enabledRow
                      if (row !== undefined) void setRow($, row, !isOn)
                    }}
                  >
                    <Text color={isOn ? NEON : undefined} dimColor={!isOn} bold>
                      {isOn ? '●' : '○'} {displayName(group.plugin)}
                    </Text>
                  </Button>
                </Box>
              )}
              {group.rows.map(row => {
                const help = parseHelp(row)
                const scope = helpScope(row.key)
                helps.push({ scope, title: row.label, lines: help.row })

                if (row.kind === 'boolean') {
                  const isChecked = row.value === true

                  return (
                    <Box hover={{ scope, backgroundColor: HOVER_BACKGROUND }}>
                      <Button key={`row:${row.key}`} plain onPress={() => void setRow($, row, !isChecked)}>
                        <Text color={isChecked && isOn ? NEON : undefined} dimColor={!isOn || !isChecked}>
                          {'  '}
                          {isChecked ? '■' : '□'} {row.label}
                        </Text>
                      </Button>
                    </Box>
                  )
                }

                if (row.kind === 'number') {
                  const value = typeof row.value === 'number' ? row.value : 0

                  return (
                    <Box flexDirection="row" hover={{ scope, backgroundColor: HOVER_BACKGROUND }}>
                      <Text dimColor={!isOn}>
                        {'  '}
                        {row.label}{' '}
                      </Text>
                      <Button key={`dec:${row.key}`} plain onPress={() => void setRow($, row, value - NUMBER_STEP)}>
                        <Text color={NEON}>−</Text>
                      </Button>
                      <Text color={NEON}> {value} </Text>
                      <Button key={`inc:${row.key}`} plain onPress={() => void setRow($, row, value + NUMBER_STEP)}>
                        <Text color={NEON}>+</Text>
                      </Button>
                    </Box>
                  )
                }

                if (row.kind === 'choice') {
                  const isOpen = openKey === row.key

                  return (
                    <Box flexDirection="column">
                      <Box hover={{ scope, backgroundColor: HOVER_BACKGROUND }}>
                        <Button
                          key={`row:${row.key}`}
                          plain
                          onPress={() => void update($, expanded, current => (current === row.key ? null : row.key))}
                        >
                          <Text dimColor={!isOn}>
                            {'  '}
                            {isOpen ? '▾' : '▸'} {row.label}: <Text color={NEON}>{String(row.value)}</Text>
                          </Text>
                        </Button>
                      </Box>
                      {isOpen &&
                        (row.options ?? []).map(option => {
                          const isSelected = option === row.value
                          const optionScope = helpScope(row.key, option)
                          helps.push({
                            scope: optionScope,
                            title: `${row.label}: ${option}`,
                            lines: help.options[option] ?? help.row,
                          })

                          return (
                            <Box hover={{ scope: optionScope, backgroundColor: HOVER_BACKGROUND }}>
                              <Button key={`opt:${row.key}=${option}`} plain onPress={() => void choose($, row, option)}>
                                <Text color={isSelected ? NEON : undefined} dimColor={!isSelected}>
                                  {'      '}
                                  {isSelected ? '●' : '○'} {option}
                                </Text>
                              </Button>
                            </Box>
                          )
                        })}
                    </Box>
                  )
                }

                return (
                  <Box hover={{ scope, backgroundColor: HOVER_BACKGROUND }}>
                    <Text dimColor>
                      {'  '}
                      {row.label}: {String(row.value)}
                    </Text>
                  </Box>
                )
              })}
            </Box>
          )
        })}
        <Text dimColor>clique ou Tab + Enter · passe o mouse para ajuda · Esc fecha</Text>
        {helps
          .filter(help => help.lines.length > 0)
          .map(help => (
            <Box
              flexDirection="column"
              marginTop={1}
              borderStyle="round"
              borderColor={NEON}
              paddingX={1}
              display="none"
              hover={{ scope: help.scope, display: 'flex' }}
            >
              <Text color={NEON} bold>
                {help.title}
              </Text>
              {help.lines.map(line =>
                line.startsWith(EXAMPLE_PREFIX) ? (
                  <Box flexDirection="row">
                    <Text dimColor>exemplo </Text>
                    <Text>
                      {exampleSegments(line.slice(EXAMPLE_PREFIX.length)).map(segment => (
                        <Text color={segment.color}>{segment.text}</Text>
                      ))}
                    </Text>
                  </Box>
                ) : (
                  <Text>{line}</Text>
                ),
              )}
            </Box>
          ))}
      </Box>
    )
  })
}
