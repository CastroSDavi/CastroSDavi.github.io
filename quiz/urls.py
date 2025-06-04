# quiz/urls.py
from django.urls import path
from . import views

app_name = 'quiz'

urlpatterns = [
    path('', views.home_view, name='home'),
    path('questions/', views.questions_view, name='questions'),
    path('account/', views.account_view, name='account'),
    path('register/', views.register_view, name='register'),

    # Novas URLs para gerenciamento de conta (já existentes no seu arquivo)
    path('account/update-profile/', views.update_profile_view, name='update_profile'),
    path('account/delete-account/', views.delete_account_view, name='delete_account'),

    # URLs existentes para a lógica do quiz (já existentes no seu arquivo)
    path('api/quiz/start-session/', views.start_quiz_session_view, name='start_quiz_session'),
    path('api/quiz/register-answer/', views.register_answer_view, name='register_answer'),
    path('api/quiz/end-session/', views.end_quiz_session_view, name='end_quiz_session'),

    # API para buscar todos os dados do quiz (já existente no seu arquivo)
    path('api/quiz/alldata/', views.api_get_quiz_data_view, name='api_get_quiz_data'),

    # NOVA URL para retomar uma sessão de quiz em andamento
    path('api/quiz/resume-session/', views.api_resume_quiz_session_view, name='api_resume_quiz_session'),

    # URLs existentes para favoritos e estatísticas (já existentes no seu arquivo)
    path('api/question/<int:pergunta_id>/toggle_favorite/', views.toggle_favorite_status_view, name='toggle_favorite_status'),
    path('api/favorites/', views.get_favorite_questions_view, name='get_favorite_questions'),
    path('api/user-statistics/', views.api_get_user_statistics_view, name='api_get_user_statistics'),
]