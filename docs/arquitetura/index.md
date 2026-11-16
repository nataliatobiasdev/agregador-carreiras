# Visão da arquitetura

Três processos do Electron, com fronteira rígida: o renderer (React) nunca acessa Node, disco ou banco. Toda operação é um canal IPC tipado, validado com Zod no processo principal e executado por um *service* transacional que não depende do Electron, e por isso é testável em Node puro.

```mermaid
flowchart TB
  subgraph R["Renderer (Chromium, sandbox)"]
    UI["React 18 + React Router<br/>TanStack Query · Tailwind · cmdk"]
    API["window.cam.domínio.ação()<br/>montado a partir dos contratos"]
    UI --> API
  end
  subgraph P["Preload (contextIsolation)"]
    BR["camBridge.invoke(canal, input)<br/>pathForFile · onDataChanged"]
  end
  subgraph M["Main (Node)"]
    REG["register.ts<br/>verifica origem do frame"]
    DIS["dispatch.ts<br/>Zod parse → handler → Result"]
    SVC["services/*<br/>casos de uso em transação"]
    DOM["domain/*<br/>funções puras"]
    DB[("SQLite WAL<br/>cam.db")]
    FS[["files/ab/sha256"]]
    BK[["backups/*.zip"]]
    JOBS["jobs horários<br/>backup diário · expurgo da Lixeira"]
  end
  API -->|"ipcRenderer.invoke('cam:x.y')"| BR
  BR --> REG --> DIS --> SVC
  SVC --> DOM
  SVC --> DB
  SVC --> FS
  SVC --> BK
  JOBS --> SVC
  SVC -.->|"cam:data-changed"| UI
```

## Camadas

| Pasta | Responsabilidade | Regra |
| --- | --- | --- |
| `src/shared` | Contratos IPC (Zod), enums, DTOs, `AppError` com código | Única fonte de tipos entre main e renderer |
| `src/main/db` | Schema Drizzle, migrações SQL versionadas, executor | Só para frente; nenhuma migração “down” |
| `src/main/domain` | Derivação do status, normalização, IDs | Puro, sem I/O; cobertura mínima de 80% |
| `src/main/services` | Candidaturas, eventos, notas, arquivos, busca, Lixeira, backup, auditoria | Cada escrita numa transação, incluindo índice de busca e auditoria |
| `src/main/ipc` | Handlers finos, dispatch, registro dos canais | Validar entrada, chamar um service, nada mais |
| `src/preload` | Ponte mínima: `invoke` genérico + 2 utilitários | Nome de canal validado por regex |
| `src/renderer` | Telas, componentes, i18n `pt-BR.ts` | Sem acesso a Node; dados via TanStack Query |

Em números: cerca de 5,1 mil linhas de TypeScript no processo principal e em `shared`, 79 canais IPC em `contracts.ts`, 29 tabelas (27 de domínio, `_migrations` e `search_index` FTS5).

## Ciclo de vida do processo principal

```mermaid
sequenceDiagram
  participant OS as Windows
  participant M as main/index.ts
  participant C as createContext
  participant DB as cam.db
  OS->>M: iniciar
  M->>M: requestSingleInstanceLock()
  M->>M: setAppUserModelId, logging em %APPDATA%\CAM\logs
  M->>C: createContext(dataDir)
  C->>DB: abrir (WAL, synchronous=FULL, FK=ON)
  alt banco existente com migrações pendentes
    C->>DB: VACUUM INTO pre-migration-*.db
  end
  C->>DB: runMigrations()
  alt falha
    C->>DB: close()
    M->>OS: diálogo "seus dados não foram alterados" e sair
  end
  M->>M: hardenSession(), registerIpc(), createWindow()
  M->>M: jobs: 15 s depois e a cada hora (backup, expurgo)
```

## Dados no disco

```text
%APPDATA%\CAM\            (ou CAM_DATA_DIR, usado pelos testes)
  cam.db                  SQLite: WAL, synchronous=FULL, foreign_keys=ON, busy_timeout=5000
  files/ab/<sha256>       anexos endereçados por conteúdo
  files/tmp/              escrita temporária antes do rename atômico
  backups/                manual-*, auto-*, pre-restore-* (.zip) e pre-migration-* (.db)
  logs/                   electron-log, sem texto de notas nem salários
```
