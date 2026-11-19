# Career Application Manager

O CAM é um aplicativo desktop para Windows que registra candidaturas e acompanha processos seletivos em dados locais. O renderer React acessa operações do processo principal Electron por uma ponte IPC; o armazenamento é SQLite e arquivos no dispositivo. A integração opcional com o vagas1000 usa uma tabela no banco do CAM, não um serviço de rede.

**Linha de base auditada:** `main` no commit [`511dacd`](https://github.com/nataliatobiasdev/agregador-carreiras/tree/511dacd12eeaaf47eefa418dcd9f8475d9488b70), pacote `1.0.0`, em 19/11/2026. Esta documentação descreve o código observado nessa revisão; planos de produto não são tratados como recursos implementados.

| Seção | Conteúdo |
| --- | --- |
| [Visões estruturais](/architecture/) | Contexto C4, contêineres e sequência em D2 |
| [Contratos e dados](/contratos) | IPC, fronteiras de confiança e persistência |
| [Build e operação](/operacao) | Inicialização, distribuição, backup e limites |
| [Decisões arquiteturais](/adr/) | ADRs retrospectivos, separados das visões |

[Código-fonte](https://github.com/nataliatobiasdev/agregador-carreiras) · [Releases](https://github.com/nataliatobiasdev/agregador-carreiras/releases) · [Documentação do vagas1000](https://nataliatobiasdev.github.io/vagas-1000/)
