# Contratos e dados

## IPC Electron

O renderer usa `window.camBridge.invoke(channel, input)` exposto por `contextBridge`. O preload valida o formato do nome e chama `ipcRenderer.invoke('cam:' + channel, input)`. `registerIpc` aceita remetente confiável, `dispatch` valida com Zod e retorna `{ ok: true, data }` ou `{ ok: false, error }`. O evento de Main para renderer é `cam:data-changed`. Fontes: [preload](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/preload/index.ts), [registro](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/ipc/register.ts), [dispatch](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/ipc/dispatch.ts) e [contratos](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/shared/contracts.ts).

Os nomes abaixo recebem o prefixo literal `cam:` no transporte; são os canais definidos, não rotas HTTP:

| Domínio | Ações exatas |
| --- | --- |
| `vagas1000` | `list`, `markApplied` |
| `app` | `info`, `openDataFolder`, `openExternal`, `rebuildDerived` |
| `applications` | `list`, `get`, `create`, `update`, `duplicate`, `reapply`, `archive`, `unarchive`, `delete`, `restore`, `undoCreate`, `history`, `titles`, `lastPlatform`, `suggestPlatform`, `addContact`, `removeContact` |
| `events` | `list`, `record`, `correct`, `void` |
| `stages` | `list`, `create`, `update`, `setActive` |
| `lists` | `items`, `add`, `update` |
| `companies` | `list`, `get`, `create`, `update`, `delete`, `restore`, `suggest` |
| `contacts` | `list`, `get`, `create`, `update`, `delete`, `restore`, `timeline`, `applications` |
| `notes` | `list`, `get`, `create`, `update`, `delete`, `restore`, `revisions`, `restoreRevision`, `templates`, `updateTemplate` |
| `attachments` | `list`, `addFromPath`, `addFromBytes`, `update`, `delete`, `restore`, `open`, `verifyIntegrity` |
| `search` | `query` |
| `trash` | `list`, `restore`, `purge` |
| `backup` | `list`, `create`, `verify`, `restore`, `chooseFile`, `chooseExtraFolder`, `getSettings`, `setExtraDir` |
| `settings` | `get`, `set` |

`vagas1000.markApplied` recebe `{ key: string }` e retorna `{ id: string }` dentro do `Result`. A tela consulta `vagas1000.list` a cada cinco segundos. O renderer não tem acesso direto a Node ou SQLite; `contextIsolation`, `sandbox`, `nodeIntegration: false` e validação do remetente são configurados na janela principal.

## Persistência e integração

Por padrão, `%APPDATA%/CAM/` contém `cam.db`, `files/`, `backups/`, `logs/` e diretórios temporários. A conexão de escrita usa WAL, `synchronous=FULL`, chaves estrangeiras e `busy_timeout=5000`. Migrações SQL embutidas são aplicadas em ordem, cada uma em transação; em banco existente com migrações pendentes há backup prévio. [Conexão](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/db/connection.ts) · [Migrações](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/db/migrate.ts).

A tabela `vagas1000_inbox` contém `job_key`, `payload`, `added_at` e `application_id`. O vagas1000 faz `INSERT OR IGNORE` no arquivo padrão e lê o vínculo; o CAM só cria a candidatura após confirmação. Como o consumidor externo grava SQLite diretamente, ambos dependem do mesmo esquema e de acesso ao arquivo. Não existe servidor, porta, socket ou protocolo HTTP entre eles. [SQL](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/db/migrations/0002_vagas1000.sql) · [Ponte](https://github.com/nataliatobiasdev/vagas-1000/blob/main/scraper/panel_window.py).
