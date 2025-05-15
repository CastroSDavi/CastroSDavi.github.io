from django.urls import path
from . import views

app_name = 'quiz'

urlpatterns = [
    path('', views.home_view, name='home'),
    path('questions/', views.questions_view, name='questions'),
    path('account/', views.account_view, name='account'),
    path('register/', views.register_view, name='register'), # Adicione esta linha
]