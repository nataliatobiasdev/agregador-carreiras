# Build, distribuição e operação

## Build e entrega

O repositório usa Node.js 22, pnpm 10, `electron-vite` e Electron 38. O `package.json` aponta para `out/main/index.js`; o build separa Main, preload e renderer. `electron-builder.yml` empacota `out/**` e `package.json`, mantém o módulo nativo `better-sqlite3` fora do ASAR e gera NSIS Windows x64 por usuário, com escolha de diretório. O desinstalador está configurado para preservar dados. [Build](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/electron.vite.config.ts) · [Empacotamento](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/electron-builder.yml).

O CI Windows instala dependências, executa lint, typecheck, testes com cobertura, build, Playwright e `electron-builder`, publicando o instalador como artefato. Não há workflow de release por tag nem configuração de atualização automática ou assinatura identificada nos arquivos auditados. Em 19/11/2026 não havia tag ou release pública do CAM; a versão declarada `1.0.0` não equivale a uma release publicada. [CI](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/.github/workflows/ci.yml) · [Releases](https://github.com/nataliatobiasdev/agregador-carreiras/releases).

## Operação e limites

- Ao iniciar, o Main adquire bloqueio de instância única, abre o banco, aplica migrações, registra IPC e cria a janela. Após 15 segundos e depois a cada hora, tenta backup agendado e expurgo de itens expirados; não são processos independentes.
- Backups ZIP contêm snapshot `cam.db`, anexos e manifesto com hashes. A restauração verifica integridade e chaves estrangeiras antes da troca. Uma pasta extra pode ser escolhida pela usuária. [Implementação](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/services/backup.ts).
- A sessão Electron bloqueia requisições externas da interface, salvo exceções locais e do servidor de desenvolvimento; links HTTP(S) são abertos no navegador do sistema. `ELECTRON_RENDERER_URL` e WebSocket local são para desenvolvimento.
- Não há serviço Windows, worker dedicado, servidor HTTP nem atualizador automático identificados no código auditado. Encerrar todas as janelas encerra o app.

## GitHub Pages

O workflow [Docs](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/.github/workflows/docs.yml) compila VitePress em PR e publica em `main` quando `docs/**` muda. Os SVGs D2 versionados são consumidos como arquivos estáticos; o build do site não requer D2.
