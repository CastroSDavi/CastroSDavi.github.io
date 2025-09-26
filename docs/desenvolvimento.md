# Desenvolvimento

## Estilos CSS

- `python manage.py runserver` (com `DEBUG=True`) inicia automaticamente um watcher que recompila `assets/css/style.bundle.css` sempre que qualquer arquivo `.css` em `assets/css` muda.
- Para ajustar a frequencia do watcher defina `CSS_BUNDLE_WATCH_INTERVAL` (ex.: `set CSS_BUNDLE_WATCH_INTERVAL=0.2`). Use `DISABLE_CSS_BUNDLE_WATCH=1` se quiser desativar esse comportamento automatico.
- Caso prefira executar manualmente, rode `python scripts/bundle_css.py` para uma compilacao unica ou adicione `--watch` para manter o monitoramento ativo.
- Recomendado manter o watcher manual apenas quando estiver trabalhando fora do Django (por exemplo, scripts rapidos) ou se precisar acompanhar os logs.

## Admin do Django

- Perguntas exibem contagem de opcoes, filtros por categoria principal e acoes em massa para ativar, desativar ou duplicar registros.
- A opcao de duplicacao copia categorias e opcoes existentes e marca a copia como inativa para revisao rapida.
- O inline de opcoes exige pelo menos duas alternativas e uma correta, evitando salvar perguntas incompletas.
- O campo de dificuldade usa botoes horizontais e o status ativo pode ser ajustado direto na lista, acelerando cadastros grandes.
