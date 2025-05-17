# quiz/urls.py
from django.urls import path
from . import views

app_name = 'quiz'

urlpatterns = [
    path('', views.home_view, name='home'),
    path('questions/', views.questions_view, name='questions'),
    path('account/', views.account_view, name='account'),
    path('register/', views.register_view, name='register'),

    # URLs existentes para a lógica do quiz
    path('api/quiz/start-session/', views.start_quiz_session_view, name='start_quiz_session'),
    path('api/quiz/register-answer/', views.register_answer_view, name='register_answer'),
    path('api/quiz/end-session/', views.end_quiz_session_view, name='end_quiz_session'),

    # NOVA URL para buscar todos os dados do quiz
    path('api/quiz/alldata/', views.api_get_quiz_data_view, name='api_get_quiz_data'),
    path('api/question/<int:pergunta_id>/toggle_favorite/', views.toggle_favorite_status_view, name='toggle_favorite_status'),
    path('api/favorites/', views.get_favorite_questions_view, name='get_favorite_questions'),
]