# medquiz_project/urls.py
from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views # Importe as views de autenticação
from quiz.forms import CustomAuthenticationForm # Importe seu formulário personalizado

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('quiz.urls')),

    # Modifique a URL de login para usar o formulário personalizado
    path('accounts/login/', auth_views.LoginView.as_view(
        template_name='registration/login.html',
        authentication_form=CustomAuthenticationForm # Especifica o formulário personalizado
    ), name='login'),

    path('accounts/', include('django.contrib.auth.urls')), # Mantenha as outras URLs de autenticação
]