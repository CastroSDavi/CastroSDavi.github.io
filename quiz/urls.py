# quiz/urls.py
from django.urls import path
from . import views

app_name = 'quiz'

urlpatterns = [
    path('', views.home_view, name='home'),
    path('questions/', views.questions_view, name='questions'),
    path('account/', views.account_view, name='account'),
    path('register/', views.register_view, name='register'),

    # NOVAS URLs PARA A LÓGICA DO QUIZ
    path('api/quiz/start-session/', views.start_quiz_session_view, name='start_quiz_session'),
    path('api/quiz/register-answer/', views.register_answer_view, name='register_answer'),
    path('api/quiz/end-session/', views.end_quiz_session_view, name='end_quiz_session'),
]