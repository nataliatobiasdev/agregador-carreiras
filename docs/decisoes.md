# Decisões (ADRs)

Registro das decisões de arquitetura no formato contexto → decisão → consequências. Status de todas: **aceita** na V1.0.

## Resumo

| # | Decisão | Ganho | Custo aceito |
| --- | --- | --- | --- |
| 1 | Sem scraping nem importação | Escopo pequeno e confiável | Cadastro manual (mitigado pelo cadastro rápido) |
| 2 | Electron + TypeScript, sem Python | Uma linguagem, um instalador | Peso do Chromium |
| 3 | Eventos como fonte da verdade | Retroativos corretos, histórico, analytics | Recalcular a candidatura a cada evento |
| 4 | Integridade no SQL | Bug de código não grava dado inválido | Mudar enum exige migração |
| 5 | Schema completo já na V1.0 | V1.1 sem migração destrutiva | Tabelas sem tela por enquanto |
| 6 | better-sqlite3 síncrono no main | Transações simples e atômicas | Operação longa bloqueia o main |
| 7 | WAL + `synchronous=FULL` | Durabilidade em queda de energia | Escritas um pouco mais lentas |
| 8 | Anexos por SHA-256 | Deduplicação e backup verificável | Nome original só no banco |
| 9 | Rede bloqueada na sessão | Privacidade por construção | Sem atualização automática |
| 10 | Migrações só para frente + backup antes | Executor simples | Voltar versão = restaurar backup |
| 11 | Vitest no Node do Electron | Um único binário nativo | Testes dependem do Electron |
| 12 | Markdown em vez de editor visual | Menos dependências, dados portáveis | Edição menos amigável |
| 13 | Detalhe em página inteira | Implementação simples | Perde o contexto da lista |

## ADR-1: Sem scraping nem importação de vagas

**Contexto.** Um primeiro plano integrava o scraper de vagas que existe em paralelo. A Natalia rejeitou: ela encontra as vagas e se candidata; o app cuida do resto.
**Decisão.** O CAM só registra candidaturas digitadas pela usuária e eventos confirmados por ela. Nenhum código de rede de saída.
**Consequências.** O cadastro precisa ser muito rápido (Ctrl+N, 4 campos, Enter). O scraper evolui sem acoplar o app.

## ADR-3: Linha do tempo como fonte da verdade

**Contexto.** Processos seletivos são registrados fora de ordem (“o RH ligou ontem”). Guardar só o status atual perde história e torna eventos retroativos ambíguos.
**Decisão.** `events` é a verdade; `applications.status`, etapa atual e datas de resposta são cache derivado por uma função pura, recalculado na mesma transação.
**Consequências.** Retroativos funcionam por construção; anular em vez de apagar; “Reconstruir dados derivados” é sempre seguro; o teste de equivalência protege a invariante.

## ADR-4: Regras de integridade no SQL

**Contexto.** O app é a única fonte desses dados e não há servidor para validar de novo.
**Decisão.** Toda regra expressável em SQL vira `CHECK`, FK, índice único parcial ou trigger.
**Consequências.** Uma violação vira `CONFLICT` legível; um backup restaurado pode ser checado com `foreign_key_check`. Alterar um enum exige migração com reconstrução de tabela.

## ADR-5: Schema completo já na V1.0

**Contexto.** A V1.1 traz entrevistas, propostas, tarefas e documentos.
**Decisão.** Criar todas as tabelas do planejamento agora, mesmo sem tela.
**Consequências.** Nada registrado na V1.0 precisará de migração destrutiva. Em troca, há tabelas vazias e colunas sem uso.

## ADR-6: better-sqlite3 síncrono no processo principal

**Contexto.** Volume pessoal (centenas a poucos milhares de registros), uma única usuária.
**Decisão.** API síncrona do better-sqlite3 no main, com transações explícitas (`tx()` vira savepoint quando aninhada).
**Consequências.** Código simples e atômico. Uma operação longa bloquearia o main; o backup usa `VACUUM INTO` e as consultas são pequenas. Se o volume crescer, mover para um worker thread.

## ADR-8: Anexos endereçados por conteúdo

**Contexto.** O mesmo currículo ou print é anexado em várias candidaturas.
**Decisão.** Guardar o arquivo em `files/ab/<sha256>`, com vínculos em `attachments`.
**Consequências.** Deduplicação, verificação de integridade e backup com hash por arquivo. Abrir o arquivo exige o app, porque o nome no disco é o hash.

## ADR-10: Migrações só para frente

**Contexto.** Migrações “down” raramente são testadas e podem perder dados.
**Decisão.** Sem “down”. Antes de migrar um banco existente, `VACUUM INTO` gera um backup `pre-migration`.
**Consequências.** Executor simples. Voltar uma versão do app significa restaurar o backup.

## ADR-11: Vitest dentro do Node do Electron

**Contexto.** better-sqlite3 é nativo e precisa do ABI certo; manter dois builds (Node e Electron) gera erros de “módulo compilado para outra versão”.
**Decisão.** Rodar o Vitest com `ELECTRON_RUN_AS_NODE=1` usando o binário do Electron.
**Consequências.** Os testes usam o mesmo `.node` do instalador. O Electron precisa estar baixado para rodar os testes.
