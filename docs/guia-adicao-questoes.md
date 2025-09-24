# Guia rapido para adicionar questoes ao MedQuiz

## Visao geral do fluxo de dados
- O conteudo oficial vive no banco (db.sqlite3) carregado pelas models Django (Pergunta, OpcaoResposta, Categoria).
- Os arquivos JSON em assets/data/ sao usados como fonte de dados externa para importacao em lote.
- O comando `python manage.py load_quiz_data` sincroniza os JSON com o banco usando o campo `codigo_importacao`.
- Para edicoes pontuais, use o painel `/admin/`; para cargas maiores, edite os arquivos e rode o comando de importacao.

## Campos obrigatorios e regras de negocio
### Categoria (`categorias.json` / admin > Categorias)
- `id_categoria`: identificador estavel; mantenha valores unicos.
- `nome_categoria`: texto exibido para o usuario.
- `id_categoria_pai`: opcional; define hierarquia (use `null` para raiz).
- Evite remover categorias ja usadas; prefira reatribuir perguntas ou descrever a mudanca no nome.

### Pergunta (`perguntas.json` / admin > Perguntas)
- `id_pergunta`: identificador estavel; vira `codigo_importacao`.
- `texto_pergunta`: obrigatorio; mantenha linguagem objetiva.
- `url_imagem`: opcional; precisa ser URL publica confiavel.
- `referencia_bibliografica`: opcional, recomendado para rastreabilidade.
- `categoria_ids`: lista de `id_categoria`; pelo menos um valor valido.
- `nivel_dificuldade`: valores aceitos `Facil`, `Medio`, `Dificil` (no admin sera exibido com acentos, mas o JSON aceita ASCII).
- `explicacao_resposta`: opcional, aparece nos feedbacks do usuario.
- `ativa`: opcional; `true` por padrao. Para pausar uma questao, troque para `false`.

### Opcao de resposta (`opcoes_resposta.json` / inline no admin)
- `id_opcao_resposta`: identificador estavel por opcao.
- `id_pergunta`: referencia a pergunta associada (deve existir em `perguntas.json`).
- `texto_opcao`: obrigatorio; evite duplicar textos.
- `eh_correta`: `true` para a alternativa correta; garanta pelo menos uma correta por pergunta.
- `ordem_exibicao`: inteiro (0,1,2,...) controla a ordem desejada.
- `feedback_opcao`: opcional; exibido apos a resposta do usuario.

## Fluxo rapido via painel administrativo
1. Ative o ambiente virtual: `.\venv\Scripts\Activate.ps1`.
2. Suba o servidor: `python manage.py runserver`.
3. Acesse `http://localhost:8000/admin/` e entre com seu usuario.
4. Em **Categorias**, crie ou edite as entradas necessarias (busca/autocomplete ajuda a evitar duplicatas).
5. Em **Perguntas**, clique **Adicionar** e preencha os campos obrigatorios.
6. Salve com **Salvar e continuar editando** para liberar as opcoes.
7. Inclua 3 a 5 opcoes na tabela inline, marcando ao menos uma como correta e definindo `ordem_exibicao` sequencial.
8. Salve a pergunta. Se `Ativa` estiver marcado, ela entra no quiz imediatamente.
9. Para criar uma variacao semelhante, abra a pergunta existente, ajuste os campos e use **Salvar como novo**.

## Fluxo em lote via arquivos JSON
1. Pare o servidor se estiver em execucao (`Ctrl + C`).
2. Edite `assets/data/categorias.json`, `perguntas.json` e `opcoes_resposta.json` mantendo indentacao de 2 espacos e formato UTF-8.
   - Copie um bloco existente como molde.
   - Atualize os identificadores (`id_categoria`, `id_pergunta`, `id_opcao_resposta`) com valores nunca usados.
   - Confirme que todas as referencias cruzadas sao validas.
3. Valide os arquivos com `python -m json.tool assets/data/perguntas.json` (repita para os demais).
4. Rode `python manage.py load_quiz_data`.
   - O comando exibe quantos registros foram criados, atualizados ou ignorados.
   - Qualquer erro cancela a importacao inteira para evitar dados inconsistentes.
5. Para recriar tudo do zero em um ambiente de teste, use `python manage.py load_quiz_data --purge` (cuidado: apaga dados atuais antes de importar).

## Pos-importacao e testes rapidos
- `python manage.py check`: valida configuracoes.
- `python manage.py test quiz`: opcional, roda testes focados no modulo.
- Acesse o quiz, filtre pela nova categoria/dificuldade e confirme que a questao aparece e registra respostas.
- No admin, verifique se `codigo_importacao` confere com o ID definido nos JSON.

## Boas praticas para ganhar velocidade
- **Padronize textos**: oracoes curtas, verbo na voz ativa, referencia bibliografica consistente.
- **Use planilha de apoio**: monte lotes em CSV/Sheets e converta para JSON com script simples (ex.: `pandas` ou `jq`).
- **Reaproveite feedbacks**: mantenha snippets prontos para comentarios recorrentes de erros.
- **Commits curtos**: suba alteracoes em blocos pequenos para facilitar revisao ou rollback.
- **Checklist final**: ID novo? Categoria valida? Opcao correta marcada? Pergunta ativa? Tudo OK? Execute a importacao.

## Onde buscar mais informacao
- `docs/dados.md`: guia do comando de importacao.
- `quiz/models.py`: descreve regras e choices disponiveis.
- `/admin/quiz/opcaoresposta/`: permite ajustes em massa nas opcoes.
- Historico do terminal: guarde a saida do comando de carga para auditoria rapida.
