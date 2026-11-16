# Funcionalidades da V1.0

## Telas

| Tela | O que faz |
| --- | --- |
| Candidaturas | Tabela ou lista com filtros (status, empresa, período, texto, arquivadas) e ordenação |
| Detalhe | Abas Linha do tempo, Dados da vaga, Contatos, Notas, Arquivos e Histórico de edições |
| Empresas e Contatos | Autocompletar e criação na hora; contatos ligados a candidaturas com papel (recrutador, gestor, entrevistador, indicação, referência) |
| Notas | Markdown com modelos, autosave e versões restauráveis; da candidatura, empresa, contato ou gerais |
| Lixeira | Itens excluídos por 30 dias, restauração e exclusão definitiva |
| Configurações | Backup, tema, etapas, listas editáveis, manutenção (reconstruir derivados e índice) |

## Cadastro rápido

**Ctrl+N** abre um diálogo de 4 campos: empresa, cargo, data e plataforma. **Enter** salva, **Ctrl+Enter** salva e abre o detalhe. “Mais detalhes” mostra o formulário completo, com a seção Avançado (faixa salarial com moeda e período, pretensão, competências, requisitos, descrição da vaga, visto, idioma). O app sugere a plataforma pela URL (análise local), avisa se já há candidaturas ativas na mesma empresa e mostra a completude do registro.

<img class="shot" src="/img/cadastro-rapido.png" alt="Diálogo de cadastro rápido com empresa, cargo, data e plataforma">

## Linha do tempo

Ações no detalhe: mudar etapa (**E**), interação recebida ou enviada (**I**), follow-up (**F**), feedback, anotação, pausar/retomar, encerrar com desfecho e motivo, reabrir, corrigir e anular eventos. Detalhes em [Linha do tempo](/dados/linha-do-tempo).

<img class="shot" src="/img/linha-do-tempo.png" alt="Detalhe de uma candidatura com a linha do tempo">

## Busca global

**Ctrl+K** abre a paleta de comandos com busca sem acentos em candidaturas, empresas, contatos, notas e nomes de anexos. Detalhes em [Busca](/dados/busca).

<img class="shot" src="/img/busca.png" alt="Paleta de busca Ctrl+K com resultados">

## Outras ações

- **Duplicar** e **candidatar de novo** (liga a nova candidatura à anterior por `previous_application_id`).
- **Arquivar**, **Lixeira** de 30 dias, **desfazer** por 10 s (**Ctrl+Z**).
- **Anexos** por arrastar, botão ou **Ctrl+V** de um print.
- **Backup** diário automático, manual, pasta extra, testar e restaurar.
- **Tema** claro, escuro ou seguindo o Windows.

<img class="shot" src="/img/backup-escuro.png" alt="Configurações com backup e etapas no tema escuro">
