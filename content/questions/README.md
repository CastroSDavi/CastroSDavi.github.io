# Banco de perguntas (fonte unica)

Este diretorio concentra a fonte consolidada das perguntas. A edicao diaria acontece em `banco_perguntas.json`, onde cada pergunta ja traz suas opcoes e metadados.

## Como adicionar ou alterar perguntas

1. Abra `content/questions/banco_perguntas.json`.
2. Localize a secao `"questions"` e duplique um bloco existente ou adicione um novo objeto ao final.
3. Preencha:
   - `texto`, `referencia_bibliografica`, `nivel_dificuldade`, `explicacao_resposta` e `ativa` (opcional, padrao `true`).
   - `categorias`: use os slugs listados em `categorias_slugs.json` (pode usar multiplos). O script converte automaticamente para os IDs usados pela aplicacao.
   - `options`: mantenha a lista na ordem desejada e informe `texto` + `correta`. IDs e ordem sao recalculados automaticamente se forem omitidos.
4. Execute o comando de build para gerar os arquivos normalizados consumidos pelo front-end:

```bash
python scripts/build_question_assets.py build
```

Os arquivos `assets/data/perguntas.json` e `assets/data/opcoes_resposta.json` serao sobrescritos com base no conteudo consolidado.

## Atualizando o arquivo consolidado a partir dos JSONs atuais

Se precisar reconstruir `banco_perguntas.json` a partir dos arquivos normalizados (ex.: apos receber um dump externo), use:

```bash
python scripts/build_question_assets.py export-source
```

## Mapeamento de categorias

O arquivo `categorias_slugs.json` mantem o mapeamento slug -> ID. Sempre que voce executa qualquer subcomando do script o arquivo e atualizado (novas categorias recebem um slug gerado automaticamente).

## Validacoes automaticas

- IDs de perguntas e de opcoes sao gerados se voce deixar os campos vazios.
- A ordem das opcoes acompanha a posicao na lista.
- Categorias invalidas acionam uma mensagem de erro, evitando que dados inconsistentes cheguem aos JSONs finais.
