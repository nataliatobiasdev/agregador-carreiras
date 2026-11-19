# ADR 001 — Processos e IPC

**Estado:** observado na linha de base; registro retrospectivo.

**Contexto.** A interface precisa solicitar operações de dados sem executar Node diretamente no renderer.

**Decisão observada.** Electron separa Main e renderer; preload expõe `camBridge`, Main registra `cam:<domínio>.<ação>` e valida remetente e entrada. A sessão bloqueia requisições não permitidas. [Entrada](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/index.ts) · [Preload](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/preload/index.ts).

**Consequências observáveis.** Operações dependem dos contratos IPC e do processo principal; links externos abrem fora da janela do app. A razão histórica e outras alternativas não estão comprovadas pelo código.
