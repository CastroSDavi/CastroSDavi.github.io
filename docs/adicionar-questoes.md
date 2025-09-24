# Guia para adicionar novas questões ao MedQuiz

Este guia explica como preparar os arquivos JSON e executar a importação das categorias, perguntas e opções de resposta utilizadas pelo MedQuiz. Ele complementa o comando `python manage.py load_quiz_data`, responsável por sincronizar os dados externos com o banco de dados da aplicação.

## Estrutura dos arquivos JSON

Os dados ficam em `assets/data/` e são divididos em três arquivos:

| Arquivo | Conteúdo | Campo de identificação |
| --- | --- | --- |
| `categorias.json` | Tópicos e subáreas do quiz | `id_categoria` |
| `perguntas.json` | Perguntas que os usuários responderão | `id_pergunta` |
| `opcoes_resposta.json` | Alternativas de cada pergunta | `id_opcao_resposta` |

Todos os registros precisam fornecer **IDs estáveis**, usados para relacionar as tabelas e evitar duplicação durante a importação. Estes identificadores são gravados no campo `codigo_importacao` de cada modelo Django.

### `categorias.json`

Cada objeto representa uma categoria. Campos aceitos:

| Campo | Obrigatório? | Descrição |
| --- | --- | --- |
| `id_categoria` | ✅ | Identificador único da categoria. Deve permanecer constante entre importações. |
| `nome_categoria` | ✅ | Nome exibido ao usuário. |
| `id_categoria_pai` | ⛔️ (opcional) | `id_categoria` da categoria pai. Use `null` para categorias de nível raiz. |
| `descricao_categoria` | ⛔️ | Texto livre com detalhes ou exemplos. |

> **Validação:** se uma categoria indicar um `id_categoria_pai`, este valor precisa existir no mesmo arquivo ou já estar cadastrado no banco.

#### Exemplo

```json
{
  "id_categoria": "ANAT-001",
  "nome_categoria": "Anatomia do Sistema Cardiovascular",
  "id_categoria_pai": "FISIO-ANAT",
  "descricao_categoria": "Estruturas anatômicas relacionadas ao coração e vasos sanguíneos."
}
```

### `perguntas.json`

Cada objeto descreve uma pergunta. Campos aceitos:

| Campo | Obrigatório? | Descrição |
| --- | --- | --- |
| `id_pergunta` | ✅ | Identificador único da pergunta. |
| `texto_pergunta` | ✅ | Enunciado mostrado no quiz. |
| `categoria_ids` | ✅ | Lista com pelo menos um `id_categoria` válido. |
| `nivel_dificuldade` | ⛔️ | Valor textual: `"Fácil"`, `"Médio"` ou `"Difícil"`. Se omitido, o padrão é `"Médio"`. |
| `url_imagem` | ⛔️ | URL pública para uma imagem ilustrativa. |
| `referencia_bibliografica` | ⛔️ | Fonte de estudo ou bibliografia. |
| `explicacao_resposta` | ⛔️ | Texto com feedback detalhado apresentado após a resposta. |
| `ativa` | ⛔️ | Define se a pergunta pode aparecer nas sessões (padrão: `true`). |

> **Validação:** se alguma categoria listada em `categoria_ids` não existir, a importação será interrompida.

#### Exemplo

```json
{
  "id_pergunta": "ANAT-001-Q01",
  "texto_pergunta": "Qual vaso leva sangue oxigenado do coração para o corpo inteiro?",
  "categoria_ids": ["ANAT-001"],
  "nivel_dificuldade": "Fácil",
  "referencia_bibliografica": "Moore, Anatomia Clínica, 8ª ed.",
  "explicacao_resposta": "A aorta é a principal artéria sistêmica, responsável por distribuir o sangue oxigenado."
}
```

### `opcoes_resposta.json`

Cada objeto representa uma alternativa da pergunta associada.

| Campo | Obrigatório? | Descrição |
| --- | --- | --- |
| `id_opcao_resposta` | ✅ | Identificador único da opção. |
| `id_pergunta` | ✅ | `id_pergunta` da pergunta vinculada. |
| `texto_opcao` | ✅ | Texto exibido para o usuário. |
| `eh_correta` | ⛔️ | Booleano que indica a alternativa correta (`true` / `false`). Padrão: `false`. |
| `ordem_exibicao` | ⛔️ | Número inteiro usado para ordenar a apresentação das opções. Se ausente, assume `0`. |
| `feedback_opcao` | ⛔️ | Comentário específico exibido após a resposta do usuário. |

> **Validação:** uma opção só pode ser importada se a pergunta indicada por `id_pergunta` existir.

#### Exemplo

```json
{
  "id_opcao_resposta": "ANAT-001-Q01-A",
  "id_pergunta": "ANAT-001-Q01",
  "texto_opcao": "Aorta",
  "eh_correta": true,
  "ordem_exibicao": 0,
  "feedback_opcao": "Correto! A aorta emerge do ventrículo esquerdo e distribui o sangue oxigenado pelo corpo."
}
```

## Passo a passo para adicionar novas questões

1. **Criar ou atualizar as categorias necessárias** no `categorias.json`. Certifique-se de definir `id_categoria_pai` apenas quando o pai existir.
2. **Adicionar as perguntas** no `perguntas.json`, informando pelo menos uma categoria e garantindo que o `id_pergunta` seja único.
3. **Inserir todas as opções correspondentes** no `opcoes_resposta.json`. Cada pergunta deve ter pelo menos uma opção marcada com `"eh_correta": true`.
4. **Validar o JSON** (estrutura, vírgulas e colchetes). Ferramentas online ou o comando `python -m json.tool caminho/arquivo.json` podem ajudar.
5. **Copiar os arquivos para `assets/data/`** dentro do projeto.
6. **Executar a importação**:
   ```bash
   python manage.py load_quiz_data
   ```
   O comando cria ou atualiza registros existentes, mantendo os identificadores externos.
7. **Verificar o resumo exibido no terminal**. Caso alguma referência esteja incorreta, o processo abortará com a mensagem de erro correspondente.
8. (Opcional) **Recriar completamente a base** quando necessário para ambientes de teste:
   ```bash
   python manage.py load_quiz_data --purge
   ```
   Essa opção apaga os dados atuais antes de recarregar tudo.

## Boas práticas

- Escolha identificadores legíveis: prefira códigos que indiquem a origem ou o tema (`"ANAT-001-Q05"` em vez de apenas números).
- Mantenha um arquivo de controle ou planilha externa para acompanhar quais perguntas já foram publicadas.
- Utilize `explicacao_resposta` e `feedback_opcao` para reforçar o aprendizado, oferecendo justificativas claras para acertos e erros.
- Teste a nova pergunta em um ambiente local antes de liberar em produção, garantindo que imagens e links funcionem corretamente.

Seguindo estes passos, novas questões podem ser integradas ao MedQuiz de forma consistente, segura e repetível.
