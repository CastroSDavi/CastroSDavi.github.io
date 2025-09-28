"""MedQuiz admin module organized by domain."""

from django.contrib import admin

admin.site.site_header = "MedQuiz Admin"
admin.site.site_title = "MedQuiz Administração"
admin.site.index_title = "Gestão de Conteúdo"

# Load registrations grouped by domain to keep the admin tidy.
from . import analytics, configuration, content, gamification, sessions, system  # noqa: E402,F401
