# quiz/urls.py
from django.urls import include, path
from django.views.generic import RedirectView

from rest_framework.routers import DefaultRouter

from . import views
from .api.viewsets import (
    FavoriteQuestionViewSet,
    QuestionViewSet,
    QuizViewSet,
    UserStatisticsViewSet,
    UserQuestionHistoryViewSet,
)

app_name = 'quiz'

router = DefaultRouter()
router.register('api/quiz', QuizViewSet, basename='quiz')
router.register('api/favorites', FavoriteQuestionViewSet, basename='favorites')
router.register('api/question', QuestionViewSet, basename='question')
router.register('api/user-statistics', UserStatisticsViewSet, basename='user-statistics')
router.register('api/question-history', UserQuestionHistoryViewSet, basename='user-question-history')

urlpatterns = [
    path('', views.home_view, name='home'),
    path('hub/', views.challenge_hub_view, name='challenge_hub'),
    path('hub/perguntas/<slug:slug>/', views.question_detail_view, name='question_detail'),
    path('hub/desafios/<slug:slug>/', views.challenge_detail_view, name='challenge_detail'),
    path('questions/', RedirectView.as_view(pattern_name='quiz:challenge_hub', permanent=True)),
    path('account/', views.account_view, name='account'),
    path('register/', views.register_view, name='register'),

    # Novas URLs para gerenciamento de conta (já existentes no seu arquivo)
    path('account/update-profile/', views.update_profile_view, name='update_profile'),
    path('account/update-preferences/', views.update_preferences_view, name='update_preferences'),
    path('account/delete-account/', views.delete_account_view, name='delete_account'),

    path(
        'api/question/<int:pergunta_id>/toggle_favorite/',
        QuestionViewSet.as_view({'post': 'toggle_favorite'}),
        name='question-toggle_favorite',
    ),
    path('', include(router.urls)),
]