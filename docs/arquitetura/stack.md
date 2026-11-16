# Por que Electron + TypeScript, sem Python

A stack foi decidida pela Natalia em 16/11/2026, depois de um primeiro plano que previa integração com o scraper (em Python) e foi rejeitado junto com a ideia de importar vagas. Sem a integração, Python deixou de ter função no app.

| Critério | Electron + TS (escolhido) | Alternativa |
| --- | --- | --- |
| Uma linguagem de ponta a ponta | TypeScript no main, preload, renderer e testes; tipos dos contratos compartilhados | Python + UI web exigiria duas linguagens e uma ponte própria |
| Distribuição no Windows | Um instalador NSIS por usuário, sem runtime extra | Python embutido (PyInstaller) aumenta o tamanho e complica o build |
| Banco local | better-sqlite3: síncrono, transações reais, FTS5 embutido | Equivalente em Python, mas fora do processo da UI |
| Teste ponta a ponta | Playwright dirige o app Electron real | Mais difícil com UI nativa (Qt/Tk) |
| Custo | Chromium embutido no instalador e na memória | Tauri seria mais leve, mas traria Rust para o toolchain |

## Bibliotecas e por quê

| Biblioteca | Versão | Papel |
| --- | --- | --- |
| Electron | 38.8.6 | Runtime desktop |
| React + React Router | 18.3 / 6.30 | Interface |
| TanStack Query | 5.90 | Cache de dados no renderer, invalidado por `cam:data-changed` |
| Tailwind + cmdk + lucide | 3.4 / 1.1 / 0.544 | Estilo, paleta Ctrl+K, ícones |
| better-sqlite3 | 12.11.1 | SQLite síncrono no processo principal |
| Drizzle ORM / drizzle-kit | 0.44.7 / 0.31.5 | Schema tipado e SQL de migração legível e versionado |
| Zod | 3.25 | Validação de toda entrada IPC |
| uuid (v7) | 11.1 | Chave primária ordenável no tempo, sem colisão entre backups |
| yazl / yauzl | 3.3 / 3.4 | Escrita e leitura em streaming do zip de backup |
| electron-log | 5.4 | Logs em arquivo |
| electron-vite / electron-builder | 4.0 / 26.0 | Build e instalador |

Todas as versões são fixas em `package.json` e travadas por `pnpm-lock.yaml`.
