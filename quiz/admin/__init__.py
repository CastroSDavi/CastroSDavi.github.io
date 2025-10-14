"""MedQuiz admin module organized by domain."""

from django.contrib import admin

admin.site.site_header = "MedQuiz • Painel Administrativo"
admin.site.site_title = "MedQuiz | Administração"
admin.site.index_title = "Central de Gestão do MedQuiz"
admin.site.site_url = "/"
admin.site.enable_nav_sidebar = False
admin.site.empty_value_display = "—"

# Load registrations grouped by domain to keep the admin tidy.
from . import analytics, configuration, content, gamification, sessions, system  # noqa: E402,F401
