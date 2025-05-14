# quiz/urls.py
from django.urls import path
from . import views

app_name = 'quiz'  # Namespace para as URLs da app

urlpatterns = [
    path('', views.home_view, name='home'),
    path('questions/', views.questions_view, name='questions'),
    path('account/', views.account_view, name='account'),
]