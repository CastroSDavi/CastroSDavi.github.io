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

## Documentação da API

- Execute `pip install drf-spectacular` (ou adicione o pacote ao gerenciador de dependências do projeto) para habilitar os recursos de documentação.
- Acesse `GET /api/schema/` para baixar o arquivo OpenAPI gerado automaticamente.
- Utilize `GET /api/docs/` para a interface interativa do Swagger UI e `GET /api/redoc/` para visualizar a documentação no formato ReDoc.
- Opcionalmente, gere um arquivo estático com `python manage.py spectacular --file schema.yml` caso precise versionar o esquema ou publicá-lo em outro local.
