# Releases e deploys

Esta página reúne o histórico de entregas e publicações da documentação do CAM. A lista abaixo é um retrato consultado em **19/11/2026**; os links do GitHub mostram o histórico atualizado.

## Versões do aplicativo

O código declara a versão **1.0.0**. Em 19/11/2026, o repositório não tinha tags nem releases públicas do CAM. O CI Windows gera um instalador como artefato da execução; um artefato de CI não é uma release pública. As versões 1.7.x abaixo pertencem ao vagas1000, não ao CAM.

## Evolução da integração

| Entrega | Estado |
| --- | --- |
| CAM recebe oportunidades pendentes do vagas1000 | Integrado no [PR #9](https://github.com/nataliatobiasdev/agregador-carreiras/pull/9); a candidatura exige confirmação no CAM |
| vagas1000 1.5.1 | [Release](https://github.com/nataliatobiasdev/vagas-1000/releases/tag/v1.5.1) com o envio local ao CAM |
| vagas1000 1.6.0 | [Release](https://github.com/nataliatobiasdev/vagas-1000/releases/tag/v1.6.0) com marcadores de acompanhamento e atualização da aba LinkedIn |
| vagas1000 1.7.0 e 1.7.1 | Ampliação das fontes e feed parcial da GFT; detalhes nas [releases do vagas1000](https://github.com/nataliatobiasdev/vagas-1000/releases) |

- [Releases do CAM](https://github.com/nataliatobiasdev/agregador-carreiras/releases)
- [Execuções e artefatos do CI](https://github.com/nataliatobiasdev/agregador-carreiras/actions)
- [Integração com vagas1000 — PR #9](https://github.com/nataliatobiasdev/agregador-carreiras/pull/9)

## Publicações da documentação

O workflow **Docs** compila o VitePress e publica o resultado no GitHub Pages após alterações em `docs/` na `main`. A lista mostra execuções concluídas com sucesso, não versões do aplicativo.

| Data | Publicação | Execução |
| --- | --- | --- |
| 17/11/2026 | Integração com vagas1000 e identidade Nevora | [Ver deploy](https://github.com/nataliatobiasdev/agregador-carreiras/actions/runs/44168209872) |
| 16/11/2026 | Atualização da documentação e do roadmap | [Ver deploy](https://github.com/nataliatobiasdev/agregador-carreiras/actions/runs/43941853595) |
| 16/11/2026 | Ajuste da publicação no Pages | [Ver deploy](https://github.com/nataliatobiasdev/agregador-carreiras/actions/runs/43926955246) |
| 16/11/2026 | Publicação inicial do site | [Ver deploy](https://github.com/nataliatobiasdev/agregador-carreiras/actions/runs/43924783654) |

[Ver todas as execuções do Docs](https://github.com/nataliatobiasdev/agregador-carreiras/actions/workflows/docs.yml) · [Como funciona o CI](/qualidade/ci)
