# Guia rapido para adicionar questoes ao MedQuiz

## Visao geral do fluxo de dados
- O conteudo oficial vive no banco (db.sqlite3) carregado pelas models Django (Pergunta, OpcaoResposta, Categoria).
- Os arquivos JSON em ssets/data/ sao usados como fonte de dados externa para importacao em lote.
- O comando python manage.py load_quiz_data sincroniza os JSON com o banco usando codigo_importacao.
- Para edicoes pontuais, usar o painel /admin/ evita mexer nos JSON; para cargas maiores, edite os arquivos e rode o comando.

## Campos obrigatorios e regras de negocio
### Categoria (categorias.json / admin > Categorias)
- id_categoria: identificador estavel; mantenha valores unicos.
- 
ome_categoria: texto exibido para o usuario.
- id_categoria_pai: opcional; define hierarquia (use 
ull para raiz).
- Evite remover categorias ja usadas por perguntas; desligue-as mudando o nome ou reatribuindo perguntas antes.

### Pergunta (perguntas.json / admin > Perguntas)
- id_pergunta: identificador estavel; vira codigo_importacao.
- 	exto_pergunta: obrigatorio; mantenha linguagem objetiva.
- url_imagem: opcional; precisa ser URL publica.
- eferencia_bibliografica: opcional, recomendado.
- categoria_ids: lista de id_categoria; pelo menos uma.
- 
ivel_dificuldade: valores aceitos Facil, Medio, Dificil (sensivel a acentuacao se usar admin).
- explicacao_resposta: opcional, aparece nos feedbacks.
- tiva: opcional; 	rue por padrao. Desligue perguntas reprovadas marcando alse.

### Opcao de resposta (opcoes_resposta.json / inline no admin)
- id_opcao_resposta: identificador estavel por opcao.
- id_pergunta: referencia a pergunta associada.
- 	exto_opcao: obrigatorio; evite textos duplicados.
- eh_correta: 	rue para a resposta correta; garanta ao menos uma correta por pergunta.
- ordem_exibicao: inteiro (0,1,2,...) controla a ordem quando exibido.
- eedback_opcao: opcional; exibido apos a escolha do usuario.

## Fluxo rapido via painel administrativo
1. Ative o ambiente virtual: .\nvenv\Scripts\Activate.ps1.
2. Suba o servidor: python manage.py runserver.
3. Acesse http://localhost:8000/admin/ e entre com seu usuario.
4. Cadastre ou revise categorias em **Categorias**; use busca/autocomplete para evitar duplicatas.
5. Em **Perguntas** clique **Adicionar**:
   - Preencha pergunta, dificuldade, categorias e campos opcionais.
   - Salve para criar (Salvar e continuar editando).
   - Adicione 3-5 opcoes na area inline, marcando uma delas como correta.
6. Revise com Salvar. A pergunta passa a aparecer imediatamente no quiz se Ativa.
7. Para edicao rapida, use o filtro por dificuldade/categoria e o botao "Duplicar" (chaves de acao no topo) quando existir; atualize IDs e textos antes de salvar.

## Fluxo em lote via arquivos JSON
1. Pare o servidor se estiver rodando (Ctrl + C).
2. Edite os arquivos em ssets/data/ respeitando o formato JSON (UTF-8, 2 espaços de indentacao):
   - Copie um bloco existente como modelo.
   - Atualize id_* para valores novos; recomenda-se numeracao sequencial.
   - Confirme que cada pergunta citada em opcoes_resposta.json existe em perguntas.json.
3. Salve os arquivos e valide sintaxe com python -m json.tool assets/data/perguntas.json (repita para os demais).
4. Execute python manage.py load_quiz_data.
   - O comando mostra quantos registros foram criados/atualizados/ignorados.
   - Em caso de erro, a transacao eh revertida; corrija e execute novamente.
5. Se precisar reiniciar tudo (apenas para ambientes de teste!) use python manage.py load_quiz_data --purge.

## Pos-importacao e testes
- Rode python manage.py check para garantir que nao ha configuracoes invalidas.
- Opcional: python manage.py test quiz valida regras principais.
- Abra o site local (/quiz/ ou fluxo principal) e filtre pela categoria/dificuldade da nova pergunta para confirmar exibicao.
- No admin, refresque a pergunta para checar que codigo_importacao recebeu o id_* informado.

## Boas praticas para acelerar o trabalho
- **Padronize textos**: mantenha voz ativa e comprimento similar; evite ganchos muito longos.
- **Planilha de apoio**: mantenha colunas id_pergunta, 	exto, categoria, dificuldade, eferencia, imagem. Gere JSON via template ou script rapido quando tiver muitas questoes.
- **Reuso de feedback**: armazene feedbacks frequentes (p. ex. confusoes comuns) para copiar/colar.
- **Controle de versao**: ao trabalhar com JSON, crie commits pequenos para facilitar rollback.
- **Checklist final**: ID novo? Categoria valida? Opcao correta marcada? Pergunta ativa? Tudo ok = importar.

## Recursos uteis
- Documentacao de dados: docs/dados.md (explica o comando de importacao).
- Modelos de referencia: quiz/models.py mostra validacoes e choices disponiveis.
- Painel /admin/quiz/opcaoresposta/ permite editar opcoes em massa caso necessario.
- Logs de importacao ficam no terminal; mantenha a saida para auditoria rapida.
