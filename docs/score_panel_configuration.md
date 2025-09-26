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
  "Definido": {}
}
```

- A chave `default` serve como fallback para todos os modos.
- As chaves `Por Categoria`, `Rápido` e `Definido` podem sobrescrever qualquer
  flag individualmente.
- Valores são coeridos para booleanos; strings como "sim"/"não" ou `1`/`0`
  também são aceitas.

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

Certifique-se de rodar `python manage.py migrate` após atualizar o código.
