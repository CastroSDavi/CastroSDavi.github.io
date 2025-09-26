import logging
import os
import sys
import threading

from django.apps import AppConfig
from django.conf import settings

_CSS_WATCHER_STARTED = False


class QuizConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'quiz'

    def ready(self):
        # Importa sinais que garantem a criacao de preferencias padrao para cada usuario.
        from . import signals  # noqa: F401

        self._start_css_bundle_watcher()

    def _start_css_bundle_watcher(self) -> None:
        global _CSS_WATCHER_STARTED

        if _CSS_WATCHER_STARTED:
            return
        if not settings.DEBUG:
            return
        if os.environ.get('DISABLE_CSS_BUNDLE_WATCH') == '1':
            return
        if 'runserver' not in sys.argv:
            return
        if os.environ.get('RUN_MAIN') != 'true':
            # Evita disparar o watcher duas vezes quando o autoreloader do Django inicia.
            return

        interval = float(os.environ.get('CSS_BUNDLE_WATCH_INTERVAL', '0.5'))

        def _worker() -> None:
            logger = logging.getLogger(__name__)
            try:
                from scripts import bundle_css

                bundle_css.watch(interval=interval, quiet=True)
            except Exception:  # pragma: no cover - defesa extra
                logger.exception('CSS bundle watcher stopped unexpectedly.')

        watcher_thread = threading.Thread(target=_worker, name='css-bundle-watcher', daemon=True)
        watcher_thread.start()

        logging.getLogger(__name__).info('CSS bundle watcher started (interval=%ss).', interval)
        _CSS_WATCHER_STARTED = True
