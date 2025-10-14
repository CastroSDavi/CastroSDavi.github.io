# quiz/urls.py
from django.urls import include, path

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
    path('questions/', views.questions_view, name='questions'),
    path('questions/<int:pergunta_id>/', views.questions_view, name='question-detail-page'),
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
    path(
        'api/question/<int:pergunta_id>/report/',
        views.report_question_issue_view,
        name='question-report-issue',
    ),
    path(
        'api/support/requests/',
        views.submit_support_request_view,
        name='support-request',
    ),
    path('', include(router.urls)),
]
