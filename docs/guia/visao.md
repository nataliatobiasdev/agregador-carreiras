# Produto e escopo

> “Eu encontro as vagas. Eu me candidato. Eu registro a candidatura. O aplicativo organiza, documenta, acompanha, lembra e analisa todo o restante.”

O **Career Application Manager (CAM)** é o sistema de registro de uma busca de emprego. A unidade central é a **candidatura**, e o histórico do processo é uma **linha do tempo de eventos** confirmados pela usuária. A V1.0 entrega o núcleo “registro confiável”: cadastro rápido, linha do tempo, notas, anexos, empresas, contatos, busca, Lixeira e backup verificável.

<div class="stats">
  <div><b>29</b><span>tabelas SQLite</span></div>
  <div><b>79</b><span>canais IPC tipados</span></div>
  <div><b>78</b><span>testes automatizados</span></div>
  <div><b>0</b><span>chamadas de rede</span></div>
</div>

## Fronteira do produto

| Dentro do escopo | Fora do escopo, por decisão de produto |
| --- | --- |
| Registro manual de candidaturas já feitas | Scraping, busca ou monitoramento de vagas |
| Acompanhamento por eventos datados, inclusive retroativos | Importação de vagas, inclusive do scraper que existe em paralelo |
| Notas, anexos, contatos, empresas | Catálogo ou triagem de vagas |
| Dados 100% locais, sem rede | Criar candidaturas ou presumir eventos automaticamente |

A fronteira é deliberada: o scraper de vagas é outro projeto. O CAM não tem nenhum código de rede de saída, e a sessão do Electron bloqueia qualquer requisição que não seja o próprio bundle (veja [Segurança](/arquitetura/seguranca)).

## Estado documentado

- Código: `main` após o merge do [PR #1](https://github.com/nataliatobiasdev/agregador-carreiras/pull/1), 16/11/2026.
- Alvo: Windows x64, instalação por usuário, sem administrador.
- Toda afirmação desta documentação vem do código ou do PR. Intenções futuras estão separadas no [Roadmap](/roadmap).

<img class="shot" src="/img/candidaturas.png" alt="Lista de candidaturas em tabela com filtros por status, empresa e período">
