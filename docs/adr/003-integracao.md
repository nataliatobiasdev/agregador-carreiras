# ADR 003 — Inbox local para integração

**Estado:** observado na linha de base; registro retrospectivo.

**Contexto.** Uma vaga coletada externamente pode ser acompanhada sem presumir que houve candidatura.

**Decisão observada.** O vagas1000 escreve uma oportunidade na tabela `vagas1000_inbox` do SQLite do CAM; `markApplied` cria a candidatura e vincula o identificador quando a usuária confirma. [Migração](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/db/migrations/0002_vagas1000.sql) · [Serviço](https://github.com/nataliatobiasdev/agregador-carreiras/blob/main/src/main/services/vagas1000.ts).

**Consequências observáveis.** O contrato depende da tabela e do caminho padrão `%APPDATA%/CAM/cam.db`; o banco do CAM deve existir e conter a migração. A integração não funciona por uma API HTTP e não envia candidatura ao portal.
