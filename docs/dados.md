# Importação de dados do quiz

Este documento descreve como preparar e executar o carregamento de dados externos nas tabelas de categorias, perguntas e opções de resposta.

## Preparando os arquivos JSON

1. Reúna os arquivos `categorias.json`, `perguntas.json` e `opcoes_resposta.json` no diretório `assets/data/` do projeto.
2. Cada registro **precisa** conter os campos de identificador externo:
   - `id_categoria` em `categorias.json`.
   - `id_pergunta` em `perguntas.json`.
   - `id_opcao_resposta` em `opcoes_resposta.json`.
3. Utilize esses identificadores para relacionar os dados:
   - `categorias.json` pode referenciar `id_categoria_pai` quando existir uma hierarquia.
   - `perguntas.json` deve preencher `categoria_ids` com uma lista de `id_categoria` válidos.
   - `opcoes_resposta.json` deve informar `id_pergunta` correspondente.
4. Revise os arquivos antes da importação. Caso uma pergunta referencie uma categoria inexistente ou uma opção não encontre a pergunta associada, a importação será interrompida com erro.

## Executando a importação

Use o comando de management:

```bash
python manage.py load_quiz_data
```

O processo lê os arquivos JSON e aplica `update_or_create` em todos os modelos usando o campo `codigo_importacao`. O resumo final informa quantos registros foram criados, atualizados ou mantidos sem alterações.

### Quando utilizar `--purge`

Por padrão, o comando mantém os dados existentes e apenas atualiza ou insere registros conforme o identificador externo. Caso seja necessário recriar completamente o conjunto (por exemplo, ao trabalhar com uma base de teste isolada), utilize:

```bash
python manage.py load_quiz_data --purge
```

A opção remove todas as categorias, perguntas e opções antes da importação. Use-a com cuidado, pois o conteúdo anterior será perdido.

## Campo `codigo_importacao`

Os modelos `Categoria`, `Pergunta` e `OpcaoResposta` possuem o campo `codigo_importacao`, que armazena o identificador externo fornecido nos arquivos JSON. Esse campo é:

- Único, garantindo que cada registro represente exatamente um item externo.
- Indexado, acelerando buscas durante o carregamento.
- Populado automaticamente em registros antigos através das migrations, usando o `pk` como valor inicial.

Graças a esse campo, o comando `load_quiz_data` se torna idempotente: rodadas subsequentes da importação atualizam os registros existentes sem criar duplicatas, desde que o identificador externo seja preservado.

## Populando dados de gamificação

Para facilitar os testes dos recursos de gamificação, o projeto inclui uma migration (`0012_seed_gamification_data`) e um comando de management que inserem níveis com recompensas, conquistas e desafios dinâmicos de demonstração.

Após aplicar as migrations execute:

```bash
python manage.py seed_gamification_data
```

O comando cria ou atualiza os registros sem gerar duplicatas e apresenta um resumo com o que foi inserido, atualizado ou mantido. Caso deseje reiniciar completamente os dados de gamificação, utilize a opção `--purge`:

```bash
python manage.py seed_gamification_data --purge
```

Esse utilitário é útil para restaurar o banco de dados para um estado conhecido durante testes locais ou demonstrações.
