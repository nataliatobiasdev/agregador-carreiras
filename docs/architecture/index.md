# Visões estruturais

Os diagramas são modelos da implementação auditada, não uma proposta. Os arquivos `.d2` são a fonte editável; os SVGs são gerados com D2 0.9.0, tema 200 e layout ELK. Em C4, *contêiner* é uma unidade executável ou de armazenamento, não necessariamente um contêiner Docker.

Para regenerar um diagrama na raiz do repositório, use `d2 docs/architecture/01-c4-context.d2 docs/public/architecture/01-c4-context.svg`; repita para os outros dois. O workflow existente compila os SVGs já versionados e não verifica automaticamente se estão sincronizados com as fontes D2.

## C4 nível 1 — contexto

![Contexto do CAM](/architecture/01-c4-context.svg)

[Fonte D2](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/docs/architecture/01-c4-context.d2) · [Entrada Electron](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/index.ts) · [Integração no vagas1000](https://github.com/nataliatobiasdev/vagas-1000/blob/main/scraper/panel_window.py)

O CAM não consulta portais de vagas. Links externos são abertos pelo navegador padrão mediante `shell.openExternal`; o conteúdo da interface carregada pelo Electron permanece sujeito ao bloqueio de rede da sessão.

## C4 nível 2 — contêineres

![Contêineres do CAM no Windows](/architecture/02-c4-container.svg)

[Fonte D2](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/docs/architecture/02-c4-container.d2) · [Contexto e caminhos](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/context.ts) · [Conexão SQLite](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/db/connection.ts)

Preload é código de ponte associado ao renderer, não um processo independente. Os trabalhos periódicos de backup e expurgo são timers no Main, não workers ou serviços instalados em separado. A pasta `CAM_DATA_DIR`, quando definida, substitui o diretório padrão do CAM; a ponte do vagas1000 auditada procura especificamente `%APPDATA%/CAM/cam.db`.

## Sequência — confirmar candidatura

![Sequência da confirmação no CAM](/architecture/03-sequence-core-flow.svg)

[Fonte D2](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/docs/architecture/03-sequence-core-flow.d2) · [Tela](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/renderer/src/pages/ApplicationsPage.tsx) · [Serviço](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/services/vagas1000.ts)

A sequência começa depois que uma vaga já existe na inbox. O serviço devolve o identificador já vinculado se a operação for repetida. O envio prévio é feito pelo processo do painel do vagas1000 diretamente na tabela SQLite; não há chamada do processo externo ao IPC Electron.
