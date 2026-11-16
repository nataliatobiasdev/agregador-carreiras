# Rodar e contribuir

Requisitos: **Node.js 22** e **pnpm 10**.

```bash
pnpm install        # também recompila o better-sqlite3 para o Electron
pnpm dev            # abre o app com recarga automática
```

| Comando | O que faz |
| --- | --- |
| `pnpm test` | Testes unitários e de integração (Vitest), dentro do Node do Electron |
| `pnpm test:coverage` | O mesmo, com cobertura (mínimo de 80% em `src/main/domain`) |
| `pnpm test:e2e` | Compila e roda os testes ponta a ponta no app real (Playwright) |
| `pnpm lint` / `pnpm typecheck` | ESLint e TypeScript strict |
| `pnpm dist` | Gera o instalador NSIS por usuário em `dist/` |
| `pnpm db:generate` | Gera uma nova migração SQL a partir de `src/main/db/schema.ts` |

## Onde mexer

| Quero… | Onde |
| --- | --- |
| Adicionar uma operação | Contrato em `src/shared/contracts.ts` → handler em `src/main/ipc/handlers.ts` → service em `src/main/services/` |
| Mudar o schema | `src/main/db/schema.ts`, depois `pnpm db:generate`; nunca editar migração já publicada |
| Mudar regra de status | `src/main/domain/derive.ts` (pura) + `tests/unit/derive.test.ts` |
| Mudar texto da interface | `src/renderer/src/i18n/pt-BR.ts` |

## Esta documentação

O site fica em `docs/` e é gerado com VitePress.

```bash
cd docs
pnpm install
pnpm dev            # http://localhost:5173/agregador-carreiras/
```

Cada push na `main` que altere `docs/` publica o site pelo workflow `.github/workflows/docs.yml`.
