# Career Application Manager

App desktop para Windows, local e offline, para registrar as candidaturas que você fez e acompanhar cada processo seletivo até o fim.

> Eu encontro as vagas. Eu me candidato. Eu registro a candidatura. O aplicativo organiza, documenta, acompanha, lembra e analisa todo o restante.

O app não busca, importa nem cria candidaturas sozinho, e não faz nenhuma chamada de rede.

## O que a V1.0 faz

- **Cadastro rápido** (Ctrl+N): empresa, cargo, data e plataforma; Enter salva, Ctrl+Enter salva e abre. "Mais detalhes" mostra o formulário completo, com a seção Avançado (faixa salarial com moeda e período, pretensão, competências, requisitos, descrição da vaga, visto, idioma etc.).
- **Linha do tempo** de cada candidatura: mudar etapa (E), interação recebida ou enviada (I), follow-up enviado (F), feedback, anotação, pausar/retomar, encerrar com desfecho e motivo, reabrir. Status, etapa atual e primeira/última resposta são sempre derivados dos eventos, inclusive quando você registra algo retroativo. Eventos podem ser corrigidos ou anulados, sempre com histórico.
- **Lista e tabela** com filtros (status, empresa, período, texto, arquivadas) e ordenação.
- **Notas** em Markdown com modelos (preparação, debrief, recrutador, negociação, pesquisa da empresa…), salvamento automático e versões restauráveis. Notas podem ser da candidatura, da empresa, do contato ou gerais.
- **Anexos** por arrastar e soltar, botão ou Ctrl+V de um print. Cada arquivo é guardado uma vez só (por hash SHA-256), não importa quantas vezes for anexado.
- **Empresas e contatos** com autocompletar e criação na hora; contatos ligados a candidaturas com papel (recrutador, gestor, entrevistador, indicação, referência).
- **Busca global** (Ctrl+K) em candidaturas, empresas, contatos, notas, nomes de arquivos e descrições de vaga, ignorando acentos.
- **Duplicar**, **candidatar de novo**, **arquivar**, **Lixeira** de 30 dias, **desfazer** por 10 s (Ctrl+Z) e **histórico de edições** com valor anterior e novo.
- **Backup** diário automático (14 diários + 8 semanais), manual, cópia para uma pasta extra (ex.: OneDrive), **Testar backup** e **restaurar**, com verificação de hashes, `integrity_check` e `foreign_key_check` antes de trocar qualquer dado.
- Tema claro, escuro ou seguindo o Windows.

## Rodar em desenvolvimento

Requisitos: Node.js 22 e pnpm 10.

```bash
pnpm install        # também recompila o better-sqlite3 para o Electron
pnpm dev            # abre o app com recarga automática
```

| Comando                        | O que faz                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `pnpm test`                    | Testes unitários e de integração (Vitest), rodando dentro do Node do Electron |
| `pnpm test:coverage`           | O mesmo, com cobertura (mínimo de 80% em `src/main/domain`)                   |
| `pnpm test:e2e`                | Compila e roda os testes ponta a ponta no app real (Playwright)               |
| `pnpm lint` / `pnpm typecheck` | ESLint e TypeScript strict                                                    |
| `pnpm dist`                    | Gera o instalador NSIS por usuário (sem admin) em `dist/`                     |
| `pnpm db:generate`             | Gera uma nova migração SQL a partir de `src/main/db/schema.ts`                |

O CI (GitHub Actions, `windows-latest`) roda lint, typecheck, testes, e2e e gera o instalador como artefato.

## Onde ficam os dados

Tudo fica em `%APPDATA%\CAM`:

```
cam.db        banco SQLite (WAL, synchronous=FULL, foreign_keys=ON)
files/ab/…    anexos, nomeados pelo SHA-256 do conteúdo
backups/      backups .zip (banco + anexos + manifest.json)
logs/         logs sem conteúdo de notas nem valores salariais
```

A variável `CAM_DATA_DIR` troca essa pasta (usada nos testes).

## Arquitetura

Electron + React + TypeScript, sem servidor e sem Python. A interface nunca toca o disco: tudo passa por um canal IPC tipado.

```
src/
  shared/      contratos IPC (Zod), enums, DTOs, erros com código
  main/
    db/        schema Drizzle, migrações SQL versionadas e executor (só para frente)
    domain/    regras puras: derivação do status a partir dos eventos, normalização
    services/  casos de uso transacionais (candidaturas, eventos, notas, arquivos, busca, Lixeira, backup)
    ipc/       handlers finos: validam a entrada com Zod e chamam um service
  preload/     ponte mínima (contextIsolation + sandbox)
  renderer/    React, TanStack Query, Tailwind, cmdk; textos em src/renderer/src/i18n/pt-BR.ts
tests/
  unit/ integration/ e2e/
```

Decisões que protegem os dados:

- A linha do tempo (`events`) é a fonte da verdade. Os campos derivados em `applications` são recalculados na mesma transação de cada evento; "Reconstruir dados derivados" refaz tudo, e um teste com linhas do tempo aleatórias garante que o resultado é idêntico.
- Integridade no banco, não só no código: chaves estrangeiras, `CHECK` para enums, faixas salariais, moeda obrigatória, uma nota com no máximo um dono, anexo com exatamente um dono, `audit_log` só de inserção (trigger).
- Exclusão é sempre reversível por 30 dias; a exclusão definitiva só sai da Lixeira, com confirmação digitada, e mantém o histórico.
- Migrações rodam na inicialização, cada uma em transação, depois de um backup automático do banco.

## Fora da V1.0

Ficam para a V1.1 conforme o planejamento: tarefas, lembretes e notificações do Windows, bandeja e início com o Windows, tela Hoje, kanban, agenda, entrevistas/testes/propostas como entidades, biblioteca de currículos versionados, dashboard e metas, exportação CSV, aba Contexto (dossiê da vaga) e plano de etapas previsto. O esquema do banco já tem todas as tabelas, para que nada registrado agora precise ser migrado de forma destrutiva.
