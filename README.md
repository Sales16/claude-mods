# claude-mods

Mods para o Claude Code: plugins de *function hooks* que mudam a interface e o comportamento do próprio Claude Code.

| Mod | O que faz |
| --- | --- |
| [`mods-hub`](#mods-hub) | Botão `◆ mods` na linha do mode e janela lateral para ligar, desligar e configurar os mods. |
| [`status-inline`](#status-inline) | Medidores compactos (contexto, rate limits, modelo, custo, tokens) na linha do mode. |
| [`model-picker`](#model-picker) | Troca o modelo e o effort da sessão pela janela de mods. |

## Instalar

### Em todos os terminais (recomendado)

Em qualquer sessão do Claude Code:

```
/plugin marketplace add Sales16/claude-mods
/plugin install mods-hub@claude-mods
/plugin install status-inline@claude-mods
/plugin install model-picker@claude-mods
```

- Escolha o escopo **user** na instalação: os mods passam a carregar em todo terminal novo, em qualquer projeto.
- Instale o `mods-hub` junto: o `status-inline` depende dele.

Para pegar uma versão nova do repositório:

```
/plugin marketplace update claude-mods
/reload-plugins
```

Para remover:

```
/plugin uninstall model-picker@claude-mods
/plugin uninstall status-inline@claude-mods
/plugin uninstall mods-hub@claude-mods
```

### Direto das pastas, sem instalar

Útil enquanto você mexe nos mods: o terminal vigia as pastas e recarrega o mod sozinho quando um arquivo muda.

Clone o repositório primeiro. Os exemplos abaixo usam `C:\MyProjects\claude-mods`; troque pelo caminho do seu clone.

```
git clone https://github.com/Sales16/claude-mods.git C:\MyProjects\claude-mods
```

Para todos os terminais, em `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "C:\\MyProjects\\claude-mods\\plugins\\mods-hub;C:\\MyProjects\\claude-mods\\plugins\\status-inline;C:\\MyProjects\\claude-mods\\plugins\\model-picker"
  }
}
```

Para um terminal só:

```
claude --plugin-dir C:\MyProjects\claude-mods\plugins\mods-hub --plugin-dir C:\MyProjects\claude-mods\plugins\status-inline --plugin-dir C:\MyProjects\claude-mods\plugins\model-picker
```

Use um jeito só. Instalado e carregado pela pasta ao mesmo tempo, o mod roda duas vezes (dois `◆ mods` na linha).

### Configurações

Cada opção dos mods fica salva no `settings.json` do usuário, em `pluginConfigs`, e vale entre sessões. O nome da chave muda com o jeito de carregar (`status-inline@claude-mods` instalado, `status-inline@inline` pela pasta): ao trocar de jeito, refaça as escolhas pelo `◆ mods`.

## mods-hub

Adiciona `◆ mods` no começo da linha do mode:

```
◆ mods ⏵⏵ auto mode on │ ctx ▰▰▰▰▰▱▱▱ 62% │ …
```

Clicar em `◆ mods` (ou rodar `/mods`) abre uma janela lateral com cada mod que tem configurações:

```
● model-picker
  ■ Ativo
  ▸ Modelo: opus
  ▸ Effort: high

● status-inline
  ■ Ativo
  ▾ Barra: ▰▱
      ● ▰▱
      ○ █░
  ■ ctx %
  Amarelo a partir de % − 70 +
```

- `●`/`○` liga ou desliga o mod inteiro; `■`/`□` liga ou desliga cada opção.
- Uma opção com vários valores (`▸`) abre a lista de valores embaixo dela; escolher um aplica na hora.
- Números têm `−` e `+`, de 5 em 5.
- Passar o mouse numa opção mostra, no rodapé da janela, o que ela faz e um exemplo já na cor e no estilo daquela escolha.
- Toda mudança vale na hora: o mod mexido recarrega com a opção nova.

Opção própria: **Cor do ◆ mods** (verde-neon, ciano, magenta, laranja, azul, roxo, branco).

Clique e hover dependem de o terminal enviar o mouse para o Claude Code, o que acontece no modo tela cheia. Sem mouse, use `/mods`, Tab e Enter.

## status-inline

Desenha medidores depois da linha do mode, em verde neon:

```
⏵⏵ auto mode on │ ctx ▰▰▰▰▰▱▱▱ 62% │ 5h ▰▱▱▱▱▱▱▱ 18% ↻14:30 │ 7d ▰▰▰▱▱▱▱▱ 41% ↻sex │ opus5.5·xh │ $1.23 │ tok 1.2M │ cmp ≈18k │ 🔥 →36%
```

| Medidor | O que mostra |
| --- | --- |
| `ctx` | Quanto da janela de contexto o último request usou. |
| `5h` | Uso da janela de rate limit de 5 horas e quando ela reseta. |
| `7d` | Uso da janela semanal e o dia em que ela reseta. |
| `opus5.5·xh` | Modelo e effort (`lo`, `md`, `hi`, `xh`, `max`) do request atual. |
| `$1.23` | Custo da sessão, como o `/cost` soma. |
| `tok 1.2M` | Tokens gastos na sessão, conversa principal e subagents juntos, desde que o mod carregou. |
| `cmp ≈18k` | Tokens que faltam até o auto-compact. |
| `🔥 →36%` | Uso que a janela de 5h terá no reset, se o ritmo atual continuar. |

Configurações:

| Opção | Valores |
| --- | --- |
| Ativo | liga ou desliga os medidores |
| Cor | verde-neon, ciano, magenta, laranja, azul, roxo, branco |
| Barra | `▰▱`, `█░`, `■□`, `●○`, `⣿⣀`, `━┄` |
| Reset | oculto (`18%`), valor (`18% 9:00`), ícone (`18% ↻9:00`), texto (`18% reset às 9:00`) |
| Tokens | total, sem-cache (sem o cache relido), in/out (`↑1.2M ↓40k`), oculto |
| ctx, 5h, 7d, Modelo, Effort, Custo, cmp, Projeção 5h, Barras | mostra ou esconde cada item |
| Amarelo a partir de % | padrão 70 |
| Vermelho a partir de % | padrão 90 |

- Em tela estreita os itens somem nesta ordem: barras, extras (custo, tokens, cmp, projeção), horários de reset, `7d`, modelo/effort. `ctx` e `5h` nunca somem.
- Com a janela do `◆ mods` aberta ao lado, o mod conta a largura dela, porque a linha do mode passa por baixo das duas.

## model-picker

Troca o modelo e o effort da sessão pela janela do `◆ mods`.

| Opção | Valores |
| --- | --- |
| Ativo | liga ou desliga as trocas e a sincronização |
| Modelo | default, opus, sonnet, haiku, fable |
| Effort | low, medium, high, xhigh, max |

- Escolher um modelo troca na hora, como o `/model`. Escolher um effort roda `/effort <nível>`, que executa quando a sessão fica parada.
- Na primeira vez que carrega, o mod adota o modelo e o effort atuais da sessão: instalar não troca nada.
- Um `/model`, `/effort` ou troca de modelo pelo `/config` feita à mão passa a aparecer na janela. Um modelo como `claude-opus-5-5` ou `opus[1m]` aparece como `opus`.
- Trocar de modelo não perde a conversa, mas o primeiro request depois da troca relê o contexto sem cache: sai mais caro e mais lento.

## Estrutura

```
claude-mods/
  .claude-plugin/marketplace.json   lista os mods para o /plugin install
  plugins/
    mods-hub/        botão ◆ mods, janela lateral, /mods
    status-inline/   medidores na linha do mode
    model-picker/    modelo e effort pela janela de mods
```

Cada mod tem `.claude-plugin/plugin.json` (nome, opções em `userConfig`), `hooks/hooks.json` e o módulo em `hooks/register.ts(x)`, com seus testes em `hooks/*.test.ts(x)`.

## Criar um mod que aparece no ◆ mods

Um mod aparece na janela quando o `plugin.json` declara campos em `userConfig`.

- Um campo booleano chamado `enabled` vira o liga/desliga do mod; o mod deve checar `options.enabled` e ficar inerte quando for `false`.
- Um campo `string` com `options` vira uma lista de valores.
- A ajuda do hover vem do `description` do campo:

```
Explicação do campo, uma ideia por linha.
Ex.: {#39FF14}ctx ▰▰▰▰▰▱▱▱ 62%{/}
-- <opção>
Explicação daquela opção.
Ex.: {#00F0FF}ctx ▰▰▰▰▰▱▱▱ 62%{/}
```

O Claude Code remove as quebras de linha do `description`, então o hub reencontra as linhas: uma linha começa em `-- <opção>` (uma das opções do campo), em `Ex.: ` e depois de `.`, `!` ou `?` quando a frase seguinte começa com letra maiúscula. Comece toda linha assim e termine cada frase com ponto. Uma linha `Ex.: ` é desenhada como exemplo, e `{#RRGGBB}texto{/}` pinta aquele trecho na cor.

No `/config` do Claude Code a mesma descrição aparece como texto puro, com as marcações cruas.

## Desenvolver

```
claude plugin validate plugins/<mod>
claude plugin test plugins/<mod>
```
