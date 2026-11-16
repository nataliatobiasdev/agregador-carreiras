# CI e incidentes

Workflow `.github/workflows/ci.yml` em `windows-latest`, em todo PR e push na `main`, com timeout de 30 min.

```mermaid
flowchart LR
  A[checkout] --> B["pnpm 10 + Node 22"] --> C["install --frozen-lockfile<br/>recompila better-sqlite3"]
  C --> D[lint] --> E[typecheck] --> F["test:coverage"] --> G[build] --> H["Playwright e2e"] --> I["electron-builder<br/>NSIS"] --> J["artefato<br/>CAM-Setup-*.exe"]
```

## Histórico do PR #1

| Run | Commit | Resultado | Causa | Correção |
| --- | --- | --- | --- | --- |
| #1 | `15bd9f6` | <span class="bad">falhou</span> | `pnpm install`: `@electron/rebuild` fixa `node-gyp` numa URL git via SSH (`git@github.com:electron/node-gyp.git`); o runner não tem chave SSH | `3f0ff2d`: `pnpm.overrides` aponta `@electron/node-gyp` para o mesmo fork publicado no npm, `10.2.0-electron.1` |
| #2 | `3f0ff2d` | <span class="bad">falhou</span> | No Windows um arquivo SQLite aberto não pode ser apagado. A limpeza dos testes removia a pasta temporária antes de fechar o banco → `EBUSY` | `8e0ecfc`: limpezas em ordem LIFO (fecha o banco antes de apagar a pasta) e `createContext` fecha o handle se a migração falhar |
| #3 | `8e0ecfc` | <span class="ok">passou</span> | | Lint, typecheck, 72 testes, 6 e2e e instalador gerado |
| #4 | `82cc2ae` | <span class="ok">passou</span> | | Mesmo pipeline na `main` após o merge |

## Postmortem resumido

::: warning Por que só o CI pegou
As duas falhas só aparecem no Windows. O desenvolvimento foi feito em Linux, onde apagar um arquivo aberto funciona e a rede do ambiente resolvia a dependência git. O CI em `windows-latest` é o que garante o alvo real.
:::

- **Incidente 1, dependência via SSH.** Dependência transitiva com URL `git+ssh` quebra qualquer ambiente sem chave. A correção fixa a versão publicada no npm, que também torna o lockfile reprodutível.
- **Incidente 2, arquivo travado.** A ordem de limpeza dos testes estava invertida. A correção também melhorou o app: se a migração falhar ao abrir, o banco é fechado, então o arquivo pode ser restaurado ou substituído sem reiniciar o Windows.

## Documentação

Um segundo workflow, `.github/workflows/docs.yml`, roda em Ubuntu e publica este site no GitHub Pages quando algo em `docs/` muda na `main`. Ele é independente do CI do app.
