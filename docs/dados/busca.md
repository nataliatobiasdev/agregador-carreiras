# Busca

A busca global (**Ctrl+K**) usa uma tabela virtual FTS5 do SQLite.

```sql
CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type UNINDEXED,
  entity_id UNINDEXED,
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);
```

| Aspecto | Implementação |
| --- | --- |
| Acentos | `remove_diacritics 2`: “sao paulo” encontra “São Paulo” |
| O que é indexado | Candidaturas (cargo, empresa, descrição, requisitos, competências, cidade, país), empresas, contatos, notas e nomes de anexos |
| Consistência | Os services atualizam o índice na mesma transação de cada escrita; item excluído sai do índice |
| Reparação | “Reconstruir índice” em Configurações recria tudo |
| Consulta segura | Cada palavra vira um termo entre aspas com prefixo (`"pala"*`); sintaxe FTS5 digitada não quebra a consulta |
| Ranking | `bm25` com peso 5 no título e 1 no corpo |
| Trecho | `snippet()` com destaque `«…»` |
| Interface | Paleta `cmdk` que mistura resultados e comandos |

<img class="shot" src="/img/busca.png" alt="Paleta de busca com resultados">

## Limitações

- O conteúdo dos anexos não é indexado, só o nome.
- Sem busca por sinônimos ou erros de digitação.
