# Produto e escopo

> “Eu encontro as vagas. Eu me candidato. Eu registro a candidatura. O aplicativo organiza, documenta, acompanha, lembra e analisa todo o restante.”

O **Career Application Manager (CAM)** é o sistema de registro de uma busca de emprego. A unidade central é a **candidatura**, e o histórico do processo é uma **linha do tempo de eventos** confirmados pela usuária. A V1.0 entrega o núcleo “registro confiável”: cadastro rápido, linha do tempo, notas, anexos, empresas, contatos, busca, Lixeira e backup verificável.

<div class="stats">
  <div><b>Local</b><span>dados em SQLite</span></div>
  <div><b>Tipado</b><span>comunicação IPC</span></div>
  <div><b>Testado</b><span>CI automatizado</span></div>
  <div><b>Offline</b><span>dados no dispositivo</span></div>
</div>

## Fronteira do produto

| Dentro do escopo | Fora do escopo, por decisão de produto |
| --- | --- |
| Registro manual de candidaturas já feitas | Scraping, busca ou monitoramento de vagas |
| Vagas recebidas localmente do vagas1000, pendentes de candidatura | Enviar candidaturas a sites de emprego |
| Acompanhamento por eventos datados, inclusive retroativos | Catálogo geral ou busca externa de vagas |
| Notas, anexos, contatos, empresas | Comunicação automática com recrutadores |
| Dados 100% locais, sem rede | Criar candidaturas ou presumir eventos automaticamente |

A coleta de vagas pertence ao vagas1000. A integração grava uma oportunidade pendente no banco local do CAM; registrar uma candidatura continua sendo uma ação da usuária. O CAM mantém a sessão do Electron sem requisições de rede ao conteúdo externo (veja [Segurança](/arquitetura/seguranca)).

## Estado documentado

- Código: V1.0 do [PR #1](https://github.com/nataliatobiasdev/agregador-carreiras/pull/1), Nevora do [PR #5](https://github.com/nataliatobiasdev/agregador-carreiras/pull/5), ícone do [PR #7](https://github.com/nataliatobiasdev/agregador-carreiras/pull/7) e integração com vagas1000 do [PR #9](https://github.com/nataliatobiasdev/agregador-carreiras/pull/9).
- Alvo: Windows x64, instalação por usuário, sem administrador.
- Toda afirmação desta documentação vem do código ou dos PRs mesclados. O que ainda é plano aparece com o selo <span class="tag plan">planejado</span> e fica no [Roadmap](/roadmap) e nas páginas de [Rotina diária](/planejado/rotina) e [Jornada](/planejado/jornada).

<img class="shot" src="/img/candidaturas.png" alt="Lista de candidaturas em tabela com filtros por status, empresa e período">
