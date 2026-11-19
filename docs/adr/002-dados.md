# ADR 002 — Dados locais

**Estado:** observado na linha de base; registro retrospectivo.

**Contexto.** Candidaturas, arquivos e histórico precisam sobreviver ao encerramento do aplicativo.

**Decisão observada.** O Main usa SQLite com `better-sqlite3` e Drizzle, grava anexos no disco, aplica migrações e cria backups verificáveis. O diretório padrão é `%APPDATA%/CAM`, substituível por `CAM_DATA_DIR`. [Contexto](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/context.ts) · [Backup](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/services/backup.ts).

**Consequências observáveis.** Dados e cópias dependem da preservação dos arquivos locais; o desinstalador está configurado para não apagá-los. Histórico de alternativas não foi encontrado.
