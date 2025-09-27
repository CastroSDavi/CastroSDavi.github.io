# Score Panel Configuration

O painel de pontuação agora é controlado pelo campo `score_panel_config` do modelo
`ConfiguracoesGeraisQuiz`. Esse campo JSON permite definir, por modo de quiz, quais
indicadores devem aparecer e quais controles permanecem disponíveis para o usuário.

## Estrutura do JSON

O payload segue o formato abaixo:

```json
{
  "default": {
    "show_points": true,
    "show_correct": true,
    "show_incorrect": true,
    "show_streak": true,
    "show_multiplier": true,
    "show_timer": true,
    "allow_pause": true,
    "allow_manual_finish": true
  },
  "Por Categoria": { "allow_pause": false },
  "Rápido": { "show_timer": false },
  "Definido": {},
  "Revisão": { "show_timer": false, "allow_pause": false }
}
```

- A chave `default` serve como fallback para todos os modos.
- As chaves `Por Categoria`, `Rápido`, `Definido` e `Revisão` podem sobrescrever qualquer
  flag individualmente.
- Valores são coeridos para booleanos; strings como "sim"/"não" ou `1`/`0`
  também são aceitas.

### Modos adicionais (frontend)

Se existirem experiências de quiz que não criam uma sessão tradicional no
backend, mas precisam de regras próprias de painel (por exemplo a revisão de
favoritos), você pode cadastrá-las na configuração
`QUIZ_SCORE_PANEL_EXTRA_MODES` em `settings.py`. Cada item pode ser uma tupla
`("valor", "rótulo amigável")` ou apenas uma string. Esses modos adicionais
passam a aparecer automaticamente no Django Admin tanto nas configurações
globais quanto nas definições específicas de quiz.

## Flags disponíveis

| Flag                 | Efeito                                                                 |
|----------------------|------------------------------------------------------------------------|
| `show_points`        | Controla a visibilidade do contador de pontos.                         |
| `show_correct`       | Controla a visibilidade do total de acertos.                           |
| `show_incorrect`     | Controla a visibilidade do total de erros.                             |
| `show_streak`        | Controla a visibilidade da sequência atual de acertos.                 |
| `show_multiplier`    | Controla a exibição do multiplicador (requer `show_streak` habilitado).|
| `show_timer`         | Exibe ou oculta o cronômetro do quiz.                                  |
| `allow_pause`        | Habilita o botão de pausar/retomar (depende de `show_timer`).           |
| `allow_manual_finish`| Exibe o botão de encerrar sessão manualmente.                          |

## Fluxo de consumo

1. **Back-end**
   - `ConfiguracoesGeraisQuiz.get_score_panel_settings_for_mode()` resolve o
     conjunto final de flags por modo, fundindo `default` com as sobrescritas.
   - Os endpoints `start_session` e `resume_session` retornam `score_panel_settings`
     junto com os demais dados da sessão.
   - Quando a sessão é baseada em uma `QuizDefinicao`, os ajustes armazenados em
     `QuizDefinicao.score_panel_overrides` são mesclados sobre a configuração
     global, permitindo personalizar o painel para cada quiz definido.

2. **Front-end**
   - O reducer armazena `quiz.scorePanelSettings` durante a inicialização ou
     retomada de sessão.
   - O componente `ScorePanel` aplica as flags para mostrar/ocultar elementos,
     incluindo o cronômetro, botões de pausa e finalizar sessão.

## Migrações

- `0012_configuracoesgeraisquiz_score_panel_config` adiciona o novo campo JSON.
- `0013_alter_respostasusuarioporsessao_data_resposta` atualiza o campo
  `data_resposta` para `DateTimeField` com `timezone.now` como default, permitindo
  granularidade de horário nas respostas.
- `0015_quizdefinicao_score_panel_overrides` adiciona ajustes específicos por
  definição de quiz para o painel lateral.

Certifique-se de rodar `python manage.py migrate` após atualizar o código.
